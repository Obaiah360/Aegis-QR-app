// @ts-nocheck
// deno-lint-ignore-file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Typed enhancement output ──────────────────────────────────────────────────
interface EnhancementResult {
  summary: string;
  key_points: string[];
  document_type: string;
  sentiment: "positive" | "neutral" | "negative";
  language: string;
  word_count_estimate: number;
  topics: string[];
  action_items: string[];
  enhanced_content: string;
  improvement_suggestions: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/**
 * File types Gemini 1.5 Flash can read natively.
 * PDFs and images are sent as inline_data (base64).
 * Plain text / markdown are sent as a text part.
 */
const SUPPORTED_TYPES: Record<string, string> = {
  "application/pdf":  "application/pdf",
  "image/png":        "image/png",
  "image/jpeg":       "image/jpeg",
  "image/webp":       "image/webp",
  "image/gif":        "image/gif",
  "text/plain":       "text/plain",
  "text/markdown":    "text/plain",
};

const TEXT_TYPES = new Set(["text/plain", "text/markdown"]);

/** Prompt asking Gemini to return structured JSON enhancement data */
const buildPrompt = (filename: string) => `
You are an expert document analyst. Analyse the provided document thoroughly.
Return ONLY a valid JSON object — no markdown fences, no explanation — with this exact shape:

{
  "summary": "2–3 sentence plain-English summary",
  "key_points": ["point 1", "point 2", "..."],
  "document_type": "Invoice | Contract | Resume | Report | Letter | Article | Other",
  "sentiment": "positive | neutral | negative",
  "language": "detected ISO language name, e.g. English",
  "word_count_estimate": 0,
  "topics": ["topic 1", "topic 2"],
  "action_items": ["action 1", "..."],
  "enhanced_content": "Full document text rewritten with corrected grammar, improved clarity, and better structure — preserving original meaning exactly.",
  "improvement_suggestions": ["suggestion 1", "suggestion 2"]
}

Document filename: "${filename}"`.trim();

// ── Handler ───────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // These are declared outside try so the catch block can reach them
  let document_id: string | undefined;
  let supabase: ReturnType<typeof createClient> | undefined;

  try {
    // ── 1. Parse body ─────────────────────────────────────────────────────────
    ({ document_id } = await req.json());
    if (!document_id) return jsonRes({ error: "document_id is required" }, 400);

    // ── 2. Init Supabase (service role for storage + DB writes) ───────────────
    supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── 3. Authenticate the caller ────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonRes({ error: "Unauthorized" }, 401);

    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !user) return jsonRes({ error: "Unauthorized" }, 401);

    // ── 4. Fetch document record ──────────────────────────────────────────────
    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("id, display_name, file_path, file_type, owner_id, ai_processing_status")
      .eq("id", document_id)
      .single();

    if (docErr || !doc) return jsonRes({ error: "Document not found" }, 404);

    // ── 5. Ownership check ────────────────────────────────────────────────────
    if (doc.owner_id !== user.id) return jsonRes({ error: "Forbidden" }, 403);

    // ── 6. Idempotency guard ──────────────────────────────────────────────────
    if (doc.ai_processing_status === "enhancing") {
      return jsonRes({ error: "Document is already being processed" }, 409);
    }
    if (doc.ai_processing_status === "completed") {
      return jsonRes({ error: "Document is already enhanced" }, 409);
    }

    // ── 7. Guard unsupported types before we do any heavy work ────────────────
    if (!SUPPORTED_TYPES[doc.file_type]) {
      return jsonRes(
        { error: `Unsupported file type: ${doc.file_type}. Supported: ${Object.keys(SUPPORTED_TYPES).join(", ")}` },
        415
      );
    }

    // ── 8. Lock the row ───────────────────────────────────────────────────────
    await supabase
      .from("documents")
      .update({ ai_processing_status: "enhancing" })
      .eq("id", document_id);

    // ── 9. Verify Gemini key ──────────────────────────────────────────────────
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      await supabase.from("documents")
        .update({ ai_processing_status: "failed" }).eq("id", document_id);
      return jsonRes({ error: "AI service not configured" }, 503);
    }

    // ── 10. Download the actual file from Supabase Storage ────────────────────
    const { data: fileBlob, error: fileErr } = await supabase.storage
      .from("documents")          // <-- your bucket name; change if different
      .download(doc.file_path);

    if (fileErr || !fileBlob) {
      await supabase.from("documents")
        .update({ ai_processing_status: "failed" }).eq("id", document_id);
      return jsonRes({ error: `Failed to download file: ${fileErr?.message}` }, 500);
    }

    const arrayBuffer = await fileBlob.arrayBuffer();

    // ── 11. Build the Gemini content parts ────────────────────────────────────
    //   • Text files  → send raw text (avoids base64 overhead, better tokenisation)
    //   • Everything else → send as base64 inline_data (Gemini multimodal)
    let contentParts: unknown[];

    if (TEXT_TYPES.has(doc.file_type)) {
      const text = new TextDecoder().decode(new Uint8Array(arrayBuffer));
      contentParts = [
        { text: buildPrompt(doc.display_name) },
        { text },
      ];
    } else {
      const base64 = btoa(
        String.fromCharCode(...new Uint8Array(arrayBuffer))
      );
      contentParts = [
        { text: buildPrompt(doc.display_name) },
        { inline_data: { mime_type: SUPPORTED_TYPES[doc.file_type], data: base64 } },
      ];
    }

    // ── 12. Call Gemini ───────────────────────────────────────────────────────
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: contentParts }],
          generationConfig: {
            temperature: 0.2,       // low temp → consistent structured output
            maxOutputTokens: 8192,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const detail = await geminiRes.text();
      console.error("Gemini error:", detail);
      await supabase.from("documents")
        .update({ ai_processing_status: "failed" }).eq("id", document_id);
      return jsonRes({ error: "AI processing failed", detail }, 502);
    }

    const geminiData = await geminiRes.json();
    const rawText: string =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // ── 13. Parse the JSON the model returned ─────────────────────────────────
    let enhancement: Partial<EnhancementResult> = {};
    try {
      const clean = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      enhancement = JSON.parse(clean);
    } catch {
      // If the model didn't return clean JSON, salvage what we can
      console.warn("Could not parse Gemini JSON — storing raw text");
      enhancement = { summary: rawText, enhanced_content: rawText };
    }

    // ── 14. Persist all enriched fields ──────────────────────────────────────
    await supabase
      .from("documents")
      .update({
        // Core enhancement
        ai_extracted_text:         enhancement.enhanced_content ?? rawText,
        ai_summary:                enhancement.summary,

        // Structured metadata (store as JSONB / text[] depending on your schema)
        ai_key_points:             enhancement.key_points             ?? [],
        ai_topics:                 enhancement.topics                  ?? [],
        ai_action_items:           enhancement.action_items            ?? [],
        ai_improvement_suggestions: enhancement.improvement_suggestions ?? [],

        // Scalar metadata
        ai_document_type:          enhancement.document_type,
        ai_sentiment:              enhancement.sentiment,
        ai_language:               enhancement.language,
        ai_word_count_estimate:    enhancement.word_count_estimate,

        // Status
        ai_enhanced:               true,
        ai_processing_status:      "completed",
        ai_processed_at:           new Date().toISOString(),
      })
      .eq("id", document_id);

    // ── 15. Return a useful summary to the caller ─────────────────────────────
    return jsonRes({
      success: true,
      document_id,
      document_type:          enhancement.document_type,
      summary:                enhancement.summary,
      key_points:             enhancement.key_points,
      topics:                 enhancement.topics,
      action_items:           enhancement.action_items,
      improvement_suggestions: enhancement.improvement_suggestions,
      sentiment:              enhancement.sentiment,
      language:               enhancement.language,
      word_count_estimate:    enhancement.word_count_estimate,
    });

  } catch (e) {
    console.error("Unhandled error:", e);

    // Safe best-effort status update — document_id is in outer scope
    if (supabase && document_id) {
      await supabase
        .from("documents")
        .update({ ai_processing_status: "failed" })
        .eq("id", document_id)
        .catch(() => {});  // never throw from catch
    }

    return jsonRes({ error: e?.message ?? "Internal server error" }, 500);
  }
});
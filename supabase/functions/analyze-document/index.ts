// @ts-nocheck
// deno-lint-ignore-file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface AnalysisResult {
  classification: string;
  confidence: "high" | "medium" | "low";
  extracted_text: string;
  summary: string;
  key_fields: Record<string, string>;   // e.g. { "Name": "John", "DOB": "1990-01-01" }
  language: string;
  tags: string[];
  is_expired: boolean | null;           // for identity/travel docs
  sensitive_data_detected: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/**
 * Fallback classifier — runs from filename alone when the file
 * cannot be downloaded or Gemini is unavailable.
 */
function classifyByName(name: string, ext: string): string {
  const lower = name.toLowerCase();
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
    if (lower.includes("passport") || lower.includes("id") || lower.includes("license")) return "identity";
    if (lower.includes("medical") || lower.includes("health") || lower.includes("prescription")) return "medical";
    return "image";
  }
  if (lower.includes("resume") || lower.includes("cv")) return "resume";
  if (lower.includes("passport") || lower.includes("visa") || lower.includes("ticket")) return "travel";
  if (lower.includes("medical") || lower.includes("health") || lower.includes("prescription")) return "medical";
  if (lower.includes("invoice") || lower.includes("receipt") || lower.includes("bank")) return "financial";
  if (lower.includes("contract") || lower.includes("agreement") || lower.includes("legal")) return "legal";
  if (lower.includes("id") || lower.includes("license") || lower.includes("certificate")) return "identity";
  return "general";
}

/**
 * File types Gemini 1.5 Flash can read natively.
 * Text files are decoded and sent as plain text parts.
 * Everything else is base64 inline_data (multimodal).
 */
const SUPPORTED_MIME: Record<string, string> = {
  "application/pdf": "application/pdf",
  "image/png":       "image/png",
  "image/jpeg":      "image/jpeg",
  "image/webp":      "image/webp",
  "image/gif":       "image/gif",
  "text/plain":      "text/plain",
  "text/markdown":   "text/plain",
};

const TEXT_TYPES = new Set(["text/plain", "text/markdown"]);

/** Strict JSON prompt — model must return only the contract, nothing else */
const buildPrompt = (filename: string) => `
You are a document analysis expert with OCR capability.
Carefully read the full document provided and return ONLY a valid JSON object
— no markdown fences, no commentary — with this exact shape:

{
  "classification": "identity | medical | resume | travel | financial | legal | image | general",
  "confidence": "high | medium | low",
  "extracted_text": "Every word of text visible in the document, verbatim",
  "summary": "2-3 sentence plain-English description of what this document is",
  "key_fields": {
    "FieldName": "value"
  },
  "language": "Detected language name e.g. English",
  "tags": ["tag1", "tag2"],
  "is_expired": null,
  "sensitive_data_detected": false
}

Rules:
- "classification" must be exactly one of the listed values.
- "key_fields" should capture the most important structured data
  (e.g. for a passport: Name, DOB, Passport Number, Expiry;
       for an invoice: Invoice Number, Date, Total, Vendor;
       for a resume: Name, Email, Skills).
- "is_expired" — set to true/false only if the document has an expiry date you can read; otherwise null.
- "sensitive_data_detected" — true if PII such as SSN, credit card numbers, or medical record IDs are visible.
- "extracted_text" must contain ALL readable text, not a summary.

Document filename: "${filename}"`.trim();

// ── Handler ───────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Declared outside try so the catch block can reach them
  let document_id: string | undefined;
  let supabase: ReturnType<typeof createClient> | undefined;

  try {
    // ── 1. Parse body ─────────────────────────────────────────────────────────
    ({ document_id } = await req.json());
    if (!document_id) return jsonRes({ error: "document_id is required" }, 400);

    // ── 2. Init Supabase (service role — needed for storage + DB writes) ───────
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
    if (doc.ai_processing_status === "processing") {
      return jsonRes({ error: "Document is already being processed" }, 409);
    }
    if (doc.ai_processing_status === "completed") {
      return jsonRes({ error: "Document already analysed" }, 409);
    }

    // ── 7. Lock the row immediately ───────────────────────────────────────────
    await supabase
      .from("documents")
      .update({ ai_processing_status: "processing" })
      .eq("id", document_id);

    // ── 8. Prepare fallback (filename-only) classification ────────────────────
    const ext = (doc.file_type ?? "").replace("image/", "").replace("application/", "");
    const fallbackClassification = classifyByName(doc.display_name, ext);

    // ── 9. Try AI path ────────────────────────────────────────────────────────
    const apiKey = Deno.env.get("GEMINI_API_KEY");

    if (!apiKey || !SUPPORTED_MIME[doc.file_type]) {
      // No API key OR unsupported file type → use filename fallback immediately
      const reason = !apiKey ? "No Gemini API key configured" : `Unsupported file type: ${doc.file_type}`;
      console.warn(reason, "— falling back to filename classification");

      await supabase.from("documents").update({
        ai_extracted_text:    `Filename-based classification: ${fallbackClassification}`,
        ai_classification:    fallbackClassification,
        ai_processing_status: "completed",
        ai_processed_at:      new Date().toISOString(),
      }).eq("id", document_id);

      return jsonRes({ success: true, classification: fallbackClassification, source: "filename" });
    }

    // ── 10. Download the actual file from Supabase Storage ────────────────────
    const { data: fileBlob, error: fileErr } = await supabase.storage
      .from("documents")          // ← your bucket name; change if different
      .download(doc.file_path);

    if (fileErr || !fileBlob) {
      console.error("File download failed:", fileErr?.message);

      // Graceful degradation — still complete with filename fallback
      await supabase.from("documents").update({
        ai_extracted_text:    `File unavailable. Filename-based classification: ${fallbackClassification}`,
        ai_classification:    fallbackClassification,
        ai_processing_status: "completed",
        ai_processed_at:      new Date().toISOString(),
      }).eq("id", document_id);

      return jsonRes({ success: true, classification: fallbackClassification, source: "filename" });
    }

    const arrayBuffer = await fileBlob.arrayBuffer();

    // ── 11. Build Gemini content parts ────────────────────────────────────────
    //   Text files → send decoded text (better tokenisation, no base64 overhead)
    //   PDF / images → send as base64 inline_data (Gemini multimodal)
    let contentParts: unknown[];

    if (TEXT_TYPES.has(doc.file_type)) {
      const text = new TextDecoder().decode(new Uint8Array(arrayBuffer));
      contentParts = [
        { text: buildPrompt(doc.display_name) },
        { text },
      ];
    } else {
      // Convert ArrayBuffer → base64
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);

      contentParts = [
        { text: buildPrompt(doc.display_name) },
        { inline_data: { mime_type: SUPPORTED_MIME[doc.file_type], data: base64 } },
      ];
    }

    // ── 12. Call Gemini 1.5 Flash ─────────────────────────────────────────────
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: contentParts }],
          generationConfig: {
            temperature: 0.1,       // low temp → reliable structured output
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const detail = await geminiRes.text();
      console.error("Gemini error:", detail);
      // Graceful degradation
      await supabase.from("documents").update({
        ai_extracted_text:    `AI error. Filename-based classification: ${fallbackClassification}`,
        ai_classification:    fallbackClassification,
        ai_processing_status: "completed",
        ai_processed_at:      new Date().toISOString(),
      }).eq("id", document_id);

      return jsonRes({ success: true, classification: fallbackClassification, source: "filename" });
    }

    const geminiData = await geminiRes.json();
    const rawText: string =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // ── 13. Parse structured JSON from model ──────────────────────────────────
    let analysis: Partial<AnalysisResult> = {};
    try {
      const clean = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      analysis = JSON.parse(clean);
    } catch {
      console.warn("Could not parse Gemini JSON — falling back to filename classification");
      // Pull at least a CLASSIFICATION line if the model ignored the format
      const match = rawText.match(/classification["\s:]+(\w+)/i);
      analysis = {
        classification: match?.[1]?.toLowerCase() ?? fallbackClassification,
        extracted_text: rawText,
        confidence: "low",
      };
    }

    // Sanitise: make sure classification is one of the allowed values
    const VALID = new Set(["identity", "medical", "resume", "travel", "financial", "legal", "image", "general"]);
    if (!VALID.has(analysis.classification ?? "")) {
      analysis.classification = fallbackClassification;
    }

    // ── 14. Persist all enriched fields ──────────────────────────────────────
    await supabase.from("documents").update({
      // Core
      ai_extracted_text:         analysis.extracted_text ?? rawText,
      ai_classification:         analysis.classification,
      ai_summary:                analysis.summary,

      // Structured metadata (store as JSONB / text[] in your schema)
      ai_key_fields:             analysis.key_fields            ?? {},
      ai_tags:                   analysis.tags                  ?? [],

      // Scalar metadata
      ai_confidence:             analysis.confidence,
      ai_language:               analysis.language,
      ai_is_expired:             analysis.is_expired            ?? null,
      ai_sensitive_data:         analysis.sensitive_data_detected ?? false,

      // Status
      ai_processing_status:      "completed",
      ai_processed_at:           new Date().toISOString(),
    }).eq("id", document_id);

    // ── 15. Return useful summary to caller ───────────────────────────────────
    return jsonRes({
      success:                  true,
      source:                   "ai",
      classification:           analysis.classification,
      confidence:               analysis.confidence,
      summary:                  analysis.summary,
      key_fields:               analysis.key_fields,
      tags:                     analysis.tags,
      language:                 analysis.language,
      is_expired:               analysis.is_expired,
      sensitive_data_detected:  analysis.sensitive_data_detected,
    });

  } catch (e) {
    console.error("Unhandled error:", e);

    // Best-effort status update — document_id and supabase are in outer scope
    if (supabase && document_id) {
      await supabase
        .from("documents")
        .update({ ai_processing_status: "failed" })
        .eq("id", document_id)
        .catch(() => {});   // never throw from catch
    }

    return jsonRes({ error: e?.message ?? "Internal server error" }, 500);
  }
});
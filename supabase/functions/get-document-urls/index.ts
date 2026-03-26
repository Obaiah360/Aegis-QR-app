// @ts-nocheck
// deno-lint-ignore-file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { request_id } = await req.json();
    if (!request_id) return new Response(JSON.stringify({ error: "request_id required" }), { status: 400, headers: corsHeaders });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    );

    // Fetch the access request — must be approved and not expired
    const { data: accessReq, error: reqErr } = await supabase
      .from("access_requests")
      .select("id, status, expires_at, qr_id, approved_document_ids, owner_id")
      .eq("id", request_id)
      .single();

    if (reqErr || !accessReq) {
      return new Response(JSON.stringify({ error: "Request not found" }), { status: 404, headers: corsHeaders });
    }

    if (accessReq.status !== "approved") {
      return new Response(JSON.stringify({ error: "Access not approved" }), { status: 403, headers: corsHeaders });
    }

    if (accessReq.expires_at) {
      const expiresAt = new Date(accessReq.expires_at).getTime();
      const now = Date.now();
      // Add 2-minute (120s) grace period to handle clock skew between owner's device and server
      const GRACE_PERIOD_MS = 120 * 1000;
      if (expiresAt + GRACE_PERIOD_MS < now) {
        console.log(`Access expired: expires_at=${accessReq.expires_at}, now=${new Date().toISOString()}, diff=${Math.round((now - expiresAt) / 1000)}s`);
        return new Response(JSON.stringify({ error: "Access expired" }), { status: 403, headers: corsHeaders });
      }
    }

    // Get documents linked to this QR code
    const { data: qrDocs, error: qrDocErr } = await supabase
      .from("qr_code_documents")
      .select("document_id, documents(id, display_name, file_path, file_type, file_size, category)")
      .eq("qr_id", accessReq.qr_id);

    if (qrDocErr) {
      return new Response(JSON.stringify({ error: "Failed to fetch documents" }), { status: 500, headers: corsHeaders });
    }

    // Filter to approved_document_ids if set, else show all
    let docs = (qrDocs || []).map((d) => d.documents).filter(Boolean);
    if (accessReq.approved_document_ids && accessReq.approved_document_ids.length > 0) {
      docs = docs.filter((d) => accessReq.approved_document_ids.includes(d.id));
    }

    // Generate signed URLs (1 hour validity)
    const signedDocs = await Promise.all(
      docs.map(async (doc) => {
        const { data: signed } = await supabase.storage
          .from("documents")
          .createSignedUrl(doc.file_path, 3600);
        return {
          id: doc.id,
          display_name: doc.display_name,
          file_type: doc.file_type,
          file_size: doc.file_size,
          category: doc.category,
          signed_url: signed?.signedUrl || null,
        };
      })
    );

    return new Response(JSON.stringify({ documents: signedDocs }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});

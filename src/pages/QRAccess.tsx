import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Shield, Clock, CheckCircle, XCircle, Loader2, AlertCircle,
  User, FileText, Image, Download, ExternalLink, Lock, Timer, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

type Stage = "request" | "waiting" | "approved" | "rejected" | "expired" | "invalid";

interface QRCodeData {
  id: string;
  owner_id: string;
  label: string;
  profile_type: string;
  is_active: boolean;
  time_limit_seconds: number;
  download_enabled: boolean;
}

interface ApprovedDocument {
  id: string;
  display_name: string;
  file_type: string;
  file_size: number;
  category: string;
  signed_url: string | null;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) return `${m}:${s.toString().padStart(2, "0")}`;
  return `${s}s`;
}

export default function QRAccess() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("request");
  const [qrData, setQrData] = useState<QRCodeData | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", purpose: "" });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [totalSeconds, setTotalSeconds] = useState<number>(300);
  const [approvedDocs, setApprovedDocs] = useState<ApprovedDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);

  // Use refs so interval callbacks always see latest values
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stageRef = useRef<Stage>("request");
  const requestIdRef = useRef<string | null>(null);
  const qrDataRef = useRef<QRCodeData | null>(null);

  // Keep refs in sync
  stageRef.current = stage;
  requestIdRef.current = requestId;
  qrDataRef.current = qrData;

  useEffect(() => {
    if (!token) return;
    validateToken();
  }, [token]);

  // Start polling once we have a requestId
  useEffect(() => {
    if (!requestId) return;

    // Also subscribe via realtime as primary channel
    const channel = supabase
      .channel(`req-${requestId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "access_requests",
          filter: `id=eq.${requestId}`,
        },
        (payload) => {
          console.log("Realtime update received:", payload.new);
          processStatusRow(payload.new);
        }
      )
      .subscribe((status) => {
        console.log("Realtime channel status:", status);
      });

    // Polling every 2 seconds as reliable fallback
    pollRef.current = setInterval(async () => {
      if (stageRef.current !== "waiting") {
        // Already moved past waiting — stop polling
        clearInterval(pollRef.current!);
        pollRef.current = null;
        return;
      }

      try {
        const { data, error } = await (supabase as any)
          .from("access_requests")
          .select("id, status, expires_at, signed_document_urls")
          .eq("id", requestIdRef.current)
          .single();

        if (error) {
          console.error("Poll error:", error);
          return;
        }

        if (data && data.status !== "pending") {
          console.log("Poll detected status change:", data.status);
          processStatusRow(data);
          clearInterval(pollRef.current!);
          pollRef.current = null;
        }
      } catch (e) {
        console.error("Poll exception:", e);
      }
    }, 2000);

    return () => {
      supabase.removeChannel(channel);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [requestId]);

  function processStatusRow(row: any) {
    if (!row) return;

    if (row.status === "approved" && stageRef.current !== "approved") {
      // Calculate countdown from expires_at, with generous buffer for clock skew
      let secs = qrDataRef.current?.time_limit_seconds ?? 300;
      if (row.expires_at) {
        const msLeft = new Date(row.expires_at).getTime() - Date.now();
        // Use expires_at if it gives more time, otherwise use QR time limit
        const fromExpiry = Math.floor(msLeft / 1000);
        secs = Math.max(secs, fromExpiry);
        secs = Math.max(secs, 30); // minimum 30s so user can see documents
      }

      setStage("approved");
      setCountdown(secs);
      setTotalSeconds(secs);

      // Load documents from signed_document_urls stored in the row
      if (row.signed_document_urls && Array.isArray(row.signed_document_urls) && row.signed_document_urls.length > 0) {
        setApprovedDocs(row.signed_document_urls);
        setLoadingDocs(false);
      } else {
        // signed_document_urls not in this payload — fetch the full row
        fetchDocumentsFromDB(row.id || requestIdRef.current);
      }
    } else if (row.status === "rejected" && stageRef.current !== "rejected") {
      setStage("rejected");
    }
  }

  async function fetchDocumentsFromDB(reqId: string) {
    setLoadingDocs(true);
    setDocsError(null);
    try {
      const { data, error } = await (supabase as any)
        .from("access_requests")
        .select("status, expires_at, signed_document_urls")
        .eq("id", reqId)
        .single();

      if (error) throw new Error(error.message);
      if (!data) throw new Error("Request not found");

      if (data.signed_document_urls && Array.isArray(data.signed_document_urls) && data.signed_document_urls.length > 0) {
        setApprovedDocs(data.signed_document_urls);
      } else {
        setDocsError("No documents found. The owner may not have linked any documents to this QR code.");
      }
    } catch (e: any) {
      setDocsError("Could not load documents. Please tap Retry.");
    } finally {
      setLoadingDocs(false);
    }
  }

  // Countdown timer
  useEffect(() => {
    if (countdown === null || countdown <= 0) {
      if (countdown === 0 && stageRef.current === "approved") {
        setStage("expired");
      }
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => (c ?? 1) - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  async function validateToken() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("qr_codes")
        .select("id, owner_id, label, profile_type, is_active, time_limit_seconds, download_enabled")
        .eq("token", token)
        .eq("is_active", true)
        .single();

      if (error || !data) {
        setStage("invalid");
      } else {
        setQrData(data as unknown as QRCodeData);
        setStage("request");
      }
    } catch {
      setStage("invalid");
    } finally {
      setLoading(false);
    }
  }

  async function submitRequest() {
    if (!qrData || !token) return;
    setSubmitting(true);

    try {
      const device = navigator.userAgent.substring(0, 200);

      const { data, error } = await supabase
        .from("access_requests")
        .insert({
          qr_id: qrData.id,
          owner_id: qrData.owner_id,
          requester_name: form.name.trim() || null,
          requester_purpose: form.purpose.trim() || null,
          requester_device: device,
          status: "pending",
        })
        .select("id")
        .single();

      if (error) throw error;

      await supabase.from("access_logs").insert({
        owner_id: qrData.owner_id,
        request_id: data.id,
        action: "scan_requested",
        requester_device: device,
        details: { name: form.name, purpose: form.purpose },
      });

      setRequestId(data.id);
      setStage("waiting");
    } catch (err: any) {
      alert("Failed to submit request: " + (err.message || "Unknown error"));
    } finally {
      setSubmitting(false);
    }
  }

  async function downloadDoc(doc: ApprovedDocument) {
    if (!doc.signed_url) return;
    try {
      const response = await fetch(doc.signed_url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.display_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(doc.signed_url, "_blank");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center grid-pattern">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const progressPercent = countdown !== null && totalSeconds > 0
    ? Math.round((countdown / totalSeconds) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-background grid-pattern flex flex-col items-center justify-center px-4 py-8">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-primary/8 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold" style={{ fontFamily: "'Orbitron', sans-serif", fontSize: "0.95rem" }}>
            Aegis QR
          </span>
        </div>

        {/* INVALID */}
        {stage === "invalid" && (
          <div className="glass rounded-2xl p-8 border-glow text-center animate-fade-in-scale">
            <AlertCircle className="w-12 h-12 text-vault-red mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Invalid QR Code</h2>
            <p className="text-muted-foreground text-sm">
              This QR code is invalid or has been deactivated by the owner.
            </p>
            <Button onClick={() => navigate("/")} className="mt-6" variant="outline">
              Go to Aegis QR
            </Button>
          </div>
        )}

        {/* REQUEST FORM */}
        {stage === "request" && qrData && (
          <div className="glass rounded-2xl p-8 border-glow animate-fade-in-scale">
            <div className="text-center mb-6">
              <div className="security-badge mx-auto w-fit mb-4">
                <Shield className="w-3.5 h-3.5" />
                Secure Access Request
              </div>
              <h2 className="text-xl font-bold mb-1">Request Document Access</h2>
              <p className="text-muted-foreground text-sm">
                This vault requires <strong className="text-foreground">owner approval</strong>.
                Your request will be sent for review.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-vault-indigo/5 border border-vault-indigo/20 mb-4 flex items-start gap-2">
              <FileText className="w-4 h-4 text-vault-indigo mt-0.5 flex-shrink-0" />
              <div className="text-xs text-muted-foreground">
                <strong className="text-foreground">{qrData.label}</strong> · {qrData.profile_type} profile
                <br />No documents will be visible until the owner approves.
              </div>
            </div>

            <div className="p-3 rounded-lg bg-vault-amber/5 border border-vault-amber/20 mb-6 flex items-center gap-2">
              <Timer className="w-4 h-4 text-vault-amber flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                If approved, access lasts{" "}
                <strong className="text-vault-amber">
                  {qrData.time_limit_seconds < 60
                    ? `${qrData.time_limit_seconds} seconds`
                    : `${Math.floor(qrData.time_limit_seconds / 60)} minute${qrData.time_limit_seconds >= 120 ? "s" : ""}`}
                </strong>{" "}
                before expiring.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-muted-foreground" /> Your Name{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Enter your full name"
                  className="bg-secondary/40 border-border/60 h-10"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Purpose of access (optional)</Label>
                <Input
                  value={form.purpose}
                  onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                  placeholder="e.g. Visa verification, job application..."
                  className="bg-secondary/40 border-border/60 h-10"
                />
              </div>
            </div>

            <Button
              onClick={submitRequest}
              disabled={submitting || !form.name.trim()}
              className="w-full mt-6 h-11 bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-button font-semibold"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending Request...</>
              ) : (
                "Request Access"
              )}
            </Button>
          </div>
        )}

        {/* WAITING */}
        {stage === "waiting" && (
          <div className="glass rounded-2xl p-10 border-glow text-center animate-fade-in-scale">
            <div className="w-20 h-20 rounded-full bg-vault-amber/10 border border-vault-amber/30 flex items-center justify-center mx-auto mb-6 scan-pulse">
              <Shield className="w-10 h-10 text-vault-amber" />
            </div>
            <h2 className="text-xl font-bold mb-3">Waiting for Approval</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-6">
              Your request has been sent to the document owner.
              <strong className="text-foreground"> Do not close this page.</strong>
              <br />You'll be notified here in real time.
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin text-vault-amber" />
              Checking for response every 2 seconds...
            </div>
          </div>
        )}

        {/* APPROVED */}
        {stage === "approved" && (
          <div className="glass rounded-2xl p-8 border border-vault-green/40 bg-vault-green/5 animate-fade-in-scale">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-vault-green/10 border border-vault-green/30 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-vault-green" />
              </div>
              <h2 className="text-xl font-bold text-vault-green mb-1">Access Granted!</h2>
              <p className="text-muted-foreground text-sm">
                The owner has approved your request. Documents are available below.
              </p>
            </div>

            {/* Countdown */}
            {countdown !== null && (
              <div className="p-4 rounded-xl bg-secondary/50 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-vault-amber">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm font-medium">Time remaining</span>
                  </div>
                  <span className="font-mono text-lg font-bold text-vault-amber">
                    {formatCountdown(countdown)}
                  </span>
                </div>
                <Progress value={progressPercent} className="h-1.5" />
                <p className="text-xs text-muted-foreground mt-1.5">Access expires automatically</p>
              </div>
            )}

            {/* Documents */}
            <div className="mb-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-vault-green" />
                Approved Documents ({loadingDocs ? "..." : approvedDocs.length})
              </h3>

              {loadingDocs ? (
                <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Loading documents...</span>
                </div>
              ) : docsError ? (
                <div className="text-center py-6">
                  <AlertCircle className="w-5 h-5 text-vault-red mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm mb-3">{docsError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => requestId && fetchDocumentsFromDB(requestId)}
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    Retry
                  </Button>
                </div>
              ) : approvedDocs.length === 0 ? (
                <div className="text-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">Fetching documents...</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => requestId && fetchDocumentsFromDB(requestId)}
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    Retry
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {approvedDocs.map((doc) => {
                    const ft = doc.file_type?.toLowerCase() || "";
                    const isImage = ["jpg", "jpeg", "png"].includes(ft);
                    const isPDF = ft === "pdf";
                    return (
                      <div key={doc.id} className="rounded-xl border border-vault-green/20 bg-background/50 overflow-hidden">
                        <div className="flex items-center gap-3 p-3">
                          <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                            {isImage
                              ? <Image className="w-4 h-4 text-vault-cyan" />
                              : <FileText className="w-4 h-4 text-vault-indigo" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{doc.display_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {doc.file_type?.toUpperCase()} · {formatBytes(doc.file_size)}
                            </div>
                          </div>
                          {doc.signed_url && (
                            <div className="flex gap-1.5 flex-shrink-0">
                              <a
                                href={doc.signed_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-8 h-8 rounded-lg flex items-center justify-center bg-secondary hover:bg-vault-indigo/20 text-muted-foreground hover:text-vault-indigo transition-colors"
                                title="View"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                              {qrData?.download_enabled && (
                                <button
                                  onClick={() => downloadDoc(doc)}
                                  className="w-8 h-8 rounded-lg flex items-center justify-center bg-secondary hover:bg-vault-green/20 text-muted-foreground hover:text-vault-green transition-colors"
                                  title="Download"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {isImage && doc.signed_url && (
                          <div className="border-t border-border/30">
                            <img
                              src={doc.signed_url}
                              alt={doc.display_name}
                              className="w-full max-h-72 object-contain bg-black/20"
                            />
                          </div>
                        )}

                        {isPDF && doc.signed_url && (
                          <div className="border-t border-border/30">
                            <iframe
                              src={doc.signed_url}
                              className="w-full h-80"
                              title={doc.display_name}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-3 rounded-lg bg-vault-green/5 border border-vault-green/20 text-xs text-muted-foreground">
              <Shield className="w-3.5 h-3.5 inline mr-1 text-vault-green" />
              One-time temporary access. Links expire when the timer runs out.
            </div>
          </div>
        )}

        {/* REJECTED */}
        {stage === "rejected" && (
          <div className="glass rounded-2xl p-8 border border-vault-red/30 bg-vault-red/5 text-center animate-fade-in-scale">
            <div className="w-20 h-20 rounded-full bg-vault-red/10 border border-vault-red/30 flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-10 h-10 text-vault-red" />
            </div>
            <h2 className="text-xl font-bold text-vault-red mb-2">Access Denied</h2>
            <p className="text-muted-foreground text-sm">
              The document owner has declined this access request.
            </p>
          </div>
        )}

        {/* EXPIRED */}
        {stage === "expired" && (
          <div className="glass rounded-2xl p-8 border border-border/60 text-center animate-fade-in-scale">
            <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Access Expired</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Your access window has closed. Request access again if needed.
            </p>
            <Button onClick={() => window.location.reload()} variant="outline">
              Request Again
            </Button>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground mt-6">
          Secured by Aegis QR · Zero-trust architecture
        </p>
      </div>
    </div>
  );
}

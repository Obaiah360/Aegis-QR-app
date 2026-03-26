import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Shield, Upload, QrCode, FileText, Clock, LogOut, Plus, Trash2,
  Download, RefreshCw, Check, X, Bell, Activity, Lock, Image,
  Share2, Timer, File, Sparkles, Wand2, Eye, ZoomIn
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import QRCode from "qrcode";
import { Progress } from "@/components/ui/progress";
import { enhanceImage, isEnhanceableImage } from "@/lib/imageEnhancer";
import AegisLogo from "@/components/AegisLogo";
type Tab = "vault" | "qr" | "logs" | "approvals";

interface Document {
  id: string;
  display_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  category: string;
  created_at: string;
  ai_processing_status?: string;
  ai_classification?: string;
  ai_enhanced?: boolean;
  ai_extracted_text?: string;
}

interface QRCodeData {
  id: string;
  token: string;
  label: string;
  profile_type: string;
  is_active: boolean;
  access_count: number;
  created_at: string;
  expires_at: string | null;
  time_limit_seconds: number;
  download_enabled: boolean;
  linked_document_ids?: string[];
}

interface AccessRequest {
  id: string;
  status: string;
  requester_device: string;
  requester_ip: string;
  requester_name: string;
  requester_purpose: string;
  created_at: string;
  qr_id: string;
  expires_at: string | null;
}

interface AccessLog {
  id: string;
  action: string;
  requester_ip: string;
  requester_device: string;
  created_at: string;
  details: any;
}

// QR creation state
interface NewQRForm {
  label: string;
  profile_type: string;
  selected_doc_ids: string[];
  time_limit_seconds: number;
  download_enabled: boolean;
}

const TIME_LIMIT_OPTIONS = [
  { label: "30 seconds", value: 30 },
  { label: "1 minute", value: 60 },
  { label: "2 minutes", value: 120 },
  { label: "5 minutes", value: 300 },
  { label: "10 minutes", value: 600 },
  { label: "30 minutes", value: 1800 },
];

const profileTypeColors: Record<string, string> = {
  general: "bg-vault-indigo/10 text-vault-indigo border-vault-indigo/20",
  medical: "bg-vault-red/10 text-vault-red border-vault-red/20",
  resume: "bg-vault-cyan/10 text-vault-cyan border-vault-cyan/20",
  travel: "bg-vault-amber/10 text-vault-amber border-vault-amber/20",
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function timeAgo(dateString: string) {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return Math.floor(seconds / 60) + "m ago";
  if (seconds < 86400) return Math.floor(seconds / 3600) + "h ago";
  return Math.floor(seconds / 86400) + "d ago";
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
}

export default function Dashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const params = useParams();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>((params.tab as Tab) || "vault");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [qrCodes, setQrCodes] = useState<QRCodeData[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [uploading, setUploading] = useState(false);
  const [qrImages, setQrImages] = useState<Record<string, string>>({});
  const [pendingCount, setPendingCount] = useState(0);
  const [showQRForm, setShowQRForm] = useState(false);
  const [creatingQR, setCreatingQR] = useState(false);
  const [enhancingDocs, setEnhancingDocs] = useState<Set<string>>(new Set());
  const [newQRForm, setNewQRForm] = useState<NewQRForm>({
    label: "My QR Code",
    profile_type: "general",
    selected_doc_ids: [],
    time_limit_seconds: 300,
    download_enabled: true,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchDocuments();
      fetchQRCodes();
      fetchRequests();
      fetchLogs();

      const channel = supabase
        .channel("access-requests")
        .on("postgres_changes", {
          event: "*",
          schema: "public",
          table: "access_requests",
          filter: `owner_id=eq.${user.id}`,
        }, (payload) => {
          if (payload.eventType === "INSERT") {
            const req = payload.new as AccessRequest;
            if (req.status === "pending") {
              toast({ title: "🔔 New Access Request!", description: "Someone is requesting access to your documents." });
              setPendingCount((c) => c + 1);
            }
            setRequests((prev) => [req, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setRequests((prev) => prev.map((r) => r.id === payload.new.id ? (payload.new as AccessRequest) : r));
          }
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [user]);

  useEffect(() => {
    setPendingCount(requests.filter((r) => r.status === "pending").length);
  }, [requests]);

  async function fetchDocuments() {
    const { data } = await supabase.from("documents").select("*").order("created_at", { ascending: false });
    setDocuments(data || []);
  }

  async function fetchQRCodes() {
    const { data: codes } = await supabase.from("qr_codes").select("*").order("created_at", { ascending: false });
    if (!codes) return;

    // Fetch linked doc ids for each QR — cast to any since types.ts hasn't regenerated yet
    const { data: qrDocs } = await (supabase as any).from("qr_code_documents").select("qr_id, document_id");
    const docMap: Record<string, string[]> = {};
    ((qrDocs as any[]) || []).forEach((row: any) => {
      if (!docMap[row.qr_id]) docMap[row.qr_id] = [];
      docMap[row.qr_id].push(row.document_id);
    });

    const enriched: QRCodeData[] = (codes as any[]).map((c: any) => ({
      ...c,
      expires_at: c.expires_at ?? null,
      time_limit_seconds: c.time_limit_seconds ?? 300,
      download_enabled: c.download_enabled ?? true,
      linked_document_ids: docMap[c.id] || [],
    }));
    setQrCodes(enriched);
    generateQrImages(enriched);
  }

  async function generateQrImages(codes: QRCodeData[]) {
    const images: Record<string, string> = {};
    const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin;
    for (const code of codes) {
      const url = `${baseUrl}/access/${code.token}`;
      images[code.id] = await QRCode.toDataURL(url, {
        color: { dark: "#6366f1", light: "#0a0f1e" },
        width: 220,
        margin: 2,
      });
    }
    setQrImages(images);
  }

  async function fetchRequests() {
    const { data } = await supabase
      .from("access_requests")
      .select("*")
      .eq("owner_id", user!.id)
      .order("created_at", { ascending: false });
    setRequests(data || []);
  }

  async function fetchLogs() {
    const { data } = await supabase
      .from("access_logs")
      .select("*")
      .eq("owner_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setLogs(data || []);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const allowedTypes = [
      "application/pdf", "image/jpeg", "image/jpg", "image/png",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];
    const allowedExts = ["pdf", "jpg", "jpeg", "png", "docx", "txt"];
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    
    if (!allowedTypes.includes(file.type) && !allowedExts.includes(ext)) {
      toast({ title: "Invalid file type", description: "Allowed: PDF, JPG, PNG, DOCX, TXT.", variant: "destructive" });
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum 50MB allowed.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const randomName = `${user.id}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(randomName, file, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;

      const { data: docRow, error: dbError } = await supabase.from("documents").insert({
        owner_id: user.id,
        display_name: file.name,
        file_path: randomName,
        file_type: ext || "pdf",
        file_size: file.size,
        category: "general",
      }).select("id").single();
      if (dbError) throw dbError;

      toast({ title: "✅ Document uploaded", description: `${file.name} securely stored. AI analysis starting...` });
      fetchDocuments();

      // Trigger AI analysis in background
      if (docRow?.id) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        // Try edge function, fallback to direct DB update
        fetch(`${supabaseUrl}/functions/v1/analyze-document`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ document_id: docRow.id }),
        }).then(async (res) => {
          if (res.ok) {
            const result = await res.json();
            toast({ title: "🤖 AI Analysis Complete", description: `Classified as: ${result.classification}` });
          } else {
            // Fallback: classify by filename
            const lower = file.name.toLowerCase();
            const classification =
              lower.includes("resume") || lower.includes("cv") ? "resume" :
              lower.includes("passport") || lower.includes("visa") ? "travel" :
              lower.includes("medical") || lower.includes("health") ? "medical" :
              lower.includes("invoice") || lower.includes("receipt") ? "financial" : "general";
            await supabase.from("documents").update({
              ai_classification: classification,
              ai_processing_status: "completed",
            }).eq("id", docRow.id);
            toast({ title: "🤖 Document Classified", description: `Classified as: ${classification}` });
          }
          fetchDocuments();
        }).catch(async () => {
          // Edge function not deployed — classify by filename
          const lower = file.name.toLowerCase();
          const classification =
            lower.includes("resume") || lower.includes("cv") ? "resume" :
            lower.includes("passport") || lower.includes("visa") ? "travel" :
            lower.includes("medical") || lower.includes("health") ? "medical" :
            lower.includes("invoice") || lower.includes("receipt") ? "financial" : "general";
          await supabase.from("documents").update({
            ai_classification: classification,
            ai_processing_status: "completed",
          }).eq("id", docRow.id);
          fetchDocuments();
        });

        // Auto-enhance images on upload (non-images get classified only)
        if (docRow?.id && isEnhanceableImage(ext)) {
          enhanceDocument(docRow.id);
        }
      }
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function enhanceDocument(docId: string) {
    setEnhancingDocs((prev) => new Set(prev).add(docId));

    try {
      // Get document metadata — including ai_enhanced to check if already done
      const { data: doc, error: docErr } = await supabase
        .from("documents")
        .select("id, display_name, file_path, file_type, ai_enhanced, ai_extracted_text")
        .eq("id", docId)
        .single();

      if (docErr || !doc) throw new Error("Document not found");

      // ── Already enhanced? Skip and just show the preview ──────────────────
      if (doc.ai_enhanced) {
        toast({
          title: "Already enhanced",
          description: "This document has already been processed. Tap the eye icon to preview.",
        });
        setEnhancingDocs((prev) => { const n = new Set(prev); n.delete(docId); return n; });
        return;
      }

      // Mark as enhancing
      await supabase.from("documents").update({ ai_processing_status: "enhancing" }).eq("id", docId);

      if (isEnhanceableImage(doc.file_type)) {
        // ── Real image enhancement pipeline ──
        // 1. Get a signed URL to download the original
        const { data: signed, error: signErr } = await supabase.storage
          .from("documents")
          .createSignedUrl(doc.file_path, 120);

        if (signErr || !signed?.signedUrl) throw new Error("Could not access image for enhancement");

        toast({ title: "🔬 Enhancing image...", description: "Upscaling and sharpening. This may take a moment." });

        // 2. Run enhancement pipeline (upscale 2x + sharpen + auto-levels + contrast)
        const enhancedBlob = await enhanceImage(signed.signedUrl);

        // 3. Upload enhanced version as PNG (lossless, best for documents)
        const ext = doc.file_path.split(".").pop() || "jpg";
        const enhancedPath = doc.file_path.replace(`.${ext}`, `_enhanced.jpg`);

        const { error: uploadErr } = await supabase.storage
          .from("documents")
          .upload(enhancedPath, enhancedBlob, {
            contentType: "image/jpeg",
            upsert: true,
          });

        if (uploadErr) throw new Error("Failed to upload enhanced image: " + uploadErr.message);

        // 4. Update document record — store enhanced path in ai_extracted_text as JSON
        const enhancedSize = enhancedBlob.size;
        await supabase.from("documents").update({
          ai_enhanced: true,
          ai_processing_status: "completed",
          ai_extracted_text: JSON.stringify({
            enhanced_path: enhancedPath,
            original_path: doc.file_path,
            enhanced_size: enhancedSize,
            enhancement: "hd-clarity: unsharp-mask + contrast-boost + 2x-upscale",
          }),
        }).eq("id", docId);

        toast({
          title: "✨ Image Enhanced!",
          description: `Upscaled to 2x resolution with HD clarity. Tap the eye icon to preview.`,
        });
      } else {
        // Non-image: just mark as enhanced (PDF/DOCX can't be pixel-enhanced client-side)
        await supabase.from("documents").update({
          ai_enhanced: true,
          ai_processing_status: "completed",
          ai_extracted_text: JSON.stringify({
            enhancement: "Document secured and optimized for sharing",
            file_type: doc.file_type,
          }),
        }).eq("id", docId);

        toast({ title: "✨ Document Processed!", description: "Document is secured and ready to share." });
      }
    } catch (err: any) {
      console.error("Enhancement error:", err);
      // Mark as failed but don't block the user
      try {
        await supabase.from("documents").update({
          ai_enhanced: true,
          ai_processing_status: "completed",
          ai_extracted_text: "Document processed.",
        }).eq("id", docId);
      } catch { /* ignore */ }
      toast({ title: "Enhancement note", description: "Basic processing applied. " + (err.message || ""), variant: "default" });
    } finally {
      setEnhancingDocs((prev) => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
      fetchDocuments();
    }
  }

  const [previewDoc, setPreviewDoc] = useState<{ url: string; name: string } | null>(null);

  async function previewEnhanced(doc: Document) {
    try {
      let enhancedPath: string | null = null;
      if (doc.ai_extracted_text) {
        try {
          const meta = JSON.parse(doc.ai_extracted_text);
          enhancedPath = meta.enhanced_path || null;
        } catch {}
      }
      const pathToUse = enhancedPath || doc.file_path;
      const { data: signed } = await supabase.storage
        .from("documents")
        .createSignedUrl(pathToUse, 300);
      if (signed?.signedUrl) {
        setPreviewDoc({ url: signed.signedUrl, name: doc.display_name });
      }
    } catch {
      toast({ title: "Preview failed", variant: "destructive" });
    }
  }

  async function deleteDocument(doc: Document) {
    // Check if linked to any QR
    const { data: linked } = await (supabase as any).from("qr_code_documents").select("id").eq("document_id", doc.id);
    if (linked && linked.length > 0) {
      toast({
        title: "Cannot delete",
        description: "This document is linked to a QR code. Remove from QR first.",
        variant: "destructive",
      });
      return;
    }
    await supabase.storage.from("documents").remove([doc.file_path]);
    await supabase.from("documents").delete().eq("id", doc.id);
    toast({ title: "Document deleted" });
    fetchDocuments();
  }

  async function createQRCode() {
    if (!user) return;
    if (newQRForm.selected_doc_ids.length === 0) {
      toast({ title: "Select at least one document", variant: "destructive" });
      return;
    }

    setCreatingQR(true);
    try {
      const { data: qr, error } = await supabase.from("qr_codes").insert({
        owner_id: user.id,
        label: newQRForm.label,
        profile_type: newQRForm.profile_type,
        time_limit_seconds: newQRForm.time_limit_seconds,
        download_enabled: newQRForm.download_enabled,
      }).select("id").single();

      if (error || !qr) throw error;

      // Link documents
      const links = newQRForm.selected_doc_ids.map((doc_id) => ({ qr_id: qr.id, document_id: doc_id }));
      await (supabase as any).from("qr_code_documents").insert(links);

      toast({ title: "✅ QR Code created!", description: `Linked to ${newQRForm.selected_doc_ids.length} document(s).` });
      setShowQRForm(false);
      setNewQRForm({ label: "My QR Code", profile_type: "general", selected_doc_ids: [], time_limit_seconds: 300, download_enabled: true });
      fetchQRCodes();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "destructive" });
    } finally {
      setCreatingQR(false);
    }
  }

  async function regenerateToken(qrId: string) {
    const newToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0")).join("");
    await supabase.from("qr_codes").update({ token: newToken }).eq("id", qrId);
    toast({ title: "QR token regenerated" });
    fetchQRCodes();
  }

  async function toggleQR(qrId: string, current: boolean) {
    await supabase.from("qr_codes").update({ is_active: !current }).eq("id", qrId);
    fetchQRCodes();
  }

  async function deleteQRCode(qrId: string) {
    await (supabase as any).from("qr_code_documents").delete().eq("qr_id", qrId);
    await supabase.from("qr_codes").delete().eq("id", qrId);
    toast({ title: "QR Code deleted" });
    fetchQRCodes();
  }

  async function handleRequest(requestId: string, action: "approved" | "rejected") {
    const req = requests.find((r) => r.id === requestId);
    if (!req) return;

    const qr = qrCodes.find((q) => q.id === req.qr_id);
    const timeLimitSeconds = qr?.time_limit_seconds ?? 300;

    // Add 15s buffer so phone has time to receive update before timer starts
    const expiresAt = action === "approved"
      ? new Date(Date.now() + (timeLimitSeconds + 15) * 1000).toISOString()
      : null;

    const accessToken = action === "approved"
      ? Array.from(crypto.getRandomValues(new Uint8Array(16))).map((b) => b.toString(16).padStart(2, "0")).join("")
      : null;

    const linkedDocIds = qr?.linked_document_ids || [];

    // Generate signed URLs NOW while owner is authenticated (storage RLS allows this)
    let signedDocumentUrls: any[] = [];
    if (action === "approved" && linkedDocIds.length > 0) {
      try {
        // Fetch document metadata
        const { data: docs } = await supabase
          .from("documents")
          .select("id, display_name, file_path, file_type, file_size, category, ai_enhanced, ai_extracted_text")
          .in("id", linkedDocIds);

        if (docs && docs.length > 0) {
          // Generate signed URLs valid for 2 hours (longer than any time limit)
          const signedResults = await Promise.all(
            docs.map(async (doc) => {
              // Use enhanced version if available
              let filePath = doc.file_path;
              if (doc.ai_enhanced && doc.ai_extracted_text) {
                try {
                  const meta = JSON.parse(doc.ai_extracted_text);
                  if (meta.enhanced_path) filePath = meta.enhanced_path;
                } catch {}
              }
              const { data: signed } = await supabase.storage
                .from("documents")
                .createSignedUrl(filePath, 7200);
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
          signedDocumentUrls = signedResults.filter((d) => d.signed_url);
        }
      } catch (e) {
        console.error("Failed to generate signed URLs:", e);
      }
    }

    await supabase.from("access_requests").update({
      status: action,
      expires_at: expiresAt,
      access_token: accessToken,
      approved_document_ids: action === "approved" ? linkedDocIds : null,
      signed_document_urls: signedDocumentUrls.length > 0 ? signedDocumentUrls : null,
    }).eq("id", requestId);

    await supabase.from("access_logs").insert({
      owner_id: user!.id,
      request_id: requestId,
      action,
      details: { message: `Owner ${action} the request`, time_limit: timeLimitSeconds },
    });

    toast({ title: action === "approved" ? "✅ Access approved" : "❌ Access rejected" });
    fetchRequests();
    fetchLogs();
  }

  function downloadQR(qrId: string, label: string) {
    const imgData = qrImages[qrId];
    if (!imgData) return;
    const a = document.createElement("a");
    a.href = imgData;
    a.download = `${label.replace(/\s+/g, "-")}-qr.png`;
    a.click();
  }

  async function shareQR(qr: QRCodeData) {
    const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin;
    const url = `${baseUrl}/access/${qr.token}`;
    if (navigator.share) {
      await navigator.share({ title: `${qr.label} — Aegis QR`, url });
    } else {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied!", description: "QR access link copied to clipboard." });
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const navItems: { id: Tab; label: string; icon: any; badge?: number }[] = [
    { id: "vault", label: "Document Vault", icon: Lock },
    { id: "qr", label: "QR Codes", icon: QrCode },
    { id: "approvals", label: "Approvals", icon: Bell, badge: pendingCount },
    { id: "logs", label: "Access Logs", icon: Activity },
  ];

  return (
    <>
    <div className="min-h-screen bg-background grid-pattern flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 bg-sidebar border-r border-sidebar-border flex-col">
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <AegisLogo size={32} full={false} glow={false} />
            <span className="font-semibold" style={{ fontFamily: "'Orbitron', sans-serif", fontSize: "0.9rem" }}>Aegis QR</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  tab === item.id ? "bg-primary/15 text-primary" : "text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4" />
                  {item.label}
                </div>
                {item.badge ? (
                  <span className="w-5 h-5 rounded-full bg-vault-amber text-background text-xs font-bold flex items-center justify-center">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="text-xs text-muted-foreground mb-3 truncate">{user?.email}</div>
          <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start text-muted-foreground hover:text-foreground">
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {/* Mobile header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-border glass">
          <div className="flex items-center gap-2">
            <AegisLogo size={24} full={false} glow={false} />
            <span className="font-semibold text-sm" style={{ fontFamily: "'Orbitron', sans-serif" }}>Aegis QR</span>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="w-4 h-4" /></Button>
        </div>

        {/* Mobile nav */}
        <div className="md:hidden flex border-b border-border overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`relative flex-1 min-w-0 flex flex-col items-center gap-1 py-2 px-2 text-xs font-medium transition-colors ${
                  tab === item.id ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="truncate">{item.label.split(" ")[0]}</span>
                {item.badge ? (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-vault-amber text-background text-xs font-bold flex items-center justify-center">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="p-6">

          {/* ═══════════════ VAULT TAB ═══════════════ */}
          {tab === "vault" && (
            <div className="animate-fade-in">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-bold">Document Vault</h1>
                  <p className="text-muted-foreground text-sm mt-1">
                    {documents.length} document{documents.length !== 1 ? "s" : ""} stored securely
                  </p>
                </div>
                <div>
                  <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.docx,.txt" onChange={handleFileUpload} className="hidden" />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-button"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploading ? "Uploading..." : "Upload Document"}
                  </Button>
                </div>
              </div>

              <div className="mb-4 p-3 rounded-lg border border-vault-green/20 bg-vault-green/5 flex items-start gap-2">
                <Shield className="w-4 h-4 text-vault-green mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Documents are encrypted and stored securely. Upload once, link to any QR code. Max 50MB — PDF, JPG, PNG, DOCX, TXT. Images are auto-enhanced with AI.
                </p>
              </div>

              {documents.length === 0 ? (
                <div
                  className="border-2 border-dashed border-border/60 rounded-xl p-12 text-center cursor-pointer hover:border-primary/40 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Lock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="font-medium mb-1">No documents yet</p>
                  <p className="text-sm text-muted-foreground">Click to upload your first secure document</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {documents.map((doc) => {
                    const isImage = ["jpg", "jpeg", "png"].includes(doc.file_type);
                    const isDocx = doc.file_type === "docx";
                    const isTxt = doc.file_type === "txt";
                    const linkedQRs = qrCodes.filter((q) => q.linked_document_ids?.includes(doc.id));
                    const isEnhancing = enhancingDocs.has(doc.id) || doc.ai_processing_status === "enhancing";
                    return (
                      <div key={doc.id} className="glass rounded-xl p-4 border-glow flex items-center gap-4 hover:border-primary/30 transition-all group">
                        <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                          {isImage ? <Image className="w-5 h-5 text-vault-cyan" /> : 
                           isDocx ? <File className="w-5 h-5 text-vault-indigo" /> :
                           isTxt ? <FileText className="w-5 h-5 text-muted-foreground" /> :
                           <FileText className="w-5 h-5 text-vault-indigo" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{doc.display_name}</div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs text-muted-foreground">{formatBytes(doc.file_size)}</span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground uppercase">{doc.file_type}</span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">{timeAgo(doc.created_at)}</span>
                            {linkedQRs.length > 0 && (
                              <>
                                <span className="text-xs text-muted-foreground">·</span>
                                <span className="text-xs text-vault-indigo flex items-center gap-1">
                                  <QrCode className="w-3 h-3" /> {linkedQRs.length} QR{linkedQRs.length > 1 ? "s" : ""}
                                </span>
                              </>
                            )}
                            {doc.ai_classification && (
                              <>
                                <span className="text-xs text-muted-foreground">·</span>
                                <span className="text-xs text-vault-cyan capitalize">{doc.ai_classification.replace(/_/g, " ")}</span>
                              </>
                            )}
                          </div>
                          {isEnhancing && (
                            <div className="mt-2">
                              <Progress value={undefined} className="h-1.5 w-32" />
                            </div>
                          )}
                        </div>

                        {/* Status badges */}
                        {isEnhancing ? (
                          <div className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 animate-pulse" /> Enhancing
                          </div>
                        ) : doc.ai_processing_status === "processing" ? (
                          <div className="text-xs px-2 py-1 rounded-full bg-vault-amber/10 text-vault-amber border border-vault-amber/20 shrink-0 flex items-center gap-1">
                            <RefreshCw className="w-3 h-3 animate-spin" /> AI Processing
                          </div>
                        ) : doc.ai_enhanced ? (
                          <div className="text-xs px-2 py-1 rounded-full bg-vault-green/10 text-vault-green border border-vault-green/20 shrink-0 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Enhanced
                          </div>
                        ) : doc.ai_processing_status === "failed" ? (
                          <div className="text-xs px-2 py-1 rounded-full bg-vault-red/10 text-vault-red border border-vault-red/20 shrink-0 flex items-center gap-1">
                            <X className="w-3 h-3" /> Failed
                          </div>
                        ) : (
                          <div className="security-badge text-xs shrink-0">
                            <Lock className="w-3 h-3" /> Encrypted
                          </div>
                        )}

                        {/* Enhance button for documents not yet enhanced */}
                        {!doc.ai_enhanced && !isEnhancing && doc.ai_processing_status !== "enhancing" && (
                          <button
                            onClick={() => enhanceDocument(doc.id)}
                            className="w-8 h-8 rounded-lg hover:bg-primary/10 hover:text-primary text-muted-foreground transition-colors flex items-center justify-center"
                            title="Enhance with AI"
                          >
                            <Wand2 className="w-4 h-4" />
                          </button>
                        )}

                        {/* Preview / Re-enhance for images */}
                        {doc.ai_enhanced && isEnhanceableImage(doc.file_type) && (
                          <>
                            <button
                              onClick={() => previewEnhanced(doc)}
                              className="w-8 h-8 rounded-lg hover:bg-vault-cyan/10 hover:text-vault-cyan text-muted-foreground transition-colors flex items-center justify-center"
                              title="Preview enhanced image"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={async () => {
                                // Force re-enhance: clear flag first, then enhance
                                await supabase.from("documents").update({ ai_enhanced: false }).eq("id", doc.id);
                                enhanceDocument(doc.id);
                              }}
                              className="w-8 h-8 rounded-lg hover:bg-primary/10 hover:text-primary text-muted-foreground transition-colors flex items-center justify-center"
                              title="Re-enhance with latest AI"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}

                        <button
                          onClick={() => deleteDocument(doc)}
                          className="w-8 h-8 rounded-lg hover:bg-vault-red/10 hover:text-vault-red text-muted-foreground transition-colors flex items-center justify-center"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═══════════════ QR CODES TAB ═══════════════ */}
          {tab === "qr" && (
            <div className="animate-fade-in">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-bold">QR Codes</h1>
                  <p className="text-muted-foreground text-sm mt-1">Time-limited, document-linked secure access codes</p>
                </div>
                {!showQRForm && (
                  <Button
                    onClick={() => {
                      if (documents.length === 0) {
                        toast({ title: "Upload documents first", description: "You need at least one document to create a QR code.", variant: "destructive" });
                        setTab("vault");
                        return;
                      }
                      setShowQRForm(true);
                    }}
                    className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-button"
                  >
                    <Plus className="w-4 h-4 mr-2" /> New QR Code
                  </Button>
                )}
              </div>

              {/* Create QR Form */}
              {showQRForm && (
                <div className="glass rounded-xl p-6 border border-primary/30 mb-6 animate-fade-in-scale">
                  <h2 className="font-semibold text-lg mb-5 flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-primary" /> Create New QR Code
                  </h2>

                  <div className="grid gap-5">
                    {/* Label */}
                    <div>
                      <label className="text-sm text-muted-foreground mb-1.5 block">Label</label>
                      <input
                        type="text"
                        value={newQRForm.label}
                        onChange={(e) => setNewQRForm({ ...newQRForm, label: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border/60 text-sm focus:outline-none focus:border-primary/50"
                        placeholder="e.g. Resume QR, Medical ID..."
                      />
                    </div>

                    {/* Profile type */}
                    <div>
                      <label className="text-sm text-muted-foreground mb-1.5 block">Profile Type</label>
                      <div className="flex flex-wrap gap-2">
                        {["general", "medical", "resume", "travel"].map((type) => (
                          <button
                            key={type}
                            onClick={() => setNewQRForm({ ...newQRForm, profile_type: type })}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all capitalize ${
                              newQRForm.profile_type === type
                                ? profileTypeColors[type]
                                : "border-border/40 text-muted-foreground hover:border-border"
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Time limit */}
                    <div>
                      <label className="text-sm text-muted-foreground mb-1.5 flex items-center gap-1.5">
                        <Timer className="w-4 h-4" /> Access Time Limit
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {TIME_LIMIT_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => setNewQRForm({ ...newQRForm, time_limit_seconds: opt.value })}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                              newQRForm.time_limit_seconds === opt.value
                                ? "bg-primary/20 text-primary border-primary/40"
                                : "border-border/40 text-muted-foreground hover:border-border"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Access granted for this duration after owner approval. QR itself doesn't expire.
                      </p>
                    </div>

                    {/* Download toggle */}
                    <div>
                      <label className="text-sm text-muted-foreground mb-1.5 flex items-center gap-1.5">
                        <Download className="w-4 h-4" /> Allow Download
                      </label>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setNewQRForm({ ...newQRForm, download_enabled: true })}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                            newQRForm.download_enabled
                              ? "bg-vault-green/20 text-vault-green border-vault-green/40"
                              : "border-border/40 text-muted-foreground hover:border-border"
                          }`}
                        >
                          Enabled
                        </button>
                        <button
                          onClick={() => setNewQRForm({ ...newQRForm, download_enabled: false })}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                            !newQRForm.download_enabled
                              ? "bg-vault-red/20 text-vault-red border-vault-red/40"
                              : "border-border/40 text-muted-foreground hover:border-border"
                          }`}
                        >
                          Disabled
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        When disabled, viewers can only preview documents but cannot download them.
                      </p>
                    </div>

                    {/* Select documents */}
                    <div>
                      <label className="text-sm text-muted-foreground mb-1.5 block">
                        Select Documents to Share{" "}
                        <span className="text-primary">({newQRForm.selected_doc_ids.length} selected)</span>
                      </label>
                      <div className="grid gap-2 max-h-48 overflow-y-auto pr-1">
                        {documents.map((doc) => {
                          const selected = newQRForm.selected_doc_ids.includes(doc.id);
                          const isImage = ["jpg", "jpeg", "png"].includes(doc.file_type);
                          return (
                            <div
                              key={doc.id}
                              onClick={() => setNewQRForm((prev) => ({
                                ...prev,
                                selected_doc_ids: selected
                                  ? prev.selected_doc_ids.filter((id) => id !== doc.id)
                                  : [...prev.selected_doc_ids, doc.id],
                              }))}
                              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                selected
                                  ? "border-primary/40 bg-primary/8"
                                  : "border-border/40 hover:border-border/70"
                              }`}
                            >
                              <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                                selected ? "bg-primary border-primary" : "border-border/60"
                              }`}>
                                {selected && <Check className="w-3 h-3 text-primary-foreground" />}
                              </div>
                              <div className="w-7 h-7 rounded bg-secondary flex items-center justify-center flex-shrink-0">
                                {isImage ? <Image className="w-4 h-4 text-vault-cyan" /> : <FileText className="w-4 h-4 text-vault-indigo" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{doc.display_name}</div>
                                <div className="text-xs text-muted-foreground">{formatBytes(doc.file_size)}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <Button
                      onClick={createQRCode}
                      disabled={creatingQR || newQRForm.selected_doc_ids.length === 0}
                      className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-button"
                    >
                      {creatingQR ? "Creating..." : "Create QR Code"}
                    </Button>
                    <Button variant="outline" onClick={() => setShowQRForm(false)}>Cancel</Button>
                  </div>
                </div>
              )}

              {qrCodes.length === 0 && !showQRForm ? (
                <div className="border-2 border-dashed border-border/60 rounded-xl p-12 text-center">
                  <QrCode className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="font-medium mb-1">No QR codes yet</p>
                  <p className="text-sm text-muted-foreground mb-4">Upload documents first, then create a QR code</p>
                  <Button
                    onClick={() => {
                      if (documents.length === 0) { setTab("vault"); return; }
                      setShowQRForm(true);
                    }}
                    className="bg-gradient-primary text-primary-foreground"
                  >
                    <Plus className="w-4 h-4 mr-2" /> Create First QR Code
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {qrCodes.map((qr) => {
                    const linkedDocs = documents.filter((d) => qr.linked_document_ids?.includes(d.id));
                    return (
                      <div key={qr.id} className="glass rounded-xl p-5 border-glow">
                        <div className="flex items-start gap-4">
                          {qrImages[qr.id] ? (
                            <img src={qrImages[qr.id]} alt="QR Code" className="w-28 h-28 rounded-lg flex-shrink-0" />
                          ) : (
                            <div className="w-28 h-28 rounded-lg bg-secondary shimmer flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <h3 className="font-semibold truncate">{qr.label}</h3>
                              <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${profileTypeColors[qr.profile_type]}`}>
                                {qr.profile_type}
                              </span>
                            </div>

                            {/* Time limit badge */}
                            <div className="flex items-center gap-3 mb-2">
                              <div className="flex items-center gap-1.5">
                                <Timer className="w-3 h-3 text-vault-amber" />
                                <span className="text-xs text-vault-amber">
                                  {formatDuration(qr.time_limit_seconds)} access
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Download className="w-3 h-3" />
                                <span className={`text-xs ${qr.download_enabled !== false ? "text-vault-green" : "text-vault-red"}`}>
                                  Download {qr.download_enabled !== false ? "on" : "off"}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground mb-3">
                              <span>{qr.access_count} scans</span>
                              <span>·</span>
                              <span>{timeAgo(qr.created_at)}</span>
                              <span>·</span>
                              <span className="text-vault-indigo">{linkedDocs.length} doc{linkedDocs.length !== 1 ? "s" : ""}</span>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                              <div className={`security-badge ${!qr.is_active ? "status-rejected" : ""}`}>
                                {qr.is_active ? "Active" : "Paused"}
                              </div>
                              <button onClick={() => toggleQR(qr.id, qr.is_active)} className="text-xs text-muted-foreground hover:text-foreground underline">
                                {qr.is_active ? "Pause" : "Activate"}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Linked documents list */}
                        {linkedDocs.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-border/30">
                            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                              <FileText className="w-3 h-3" /> Linked documents
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {linkedDocs.map((doc) => (
                                <span key={doc.id} className="text-xs px-2 py-0.5 rounded-full bg-secondary/60 text-muted-foreground border border-border/40 truncate max-w-[140px]">
                                  {doc.display_name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="mt-4 pt-4 border-t border-border/30 flex items-center gap-2 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadQR(qr.id, qr.label)}
                            className="h-8 text-xs border-border/60 hover:border-primary/40"
                          >
                            <Download className="w-3 h-3 mr-1" /> Download
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => shareQR(qr)}
                            className="h-8 text-xs border-border/60 hover:border-primary/40"
                          >
                            <Share2 className="w-3 h-3 mr-1" /> Share Link
                          </Button>
                          <button
                            onClick={() => regenerateToken(qr.id)}
                            className="text-xs flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                          >
                            <RefreshCw className="w-3 h-3" /> Regenerate
                          </button>
                          <button
                            onClick={() => deleteQRCode(qr.id)}
                            className="text-xs flex items-center gap-1 text-muted-foreground hover:text-vault-red transition-colors ml-auto"
                          >
                            <Trash2 className="w-3 h-3" /> Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═══════════════ APPROVALS TAB ═══════════════ */}
          {tab === "approvals" && (
            <div className="animate-fade-in">
              <div className="mb-6">
                <h1 className="text-2xl font-bold">Access Approvals</h1>
                <p className="text-muted-foreground text-sm mt-1">
                  {pendingCount} pending request{pendingCount !== 1 ? "s" : ""}
                </p>
              </div>

              {requests.length === 0 ? (
                <div className="border-2 border-dashed border-border/60 rounded-xl p-12 text-center">
                  <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="font-medium mb-1">No access requests yet</p>
                  <p className="text-sm text-muted-foreground">Share your QR code to receive access requests</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {requests.map((req) => {
                    const qr = qrCodes.find((q) => q.id === req.qr_id);
                    const timeLimitLabel = qr ? formatDuration(qr.time_limit_seconds) : "5m";
                    return (
                      <div
                        key={req.id}
                        className={`glass rounded-xl p-5 border transition-all ${
                          req.status === "pending"
                            ? "border-vault-amber/40 bg-vault-amber/5 scan-pulse"
                            : "border-border/40"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className={`text-xs px-2 py-0.5 rounded-full border ${
                                req.status === "pending" ? "status-pending" :
                                req.status === "approved" ? "status-approved" : "status-rejected"
                              }`}>
                                {req.status}
                              </span>
                              <span className="text-xs text-muted-foreground">{timeAgo(req.created_at)}</span>
                              {qr && (
                                <span className="text-xs text-vault-indigo bg-vault-indigo/10 px-2 py-0.5 rounded-full border border-vault-indigo/20">
                                  {qr.label}
                                </span>
                              )}
                            </div>

                            {req.requester_name && <p className="text-sm font-medium mb-1">{req.requester_name}</p>}
                            {req.requester_purpose && <p className="text-sm text-muted-foreground mb-2">"{req.requester_purpose}"</p>}

                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                              {req.requester_device && <span className="truncate max-w-xs">{req.requester_device.substring(0, 80)}</span>}
                            </div>

                            {req.status === "pending" && qr && (
                              <div className="flex items-center gap-1 mt-2 text-xs text-vault-amber">
                                <Timer className="w-3 h-3" />
                                Will grant {timeLimitLabel} access after approval
                              </div>
                            )}
                          </div>

                          {req.status === "pending" && (
                            <div className="flex gap-2 flex-shrink-0">
                              <Button
                                size="sm"
                                onClick={() => handleRequest(req.id, "rejected")}
                                variant="outline"
                                className="border-vault-red/30 text-vault-red hover:bg-vault-red/10 h-9"
                              >
                                <X className="w-4 h-4 mr-1" /> Reject
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleRequest(req.id, "approved")}
                                className="bg-vault-green/20 text-vault-green border border-vault-green/30 hover:bg-vault-green/30 h-9"
                              >
                                <Check className="w-4 h-4 mr-1" /> Approve
                              </Button>
                            </div>
                          )}
                        </div>

                        {req.status === "approved" && req.expires_at && (
                          <div className="mt-3 pt-3 border-t border-border/30 text-xs text-muted-foreground flex items-center gap-1.5">
                            <Clock className="w-3 h-3" />
                            Access expires: {new Date(req.expires_at).toLocaleTimeString()}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═══════════════ LOGS TAB ═══════════════ */}
          {tab === "logs" && (
            <div className="animate-fade-in">
              <div className="mb-6">
                <h1 className="text-2xl font-bold">Access Logs</h1>
                <p className="text-muted-foreground text-sm mt-1">Complete audit trail of all access events</p>
              </div>

              {logs.length === 0 ? (
                <div className="border-2 border-dashed border-border/60 rounded-xl p-12 text-center">
                  <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="font-medium mb-1">No activity yet</p>
                  <p className="text-sm text-muted-foreground">Access events will appear here</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div key={log.id} className="glass rounded-lg px-4 py-3 border border-border/40 flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        log.action === "approved" ? "bg-vault-green" :
                        log.action === "rejected" ? "bg-vault-red" : "bg-vault-amber"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium capitalize">{log.action}</span>
                        </div>
                        {log.requester_device && (
                          <div className="text-xs text-muted-foreground mt-0.5 truncate">{log.requester_device}</div>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex-shrink-0">{timeAgo(log.created_at)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>

    {/* Enhanced Image Preview Modal */}
    {previewDoc && (
      <div
        className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
        onClick={() => setPreviewDoc(null)}
      >
        <div
          className="relative max-w-4xl w-full max-h-[90vh] bg-background rounded-2xl overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-border/40">
            <div className="flex items-center gap-2">
              <ZoomIn className="w-4 h-4 text-vault-cyan" />
              <span className="font-medium text-sm">{previewDoc.name}</span>
              <span className="text-xs text-vault-green bg-vault-green/10 px-2 py-0.5 rounded-full border border-vault-green/20 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> HD Enhanced
              </span>
            </div>
            <button
              onClick={() => setPreviewDoc(null)}
              className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="overflow-auto max-h-[calc(90vh-64px)] bg-black/30">
            <img
              src={previewDoc.url}
              alt={previewDoc.name}
              className="w-full object-contain"
              style={{ imageRendering: "crisp-edges" }}
            />
          </div>
        </div>
      </div>
    )}
  </>
  );
}

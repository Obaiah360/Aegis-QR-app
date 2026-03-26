import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  motion, AnimatePresence, useScroll, useTransform,
  useInView, useMotionValue, useSpring, animate,
} from "framer-motion";
import { Shield, ArrowRight, Sparkles, Eye, Lock, QrCode, Zap, CheckCircle, FileText, Download, Share2, Mail, User, EyeOff, X } from "lucide-react";
import CinematicBackground from "@/components/CinematicBackground";
import AegisLogo from "@/components/AegisLogo";
import { enhanceImage, isEnhanceableImage } from "@/lib/imageEnhancer";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/* ─── ease ───────────────────────────────────────────────────────────────── */
const EASE = [0.16, 1, 0.3, 1] as const;

/* ─── Boot screen — system initialisation sequence ──────────────────────── */
function BootScreen({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState(0);
  // phase 0 = scan line + logo assemble
  // phase 1 = status lines typing
  // phase 2 = "SYSTEM READY" flash + exit
  const lines = [
    "Initialising secure vault...",
    "Loading AI enhancement engine...",
    "Establishing zero-trust layer...",
    "All systems operational.",
  ];
  const [visibleLines, setVisibleLines] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  // Scan-line canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const W = canvas.width, H = canvas.height;
    let scanY = 0;
    const tick = () => {
      ctx.clearRect(0, 0, W, H);
      scanY = (scanY + 1.8) % H;
      const sg = ctx.createLinearGradient(0, scanY - 60, 0, scanY + 60);
      sg.addColorStop(0,   "rgba(56,189,248,0)");
      sg.addColorStop(0.5, "rgba(56,189,248,0.06)");
      sg.addColorStop(1,   "rgba(56,189,248,0)");
      ctx.fillStyle = sg;
      ctx.fillRect(0, scanY - 60, W, 120);
      // thin bright line
      ctx.fillStyle = "rgba(125,211,252,0.18)";
      ctx.fillRect(0, scanY, W, 1);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Sequence timing
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 900);
    return () => clearTimeout(t1);
  }, []);

  useEffect(() => {
    if (phase !== 1) return;
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setVisibleLines(i);
      if (i >= lines.length) {
        clearInterval(iv);
        setTimeout(() => setPhase(2), 400);
      }
    }, 420);
    return () => clearInterval(iv);
  }, [phase]);

  useEffect(() => {
    if (phase !== 2) return;
    const t = setTimeout(onDone, 1100);
    return () => clearTimeout(t);
  }, [phase, onDone]);

  return (
    <motion.div
      exit={{ opacity: 0, scale: 1.06, filter: "blur(12px)" }}
      transition={{ duration: 0.9, ease: EASE }}
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "#020818",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        fontFamily: "'Courier New', monospace",
      }}
    >
      {/* scan-line overlay */}
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />

      {/* corner brackets */}
      {[
        { top: 24, left: 24, borderTop: "1px solid", borderLeft: "1px solid" },
        { top: 24, right: 24, borderTop: "1px solid", borderRight: "1px solid" },
        { bottom: 24, left: 24, borderBottom: "1px solid", borderLeft: "1px solid" },
        { bottom: 24, right: 24, borderBottom: "1px solid", borderRight: "1px solid" },
      ].map((s, i) => (
        <motion.div key={i}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.08, duration: 0.5, ease: EASE }}
          style={{ position: "absolute", width: 28, height: 28, borderColor: "rgba(56,189,248,0.35)", ...s }}
        />
      ))}

      {/* Logo assemble */}
      <motion.div
        initial={{ scale: 0.4, opacity: 0, filter: "blur(16px)" }}
        animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.9, ease: EASE }}
        style={{ position: "relative", marginBottom: 36 }}
      >
        {/* outer ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          style={{ position: "absolute", inset: -18, borderRadius: "50%", border: "1px solid rgba(56,189,248,0.18)", borderTopColor: "rgba(56,189,248,0.55)" }}
        />
        {/* inner ring */}
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          style={{ position: "absolute", inset: -8, borderRadius: "50%", border: "1px dashed rgba(125,211,252,0.14)", borderRightColor: "rgba(125,211,252,0.40)" }}
        />
        <AegisLogo size={72} full={false} glow={true} />
      </motion.div>

      {/* Brand name */}
      <motion.div
        initial={{ opacity: 0, letterSpacing: "0.6em" }}
        animate={{ opacity: 1, letterSpacing: "0.18em" }}
        transition={{ duration: 1.0, delay: 0.3, ease: EASE }}
        style={{ marginBottom: 40 }}
      >
        <AegisLogo size={32} full={true} glow={false} />
      </motion.div>

      {/* Status lines */}
      <div style={{ width: 320, minHeight: 100 }}>
        {lines.slice(0, visibleLines).map((line, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              fontSize: "0.72rem",
              color: i === visibleLines - 1 ? "rgba(125,211,252,0.9)" : "rgba(125,211,252,0.35)",
              marginBottom: 8,
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            <span style={{ color: i === visibleLines - 1 ? "#4ade80" : "rgba(74,222,128,0.3)" }}>▸</span>
            {line}
            {i === visibleLines - 1 && (
              <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>_</motion.span>
            )}
          </motion.div>
        ))}
      </div>

      {/* SYSTEM READY flash */}
      <AnimatePresence>
        {phase === 2 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.85, 1, 1, 1.05] }}
            transition={{ duration: 1.0, times: [0, 0.2, 0.7, 1] }}
            style={{
              position: "absolute",
              fontSize: "clamp(1.4rem,3vw,2.2rem)",
              fontWeight: 900,
              letterSpacing: "0.22em",
              color: "rgba(56,189,248,0.95)",
              textShadow: "0 0 40px rgba(56,189,248,0.8), 0 0 80px rgba(56,189,248,0.4)",
              fontFamily: "'Orbitron',sans-serif",
            }}
          >
            SYSTEM READY
          </motion.div>
        )}
      </AnimatePresence>

      {/* progress bar */}
      <motion.div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "rgba(56,189,248,0.08)" }}>
        <motion.div
          initial={{ width: "0%" }}
          animate={{ width: phase >= 2 ? "100%" : phase >= 1 ? "70%" : "20%" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{ height: "100%", background: "linear-gradient(90deg,rgba(0,120,255,0.6),rgba(56,189,248,0.9))" }}
        />
      </motion.div>
    </motion.div>
  );
}

/* ─── Scroll progress bar ────────────────────────────────────────────────── */
function ScrollBar() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });
  return <motion.div className="scroll-line" style={{ scaleX }} />;
}

/* ─── Mouse glow (spring-smoothed) ──────────────────────────────────────── */
function MouseGlow() {
  const mx = useMotionValue(-999); const my = useMotionValue(-999);
  const sx = useSpring(mx, { stiffness: 60, damping: 18 });
  const sy = useSpring(my, { stiffness: 60, damping: 18 });
  useEffect(() => {
    const h = (e: MouseEvent) => { mx.set(e.clientX); my.set(e.clientY); };
    window.addEventListener("mousemove", h);
    return () => window.removeEventListener("mousemove", h);
  }, [mx, my]);
  return (
    <motion.div className="pointer-events-none fixed inset-0 z-10"
      style={{ background: `radial-gradient(circle at ${sx.get()}px ${sy.get()}px, rgba(99,102,241,0.1), transparent 34%)` }} />
  );
}

/* ─── Magnetic button ────────────────────────────────────────────────────── */
function MagButton({ children, onClick, style = {}, className = "" }: {
  children: React.ReactNode; onClick?: () => void;
  style?: React.CSSProperties; className?: string;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0); const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 20 });
  const sy = useSpring(y, { stiffness: 200, damping: 20 });

  const onMove = (e: React.MouseEvent) => {
    const r = ref.current!.getBoundingClientRect();
    x.set((e.clientX - r.left - r.width / 2) * 0.3);
    y.set((e.clientY - r.top - r.height / 2) * 0.3);
  };
  const onLeave = () => { x.set(0); y.set(0); };

  const addRipple = (e: React.MouseEvent) => {
    const btn = ref.current!;
    const r = btn.getBoundingClientRect();
    const rip = document.createElement("span");
    rip.className = "ripple-effect";
    const size = Math.max(r.width, r.height);
    rip.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX-r.left-size/2}px;top:${e.clientY-r.top-size/2}px`;
    btn.appendChild(rip);
    setTimeout(() => rip.remove(), 600);
    onClick?.();
  };

  return (
    <motion.button ref={ref} className={`ripple mag-btn ${className}`}
      style={{ ...style, x: sx, y: sy }}
      onMouseMove={onMove} onMouseLeave={onLeave} onClick={addRipple}
      whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
      {children}
    </motion.button>
  );
}

/* ─── Spotlight card (mouse-tracked inner glow) ──────────────────────────── */
function SpotCard({ children, style = {}, className = "" }: {
  children: React.ReactNode; style?: React.CSSProperties; className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent) => {
    const r = ref.current!.getBoundingClientRect();
    ref.current!.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
    ref.current!.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
  };
  return (
    <motion.div ref={ref} className={`spotlight-card grad-border ${className}`}
      style={style} onMouseMove={onMove}
      whileHover={{ y: -6, transition: { duration: 0.3, ease: EASE } }}>
      {children}
    </motion.div>
  );
}

/* ─── 3D tilt card ───────────────────────────────────────────────────────── */
function TiltCard({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const rx = useMotionValue(0); const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 150, damping: 20 });
  const sry = useSpring(ry, { stiffness: 150, damping: 20 });

  const onMove = (e: React.MouseEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    rx.set(py * -14); ry.set(px * 14);
  };
  const onLeave = () => { rx.set(0); ry.set(0); };

  return (
    <motion.div ref={ref} className="tilt-card" style={{ ...style, rotateX: srx, rotateY: sry, perspective: 800 }}
      onMouseMove={onMove} onMouseLeave={onLeave}>
      {children}
    </motion.div>
  );
}

/* ─── Animated counter ───────────────────────────────────────────────────── */
function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView || !ref.current) return;
    const ctrl = animate(0, to, {
      duration: 2, ease: "easeOut",
      onUpdate: v => { if (ref.current) ref.current.textContent = Math.round(v) + suffix; },
    });
    return () => ctrl.stop();
  }, [inView, to, suffix]);
  return <span ref={ref} className="counter-num">0{suffix}</span>;
}

/* ─── Word-by-word reveal ────────────────────────────────────────────────── */
function WordReveal({ text, className = "", delay = 0, style = {} }: { text: string; className?: string; delay?: number; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  return (
    <div ref={ref} className={className} style={{ overflow: "hidden", ...style }}>
      {text.split(" ").map((word, i) => (
        <motion.span key={i} style={{ display: "inline-block", marginRight: "0.28em" }}
          initial={{ opacity: 0, y: "110%", rotateX: -80 }}
          animate={inView ? { opacity: 1, y: "0%", rotateX: 0 } : {}}
          transition={{ duration: 0.75, delay: delay + i * 0.07, ease: EASE }}>
          {word}
        </motion.span>
      ))}
    </div>
  );
}

/* ─── Scene wrapper ──────────────────────────────────────────────────────── */
function Scene({ children, style = {}, className = "", delay = 0 }: {
  children: React.ReactNode; style?: React.CSSProperties; className?: string; delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-12% 0px" });
  return (
    <motion.div ref={ref} className={className} style={style}
      initial={{ opacity: 0, y: 52 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 1.1, delay, ease: EASE }}>
      {children}
    </motion.div>
  );
}

/* ─── Compare slider ─────────────────────────────────────────────────────── */
function CompareSlider({ before, after }: { before: string; after: string }) {
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const move = (cx: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.min(100, Math.max(0, ((cx - r.left) / r.width) * 100)));
  };
  return (
    <motion.div ref={ref} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.9, ease: EASE }}
      className="relative w-full max-w-3xl mx-auto rounded-2xl overflow-hidden select-none cursor-col-resize neon-border"
      style={{ aspectRatio: "4/3" }}
      onMouseDown={() => { dragging.current = true; }}
      onMouseMove={e => { if (dragging.current) move(e.clientX); }}
      onMouseUp={() => { dragging.current = false; }}
      onMouseLeave={() => { dragging.current = false; }}
      onTouchMove={e => move(e.touches[0].clientX)}>
      <img src={after} className="absolute inset-0 w-full h-full object-cover" alt="Enhanced" />
      <motion.div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold float-badge"
        style={{ background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.4)", color: "#a5b4fc" }}>
        <Sparkles size={11} /> AI Enhanced
      </motion.div>
      <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <img src={before} className="absolute inset-0 w-full h-full object-cover" alt="Original" style={{ filter: "brightness(0.7) blur(1px)" }} />
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
          style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }}>
          Original
        </div>
      </div>
      <div className="absolute top-0 bottom-0 w-0.5 bg-white/90 shadow-[0_0_16px_rgba(255,255,255,0.6)]"
        style={{ left: `${pos}%`, transform: "translateX(-50%)" }}>
        <motion.div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white shadow-xl flex items-center justify-center"
          animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 2, repeat: Infinity }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M4 7H1M10 7h3M4 4l-3 3 3 3M10 4l3 3-3 3" stroke="#0B0B0B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.div>
      </div>
    </motion.div>
  );
}

/* ─── Upload demo ────────────────────────────────────────────────────────── */
type UploadStatus = "idle" | "enhancing" | "done" | "error";

// Module-level ref so UploadDemo can trigger the auth modal without prop drilling
let _openAuth: ((tab: "login" | "register") => void) | null = null;

function UploadDemo() {
  const [before, setBefore] = useState<string | null>(null);
  const [after, setAfter] = useState<string | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!isEnhanceableImage(ext)) { setStatus("error"); return; }
    setBefore(URL.createObjectURL(file)); setAfter(null); setStatus("enhancing");
    try {
      const blob = await enhanceImage(URL.createObjectURL(file));
      setAfter(URL.createObjectURL(blob)); setStatus("done");
    } catch { setStatus("error"); }
  };

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 2rem" }}>
      <AnimatePresence mode="wait">
        {status === "idle" && (
          <motion.div key="drop" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.6, ease: EASE }}
            onClick={() => inputRef.current?.click()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handle(f); }}
            onDragOver={e => e.preventDefault()}
            className="neon-border"
            style={{ borderRadius: 20, padding: "72px 32px", textAlign: "center", cursor: "pointer", background: "rgba(99,102,241,0.03)", transition: "background 0.3s" }}
            whileHover={{ background: "rgba(99,102,241,0.07)" }}>
            <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png" onChange={e => { const f = e.target.files?.[0]; if (f) handle(f); }} style={{ display: "none" }} />
            <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              style={{ fontSize: "3.5rem", marginBottom: 20 }}>📄</motion.div>
            <p style={{ color: "#F0F0F0", fontWeight: 600, fontSize: "1.1rem", marginBottom: 8 }}>Drop a document image here</p>
            <p style={{ color: "rgba(240,240,240,0.35)", fontSize: "0.85rem" }}>JPG or PNG · Enhanced locally · No upload needed</p>
          </motion.div>
        )}
        {status === "enhancing" && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{ position: "relative", width: 64, height: 64, margin: "0 auto 28px" }}>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid transparent", borderTopColor: "#6366f1", borderRightColor: "#a78bfa" }} />
              <motion.div animate={{ rotate: -360 }} transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                style={{ position: "absolute", inset: 8, borderRadius: "50%", border: "1px solid transparent", borderTopColor: "#22d3ee" }} />
              <Sparkles size={20} color="#a78bfa" style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }} />
            </div>
            <motion.p animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }}
              style={{ color: "#a78bfa", fontSize: "1rem" }}>✨ Enhancing your document...</motion.p>
          </motion.div>
        )}
        {status === "error" && (
          <motion.p key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ textAlign: "center", color: "#f87171", padding: "40px 0", fontSize: "0.95rem" }}>
            ❌ Please upload a JPG or PNG image
          </motion.p>
        )}
      </AnimatePresence>

      {before && after && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}>
          <CompareSlider before={before} after={after} />
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
            style={{ textAlign: "center", marginTop: 14, color: "rgba(240,240,240,0.25)", fontSize: "0.78rem" }}>
            ← Drag to compare original vs AI enhanced
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}
            style={{ textAlign: "center", marginTop: 40 }}>
            <MagButton onClick={() => _openAuth?.("register")}
              style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "white", cursor: "pointer", fontSize: "1rem", fontWeight: 600, padding: "14px 32px", borderRadius: 12, boxShadow: "0 8px 32px rgba(99,102,241,0.4)" }}>
              Save to your vault <ArrowRight size={18} />
            </MagButton>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

/* ─── Dashboard preview ──────────────────────────────────────────────────── */
const DOCS = [
  { name: "Passport.jpg",        status: "Enhanced",   color: "#4ade80", icon: "🛂", pct: 100 },
  { name: "Resume_2024.pdf",     status: "Verified",   color: "#22d3ee", icon: "📄", pct: 100 },
  { name: "MedicalReport.png",   status: "Processing", color: "#fbbf24", icon: "🏥", pct: 45  },
  { name: "BankStatement.pdf",   status: "Enhanced",   color: "#4ade80", icon: "🏦", pct: 100 },
  { name: "VisaApplication.jpg", status: "Verified",   color: "#22d3ee", icon: "✈️", pct: 100 },
  { name: "Certificate.png",     status: "Enhanced",   color: "#4ade80", icon: "🎓", pct: 100 },
];

function DashboardPreview() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  return (
    <div ref={ref} style={{ maxWidth: 900, margin: "0 auto", padding: "0 2rem" }}>
      <motion.div initial={{ opacity: 0, y: -12 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7 }}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderRadius: "14px 14px 0 0", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderBottom: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Shield size={14} color="white" />
          </div>
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: "0.72rem", fontWeight: 600, color: "rgba(240,240,240,0.6)" }}>Aegis QR — Document Vault</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["#ff5f57","#febc2e","#28c840"].map(c => (
            <motion.div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c, opacity: 0.7 }}
              animate={{ opacity: [0.5, 0.9, 0.5] }} transition={{ duration: 2 + Math.random(), repeat: Infinity }} />
          ))}
        </div>
      </motion.div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 12, padding: 20, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "0 0 14px 14px" }}>
        {DOCS.map((doc, i) => (
          <motion.div key={doc.name}
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
            transition={{ duration: 0.6, delay: i * 0.1, ease: EASE }}
            className="spotlight-card"
            style={{ padding: "18px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", cursor: "default" }}
            whileHover={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.14)", y: -3, transition: { duration: 0.2 } }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: "1.4rem" }}>{doc.icon}</span>
              <motion.span
                initial={{ scale: 0 }} animate={inView ? { scale: 1 } : {}} transition={{ delay: i * 0.1 + 0.3, type: "spring", stiffness: 300 }}
                style={{ fontSize: "0.62rem", fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: `${doc.color}18`, color: doc.color, border: `1px solid ${doc.color}30`, letterSpacing: "0.05em" }}>
                {doc.status}
              </motion.span>
            </div>
            <p style={{ fontSize: "0.78rem", fontWeight: 500, color: "rgba(240,240,240,0.7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 10 }}>{doc.name}</p>
            <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
              <motion.div
                initial={{ width: 0 }} animate={inView ? { width: `${doc.pct}%` } : {}}
                transition={{ duration: 1.4, delay: i * 0.1 + 0.4, ease: "easeOut" }}
                style={{ height: "100%", borderRadius: 2, background: `linear-gradient(90deg, ${doc.color}88, ${doc.color})` }} />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              {[Download, Share2, Eye].map((Icon, j) => (
                <motion.button key={j} style={{ width: 26, height: 26, borderRadius: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                  whileHover={{ background: "rgba(99,102,241,0.15)", borderColor: "rgba(99,102,241,0.3)", scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                  <Icon size={11} color="rgba(240,240,240,0.5)" />
                </motion.button>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ─── Marquee trust bar ──────────────────────────────────────────────────── */
const TRUST_ITEMS = ["AES-256 Encrypted","Zero-Trust Access","Real-Time Approvals","AI Enhanced","GDPR Ready","End-to-End Secure","Audit Trail","Auto-Expiry","QR Verified","Privacy-First"];
function TrustMarquee() {
  const doubled = [...TRUST_ITEMS, ...TRUST_ITEMS];
  return (
    <div style={{ overflow: "hidden", padding: "20px 0", borderTop: "1px solid rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.04)", background: "rgba(255,255,255,0.01)" }}>
      <div className="marquee-track">
        {doubled.map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, color: "rgba(240,240,240,0.3)", fontSize: "0.8rem", fontWeight: 500, flexShrink: 0 }}>
            <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#6366f1" }} />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Auth Modal helpers (must be outside AuthModal to avoid React crash) ─── */
function ModalSpinner() {
  return (
    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      style={{ width: 17, height: 17, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.25)", borderTopColor: "white" }} />
  );
}

function ModalField({ type, value, onChange, placeholder, Icon, label, right }: {
  type: string; value: string; onChange: (v: string) => void;
  placeholder: string; Icon: React.ElementType; label: string; right?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: "0.63rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(125,211,252,0.55)", marginBottom: 6 }}>{label}</label>
      <motion.div animate={{ boxShadow: focused ? "0 0 0 1px rgba(56,189,248,0.55),0 0 18px rgba(56,189,248,0.1)" : "0 0 0 1px rgba(56,189,248,0.12)" }} transition={{ duration: 0.2 }}
        style={{ position: "relative", borderRadius: 11, background: "rgba(0,15,50,0.55)", backdropFilter: "blur(14px)" }}>
        <Icon size={13} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: focused ? "rgba(56,189,248,0.85)" : "rgba(125,211,252,0.3)", transition: "color 0.2s" }} />
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{ width: "100%", height: 44, paddingLeft: 36, paddingRight: right ? 40 : 13, background: "transparent", border: "none", outline: "none", color: "#e0f2fe", fontSize: "0.87rem", fontFamily: "inherit", boxSizing: "border-box" }} />
        {right && <div style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)" }}>{right}</div>}
        <motion.div animate={{ scaleX: focused ? 1 : 0, opacity: focused ? 1 : 0 }} transition={{ duration: 0.25 }}
          style={{ position: "absolute", bottom: 0, left: "8%", right: "8%", height: 1, background: "linear-gradient(90deg,transparent,rgba(56,189,248,0.7),transparent)", transformOrigin: "center", borderRadius: 1 }} />
      </motion.div>
    </div>
  );
}

/* ─── Auth Modal ─────────────────────────────────────────────────────────── */
function AuthModal({ open, tab: initTab, onClose }: { open: boolean; tab: "login" | "register"; onClose: () => void }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tab, setTab] = useState<"login" | "register">(initTab);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // sync tab when parent changes it
  useEffect(() => { setTab(initTab); }, [initTab]);
  // reset fields on open
  useEffect(() => { if (open) { setEmail(""); setPassword(""); setConfirmPw(""); setFullName(""); setSuccess(false); setShowPw(false); } }, [open]);
  // close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const pwStrength = (pw: string) => {
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  };
  const strengthColor = ["transparent","#f87171","#fbbf24","#34d399","#4ade80"][pwStrength(password)];
  const strengthLabel = ["","Weak","Fair","Good","Strong"][pwStrength(password)];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) {
        if (error.message.includes("Invalid login")) throw new Error("Incorrect email or password.");
        if (error.message.includes("Email not confirmed")) throw new Error("Please verify your email first.");
        throw error;
      }
      onClose();
      navigate("/dashboard");
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) { toast({ title: "Full name required", variant: "destructive" }); return; }
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) { toast({ title: "Valid email required", variant: "destructive" }); return; }
    if (password.length < 8) { toast({ title: "Password too short", description: "At least 8 characters", variant: "destructive" }); return; }
    if (password !== confirmPw) { toast({ title: "Passwords don't match", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(), password,
        options: { data: { full_name: fullName.trim() } },
      });
      if (error) throw error;
      if (data.session) { setSuccess(true); setTimeout(() => { onClose(); navigate("/dashboard"); }, 1600); }
      else { toast({ title: "Account created!", description: "Please sign in." }); setTab("login"); }
    } catch (err: any) {
      const msg = err.message || "Please try again.";
      toast({ title: msg.includes("already registered") ? "Account exists" : "Registration failed", description: msg.includes("already registered") ? "Please sign in instead." : msg, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    setGLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` } });
      if (error) throw error;
    } catch (err: any) {
      toast({ title: "Google sign-in failed", description: err.message, variant: "destructive" });
      setGLoading(false);
    }
  };

  const Spinner = ModalSpinner;
  const Field = ModalField;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* backdrop */}
          <motion.div key="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
            onClick={onClose}
            style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(2,8,24,0.82)", backdropFilter: "blur(12px)" }} />

          {/* modal */}
          <motion.div key="modal" initial={{ opacity: 0, y: 40, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.45, ease: EASE }}
            style={{ position: "fixed", inset: 0, zIndex: 501, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", pointerEvents: "none" }}>
            <div style={{ width: "100%", maxWidth: 420, pointerEvents: "auto", position: "relative" }}>
              {/* glow border */}
              <div style={{ position: "absolute", inset: -1, borderRadius: 26, background: "linear-gradient(135deg,rgba(56,189,248,0.2),rgba(99,102,241,0.12),rgba(56,189,248,0.06))", filter: "blur(1px)", zIndex: -1 }} />

              <div style={{ borderRadius: 24, background: "rgba(2,8,32,0.96)", backdropFilter: "blur(40px)", border: "1px solid rgba(56,189,248,0.14)", padding: "36px 32px", boxShadow: "0 40px 100px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)" }}>

                {/* close */}
                <motion.button onClick={onClose} whileHover={{ scale: 1.1, background: "rgba(255,255,255,0.08)" }} whileTap={{ scale: 0.95 }}
                  style={{ position: "absolute", top: 16, right: 16, width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(255,255,255,0.4)" }}>
                  <X size={15} />
                </motion.button>

                {/* success state */}
                {success ? (
                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 200 }}
                    style={{ textAlign: "center", padding: "32px 0" }}>
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
                      style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
                      <CheckCircle size={56} color="#4ade80" strokeWidth={1.5} />
                    </motion.div>
                    <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#e0f2fe", marginBottom: 8 }}>Vault created.</h2>
                    <p style={{ color: "rgba(125,211,252,0.4)", fontSize: "0.85rem" }}>Redirecting to your dashboard...</p>
                  </motion.div>
                ) : (
                  <>
                    {/* logo + tabs */}
                    <div style={{ textAlign: "center", marginBottom: 28 }}>
                      <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                        <AegisLogo size={48} full={false} glow={true} />
                      </div>
                      <div style={{ display: "inline-flex", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", padding: 3, gap: 2 }}>
                        {(["login","register"] as const).map(t => (
                          <motion.button key={t} onClick={() => setTab(t)}
                            style={{ padding: "7px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: "0.82rem", fontWeight: 600, fontFamily: "inherit", position: "relative", background: "transparent", color: tab === t ? "#e0f2fe" : "rgba(125,211,252,0.35)", transition: "color 0.2s" }}>
                            {tab === t && (
                              <motion.div layoutId="tab-bg" style={{ position: "absolute", inset: 0, borderRadius: 8, background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.22)" }} transition={{ duration: 0.25 }} />
                            )}
                            <span style={{ position: "relative" }}>{t === "login" ? "Sign In" : "Sign Up"}</span>
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    <AnimatePresence mode="wait">
                      {tab === "login" ? (
                        <motion.form key="login" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.25 }} onSubmit={handleLogin}>
                          <Field type="email" value={email} onChange={setEmail} placeholder="you@example.com" Icon={Mail} label="Email" />
                          <Field type={showPw ? "text" : "password"} value={password} onChange={setPassword} placeholder="••••••••" Icon={Lock} label="Password"
                            right={<button type="button" onClick={() => setShowPw(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(125,211,252,0.4)", display: "flex", padding: 0 }}>{showPw ? <EyeOff size={14} /> : <Eye size={14} />}</button>} />
                          <motion.button type="submit" disabled={loading} whileHover={{ scale: 1.02, boxShadow: "0 10px 32px rgba(0,110,255,0.45)" }} whileTap={{ scale: 0.97 }}
                            style={{ width: "100%", height: 50, borderRadius: 12, background: "linear-gradient(135deg,#0048c0,#38bdf8)", border: "none", color: "white", fontSize: "0.95rem", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, marginTop: 6, opacity: loading ? 0.7 : 1, boxShadow: "0 4px 24px rgba(0,110,255,0.3)", fontFamily: "inherit" }}>
                            {loading ? <Spinner /> : <><span>Sign In</span><ArrowRight size={16} /></>}
                          </motion.button>
                        </motion.form>
                      ) : (
                        <motion.form key="register" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }} onSubmit={handleRegister}>
                          <Field type="text" value={fullName} onChange={setFullName} placeholder="John Doe" Icon={User} label="Full Name" />
                          <Field type="email" value={email} onChange={setEmail} placeholder="you@example.com" Icon={Mail} label="Email" />
                          <Field type={showPw ? "text" : "password"} value={password} onChange={setPassword} placeholder="••••••••" Icon={Lock} label="Password"
                            right={<button type="button" onClick={() => setShowPw(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(125,211,252,0.4)", display: "flex", padding: 0 }}>{showPw ? <EyeOff size={14} /> : <Eye size={14} />}</button>} />
                          {password.length > 0 && (
                            <div style={{ marginBottom: 12, marginTop: -6 }}>
                              <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden", marginBottom: 4 }}>
                                <motion.div animate={{ width: `${(pwStrength(password) / 4) * 100}%` }} transition={{ duration: 0.35 }} style={{ height: "100%", borderRadius: 2, background: strengthColor }} />
                              </div>
                              <span style={{ fontSize: "0.65rem", color: strengthColor, letterSpacing: "0.06em" }}>{strengthLabel}</span>
                            </div>
                          )}
                          <Field type={showConfirm ? "text" : "password"} value={confirmPw} onChange={setConfirmPw} placeholder="••••••••" Icon={Lock} label="Confirm Password"
                            right={<button type="button" onClick={() => setShowConfirm(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(125,211,252,0.4)", display: "flex", padding: 0 }}>{showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}</button>} />
                          <motion.button type="submit" disabled={loading} whileHover={{ scale: 1.02, boxShadow: "0 10px 32px rgba(0,110,255,0.45)" }} whileTap={{ scale: 0.97 }}
                            style={{ width: "100%", height: 50, borderRadius: 12, background: "linear-gradient(135deg,#0048c0,#38bdf8)", border: "none", color: "white", fontSize: "0.95rem", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, marginTop: 6, opacity: loading ? 0.7 : 1, boxShadow: "0 4px 24px rgba(0,110,255,0.3)", fontFamily: "inherit" }}>
                            {loading ? <Spinner /> : <><span>Create Account</span><ArrowRight size={16} /></>}
                          </motion.button>
                        </motion.form>
                      )}
                    </AnimatePresence>

                    {/* divider + google */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0" }}>
                      <div style={{ flex: 1, height: 1, background: "rgba(56,189,248,0.09)" }} />
                      <span style={{ color: "rgba(125,211,252,0.25)", fontSize: "0.7rem", letterSpacing: "0.06em" }}>or</span>
                      <div style={{ flex: 1, height: 1, background: "rgba(56,189,248,0.09)" }} />
                    </div>
                    <motion.button type="button" onClick={handleGoogle} disabled={gLoading}
                      whileHover={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(56,189,248,0.3)" }} whileTap={{ scale: 0.98 }}
                      style={{ width: "100%", height: 47, borderRadius: 11, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(224,242,254,0.7)", fontSize: "0.86rem", fontWeight: 500, cursor: gLoading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, transition: "all 0.2s", fontFamily: "inherit" }}>
                      {gLoading ? <Spinner /> : <>
                        <svg width="17" height="17" viewBox="0 0 24 24">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        Continue with Google
                      </>}
                    </motion.button>
                  </>
                )}
              </div>
              {/* bottom glow */}
              <motion.div animate={{ opacity: [0.2, 0.6, 0.2] }} transition={{ duration: 3.5, repeat: Infinity }}
                style={{ height: 1, background: "linear-gradient(90deg,transparent,rgba(56,189,248,0.35),transparent)", marginTop: 1 }} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ─── MAIN PAGE ──────────────────────────────────────────────────────────── */
export default function Index() {
  const navigate = useNavigate();

  // Boot screen
  const [bootDone, setBootDone] = useState(false);

  // Auth modal
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("register");
  const openAuth = (tab: "login" | "register") => { setAuthTab(tab); setAuthOpen(true); };

  // Wire module-level ref so UploadDemo sub-component can open the modal
  useEffect(() => { _openAuth = openAuth; return () => { _openAuth = null; }; }, []);

  // Cinematic intro
  const [introPhase, setIntroPhase] = useState<"l1"|"l2"|"done">("l1");
  const [introComplete, setIntroComplete] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setIntroPhase("l2"), 2400);
    const t2 = setTimeout(() => { setIntroPhase("done"); setIntroComplete(true); }, 4800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // Scrolled nav
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  // Hero parallax
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: heroP } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(heroP, [0, 1], [0, 140]);
  const heroOp = useTransform(heroP, [0, 0.65], [1, 0]);
  const heroScale = useTransform(heroP, [0, 1], [1, 0.92]);

  // Spotlight card mouse handler
  const spotMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
  }, []);

  return (
    <div style={{ background: "#020818", color: "#F0F0F0", fontFamily: "'Inter',sans-serif", overflowX: "hidden" }}>
      <CinematicBackground fixed={true} />
      <ScrollBar />
      <MouseGlow />

      {/* ── BOOT SCREEN ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {!bootDone && <BootScreen key="boot" onDone={() => setBootDone(true)} />}
      </AnimatePresence>

      {/* ── CINEMATIC INTRO ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {bootDone && !introComplete && (
          <motion.div key="intro" exit={{ opacity: 0, scale: 1.04 }} transition={{ duration: 1.4, ease: EASE }}
            style={{ position: "fixed", inset: 0, zIndex: 200, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ position: "relative", zIndex: 1, textAlign: "center", padding: "0 2rem" }}>
              <AnimatePresence mode="wait">
                {introPhase === "l1" && (
                  <motion.div key="l1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -30 }} transition={{ duration: 0.4 }}>
                    <motion.h1
                      initial={{ opacity: 0, y: 40, filter: "blur(20px)", letterSpacing: "0.3em" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)", letterSpacing: "-0.03em" }}
                      transition={{ duration: 1.6, ease: EASE }}
                      style={{ fontSize: "clamp(2.4rem,6vw,5.5rem)", fontWeight: 900, color: "#F0F0F0", lineHeight: 1.05 }}>
                      Protect what matters.
                    </motion.h1>
                    <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1.2, delay: 0.8, ease: EASE }}
                      style={{ height: 1, background: "linear-gradient(90deg,transparent,rgba(99,102,241,0.6),transparent)", marginTop: 24, transformOrigin: "left" }} />
                  </motion.div>
                )}
                {introPhase === "l2" && (
                  <motion.div key="l2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -30 }} transition={{ duration: 0.4 }}>
                    <motion.h1
                      initial={{ opacity: 0, y: 40, filter: "blur(20px)", letterSpacing: "0.3em" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)", letterSpacing: "-0.03em" }}
                      transition={{ duration: 1.6, ease: EASE }}
                      style={{ fontSize: "clamp(2.4rem,6vw,5.5rem)", fontWeight: 900, lineHeight: 1.05, background: "linear-gradient(135deg,#6366f1,#a78bfa,#22d3ee)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                      Verify what's real.
                    </motion.h1>
                    <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1.2, delay: 0.8, ease: EASE }}
                      style={{ height: 1, background: "linear-gradient(90deg,transparent,rgba(34,211,238,0.5),transparent)", marginTop: 24, transformOrigin: "left" }} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
              onClick={() => { setIntroPhase("done"); setIntroComplete(true); }}
              style={{ position: "absolute", bottom: 40, right: 40, background: "none", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: "0.72rem", padding: "8px 16px", borderRadius: 8, letterSpacing: "0.08em" }}
              whileHover={{ color: "rgba(255,255,255,0.7)", borderColor: "rgba(255,255,255,0.3)" }}>
              SKIP
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <motion.nav initial={{ opacity: 0, y: -24 }} animate={introComplete ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.8, delay: 0.2 }}
        style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, padding: "0 2.5rem", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", background: scrolled ? "rgba(6,6,15,0.9)" : "transparent", backdropFilter: scrolled ? "blur(24px)" : "none", borderBottom: scrolled ? "1px solid rgba(255,255,255,0.05)" : "none", transition: "all 0.4s ease" }}>
        <motion.div style={{ display: "flex", alignItems: "center" }} whileHover={{ scale: 1.03 }}>
          <AegisLogo size={36} full={true} glow={true} />
        </motion.div>
        <div style={{ display: "flex", gap: 28, alignItems: "center" }}>
          {[["Features","features"],["Demo","demo"],["Login",""]].map(([label, id]) => (
            <motion.button key={label}
              onClick={() => id ? document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }) : openAuth("login")}
              style={{ background: "none", border: "none", color: "rgba(240,240,240,0.4)", cursor: "pointer", fontSize: "0.85rem", padding: "6px 0", position: "relative" }}
              whileHover={{ color: "#F0F0F0" }}>
              {label}
              <motion.div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg,#6366f1,#22d3ee)", scaleX: 0, transformOrigin: "left" }}
                whileHover={{ scaleX: 1 }} transition={{ duration: 0.3 }} />
            </motion.button>
          ))}
          <MagButton onClick={() => openAuth("register")}
            style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "white", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600, padding: "9px 22px", borderRadius: 9, boxShadow: "0 4px 20px rgba(99,102,241,0.35)" }}>
            Get Started
          </MagButton>
        </div>
      </motion.nav>

      {/* ══ HERO ══════════════════════════════════════════════════════════ */}
      <section ref={heroRef} style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "120px 2rem 80px", position: "relative", overflow: "hidden" }}>
        <motion.div style={{ y: heroY, opacity: heroOp, scale: heroScale, position: "relative", zIndex: 1, maxWidth: 860, margin: "0 auto" }}>
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.9 }} animate={introComplete ? { opacity: 1, y: 0, scale: 1 } : {}} transition={{ duration: 0.8, delay: 0.4 }}
            className="float-badge"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 16px", borderRadius: 100, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc", fontSize: "0.75rem", fontWeight: 600, marginBottom: 36, letterSpacing: "0.04em" }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: "linear" }}><Sparkles size={12} /></motion.div>
            AI-Powered Document Security
          </motion.div>

          <div style={{ overflow: "hidden", marginBottom: 24 }}>
            <motion.h1 initial={{ y: "110%", opacity: 0 }} animate={introComplete ? { y: "0%", opacity: 1 } : {}} transition={{ duration: 1.1, delay: 0.55, ease: EASE }}
              style={{ fontSize: "clamp(3rem,7.5vw,6rem)", fontWeight: 900, lineHeight: 1.02, letterSpacing: "-0.035em" }}>
              Protect what matters.
            </motion.h1>
          </div>
          <div style={{ overflow: "hidden", marginBottom: 32 }}>
            <motion.h1 initial={{ y: "110%", opacity: 0 }} animate={introComplete ? { y: "0%", opacity: 1 } : {}} transition={{ duration: 1.1, delay: 0.72, ease: EASE }}
              style={{ fontSize: "clamp(3rem,7.5vw,6rem)", fontWeight: 900, lineHeight: 1.02, letterSpacing: "-0.035em", background: "linear-gradient(135deg,#6366f1,#a78bfa 50%,#22d3ee)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              Verify what's real.
            </motion.h1>
          </div>

          <motion.p initial={{ opacity: 0, y: 20 }} animate={introComplete ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.9, delay: 1.0 }}
            style={{ fontSize: "clamp(1rem,2vw,1.2rem)", color: "rgba(240,240,240,0.45)", maxWidth: 540, margin: "0 auto 52px", lineHeight: 1.8 }}>
            AI-powered document enhancement and QR verification.<br />
            Share a QR code. Every access requires your approval.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={introComplete ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.8, delay: 1.2 }}
            style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            <MagButton onClick={() => openAuth("register")}
              style={{ display: "flex", alignItems: "center", gap: 9, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "white", cursor: "pointer", fontSize: "1rem", fontWeight: 700, padding: "15px 34px", borderRadius: 13, boxShadow: "0 8px 32px rgba(99,102,241,0.45)" }}>
              Upload Document <ArrowRight size={18} />
            </MagButton>
            <MagButton onClick={() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })}
              style={{ display: "flex", alignItems: "center", gap: 9, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(240,240,240,0.85)", cursor: "pointer", fontSize: "1rem", fontWeight: 500, padding: "15px 34px", borderRadius: 13 }}>
              <Eye size={18} /> View Demo
            </MagButton>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={introComplete ? { opacity: 1 } : {}} transition={{ delay: 1.6 }}
            style={{ display: "flex", flexWrap: "wrap", gap: 24, justifyContent: "center", marginTop: 60 }}>
            {["AES-256 Encrypted","Zero-Trust Access","Real-Time Approvals","AI Enhanced"].map((item, i) => (
              <motion.div key={item} initial={{ opacity: 0, x: -10 }} animate={introComplete ? { opacity: 1, x: 0 } : {}} transition={{ delay: 1.7 + i * 0.1 }}
                style={{ display: "flex", alignItems: "center", gap: 7, color: "rgba(240,240,240,0.3)", fontSize: "0.8rem" }}>
                <CheckCircle size={14} color="#4ade80" /> {item}
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* Scroll mouse indicator */}
        <motion.div initial={{ opacity: 0 }} animate={introComplete ? { opacity: 1 } : {}} transition={{ delay: 2.2 }}
          style={{ position: "absolute", bottom: 44, left: "50%", transform: "translateX(-50%)" }}>
          <motion.div animate={{ y: [0, 10, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            style={{ width: 26, height: 42, borderRadius: 13, border: "1px solid rgba(255,255,255,0.14)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "7px 0" }}>
            <motion.div animate={{ y: [0, 16, 0], opacity: [1, 0, 1] }} transition={{ duration: 2.2, repeat: Infinity }}
              style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(99,102,241,0.7)" }} />
          </motion.div>
        </motion.div>
      </section>

      {/* ══ TRUST MARQUEE ═════════════════════════════════════════════════ */}
      <TrustMarquee />

      {/* ══ SCENE 1 — PROBLEM ═════════════════════════════════════════════ */}
      <section style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "120px 2rem", textAlign: "center" }}>
        <div style={{ maxWidth: 720 }}>
          <Scene delay={0}>
            <p style={{ fontSize: "0.68rem", letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(240,240,240,0.2)", marginBottom: 36 }}>01 — The Problem</p>
          </Scene>
          <WordReveal text="Documents lose clarity." className="" style={{ fontSize: "clamp(2.4rem,5.5vw,4.2rem)", fontWeight: 800, lineHeight: 1.08, letterSpacing: "-0.025em", marginBottom: 16 } as React.CSSProperties} delay={0.1} />
          <WordReveal text="Trust disappears." className="" style={{ fontSize: "clamp(2.4rem,5.5vw,4.2rem)", fontWeight: 800, lineHeight: 1.08, letterSpacing: "-0.025em", color: "rgba(240,240,240,0.28)" } as React.CSSProperties} delay={0.3} />
          <Scene delay={0.2} style={{ marginTop: 48 }}>
            <p style={{ color: "rgba(240,240,240,0.38)", fontSize: "1.05rem", lineHeight: 1.8, maxWidth: 520, margin: "0 auto 48px" }}>
              Every time you hand over a document, you lose control. You don't know who sees it, copies it, or keeps it.
            </p>
            <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
              {[
                { icon: "📷", text: "Blurry phone photos" },
                { icon: "🔓", text: "No access control" },
                { icon: "🕵️", text: "No audit trail" },
              ].map((item, i) => (
                <TiltCard key={i}>
                  <div style={{ padding: "16px 22px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", fontSize: "0.85rem", color: "rgba(240,240,240,0.45)", display: "flex", alignItems: "center", gap: 10 }}>
                    <span>{item.icon}</span> {item.text}
                  </div>
                </TiltCard>
              ))}
            </div>
          </Scene>
        </div>
      </section>

      {/* ══ SCENE 2 — TENSION ═════════════════════════════════════════════ */}
      <section style={{ minHeight: "65vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "100px 2rem", textAlign: "center", background: "rgba(255,255,255,0.012)", borderTop: "1px solid rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ maxWidth: 700 }}>
          <Scene><p style={{ fontSize: "0.68rem", letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(240,240,240,0.2)", marginBottom: 36 }}>02 — The Tension</p></Scene>
          <WordReveal text="Blurry files." style={{ fontSize: "clamp(2.2rem,5vw,4rem)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.025em", marginBottom: 12 } as React.CSSProperties} delay={0.05} />
          <WordReveal text="No verification." style={{ fontSize: "clamp(2.2rem,5vw,4rem)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.025em", color: "rgba(240,240,240,0.28)" } as React.CSSProperties} delay={0.2} />
        </div>
      </section>

      {/* ══ SCENE 3 — SOLUTION ════════════════════════════════════════════ */}
      <section style={{ minHeight: "65vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "120px 2rem", textAlign: "center" }}>
        <div style={{ maxWidth: 700 }}>
          <Scene><p style={{ fontSize: "0.68rem", letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(99,102,241,0.55)", marginBottom: 36 }}>03 — The Solution</p></Scene>
          <WordReveal text="Aegis QR changes that." style={{ fontSize: "clamp(2.2rem,5vw,4rem)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.025em", marginBottom: 28 } as React.CSSProperties} delay={0.05} />
          <Scene delay={0.2}>
            <p style={{ color: "rgba(240,240,240,0.4)", fontSize: "1.05rem", lineHeight: 1.8, maxWidth: 500, margin: "0 auto 40px" }}>
              One vault. AI-enhanced clarity. Zero-trust sharing. Every access requires your personal approval — in real time.
            </p>
            <motion.div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 26px", borderRadius: 100, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc", fontSize: "0.9rem", fontWeight: 500 }}
              animate={{ boxShadow: ["0 0 0px rgba(99,102,241,0)", "0 0 24px rgba(99,102,241,0.3)", "0 0 0px rgba(99,102,241,0)"] }}
              transition={{ duration: 3, repeat: Infinity }}>
              <Sparkles size={16} /> AI-powered clarity. Secure verification.
            </motion.div>
          </Scene>
        </div>
      </section>

      {/* ══ SCENE 4 — LIVE DEMO ═══════════════════════════════════════════ */}
      <section id="demo" style={{ padding: "120px 0", background: "rgba(255,255,255,0.012)", borderTop: "1px solid rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <Scene style={{ textAlign: "center", marginBottom: 56, padding: "0 2rem" }}>
          <p style={{ fontSize: "0.68rem", letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(99,102,241,0.55)", marginBottom: 20 }}>04 — The Experience</p>
          <h2 style={{ fontSize: "clamp(2rem,5vw,3.6rem)", fontWeight: 800, lineHeight: 1.08, letterSpacing: "-0.025em", marginBottom: 16 }}>From blurry to brilliant.</h2>
          <p style={{ color: "rgba(240,240,240,0.38)", fontSize: "1rem", maxWidth: 440, margin: "0 auto" }}>Drop any JPG or PNG. Watch AI clarity kick in — runs entirely in your browser.</p>
        </Scene>
        <UploadDemo />
      </section>

      {/* ══ SCENE 5 — FEATURES ════════════════════════════════════════════ */}
      <section id="features" style={{ padding: "120px 2rem", maxWidth: 1040, margin: "0 auto" }}>
        <Scene style={{ textAlign: "center", marginBottom: 72 }}>
          <p style={{ fontSize: "0.68rem", letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(240,240,240,0.2)", marginBottom: 20 }}>05 — The Intelligence</p>
          <h2 style={{ fontSize: "clamp(2rem,5vw,3.6rem)", fontWeight: 800, lineHeight: 1.08, letterSpacing: "-0.025em", marginBottom: 16 }}>
            AI-powered clarity.<br />
            <span style={{ background: "linear-gradient(135deg,#6366f1,#a78bfa,#22d3ee)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Secure verification.</span>
          </h2>
        </Scene>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 20 }}>
          {[
            { icon: <Sparkles size={22} color="#a78bfa" />, bg: "rgba(167,139,250,0.12)", bd: "rgba(167,139,250,0.25)", title: "AI Enhancement", desc: "Unsharp mask + 2× upscale. Colors preserved. Runs in your browser.", tag: "Core" },
            { icon: <QrCode size={22} color="#22d3ee" />, bg: "rgba(34,211,238,0.1)", bd: "rgba(34,211,238,0.22)", title: "QR Verification", desc: "Unique token per share. You approve every scan in real time.", tag: "Zero-Trust" },
            { icon: <Lock size={22} color="#4ade80" />, bg: "rgba(74,222,128,0.1)", bd: "rgba(74,222,128,0.22)", title: "AES-256 Storage", desc: "Encrypted at rest. Signed URLs auto-expire. Nothing leaks.", tag: "Privacy" },
            { icon: <Zap size={22} color="#fbbf24" />, bg: "rgba(251,191,36,0.1)", bd: "rgba(251,191,36,0.22)", title: "Real-Time Control", desc: "Approve or reject in seconds from anywhere. Access auto-expires.", tag: "Live" },
            { icon: <Eye size={22} color="#f472b6" />, bg: "rgba(244,114,182,0.1)", bd: "rgba(244,114,182,0.22)", title: "Full Audit Trail", desc: "Every scan logged — timestamp, device, IP. Zero surprises.", tag: "Transparent" },
            { icon: <Shield size={22} color="#6366f1" />, bg: "rgba(99,102,241,0.1)", bd: "rgba(99,102,241,0.22)", title: "Smart QR Profiles", desc: "Medical, travel, resume — purpose-specific QR codes.", tag: "Flexible" },
          ].map((f, i) => (
            <motion.div key={f.title}
              initial={{ opacity: 0, y: 32, scale: 0.96 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: "-8% 0px" }}
              transition={{ duration: 0.75, delay: i * 0.09, ease: EASE }}
              className="spotlight-card"
              onMouseMove={spotMove}
              style={{ padding: "28px 24px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", cursor: "default", position: "relative" }}
              whileHover={{ background: f.bg, borderColor: f.bd, y: -6, transition: { duration: 0.25 } }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
                <motion.div style={{ width: 44, height: 44, borderRadius: 11, background: f.bg, border: `1px solid ${f.bd}`, display: "flex", alignItems: "center", justifyContent: "center" }}
                  whileHover={{ scale: 1.12, rotate: 5 }} transition={{ duration: 0.2 }}>
                  {f.icon}
                </motion.div>
                <span style={{ fontSize: "0.62rem", fontWeight: 700, padding: "3px 9px", borderRadius: 4, background: "rgba(255,255,255,0.04)", color: "rgba(240,240,240,0.28)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{f.tag}</span>
              </div>
              <h3 style={{ fontWeight: 700, marginBottom: 8, fontSize: "0.98rem" }}>{f.title}</h3>
              <p style={{ color: "rgba(240,240,240,0.38)", fontSize: "0.84rem", lineHeight: 1.65 }}>{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══ STATS ═════════════════════════════════════════════════════════ */}
      <section style={{ padding: "80px 2rem", background: "rgba(255,255,255,0.012)", borderTop: "1px solid rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 20 }}>
          {[
            { val: 256, suffix: "-bit", label: "Encryption" },
            { val: 100, suffix: "%", label: "Owner-controlled" },
            { val: 0, suffix: "ms", label: "Auto-expiry delay" },
            { val: 99, suffix: ".9%", label: "Uptime SLA" },
          ].map((s, i) => (
            <motion.div key={s.label}
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ duration: 0.7, delay: i * 0.1, ease: EASE }}
              style={{ textAlign: "center", padding: "32px 20px", borderRadius: 14, background: "rgba(99,102,241,0.04)", border: "1px solid rgba(99,102,241,0.12)" }}>
              <div style={{ fontSize: "2.4rem", fontWeight: 900, fontFamily: "'Orbitron',sans-serif", background: "linear-gradient(135deg,#6366f1,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", marginBottom: 8 }}>
                <Counter to={s.val} suffix={s.suffix} />
              </div>
              <div style={{ color: "rgba(240,240,240,0.35)", fontSize: "0.8rem", letterSpacing: "0.05em" }}>{s.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══ SCENE 6 — DASHBOARD ═══════════════════════════════════════════ */}
      <section style={{ padding: "120px 0", background: "rgba(255,255,255,0.012)", borderTop: "1px solid rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <Scene style={{ textAlign: "center", marginBottom: 56, padding: "0 2rem" }}>
          <p style={{ fontSize: "0.68rem", letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(240,240,240,0.2)", marginBottom: 20 }}>06 — The Product</p>
          <h2 style={{ fontSize: "clamp(2rem,5vw,3.6rem)", fontWeight: 800, lineHeight: 1.08, letterSpacing: "-0.025em", marginBottom: 16 }}>Your vault. Your rules.</h2>
          <p style={{ color: "rgba(240,240,240,0.38)", fontSize: "1rem", maxWidth: 420, margin: "0 auto" }}>Every document tracked, enhanced, and ready to share — on your terms.</p>
        </Scene>
        <DashboardPreview />
      </section>

      {/* ══ FINAL CTA ═════════════════════════════════════════════════════ */}
      <section style={{ padding: "140px 2rem 180px", textAlign: "center" }}>
        <Scene>
          <TiltCard style={{ maxWidth: 680, margin: "0 auto" }}>
            <div style={{ padding: "88px 52px", borderRadius: 24, background: "linear-gradient(145deg,rgba(99,102,241,0.09),rgba(139,92,246,0.05))", border: "1px solid rgba(99,102,241,0.22)", boxShadow: "0 0 120px rgba(99,102,241,0.14)", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 500, height: 260, borderRadius: "50%", background: "radial-gradient(ellipse,rgba(99,102,241,0.16) 0%,transparent 70%)", filter: "blur(40px)", pointerEvents: "none" }} />
              <div style={{ position: "relative" }}>
                <p style={{ fontSize: "0.68rem", letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(99,102,241,0.55)", marginBottom: 28 }}>Final Scene</p>
                <div style={{ margin: "0 auto 32px", display: "flex", justifyContent: "center" }}>
                  <AegisLogo size={60} full={false} glow={true} />
                </div>
                <h2 style={{ fontSize: "clamp(1.9rem,4vw,3.2rem)", fontWeight: 800, lineHeight: 1.08, letterSpacing: "-0.025em", marginBottom: 18 }}>
                  Start securing your<br />documents today.
                </h2>
                <p style={{ color: "rgba(240,240,240,0.38)", fontSize: "1rem", marginBottom: 48, lineHeight: 1.7 }}>
                  Free to start. No credit card required.<br />Your privacy, your control.
                </p>
                <MagButton onClick={() => openAuth("register")}
                  style={{ display: "inline-flex", alignItems: "center", gap: 12, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "white", cursor: "pointer", fontSize: "1.05rem", fontWeight: 700, padding: "17px 44px", borderRadius: 13, boxShadow: "0 8px 32px rgba(99,102,241,0.5)" }}>
                  Create Your Free Vault <ArrowRight size={20} />
                </MagButton>
              </div>
            </div>
          </TiltCard>
        </Scene>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.04)", padding: "32px 2rem", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "rgba(240,240,240,0.18)", fontSize: "0.78rem" }}>
          <AegisLogo size={22} full={false} glow={false} />
          <span>Privacy-first document security</span>
        </div>
      </footer>

      {/* ── AUTH MODAL ──────────────────────────────────────────────────── */}
      <AuthModal open={authOpen} tab={authTab} onClose={() => setAuthOpen(false)} />

      <style>{`html{scroll-behavior:smooth}*{box-sizing:border-box}`}</style>
    </div>
  );
}

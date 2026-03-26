import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, ArrowRight } from "lucide-react";
import CinematicBackground from "@/components/CinematicBackground";
import AegisLogo from "@/components/AegisLogo";

const EASE = [0.16, 1, 0.3, 1] as const;

/* ── Particle canvas ─────────────────────────────────────────────────────── */
function Particles() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    let W = 0, H = 0, raf = 0;
    const resize = () => { W = c.width = c.offsetWidth; H = c.height = c.offsetHeight; };
    resize();
    window.addEventListener("resize", resize);
    const pts = Array.from({ length: 60 }, () => ({
      x: Math.random(), y: Math.random(),
      vx: (Math.random() - 0.5) * 0.00011,
      vy: (Math.random() - 0.5) * 0.00011,
      r: Math.random() * 1.5 + 0.3,
      op: Math.random() * 0.35 + 0.05,
      tw: Math.random() * Math.PI * 2,
    }));
    const tick = () => {
      ctx.clearRect(0, 0, W, H);
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = 1; if (p.x > 1) p.x = 0;
        if (p.y < 0) p.y = 1; if (p.y > 1) p.y = 0;
        p.tw += 0.018;
        const op = p.op * (0.35 + Math.sin(p.tw) * 0.65);
        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(56,189,248,${op})`;
        ctx.fill();
      }
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 0.13) {
            ctx.beginPath();
            ctx.moveTo(pts[i].x * W, pts[i].y * H);
            ctx.lineTo(pts[j].x * W, pts[j].y * H);
            ctx.strokeStyle = `rgba(56,189,248,${(1 - d / 0.13) * 0.065})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 1 }} />;
}

/* ── Cinematic input ─────────────────────────────────────────────────────── */
function Field({
  type, value, onChange, placeholder, Icon, label, right, delay = 0,
}: {
  type: string; value: string; onChange: (v: string) => void;
  placeholder: string; Icon: React.ElementType; label: string;
  right?: React.ReactNode; delay?: number;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, x: -22 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.55, delay, ease: EASE }}
      style={{ marginBottom: 18 }}
    >
      <label style={{ display: "block", fontSize: "0.67rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(125,211,252,0.6)", marginBottom: 8 }}>
        {label}
      </label>
      <motion.div
        animate={{ boxShadow: focused ? "0 0 0 1px rgba(56,189,248,0.55), 0 0 22px rgba(56,189,248,0.12)" : "0 0 0 1px rgba(56,189,248,0.12)" }}
        transition={{ duration: 0.25 }}
        style={{ position: "relative", borderRadius: 12, background: "rgba(0,15,50,0.55)", backdropFilter: "blur(14px)" }}
      >
        <Icon size={14} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", transition: "color 0.3s", color: focused ? "rgba(56,189,248,0.85)" : "rgba(125,211,252,0.3)" }} />
        <input
          type={type} value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ width: "100%", height: 48, paddingLeft: 38, paddingRight: right ? 42 : 14, background: "transparent", border: "none", outline: "none", color: "#e0f2fe", fontSize: "0.9rem", fontFamily: "inherit", boxSizing: "border-box" }}
        />
        {right && <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}>{right}</div>}
        <motion.div
          animate={{ scaleX: focused ? 1 : 0, opacity: focused ? 1 : 0 }}
          transition={{ duration: 0.3 }}
          style={{ position: "absolute", bottom: 0, left: "8%", right: "8%", height: 1, background: "linear-gradient(90deg,transparent,rgba(56,189,248,0.75),transparent)", transformOrigin: "center", borderRadius: 1 }}
        />
      </motion.div>
    </motion.div>
  );
}

/* ── Main ────────────────────────────────────────────────────────────────── */
export default function LoginPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [ready, setReady] = useState(false);

  const mx = useMotionValue(-999); const my = useMotionValue(-999);
  const sx = useSpring(mx, { stiffness: 50, damping: 15 });
  const sy = useSpring(my, { stiffness: 50, damping: 15 });

  useEffect(() => {
    setReady(true);
    supabase.auth.getSession().then(({ data: { session } }) => { if (session) navigate("/dashboard"); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => { if (session) navigate("/dashboard"); });
    const h = (e: MouseEvent) => { mx.set(e.clientX); my.set(e.clientY); };
    window.addEventListener("mousemove", h);
    return () => { subscription.unsubscribe(); window.removeEventListener("mousemove", h); };
  }, [navigate, mx, my]);

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
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message, variant: "destructive" });
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

  return (
    <div style={{ minHeight: "100vh", background: "#020818", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter',sans-serif", position: "relative", overflow: "hidden" }}>
      <CinematicBackground />
      <Particles />

      {/* mouse glow */}
      <motion.div className="pointer-events-none fixed inset-0" style={{ zIndex: 2, background: `radial-gradient(circle at ${sx.get()}px ${sy.get()}px, rgba(0,100,220,0.08), transparent 36%)` }} />

      {/* left panel — wide screens */}
      <motion.div
        initial={{ opacity: 0, x: -60 }}
        animate={ready ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 1.0, ease: EASE }}
        className="hidden lg:flex"
        style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "38%", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 4rem", zIndex: 5, pointerEvents: "none" }}
      >
        <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} style={{ marginBottom: 40 }}>
          <AegisLogo size={80} full={false} glow={true} />
        </motion.div>
        <h2 style={{ fontSize: "2rem", fontWeight: 900, lineHeight: 1.1, letterSpacing: "-0.03em", color: "#e0f2fe", marginBottom: 16, textAlign: "center" }}>
          Your vault.<br />Your rules.
        </h2>
        <p style={{ color: "rgba(125,211,252,0.45)", fontSize: "0.88rem", lineHeight: 1.75, textAlign: "center", maxWidth: 280 }}>
          AI-enhanced documents. Zero-trust sharing. Every access requires your approval.
        </p>
        <div style={{ marginTop: 48, display: "flex", flexDirection: "column", gap: 14 }}>
          {["AES-256 Encrypted", "Real-Time Approvals", "Full Audit Trail"].map((item, i) => (
            <motion.div key={item} initial={{ opacity: 0, x: -16 }} animate={ready ? { opacity: 1, x: 0 } : {}} transition={{ delay: 0.6 + i * 0.12, duration: 0.5, ease: EASE }}
              style={{ display: "flex", alignItems: "center", gap: 10, color: "rgba(125,211,252,0.42)", fontSize: "0.8rem" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(56,189,248,0.65)", boxShadow: "0 0 8px rgba(56,189,248,0.5)" }} />
              {item}
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* card */}
      <motion.div
        initial={{ opacity: 0, y: 44, scale: 0.95 }}
        animate={ready ? { opacity: 1, y: 0, scale: 1 } : {}}
        transition={{ duration: 0.9, ease: EASE }}
        style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: 440, padding: "0 1.5rem" }}
      >
        <div style={{ position: "absolute", inset: -1, borderRadius: 26, background: "linear-gradient(135deg,rgba(56,189,248,0.18),rgba(80,40,200,0.10),rgba(56,189,248,0.06))", filter: "blur(1px)", zIndex: -1 }} />

        <div style={{ borderRadius: 24, background: "rgba(2,8,32,0.90)", backdropFilter: "blur(36px)", border: "1px solid rgba(56,189,248,0.14)", padding: "42px 36px", boxShadow: "0 40px 90px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.04)" }}>

          {/* header */}
          <motion.div initial={{ opacity: 0, y: -16 }} animate={ready ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7, ease: EASE }} style={{ textAlign: "center", marginBottom: 38 }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
              <AegisLogo size={52} full={false} glow={true} />
            </div>
            <div style={{ fontSize: "0.6rem", letterSpacing: "0.24em", textTransform: "uppercase", color: "rgba(56,189,248,0.5)", marginBottom: 10, fontFamily: "'Orbitron',sans-serif" }}>Aegis QR</div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#e0f2fe", letterSpacing: "-0.025em", marginBottom: 7 }}>Welcome back</h1>
            <p style={{ color: "rgba(125,211,252,0.4)", fontSize: "0.85rem" }}>Sign in to your secure vault</p>
          </motion.div>

          {/* form */}
          <form onSubmit={handleLogin}>
            <Field type="email" value={email} onChange={setEmail} placeholder="you@example.com" Icon={Mail} label="Email Address" delay={0.15} />
            <Field
              type={showPw ? "text" : "password"} value={password} onChange={setPassword}
              placeholder="••••••••" Icon={Lock} label="Password" delay={0.22}
              right={
                <button type="button" onClick={() => setShowPw(v => !v)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(125,211,252,0.4)", display: "flex", alignItems: "center", padding: 0 }}>
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              }
            />

            <motion.div initial={{ opacity: 0, y: 12 }} animate={ready ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.32, duration: 0.6, ease: EASE }}>
              <motion.button type="submit" disabled={loading}
                whileHover={{ scale: 1.02, boxShadow: "0 10px 36px rgba(0,110,255,0.5)" }}
                whileTap={{ scale: 0.97 }}
                style={{ width: "100%", height: 52, borderRadius: 13, background: "linear-gradient(135deg,#0048c0,#38bdf8)", border: "none", color: "white", fontSize: "0.97rem", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 8, opacity: loading ? 0.7 : 1, boxShadow: "0 4px 26px rgba(0,110,255,0.32)", fontFamily: "inherit" }}>
                {loading
                  ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white" }} />
                  : <><span>Sign In</span><ArrowRight size={17} /></>}
              </motion.button>
            </motion.div>
          </form>

          {/* divider */}
          <motion.div initial={{ opacity: 0 }} animate={ready ? { opacity: 1 } : {}} transition={{ delay: 0.40 }} style={{ display: "flex", alignItems: "center", gap: 12, margin: "26px 0" }}>
            <div style={{ flex: 1, height: 1, background: "rgba(56,189,248,0.09)" }} />
            <span style={{ color: "rgba(125,211,252,0.28)", fontSize: "0.72rem", letterSpacing: "0.06em" }}>or</span>
            <div style={{ flex: 1, height: 1, background: "rgba(56,189,248,0.09)" }} />
          </motion.div>

          {/* google */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={ready ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.46, duration: 0.5, ease: EASE }}>
            <motion.button type="button" onClick={handleGoogle} disabled={gLoading}
              whileHover={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(56,189,248,0.32)" }}
              whileTap={{ scale: 0.98 }}
              style={{ width: "100%", height: 49, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(224,242,254,0.75)", fontSize: "0.88rem", fontWeight: 500, cursor: gLoading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, transition: "all 0.2s", fontFamily: "inherit" }}>
              {gLoading
                ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "white" }} />
                : <>
                    <svg width="18" height="18" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Continue with Google
                  </>}
            </motion.button>
          </motion.div>

          <motion.p initial={{ opacity: 0 }} animate={ready ? { opacity: 1 } : {}} transition={{ delay: 0.56 }}
            style={{ textAlign: "center", marginTop: 26, fontSize: "0.82rem", color: "rgba(125,211,252,0.3)" }}>
            Don't have an account?{" "}
            <Link to="/register" style={{ color: "rgba(56,189,248,0.8)", fontWeight: 600, textDecoration: "none" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#38bdf8")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(56,189,248,0.8)")}>
              Create one
            </Link>
          </motion.p>
        </div>

        {/* bottom glow line */}
        <motion.div animate={{ opacity: [0.25, 0.65, 0.25] }} transition={{ duration: 3.5, repeat: Infinity }}
          style={{ height: 1, background: "linear-gradient(90deg,transparent,rgba(56,189,248,0.38),transparent)", marginTop: 1 }} />
      </motion.div>
    </div>
  );
}

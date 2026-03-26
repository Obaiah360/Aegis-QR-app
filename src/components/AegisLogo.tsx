import { motion } from "framer-motion";

/* ─────────────────────────────────────────────────────────────────────────────
   AegisLogo — SVG recreation of the brand logo
   Props:
     size   — controls overall scale (default 48 = icon-only height in px)
     full   — show text "Aegis QR" beside the shield (default true)
     glow   — animate the shield glow pulse (default true)
───────────────────────────────────────────────────────────────────────────── */
export default function AegisLogo({
  size = 48,
  full = true,
  glow = true,
  className = "",
}: {
  size?: number;
  full?: boolean;
  glow?: boolean;
  className?: string;
}) {
  const s = size;

  const shield = (
    <motion.div
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: s * 0.22, position: "relative" }}
      animate={glow ? {
        filter: [
          "drop-shadow(0 0 6px rgba(56,189,248,0.5)) drop-shadow(0 0 14px rgba(120,60,240,0.3))",
          "drop-shadow(0 0 14px rgba(56,189,248,0.8)) drop-shadow(0 0 28px rgba(120,60,240,0.55))",
          "drop-shadow(0 0 6px rgba(56,189,248,0.5)) drop-shadow(0 0 14px rgba(120,60,240,0.3))",
        ],
      } : {}}
      transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
    >
      {/* Shield SVG */}
      <svg
        width={s}
        height={s * 1.18}
        viewBox="0 0 100 118"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Shield gradient — blue to purple */}
          <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#38bdf8" />
            <stop offset="50%"  stopColor="#818cf8" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>

          {/* Inner fill — dark navy */}
          <linearGradient id="shieldFill" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#0a1628" />
            <stop offset="100%" stopColor="#060d1f" />
          </linearGradient>

          {/* Circuit glow */}
          <linearGradient id="circuitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#38bdf8" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#818cf8" stopOpacity="0.7" />
          </linearGradient>

          {/* Light ray gradient */}
          <radialGradient id="rayGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#38bdf8" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </radialGradient>

          <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Light rays behind shield */}
        <ellipse cx="50" cy="62" rx="52" ry="38" fill="url(#rayGrad)" opacity="0.5" />
        {/* Left purple ray */}
        <line x1="50" y1="62" x2="-8" y2="90" stroke="#a855f7" strokeWidth="1.2" strokeOpacity="0.35" />
        <line x1="50" y1="62" x2="-4" y2="80" stroke="#818cf8" strokeWidth="0.8" strokeOpacity="0.25" />
        {/* Right cyan ray */}
        <line x1="50" y1="62" x2="108" y2="90" stroke="#38bdf8" strokeWidth="1.2" strokeOpacity="0.35" />
        <line x1="50" y1="62" x2="104" y2="80" stroke="#38bdf8" strokeWidth="0.8" strokeOpacity="0.25" />

        {/* Shield body fill */}
        <path
          d="M50 4 L90 20 L90 58 C90 82 72 100 50 110 C28 100 10 82 10 58 L10 20 Z"
          fill="url(#shieldFill)"
        />

        {/* Shield border — gradient stroke */}
        <path
          d="M50 4 L90 20 L90 58 C90 82 72 100 50 110 C28 100 10 82 10 58 L10 20 Z"
          stroke="url(#shieldGrad)"
          strokeWidth="3"
          fill="none"
          filter="url(#glow)"
        />

        {/* Inner shield border (thinner, offset) */}
        <path
          d="M50 12 L84 26 L84 58 C84 78 68 94 50 103 C32 94 16 78 16 58 L16 26 Z"
          stroke="url(#shieldGrad)"
          strokeWidth="1"
          strokeOpacity="0.3"
          fill="none"
        />

        {/* ── Circuit / QR pattern inside shield ── */}
        {/* Center chip square */}
        <rect x="38" y="46" width="24" height="24" rx="2" stroke="url(#circuitGrad)" strokeWidth="1.5" fill="none" filter="url(#glow)" />
        {/* Inner chip detail */}
        <rect x="43" y="51" width="14" height="14" rx="1" stroke="url(#circuitGrad)" strokeWidth="1" fill="rgba(56,189,248,0.08)" />
        {/* Chip pins — top */}
        <line x1="44" y1="46" x2="44" y2="40" stroke="url(#circuitGrad)" strokeWidth="1.2" />
        <line x1="50" y1="46" x2="50" y2="40" stroke="url(#circuitGrad)" strokeWidth="1.2" />
        <line x1="56" y1="46" x2="56" y2="40" stroke="url(#circuitGrad)" strokeWidth="1.2" />
        {/* Chip pins — bottom */}
        <line x1="44" y1="70" x2="44" y2="76" stroke="url(#circuitGrad)" strokeWidth="1.2" />
        <line x1="50" y1="70" x2="50" y2="76" stroke="url(#circuitGrad)" strokeWidth="1.2" />
        <line x1="56" y1="70" x2="56" y2="76" stroke="url(#circuitGrad)" strokeWidth="1.2" />
        {/* Chip pins — left */}
        <line x1="38" y1="52" x2="32" y2="52" stroke="url(#circuitGrad)" strokeWidth="1.2" />
        <line x1="38" y1="58" x2="32" y2="58" stroke="url(#circuitGrad)" strokeWidth="1.2" />
        <line x1="38" y1="64" x2="32" y2="64" stroke="url(#circuitGrad)" strokeWidth="1.2" />
        {/* Chip pins — right */}
        <line x1="62" y1="52" x2="68" y2="52" stroke="url(#circuitGrad)" strokeWidth="1.2" />
        <line x1="62" y1="58" x2="68" y2="58" stroke="url(#circuitGrad)" strokeWidth="1.2" />
        <line x1="62" y1="64" x2="68" y2="64" stroke="url(#circuitGrad)" strokeWidth="1.2" />
        {/* Corner circuit traces */}
        <path d="M32 52 L28 52 L28 44 L36 44" stroke="url(#circuitGrad)" strokeWidth="1" fill="none" strokeOpacity="0.6" />
        <path d="M68 52 L72 52 L72 44 L64 44" stroke="url(#circuitGrad)" strokeWidth="1" fill="none" strokeOpacity="0.6" />
        <path d="M32 64 L28 64 L28 72 L36 72" stroke="url(#circuitGrad)" strokeWidth="1" fill="none" strokeOpacity="0.6" />
        <path d="M68 64 L72 64 L72 72 L64 72" stroke="url(#circuitGrad)" strokeWidth="1" fill="none" strokeOpacity="0.6" />
        {/* Corner dots */}
        <circle cx="28" cy="44" r="1.8" fill="#38bdf8" opacity="0.8" />
        <circle cx="72" cy="44" r="1.8" fill="#818cf8" opacity="0.8" />
        <circle cx="28" cy="72" r="1.8" fill="#818cf8" opacity="0.8" />
        <circle cx="72" cy="72" r="1.8" fill="#38bdf8" opacity="0.8" />
        {/* Center dot */}
        <circle cx="50" cy="58" r="2.5" fill="#38bdf8" opacity="0.9" filter="url(#glow)" />
      </svg>

      {/* Text — "Aegis QR" */}
      {full && (
        <div style={{ display: "flex", alignItems: "baseline", gap: s * 0.06, lineHeight: 1 }}>
          <span style={{
            fontSize: s * 0.62,
            fontWeight: 800,
            color: "#f0f9ff",
            fontFamily: "'Inter', sans-serif",
            letterSpacing: "-0.02em",
          }}>
            Aegis
          </span>
          <span style={{
            fontSize: s * 0.62,
            fontWeight: 800,
            color: "#38bdf8",
            fontFamily: "'Inter', sans-serif",
            letterSpacing: "-0.02em",
          }}>
            QR
          </span>
        </div>
      )}
    </motion.div>
  );

  return shield;
}

import { useEffect, useRef } from "react";
import { motion, useAnimation } from "framer-motion";

// ── Variants ─────────────────────────────────────────────────────────────────

const EASE_PREMIUM: [number, number, number, number] = [0.16, 1, 0.3, 1];

const wordIn = {
  hidden: { opacity: 0, y: 36, filter: "blur(10px)" },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { delay, duration: 0.8, ease: EASE_PREMIUM },
  }),
};

const subtitleWordIn = {
  hidden: { opacity: 0, y: 18, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease: EASE_PREMIUM },
  },
};

const subtitleContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.16, delayChildren: 1.45 },
  },
};

const sweepAnim = {
  hidden: { x: "-115%", opacity: 0 },
  visible: {
    x: "115%",
    opacity: [0, 0.85, 0],
    transition: { delay: 2.05, duration: 1.05, ease: [0.4, 0, 0.2, 1] },
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function AnimatedTitle() {
  const controls = useAnimation();
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!hasAnimated.current) {
      hasAnimated.current = true;
      controls.start("visible");
    }
  }, [controls]);

  return (
    <div className="flex flex-col items-center gap-3 mb-6">
      {/* ── Main title row ─────────────────────────────────────────────── */}
      <div className="relative">
        {/* Soft radial glow behind text */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden
          style={{
            background:
              "radial-gradient(ellipse 100% 120% at 50% 60%, hsl(234 89% 64% / 0.18) 0%, transparent 70%)",
            filter: "blur(24px)",
            transform: "scale(1.4)",
          }}
        />

        {/* Sweep shimmer — clips to the title area */}
        <div className="absolute inset-0 overflow-hidden rounded-sm pointer-events-none" aria-hidden>
          <motion.div
            className="absolute top-0 bottom-0 w-[38%]"
            style={{
              background:
                "linear-gradient(105deg, transparent 20%, hsl(214 100% 88% / 0.52) 50%, transparent 80%)",
              filter: "blur(3px)",
            }}
            variants={sweepAnim}
            initial="hidden"
            animate={controls}
          />
        </div>

        {/* Words */}
        <h1
          className="relative flex items-baseline gap-3 sm:gap-5 flex-wrap justify-center leading-none"
          aria-label="Aegis QR"
        >
          {/* AEGIS */}
          <motion.span
            custom={0.05}
            variants={wordIn}
            initial="hidden"
            animate={controls}
            className="block"
            style={{
              fontFamily: "'Orbitron', sans-serif",
              fontWeight: 800,
              fontSize: "clamp(3.2rem, 9vw, 6.5rem)",
              letterSpacing: "-0.02em",
              color: "hsl(var(--foreground))",
              textShadow:
                "0 0 32px hsl(234 89% 74% / 0.30), 0 0 64px hsl(234 89% 64% / 0.12)",
              transition: "text-shadow 0.3s ease",
            }}
            whileHover={{
              textShadow:
                "0 0 40px hsl(234 89% 74% / 0.55), 0 0 80px hsl(234 89% 64% / 0.28)",
              transition: { duration: 0.3 },
            }}
          >
            Aegis
          </motion.span>

          {/* QR — stronger gradient glow */}
          <motion.span
            custom={0.46}
            variants={wordIn}
            initial="hidden"
            animate={controls}
            className="block"
            style={{
              fontFamily: "'Orbitron', sans-serif",
              fontWeight: 900,
              fontSize: "clamp(3.2rem, 9vw, 6.5rem)",
              letterSpacing: "-0.02em",
              background: "var(--gradient-primary)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              filter:
                "drop-shadow(0 0 22px hsl(234 89% 74% / 0.55)) drop-shadow(0 0 50px hsl(260 89% 68% / 0.30))",
              transition: "filter 0.3s ease",
            }}
            whileHover={{
              filter:
                "drop-shadow(0 0 32px hsl(234 89% 74% / 0.80)) drop-shadow(0 0 70px hsl(260 89% 68% / 0.50))",
            }}
          >
            QR
          </motion.span>
        </h1>
      </div>

      {/* ── Subtitle — word by word ──────────────────────────────────────── */}
      <motion.p
        className="flex gap-2 sm:gap-3 flex-wrap justify-center"
        variants={subtitleContainer}
        initial="hidden"
        animate={controls}
        aria-label="Shielding Digital Identity"
      >
        {["Shielding", "Digital", "Identity"].map((word) => (
          <motion.span
            key={word}
            variants={subtitleWordIn}
            style={{
              fontFamily: "'Exo 2', sans-serif",
              fontWeight: 300,
              fontSize: "clamp(1rem, 2.6vw, 1.45rem)",
              letterSpacing: "0.18em",
              color: "hsl(var(--foreground) / 0.65)",
              textShadow: "0 0 16px hsl(234 89% 74% / 0.18)",
              textTransform: "uppercase",
            }}
          >
            {word}
          </motion.span>
        ))}
      </motion.p>
    </div>
  );
}

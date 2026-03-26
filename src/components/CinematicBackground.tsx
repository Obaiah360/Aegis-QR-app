import { useEffect, useRef } from "react";

/* ─────────────────────────────────────────────────────────────────────────────
   AEGIS QR — PREMIUM CINEMATIC BACKGROUND
   Canvas 2D, ~60fps, mouse-interactive parallax

   Layers (back → front):
   1. Deep navy base + slow-breathing radial mesh
   2. Volumetric glow orbs (purple / blue / cyan) — drift + pulse
   3. Aurora wave ribbons — sine-wave flowing bands
   4. Mesh grid — perspective-warped dot grid with depth
   5. Constellation network — nodes + lines + data packets
   6. Particle field — 200 stars, twinkle, soft glow
   7. Shooting stars — cyan streaks
   8. Horizontal light sweep
   9. Mouse parallax distortion halo
  10. Film grain + scan lines
  11. Vignette
───────────────────────────────────────────────────────────────────────────── */

interface Particle { x:number; y:number; vx:number; vy:number; r:number; op:number; opV:number; tw:number; col:string }
interface Node     { x:number; y:number; vx:number; vy:number; pulse:number; ps:number }
interface Orb      { x:number; y:number; r:number; rgb:string; phase:number; spd:number; dx:number; dy:number }
interface Aurora   { y:number; amp:number; freq:number; phase:number; spd:number; rgb:string; alpha:number }
interface Shoot    { x:number; y:number; vx:number; vy:number; len:number; op:number; active:boolean }
interface GridDot  { bx:number; by:number; phase:number }

export default function CinematicBackground({ fixed = false }: { fixed?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const mouseRef  = useRef({ x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let W = 0, H = 0;

    const resize = () => {
      W = canvas.width  = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Mouse tracking (normalised 0-1)
    const onMouse = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      mouseRef.current.tx = (e.clientX - r.left) / r.width;
      mouseRef.current.ty = (e.clientY - r.top)  / r.height;
    };
    window.addEventListener("mousemove", onMouse);

    /* ── Palette ─────────────────────────────────────────────────────────── */
    const COLS = [
      "120,200,255",   // sky blue
      "56,189,248",    // bright sky
      "186,230,253",   // pale blue-white
      "147,197,253",   // soft blue
      "167,139,250",   // lavender
      "196,181,253",   // light purple
      "200,240,255",   // near-white blue
    ];

    /* ── 1. Particles ────────────────────────────────────────────────────── */
    const particles: Particle[] = Array.from({ length: 200 }, () => ({
      x: Math.random(), y: Math.random(),
      vx: (Math.random() - 0.5) * 0.00008,
      vy: (Math.random() - 0.5) * 0.00008,
      r:  Math.random() * 1.7 + 0.2,
      op: Math.random() * 0.35 + 0.04,
      opV:(Math.random() * 0.0003 + 0.0001) * (Math.random() > 0.5 ? 1 : -1),
      tw: Math.random() * Math.PI * 2,
      col: COLS[Math.floor(Math.random() * COLS.length)],
    }));

    /* ── 2. Constellation nodes ──────────────────────────────────────────── */
    const nodes: Node[] = Array.from({ length: 40 }, () => ({
      x: Math.random(), y: Math.random(),
      vx: (Math.random() - 0.5) * 0.00011,
      vy: (Math.random() - 0.5) * 0.00011,
      pulse: Math.random() * Math.PI * 2,
      ps: 0.004 + Math.random() * 0.008,
    }));

    /* ── 3. Volumetric orbs ──────────────────────────────────────────────── */
    const orbs: Orb[] = [
      { x:0.50, y:0.18, r:0.60, rgb:"80,40,200",   phase:0.0, spd:0.00024, dx:0.08, dy:0.06 },
      { x:0.10, y:0.55, r:0.48, rgb:"0,100,220",   phase:2.1, spd:0.00020, dx:-0.07,dy:0.05 },
      { x:0.88, y:0.28, r:0.44, rgb:"56,189,248",  phase:4.2, spd:0.00022, dx:0.06, dy:-0.06},
      { x:0.62, y:0.80, r:0.36, rgb:"120,60,240",  phase:1.0, spd:0.00016, dx:-0.05,dy:0.04 },
      { x:0.06, y:0.10, r:0.30, rgb:"0,80,200",    phase:3.5, spd:0.00021, dx:0.04, dy:0.04 },
      { x:0.92, y:0.88, r:0.26, rgb:"56,189,248",  phase:5.0, spd:0.00018, dx:-0.03,dy:-0.04},
      { x:0.38, y:0.48, r:0.22, rgb:"167,139,250", phase:2.8, spd:0.00026, dx:0.05, dy:-0.05},
      { x:0.75, y:0.35, r:0.20, rgb:"34,211,238",  phase:1.6, spd:0.00023, dx:-0.04,dy:0.03 },
    ];

    /* ── 4. Aurora ribbons ───────────────────────────────────────────────── */
    const auroras: Aurora[] = [
      { y:0.18, amp:0.065, freq:1.4, phase:0.0, spd:0.00032, rgb:"80,40,200",   alpha:0.030 },
      { y:0.36, amp:0.055, freq:1.9, phase:1.8, spd:0.00026, rgb:"0,100,220",   alpha:0.024 },
      { y:0.54, amp:0.045, freq:1.2, phase:3.2, spd:0.00029, rgb:"56,189,248",  alpha:0.022 },
      { y:0.70, amp:0.038, freq:2.3, phase:0.9, spd:0.00023, rgb:"120,60,240",  alpha:0.018 },
      { y:0.84, amp:0.030, freq:1.7, phase:2.2, spd:0.00020, rgb:"167,139,250", alpha:0.015 },
    ];

    /* ── 5. Shooting stars ───────────────────────────────────────────────── */
    const shoots: Shoot[] = Array.from({ length: 8 }, () => ({
      x:0, y:0, vx:0, vy:0, len:0, op:0, active:false,
    }));
    const spawnShoot = (s: Shoot) => {
      s.x = Math.random() * 0.8 + 0.05;
      s.y = Math.random() * 0.45;
      const angle = (Math.random() * 40 + 8) * Math.PI / 180;
      const spd   = 0.004 + Math.random() * 0.007;
      s.vx = Math.cos(angle) * spd;
      s.vy = Math.sin(angle) * spd;
      s.len = 0.06 + Math.random() * 0.10;
      s.op  = 0.55 + Math.random() * 0.45;
      s.active = true;
    };
    shoots.forEach((s, i) => setTimeout(() => spawnShoot(s), i * 2400 + Math.random() * 3000));

    /* ── 6. Perspective mesh grid ────────────────────────────────────────── */
    const GRID_COLS = 18, GRID_ROWS = 10;
    const gridDots: GridDot[] = [];
    for (let gy = 0; gy <= GRID_ROWS; gy++) {
      for (let gx = 0; gx <= GRID_COLS; gx++) {
        gridDots.push({ bx: gx / GRID_COLS, by: gy / GRID_ROWS, phase: Math.random() * Math.PI * 2 });
      }
    }

    /* ── Film grain ──────────────────────────────────────────────────────── */
    const grain = document.createElement("canvas");
    grain.width = grain.height = 256;
    const gCtx = grain.getContext("2d")!;
    const gd = gCtx.createImageData(256, 256);
    for (let i = 0; i < gd.data.length; i += 4) {
      const v = Math.random() * 255;
      gd.data[i] = gd.data[i+1] = gd.data[i+2] = v;
      gd.data[i+3] = Math.random() * 11;
    }
    gCtx.putImageData(gd, 0, 0);

    let sweepX = -0.3;
    let t = 0;

    const draw = () => {
      t++;

      // Smooth mouse lerp
      const m = mouseRef.current;
      m.x += (m.tx - m.x) * 0.04;
      m.y += (m.ty - m.y) * 0.04;

      /* ── Base ── */
      ctx.fillStyle = "#020818";
      ctx.fillRect(0, 0, W, H);

      /* ── Breathing navy mesh ── */
      const mp = t * 0.00016;
      const mx = 0.5 + Math.sin(mp) * 0.18 + (m.x - 0.5) * 0.06;
      const my = 0.35 + Math.cos(mp * 0.72) * 0.15 + (m.y - 0.5) * 0.06;
      const mg = ctx.createRadialGradient(W*mx, H*my, 0, W*0.5, H*0.5, W*1.15);
      mg.addColorStop(0,    "rgba(4,10,40,0.90)");
      mg.addColorStop(0.25, "rgba(2,6,28,0.75)");
      mg.addColorStop(0.55, "rgba(1,4,18,0.82)");
      mg.addColorStop(1,    "rgba(0,1,8,0.97)");
      ctx.fillStyle = mg;
      ctx.fillRect(0, 0, W, H);

      /* ── Volumetric orbs ── */
      for (const o of orbs) {
        const pulse = Math.sin(t * o.spd * 1000 + o.phase) * 0.5 + 0.5;
        // Mouse parallax offset
        const px = (m.x - 0.5) * 0.04 * o.r;
        const py = (m.y - 0.5) * 0.04 * o.r;
        const cx = W * (o.x + Math.sin(t * o.spd + o.phase) * o.dx + px);
        const cy = H * (o.y + Math.cos(t * o.spd * 0.7 + o.phase) * o.dy + py);
        const r  = Math.min(W, H) * o.r * (0.80 + pulse * 0.35);
        const g  = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0,    `rgba(${o.rgb},${0.14 + pulse * 0.08})`);
        g.addColorStop(0.22, `rgba(${o.rgb},${0.06 + pulse * 0.04})`);
        g.addColorStop(0.55, `rgba(${o.rgb},0.016)`);
        g.addColorStop(1,    "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      /* ── Aurora ribbons ── */
      for (const a of auroras) {
        a.phase += a.spd;
        const mouseShift = (m.y - 0.5) * 0.018;
        ctx.save();
        ctx.globalAlpha = a.alpha * (0.6 + Math.sin(t * 0.0006 + a.phase) * 0.4);
        const ag = ctx.createLinearGradient(0, 0, 0, H);
        ag.addColorStop(0,    "transparent");
        ag.addColorStop(0.28, `rgba(${a.rgb},0.65)`);
        ag.addColorStop(0.58, `rgba(${a.rgb},0.28)`);
        ag.addColorStop(1,    "transparent");
        ctx.fillStyle = ag;
        ctx.beginPath();
        ctx.moveTo(0, H);
        for (let x = 0; x <= W; x += 3) {
          const nx = x / W;
          const ny = a.y + mouseShift
            + Math.sin(nx * a.freq * Math.PI * 2 + a.phase) * a.amp
            + Math.sin(nx * a.freq * 0.52 * Math.PI * 2 + a.phase * 1.6) * a.amp * 0.40
            + Math.sin(nx * a.freq * 2.1 * Math.PI * 2 + a.phase * 0.6) * a.amp * 0.18;
          ctx.lineTo(x, ny * H);
        }
        ctx.lineTo(W, H);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      /* ── Perspective mesh grid ── */
      ctx.save();
      ctx.globalAlpha = 0.038;
      const mouseWarpX = (m.x - 0.5) * 0.03;
      const mouseWarpY = (m.y - 0.5) * 0.03;
      for (let gy = 0; gy <= GRID_ROWS; gy++) {
        for (let gx = 0; gx <= GRID_COLS; gx++) {
          const dot = gridDots[gy * (GRID_COLS + 1) + gx];
          dot.phase += 0.004;
          // perspective warp — dots near horizon (top) compress
          const depth = 0.3 + dot.by * 0.7;
          const wx = (dot.bx - 0.5) / depth + 0.5 + mouseWarpX * (1 - dot.by);
          const wy = dot.by * 0.85 + 0.08 + mouseWarpY * (1 - dot.by);
          const pulse = Math.sin(dot.phase) * 0.5 + 0.5;
          const r = (0.8 + pulse * 1.2) * depth;
          ctx.beginPath();
          ctx.arc(wx * W, wy * H, r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(56,189,248,${0.3 + pulse * 0.5})`;
          ctx.fill();
        }
      }
      // horizontal grid lines
      for (let gy = 0; gy <= GRID_ROWS; gy++) {
        const depth = 0.3 + (gy / GRID_ROWS) * 0.7;
        const y = (gy / GRID_ROWS) * 0.85 + 0.08;
        ctx.beginPath();
        const x0 = ((0 - 0.5) / depth + 0.5 + mouseWarpX * (1 - gy / GRID_ROWS)) * W;
        const x1 = ((1 - 0.5) / depth + 0.5 + mouseWarpX * (1 - gy / GRID_ROWS)) * W;
        ctx.moveTo(x0, y * H);
        ctx.lineTo(x1, y * H);
        ctx.strokeStyle = `rgba(56,189,248,${0.06 * depth})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
      // vertical grid lines
      for (let gx = 0; gx <= GRID_COLS; gx++) {
        const bx = gx / GRID_COLS;
        ctx.beginPath();
        const topDepth = 0.3;
        const botDepth = 1.0;
        const tx = (bx - 0.5) / topDepth + 0.5 + mouseWarpX;
        const bxp = (bx - 0.5) / botDepth + 0.5;
        ctx.moveTo(tx * W, (0 * 0.85 + 0.08) * H);
        ctx.lineTo(bxp * W, (1 * 0.85 + 0.08) * H);
        ctx.strokeStyle = "rgba(56,189,248,0.04)";
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
      ctx.restore();

      /* ── Constellation network ── */
      ctx.save();
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0) n.x = 1; if (n.x > 1) n.x = 0;
        if (n.y < 0) n.y = 1; if (n.y > 1) n.y = 0;
        n.pulse += n.ps;

        for (let j = i + 1; j < nodes.length; j++) {
          const m2 = nodes[j];
          const dx = n.x - m2.x, dy = n.y - m2.y;
          const d  = Math.sqrt(dx*dx + dy*dy);
          if (d < 0.17) {
            const alpha = (1 - d / 0.17) * 0.09;
            const prog  = ((t * 0.0022 + i * 0.43 + j * 0.19) % 1);
            const px = (n.x + (m2.x - n.x) * prog) * W;
            const py = (n.y + (m2.y - n.y) * prog) * H;
            ctx.beginPath();
            ctx.moveTo(n.x * W, n.y * H);
            ctx.lineTo(m2.x * W, m2.y * H);
            ctx.strokeStyle = `rgba(56,189,248,${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(px, py, 1.2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(125,211,252,${alpha * 3})`;
            ctx.fill();
          }
        }

        const np = Math.sin(n.pulse) * 0.5 + 0.5;
        const ng = ctx.createRadialGradient(n.x*W, n.y*H, 0, n.x*W, n.y*H, 7 + np * 4);
        ng.addColorStop(0, `rgba(56,189,248,${0.18 + np * 0.15})`);
        ng.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = ng;
        ctx.beginPath();
        ctx.arc(n.x*W, n.y*H, 7 + np * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(n.x*W, n.y*H, 1.4 + np * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(186,230,253,${0.26 + np * 0.22})`;
        ctx.fill();
      }
      ctx.restore();

      /* ── Particles ── */
      for (const p of particles) {
        // Mouse parallax — closer (larger) particles shift more
        const parallax = p.r / 1.9;
        const px = (p.x + (m.x - 0.5) * 0.012 * parallax) * W;
        const py = (p.y + (m.y - 0.5) * 0.012 * parallax) * H;
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = 1; if (p.x > 1) p.x = 0;
        if (p.y < 0) p.y = 1; if (p.y > 1) p.y = 0;
        p.tw += 0.015;
        const op = p.op * (0.4 + Math.sin(p.tw) * 0.6);
        p.op += p.opV;
        if (p.op > 0.42 || p.op < 0.03) p.opV *= -1;

        if (p.r > 1.1) {
          const sg = ctx.createRadialGradient(px, py, 0, px, py, p.r * 5);
          sg.addColorStop(0, `rgba(${p.col},${op * 0.5})`);
          sg.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = sg;
          ctx.beginPath();
          ctx.arc(px, py, p.r * 5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(px, py, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.col},${op})`;
        ctx.fill();
      }

      /* ── Shooting stars ── */
      for (const s of shoots) {
        if (!s.active) continue;
        s.x += s.vx; s.y += s.vy;
        s.op -= 0.009;
        if (s.op <= 0 || s.x > 1.15 || s.y > 1.1) {
          s.active = false;
          setTimeout(() => spawnShoot(s), 3000 + Math.random() * 7000);
          continue;
        }
        const mag = Math.sqrt(s.vx*s.vx + s.vy*s.vy);
        const tx = s.x - s.vx * (s.len / mag);
        const ty = s.y - s.vy * (s.len / mag);
        const sg = ctx.createLinearGradient(tx*W, ty*H, s.x*W, s.y*H);
        sg.addColorStop(0, "rgba(56,189,248,0)");
        sg.addColorStop(0.6, `rgba(125,211,252,${s.op * 0.6})`);
        sg.addColorStop(1, `rgba(200,240,255,${s.op})`);
        ctx.beginPath();
        ctx.moveTo(tx*W, ty*H);
        ctx.lineTo(s.x*W, s.y*H);
        ctx.strokeStyle = sg;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        const hg = ctx.createRadialGradient(s.x*W, s.y*H, 0, s.x*W, s.y*H, 5);
        hg.addColorStop(0, `rgba(200,240,255,${s.op})`);
        hg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.arc(s.x*W, s.y*H, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      /* ── Horizontal light sweep ── */
      sweepX += 0.0005;
      if (sweepX > 1.3) sweepX = -0.3;
      const sw = ctx.createLinearGradient((sweepX - 0.14) * W, 0, (sweepX + 0.14) * W, 0);
      sw.addColorStop(0,   "rgba(56,189,248,0)");
      sw.addColorStop(0.4, "rgba(56,189,248,0.018)");
      sw.addColorStop(0.5, "rgba(125,211,252,0.032)");
      sw.addColorStop(0.6, "rgba(56,189,248,0.018)");
      sw.addColorStop(1,   "rgba(56,189,248,0)");
      ctx.fillStyle = sw;
      ctx.fillRect(0, 0, W, H);

      /* ── Mouse distortion halo ── */
      const mhx = m.x * W, mhy = m.y * H;
      const mh = ctx.createRadialGradient(mhx, mhy, 0, mhx, mhy, Math.min(W, H) * 0.22);
      mh.addColorStop(0,   "rgba(56,189,248,0.04)");
      mh.addColorStop(0.4, "rgba(80,40,200,0.018)");
      mh.addColorStop(1,   "rgba(0,0,0,0)");
      ctx.fillStyle = mh;
      ctx.fillRect(0, 0, W, H);

      /* ── Scan lines ── */
      ctx.fillStyle = "rgba(0,0,10,0.07)";
      for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);

      /* ── Film grain ── */
      const gox = (t * 0.9) % 256, goy = (t * 0.7) % 256;
      ctx.save();
      ctx.globalAlpha = 0.025;
      ctx.globalCompositeOperation = "screen";
      const pat = ctx.createPattern(grain, "repeat");
      if (pat) {
        ctx.translate(-gox, -goy);
        ctx.fillStyle = pat;
        ctx.fillRect(gox, goy, W + 256, H + 256);
      }
      ctx.restore();

      /* ── Vignette ── */
      const vig = ctx.createRadialGradient(W/2, H/2, H * 0.14, W/2, H/2, W * 0.96);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(0,1,10,0.90)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      window.removeEventListener("mousemove", onMouse);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: fixed ? "fixed" : "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "block",
        pointerEvents: "none",
        zIndex: fixed ? -1 : undefined,
      }}
    />
  );
}

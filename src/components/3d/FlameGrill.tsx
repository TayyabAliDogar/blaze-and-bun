'use client';
import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';

// Real brand burger photography (same photograph used for the Classic Smash
// Burger in the menu — authentic food photo, not a render or plastic mock).
const BURGER_PHOTO =
  'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1200&q=80';

const FLAME_RGB: [number, number, number][] = [
  [229, 84, 42], // espresso-orange
  [242, 179, 61], // gold
  [255, 150, 40], // bright ember
];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  kind: 'flame' | 'ember' | 'smoke';
  sway: number;
  phase: number;
}

export default function FlameGrill() {
  const fgCanvasRef = useRef<HTMLCanvasElement>(null);
  const smokeCanvasRef = useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const fg = fgCanvasRef.current;
    const smoke = smokeCanvasRef.current;
    if (!fg || !smoke) return;
    const fgCtx = fg.getContext('2d');
    const smokeCtx = smoke.getContext('2d');
    if (!fgCtx || !smokeCtx) return;

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const reduced = media.matches;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const w = fg.clientWidth || 420;
      const h = fg.clientHeight || 420;
      fg.width = Math.round(w * dpr);
      fg.height = Math.round(h * dpr);
      smoke.width = Math.round(w * dpr);
      smoke.height = Math.round(h * dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const particles: Particle[] = [];
    const flameCount = 34;
    const emberCount = 46;
    const smokeCount = 5;

    const Wbase = () => fg.clientWidth || 420;
    const Hbase = () => fg.clientHeight || 420;

    const spawn = (kind: Particle['kind']): Particle => {
      const w = Wbase();
      const h = Hbase();
      const baseY = h * 0.82;
      if (kind === 'flame') {
        const jitter = (Math.random() - 0.5) * w * 0.5;
        return {
          x: w * 0.5 + jitter,
          y: baseY + Math.random() * h * 0.08,
          vx: (Math.random() - 0.5) * 14,
          vy: -(40 + Math.random() * 70),
          life: 0,
          maxLife: 0.5 + Math.random() * 0.6,
          size: h * (0.055 + Math.random() * 0.06),
          kind,
          sway: 1.6 + Math.random() * 1.4,
          phase: Math.random() * Math.PI * 2,
        };
      }
      if (kind === 'ember') {
        return {
          x: w * (0.15 + Math.random() * 0.7),
          y: baseY + Math.random() * h * 0.1,
          vx: (Math.random() - 0.5) * 26,
          vy: -(70 + Math.random() * 120),
          life: 0,
          maxLife: 1.2 + Math.random() * 1.8,
          size: 1.2 + Math.random() * 2.6,
          kind,
          sway: 2.2 + Math.random() * 2,
          phase: Math.random() * Math.PI * 2,
        };
      }
      // smoke
      return {
        x: w * (0.25 + Math.random() * 0.5),
        y: baseY - Math.random() * h * 0.2,
        vx: (Math.random() - 0.5) * 12,
        vy: -(12 + Math.random() * 18),
        life: 0,
        maxLife: 4 + Math.random() * 3,
        size: h * (0.12 + Math.random() * 0.16),
        kind,
        sway: 0.8 + Math.random() * 0.8,
        phase: Math.random() * Math.PI * 2,
      };
    };

    for (let i = 0; i < flameCount + emberCount + smokeCount; i++) {
      const kind: Particle['kind'] =
        i < flameCount ? 'flame' : i < flameCount + emberCount ? 'ember' : 'smoke';
      const p = spawn(kind);
      p.life = Math.random() * p.maxLife * 0.9; // pre-warm so the field is full
      particles.push(p);
    }

    let raf = 0;
    let last = performance.now();

    const drawFlame = (p: Particle, t: number) => {
      const w = fg.clientWidth || 420;
      const ratio = p.life / p.maxLife;
      const inv = 1 - ratio;
      const wobble = Math.sin(t * p.sway + p.phase) * w * 0.012;
      const x = p.x + wobble;
      const y = p.y;

      const segs = 3;
      for (let s = 0; s < segs; s++) {
        const f = s / (segs - 1);
        const rad = Math.max(0.5, p.size * (1 - f) * (0.35 + (1 - inv) * 0.6));
        const [r, g, b] = FLAME_RGB[Math.min(segs - 1 - s, FLAME_RGB.length - 1)];
        const alpha = inv * (0.85 - f * 0.55);
        const grad = fgCtx!.createRadialGradient(x, y - p.size * 0.6 * f, 0, x, y - p.size * 0.6 * f, rad);
        grad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
        grad.addColorStop(1, `rgba(120,20,0,0)`);
        fgCtx!.globalCompositeOperation = 'lighter';
        fgCtx!.fillStyle = grad;
        fgCtx!.beginPath();
        fgCtx!.arc(x, y - p.size * 0.6 * f, rad, 0, Math.PI * 2);
        fgCtx!.fill();
      }
    };

    const drawEmber = (p: Particle) => {
      const w = fg.clientWidth || 420;
      const ratio = p.life / p.maxLife;
      const inv = 1 - ratio;
      const wobble = Math.sin(p.phase + p.life * p.sway) * w * 0.02;
      const x = p.x + wobble;
      const y = p.y;
      const alpha = inv;
      fgCtx!.globalCompositeOperation = 'lighter';
      fgCtx!.fillStyle = `rgba(255,190,90,${alpha * 0.9})`;
      fgCtx!.beginPath();
      fgCtx!.arc(x, y, p.size, 0, Math.PI * 2);
      fgCtx!.fill();
      const glow = fgCtx!.createRadialGradient(x, y, 0, x, y, Math.max(0.5, p.size * 4));
      glow.addColorStop(0, `rgba(255,170,60,${alpha * 0.5})`);
      glow.addColorStop(1, `rgba(255,170,60,0)`);
      fgCtx!.fillStyle = glow;
      fgCtx!.beginPath();
      fgCtx!.arc(x, y, p.size * 4, 0, Math.PI * 2);
      fgCtx!.fill();
    };

    const drawSmoke = (p: Particle, t: number) => {
      const ratio = p.life / p.maxLife;
      if (ratio >= 1) return;
      const inv = 1 - ratio;
      const x = p.x + Math.sin(t * p.sway + p.phase) * 18;
      const y = p.y - inv * 30;
      const rad = Math.max(0.5, p.size * (0.7 + inv * 0.9));
      const alpha = inv * 0.16;
      const grad = smokeCtx!.createRadialGradient(x, y, 0, x, y, rad);
      grad.addColorStop(0, `rgba(220,210,190,${alpha})`);
      grad.addColorStop(1, `rgba(220,210,190,0)`);
      smokeCtx!.fillStyle = grad;
      smokeCtx!.beginPath();
      smokeCtx!.arc(x, y, rad, 0, Math.PI * 2);
      smokeCtx!.fill();
    };

    const reset = (p: Particle) => {
      const fresh = spawn(p.kind);
      Object.assign(p, fresh);
      p.life = 0;
    };

    const frame = (now: number) => {
      if (!inView) {
        // Offscreen — stop the loop; the IntersectionObserver restarts it.
        raf = 0;
        return;
      }
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const t = now / 1000;

      fgCtx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      fgCtx!.clearRect(0, 0, fg.clientWidth, fg.clientHeight);
      smokeCtx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      smokeCtx!.clearRect(0, 0, smoke.clientWidth, smoke.clientHeight);

      for (const p of particles) {
        p.life += dt;
        if (p.life >= p.maxLife) {
          reset(p);
          continue;
        }
        if (p.kind === 'smoke') {
          p.y += p.vy * dt;
          p.x += p.vx * dt;
          drawSmoke(p, t);
        } else {
          p.y += p.vy * dt;
          p.x += p.vx * dt;
          p.phase += dt * 3;
          if (p.kind === 'flame') drawFlame(p, t);
          else drawEmber(p);
        }
      }

      raf = requestAnimationFrame(frame);
    };

    let inView = true;
    const io = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        if (inView && !reduced && !raf) {
          last = performance.now();
          raf = requestAnimationFrame(frame);
        }
      },
      { rootMargin: '150px' }
    );
    io.observe(fg);

    if (reduced) {
      // Draw a single calm, low-intensity frame (still flames/embers, no motion).
      const t = 0;
      for (let i = 0; i < flameCount; i += 3) {
        const p = spawn('flame');
        p.life = p.maxLife * 0.55;
        drawFlame(p, t);
      }
      for (let i = 0; i < emberCount; i += 4) {
        const p = spawn('ember');
        p.life = p.maxLife * 0.6;
        drawEmber(p);
      }
    } else {
      raf = requestAnimationFrame(frame);
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Deep grill-glow behind everything */}
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_72%,rgba(229,84,42,0.42),rgba(229,84,42,0.12)_48%,transparent_70%)] animate-pulse-glow" />

      {/* Smoke layer (behind the burger) */}
      <canvas
        ref={smokeCanvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        aria-hidden="true"
      />

      {/* The real burger photo, circular editorial crop */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.25, ease: 'easeOut' }}
        className="relative z-10 w-[min(78%,380px)] aspect-square"
        style={{ filter: 'drop-shadow(0 30px 60px rgba(0,0,0,0.55))' }}
      >
        <motion.div
          animate={reduceMotion ? undefined : { y: [0, -10, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
          className="w-full h-full relative"
        >
          <Image
            src={BURGER_PHOTO}
            alt="Fire-grilled Double Smash burger with melted cheddar, crisp lettuce and Blaze sauce"
            fill
            priority
            sizes="(max-width: 1024px) 78vw, 380px"
            draggable={false}
            className="rounded-full object-cover"
            style={{ clipPath: 'circle(50%)' }}
          />
          {/* soft vignette so the circular crop blends into the glow */}
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              boxShadow:
                'inset 0 0 60px 20px rgba(28,18,12,0.55), inset 0 0 10px rgba(28,18,12,0.4)',
            }}
          />
        </motion.div>
      </motion.div>

      {/* Flame + ember layer in front (fire licking the lower edges) */}
      <canvas
        ref={fgCanvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-20"
        aria-hidden="true"
      />

      {/* Grill grate suggestion at the base (abstract bars, not fake food) */}
      <div
        className="absolute left-1/2 -translate-x-1/2 bottom-[6%] w-[min(78%,380px)] h-3 z-30 flex items-center justify-between px-3 opacity-90"
        aria-hidden="true"
      >
        {[...Array(5)].map((_, i) => (
          <span
            key={i}
            className="h-2 w-2 block rounded-full bg-[#1C120C]/80 shadow-[0_0_8px_rgba(242,179,61,0.7)]"
          />
        ))}
      </div>
    </div>
  );
}

'use client';
import { motion, useScroll, useTransform } from 'framer-motion';
import Button from '../ui/Button';
import FlameGrill from '../3d/FlameGrill';

export default function HeroSection() {
  const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.12, duration: 0.7, ease: 'easeOut' as const },
    }),
  };

  // Subtle scroll-linked parallax on background embers (decorative only)
  const { scrollYProgress } = useScroll();
  const emberY = useTransform(scrollYProgress, [0, 1], [-20, 60]);

  return (
    <section className="relative min-h-screen bg-[#1C120C] text-[#F5EFE4] overflow-hidden flex items-center grain">
      {/* Ambient glow */}
      <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-[#E8542A]/20 blur-[140px] animate-pulse-glow" />
      <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full bg-[#F2B33D]/10 blur-[160px] animate-pulse-glow" />

      {/* Top scrim so nav links stay legible over the scene */}
      <div className="absolute top-0 left-0 right-0 h-28 md:h-36 z-[5] bg-gradient-to-b from-[#1C120C]/90 via-[#1C120C]/40 to-transparent pointer-events-none" />

      {/* Ember particles (scroll-linked parallax wrapper, decorative only) */}
      <motion.div style={{ y: emberY }} className="absolute inset-0 pointer-events-none">
        {[...Array(14)].map((_, i) => (
          <motion.span
            key={i}
            className="absolute w-1.5 h-1.5 rounded-full bg-[#F2B33D]/60"
            style={{ left: `${(i * 7.3) % 100}%` }}
            animate={{
              y: [-30, -120],
              opacity: [0, 1, 0],
              x: [0, (i % 2 === 0 ? 1 : -1) * 20],
            }}
            transition={{
              duration: 6 + (i % 4),
              repeat: Infinity,
              delay: i * 0.4,
            }}
          />
        ))}
      </motion.div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 grid lg:grid-cols-2 gap-8 items-center w-full mt-20">
        {/* Left: Text */}
        <div className="text-center lg:text-left">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-pill mb-6"
          >
            <span className="w-2 h-2 rounded-full bg-[#E8542A] animate-pulse" />
            <span className="font-mono text-xs uppercase tracking-[0.18em] text-[#F2B33D]">
              Fire-Grilled · Pressed Fresh
            </span>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={1}
            className="font-display leading-[0.95] mb-6"
            style={{ fontSize: 'clamp(44px, 9vw, 112px)', fontWeight: 400 }}
          >
            <span className="block">Where The</span>
            <span className="block italic text-stroke-orange">Blaze</span>
            <span className="block">Meets The Bun.</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={2}
            className="text-lg text-[#F5EFE4]/70 max-w-md mx-auto lg:mx-0 mb-8"
          >
            Double-smashed Angus. 24-hour brined chicken. Hand-spun shakes you&apos;ll dream about.
            Crafted over an open flame, served at full volume.
          </motion.p>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={3}
            className="flex flex-wrap items-center gap-4 justify-center lg:justify-start"
          >
            <Button href="#menu" variant="primary" size="lg">
              Order Now 🍔
            </Button>
            <Button href="/menu" variant="ghost" size="lg" className="border border-white/20">
              View Menu
            </Button>
          </motion.div>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={4}
            className="flex items-center justify-center lg:justify-start mt-10"
          >
            <div
              role="group"
              aria-label="Trusted by thousands"
              className="glass-pill rounded-full px-5 py-2.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-mono text-xs text-[#F5EFE4]"
            >
              <span className="flex items-center gap-1.5 text-[#F2B33D]" aria-label="4.9 out of 5 stars">
                ★ 4.9
              </span>
              <span>12,400+ reviews</span>
              <span className="w-px h-3.5 bg-white/20" aria-hidden="true" />
              <span>100% fire-grilled</span>
              <span className="w-px h-3.5 bg-white/20" aria-hidden="true" />
              <span>4 locations</span>
            </div>
          </motion.div>
        </div>

        {/* Right: cinematic flame-grill hero */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="relative h-[420px] md:h-[560px] w-full"
        >
          <div className="absolute inset-0">
            <FlameGrill />
          </div>

          {/* Floating badges */}
          <motion.div
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="absolute top-8 left-2 md:left-8 glass-card-dark top-catchlight rounded-2xl px-4 py-3 text-sm"
          >
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#8A7F72] block">
              Double Smash
            </span>
            <span className="text-[#F5EFE4] font-medium">Certified Fire 🔥</span>
          </motion.div>

          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 3.5, repeat: Infinity }}
            className="absolute bottom-24 right-0 md:right-4 glass-card-dark top-catchlight rounded-2xl px-4 py-3 text-sm"
          >
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#8A7F72] block">
              Blaze Sauce
            </span>
            <span className="text-[#F2B33D] font-medium">12 secret ingredients</span>
          </motion.div>

          {/* Tagline */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 font-mono text-xs text-[#8A7F72] uppercase tracking-widest whitespace-nowrap"
          >
            🔥 fire-grilled · pressed fresh daily
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

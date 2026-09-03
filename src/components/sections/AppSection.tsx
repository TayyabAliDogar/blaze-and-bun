'use client';
import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import SectionTransition from '../ui/SectionTransition';
import StoreBadges from '../ui/StoreBadges';

export default function AppSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const phoneY = useTransform(scrollYProgress, [0, 1], [30, -30]);

  return (
    <section ref={ref} className="relative bg-[#241B14] py-24 md:py-32 overflow-hidden grain">
      <SectionTransition from="#F5EFE4" />
      {/* Phones mockup decorative */}
      <motion.div
        style={{ y: phoneY }}
        className="absolute right-[-40px] top-1/2 -translate-y-1/2 w-[420px] h-[760px] opacity-10 rotate-12 select-none pointer-events-none"
      >
        <div className="w-full h-full rounded-[60px] border-4 border-[#F2B33D] bg-[#1C120C] p-5">
          <div className="w-full h-full rounded-[40px] bg-[#E8542A]/20 flex items-center justify-center">
            <span className="text-6xl">🔥</span>
          </div>
        </div>
      </motion.div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 relative">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#F2B33D] mb-4">
              Get The App
            </p>
            <h2 className="font-display section-title text-[#F5EFE4] mb-6">
              Your fire, <span className="italic text-stroke-orange">on tap.</span>
            </h2>
            <p className="text-[#F5EFE4]/70 text-lg max-w-md mb-8">
              Order ahead, skip the line, and track your order live from kitchen to your door.
            </p>
            <ul className="space-y-3 mb-8">
              {['Skip-the-line mobile ordering', 'Early access to new menu drops', 'Live order tracking', 'Exclusive app-only offers'].map((f) => (
                <li key={f} className="flex items-center gap-3 text-[#F5EFE4]">
                  <span className="w-6 h-6 rounded-full bg-[#E8542A]/20 flex items-center justify-center text-sm">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-3">
              <StoreBadges />
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="flex justify-center"
          >
            <div className="glass-card-dark rounded-3xl p-6 text-center">
              <p className="font-mono text-xs uppercase tracking-widest text-[#8A7F72] mb-4">
                Scan to download
              </p>
              <div className="bg-white p-4 rounded-2xl mx-auto mb-4 grid place-items-center w-40 h-40">
                {/* Simple QR-style placeholder */}
                <div className="grid grid-cols-8 gap-0.5">
                  {Array.from({ length: 64 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-2.5 h-2.5 rounded-[2px] ${(i * 7 + i / 8) % 3 === 0 ? 'hidden' : ''}`}
                      style={{
                        background: ['#1C120C', '#E8542A', '#8A7F72'][i % 3],
                      }}
                    />
                  ))}
                </div>
              </div>
              <p className="font-display text-xl text-[#F5EFE4]">BLAZE & BUN</p>
              <p className="font-mono text-xs text-[#8A7F72] uppercase tracking-widest">
                iOS · Android
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

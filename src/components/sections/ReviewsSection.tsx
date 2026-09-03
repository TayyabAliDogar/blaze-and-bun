'use client';
import { motion } from 'framer-motion';
import { REVIEWS } from '@/data/reviews';
import SectionTransition from '../ui/SectionTransition';

export default function ReviewsSection() {
  return (
    <section id="reviews" className="relative bg-[#F5EFE4] text-[#1C120C] py-24 md:py-32">
      <SectionTransition from="#1C120C" />
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-14">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#E8542A] mb-4">
              The Verdict · 12,400+ reviews
            </p>
            <h2 className="font-display section-title">
              Loved at <span className="italic text-stroke-orange">full volume.</span>
            </h2>
          </div>
          <div className="flex flex-col items-start md:items-end gap-2">
            <div className="flex items-center gap-2">
              <span className="text-4xl font-display">4.9</span>
              <div>
                <div className="text-[#F2B33D] tracking-tight">★★★★★</div>
                <p className="text-xs text-[#8A7F72]">based on 12,400+ ratings</p>
              </div>
            </div>
            <a
              href="https://www.google.com/search?q=Blaze+%26+Bun+reviews"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#1C120C]/15 bg-white text-xs font-mono uppercase tracking-wider text-[#1C120C]/80 hover:border-[#E8542A]/50 hover:text-[#E8542A] transition-colors duration-200 shadow-[var(--elev-1)] hover:shadow-[var(--elev-2)]"
            >
              <span className="text-[#E8542A]">★</span> 4.9 on Google · See all reviews
              <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {REVIEWS.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: (i % 3) * 0.08 }}
              className="bg-white rounded-3xl p-6 shadow-[var(--elev-1)] hover:shadow-[var(--elev-2)] transition-shadow duration-300 border border-[#1C120C]/5 top-catchlight"
            >
              <div className="text-[#F2B33D] mb-3 text-sm tracking-tight">
                {'★'.repeat(r.rating)}
                <span className="text-[#E0D6C4]">{'★'.repeat(5 - r.rating)}</span>
              </div>
              <p className="text-sm text-[#1C120C]/80 leading-relaxed mb-4">“{r.text}”</p>
              <div className="flex items-center gap-3 pt-4 border-t border-[#1C120C]/10">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-[#F5EFE4] font-display font-bold"
                  style={{ background: r.avatarGradient }}
                >
                  {r.initials}
                </div>
                <div>
                  <p className="font-medium text-sm">{r.name}</p>
                  <p className="text-xs text-[#8A7F72]">
                    {r.location} · {r.date}
                    {r.verified && <span className="text-[#3D8B40] ml-1">✓ Verified</span>}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

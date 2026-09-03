'use client';
import { motion } from 'framer-motion';
import { sfx } from '@/lib/sounds';

export interface StickyCategory {
  id: string;
  name: string;
  icon: string;
}

interface StickyCategoryNavProps {
  categories: StickyCategory[];
  activeId: string;
  onSelect: (id: string) => void;
}

export default function StickyCategoryNav({
  categories,
  activeId,
  onSelect,
}: StickyCategoryNavProps) {
  return (
    <div className="sticky top-[60px] md:top-[64px] z-30 -mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-[#1C120C]/90 backdrop-blur-xl border-y border-white/10 shadow-[0_16px_32px_-16px_rgba(0,0,0,0.65)]">
      <nav
        aria-label="Menu categories"
        className="flex gap-2 overflow-x-auto no-scrollbar justify-start md:justify-center"
      >
        {categories.map((c) => {
          const active = activeId === c.id;
          return (
            <button
              key={c.id}
              onClick={() => {
                onSelect(c.id);
                sfx.click();
              }}
              className={`relative shrink-0 px-3.5 py-1.5 rounded-full font-mono text-xs uppercase tracking-wider border transition-colors duration-200 ${
                active
                  ? 'border-transparent'
                  : 'border-white/15 text-[#F5EFE4]/70 hover:text-[#F5EFE4] hover:border-white/40 hover:bg-white/5'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="subnav-pill"
                  className="absolute inset-0 rounded-full bg-[#E8542A] shadow-[0_8px_18px_-6px_rgba(232,84,42,0.6)]"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span className={`relative z-10 ${active ? 'text-[#F5EFE4]' : ''}`}>
                <span className="mr-1.5">{c.icon}</span>
                {c.name}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
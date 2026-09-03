'use client';
import { useRef } from 'react';
import Image from 'next/image';
import { motion, useScroll, useTransform } from 'framer-motion';
import Button from '../ui/Button';

const ACTS = [
  {
    num: '01',
    label: 'The Foundation',
    title: 'Toast the Brioche',
    text: 'Every stack begins with our potato brioche, split and toasted in a charred butter shell until it shimmers like golden glass.',
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=80',
  },
  {
    num: '02',
    label: 'The Heat',
    title: 'Smash on Chromed Steel',
    text: 'Hand-rolled Angus beef slams onto a 500°F chromed steel griddle, forming crispy-edged, caramel-sweet lacy crusts.',
    image: 'https://images.unsplash.com/photo-1554306297-0c86e837d24b?auto=format&fit=crop&w=900&q=80',
  },
  {
    num: '03',
    label: 'The Crown',
    title: 'Stack the Inferno',
    text: 'Melted Swiss, charred onion jam, dripping Blaze sauce — assembled in a flawless tower, crowned and served at full volume.',
    image: 'https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?auto=format&fit=crop&w=900&q=80',
  },
];

export default function BuildSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const x = useTransform(scrollYProgress, [0, 1], [-40, 40]);

  return (
    <section ref={ref} id="build" className="relative bg-[#F5EFE4] text-[#1C120C] py-24 md:py-32 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="mb-16 md:mb-24">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#E8542A] mb-4">The Craft</p>
          <h2 className="font-display section-title" style={{ fontSize: 'clamp(36px, 7vw, 88px)' }}>
            Built in three acts,
            <br />
            <span className="italic text-stroke-orange">destroyed in seconds.</span>
          </h2>
        </div>

        <div className="space-y-24 md:space-y-40">
          {ACTS.map((act, i) => (
            <div
              key={act.num}
              className={`grid md:grid-cols-2 gap-8 md:gap-16 items-center ${
                i % 2 === 1 ? 'md:[&>*:first-child]:order-2' : ''
              }`}
            >
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.7 }}
              >
                <div className="flex items-center gap-4 mb-4">
                  <span className="font-display text-6xl md:text-7xl leading-none text-[#E8542A] drop-shadow-[0_2px_16px_rgba(232,84,42,0.4)]">
                    {act.num}
                  </span>
                  <span className="font-mono text-sm md:text-base font-bold uppercase tracking-[0.22em] text-[#1C120C] bg-[#E8542A]/10 px-3 py-1.5 rounded-full">
                    {act.label}
                  </span>
                </div>
                <h3 className="font-display text-3xl md:text-5xl mb-4">{act.title}</h3>
                <p className="text-lg text-[#1C120C]/70 max-w-md">{act.text}</p>
              </motion.div>

              <motion.div
                style={{ x }}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.7 }}
                className="relative"
              >
                <div className="absolute -inset-4 rounded-3xl bg-[#E8542A]/10 blur-2xl" />
                <div className="relative aspect-[4/3] rounded-3xl shadow-2xl overflow-hidden">
                  <Image
                    src={act.image}
                    alt={act.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover"
                    loading="lazy"
                  />
                  <span className="absolute top-4 right-4 glass-card-dark rounded-full px-4 py-2 font-mono text-xs text-[#F5EFE4]">
                    ACT {act.num}
                  </span>
                </div>
              </motion.div>
            </div>
          ))}
        </div>

        <div className="mt-20 md:mt-28 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#8A7F72] mb-4">
            Craving the full build sheet?
          </p>
          <Button
            href="#menu"
            variant="outline"
            size="lg"
            className="border-[#E8542A] text-[#E8542A] hover:bg-[#E8542A] hover:border-[#E8542A] hover:text-[#F5EFE4] shadow-[0_12px_28px_-14px_rgba(232,84,42,0.55)]"
          >
            Jump to the Menu →
          </Button>
        </div>
      </div>
    </section>
  );
}

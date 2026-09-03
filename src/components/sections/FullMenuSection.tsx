'use client';
import MenuGrid from '../ui/MenuGrid';
import SectionTransition from '../ui/SectionTransition';

export default function FullMenuSection() {
  return (
    <section id="menu" className="relative bg-[#241B14] py-24 md:py-32 grain">
      <SectionTransition from="#F5EFE4" />
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="text-center mb-12">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#F2B33D] mb-4">
            The Full Spread
          </p>
          <h2 className="font-display section-title text-[#F5EFE4]">
            Order anything.{' '}
            <span className="italic text-stroke-orange">Nothing&apos;s behind the counter.</span>
          </h2>
          <p className="text-[#F5EFE4]/60 max-w-xl mx-auto mt-4">
            Every single item, in the open. Customize, stack, and make it yours.
          </p>
        </div>

        <MenuGrid layout="center" showFeatured headingLevel={3} />
      </div>
    </section>
  );
}
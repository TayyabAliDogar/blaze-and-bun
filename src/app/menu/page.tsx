'use client';
import { motion } from 'framer-motion';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CartDrawer from '@/components/CartDrawer';
import MenuGrid from '@/components/ui/MenuGrid';

export default function MenuPage() {
  return (
    <main className="min-h-screen bg-[#241B14] text-[#F5EFE4] grain">
      <Navbar />
      <div className="pt-28 pb-20 max-w-7xl mx-auto px-4 md:px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#F2B33D] mb-3">Full Menu</p>
          <h1 className="font-display section-title">
            Everything we <span className="italic text-stroke-orange">fire.</span>
          </h1>
        </motion.div>

        <MenuGrid
          layout="left"
          showFeatured
          headingLevel={2}
          searchPlaceholder="Search the full menu…"
        />
      </div>
      <Footer />
      <CartDrawer />
    </main>
  );
}
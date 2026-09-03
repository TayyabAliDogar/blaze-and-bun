'use client';
import type { ReactNode } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CartDrawer from '@/components/CartDrawer';

interface InfoPageProps {
  kicker?: string;
  title: string;
  children: ReactNode;
}

export default function InfoPage({ kicker, title, children }: InfoPageProps) {
  return (
    <main className="min-h-screen bg-[#241B14] text-[#F5EFE4] grain">
      <Navbar />
      <div className="pt-32 pb-24 max-w-3xl mx-auto px-4 md:px-6">
        {kicker && (
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#F2B33D] mb-3">{kicker}</p>
        )}
        <h1 className="font-display section-title mb-8">{title}</h1>
        <div className="space-y-5 leading-relaxed text-[#F5EFE4]/75">{children}</div>
        <p className="mt-12 font-mono text-xs uppercase tracking-widest text-[#8A7F72]">
          More coming soon.
        </p>
      </div>
      <Footer />
      <CartDrawer />
    </main>
  );
}
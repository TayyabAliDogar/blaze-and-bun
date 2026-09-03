'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useLocationStore } from '@/store';
import { sfx } from '@/lib/sounds';
import SectionTransition from './ui/SectionTransition';
import SocialButtons from './ui/SocialButtons';

function ComingSoon({ label }: { label: string }) {
  return (
    <span className="text-[#8A7F72] cursor-not-allowed" title="Coming soon">
      {label}
    </span>
  );
}

export default function Footer() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const { selectedLocation } = useLocationStore();

  const subscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubscribed(true);
    sfx.success();
  };

  return (
    <footer className="relative bg-[#1C120C] text-[#F5EFE4] border-t border-white/10 grain">
      <SectionTransition from="#241B14" />
      {/* Newsletter */}
      <div className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-16 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h3 className="font-display text-3xl md:text-4xl mb-2">
              Get the <span className="italic text-stroke-orange">heat</span> first.
            </h3>
            <p className="text-[#F5EFE4]/60">
              Join the Blaze Club for secret drops, BOGO nights, and early access to new menu items.
            </p>
          </div>
          {subscribed ? (
            <div className="rounded-2xl bg-[#E8542A]/15 border border-[#E8542A]/40 p-5 text-center">
              <div className="text-3xl mb-2">🔥</div>
              <p className="font-display text-xl">You&apos;re on the list!</p>
              <p className="text-sm text-[#F5EFE4]/60">Watch your inbox for the heat.</p>
            </div>
          ) : (
            <div>
              <form onSubmit={subscribe} className="flex gap-2">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="flex-1 min-w-0 px-4 py-3 rounded-full glass-pill text-sm text-[#F5EFE4] placeholder:text-white/30 focus:outline-none focus:border-[#E8542A] border border-white/10"
                />
                <button
                  type="submit"
                  className="shrink-0 px-6 py-3 rounded-full bg-[#E8542A] hover:bg-[#FF6A3D] active:bg-[#C9421F] text-[#F5EFE4] font-mono text-sm uppercase tracking-wider transition-colors shadow-[var(--glow-orange)] inner-catchlight"
                >
                  Join
                </button>
              </form>
              <p className="mt-3 text-xs text-[#8A7F72]">
                🔒 No spam. Unsubscribe anytime.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Main footer */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-14 grid grid-cols-2 md:grid-cols-4 gap-10">
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">🔥</span>
            <span className="font-display text-2xl">
              BLAZE<span className="text-[#E8542A]">&</span>BUN
            </span>
          </div>
          <p className="text-sm text-[#F5EFE4]/60 mb-4">
            Fire-grilled smash burgers, crispy chicken, and hand-spun shakes. Crafted over open flame,
            served at full volume.
          </p>
          <SocialButtons />
        </div>

        <div>
          <h4 className="font-mono text-xs uppercase tracking-widest text-[#8A7F72] mb-4">Menu</h4>
          <ul className="space-y-2.5 text-sm text-[#F5EFE4]/70">
            <li><Link href="/#menu" className="hover:text-[#F2B33D]">Burgers</Link></li>
            <li><Link href="/#menu" className="hover:text-[#F2B33D]">Fried Chicken</Link></li>
            <li><Link href="/#menu" className="hover:text-[#F2B33D]">Combos & Deals</Link></li>
            <li><Link href="/#menu" className="hover:text-[#F2B33D]">Shakes</Link></li>
            <li><Link href="/#menu" className="hover:text-[#F2B33D]">Desserts</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-mono text-xs uppercase tracking-widest text-[#8A7F72] mb-4">Company</h4>
          <ul className="space-y-2.5 text-sm text-[#F5EFE4]/70">
            <li><Link href="/" className="hover:text-[#F2B33D]">Our Story</Link></li>
            <li><Link href="/careers" className="hover:text-[#F2B33D]">Careers</Link></li>
            <li><ComingSoon label="Franchising" /></li>
            <li><Link href="/#locations" className="hover:text-[#F2B33D]">Locations</Link></li>
            <li><ComingSoon label="Gift Cards" /></li>
          </ul>
        </div>

        <div>
          <h4 className="font-mono text-xs uppercase tracking-widest text-[#8A7F72] mb-4">Help</h4>
          <ul className="space-y-2.5 text-sm text-[#F5EFE4]/70">
            <li><ComingSoon label="Contact" /></li>
            <li><ComingSoon label="Track Order" /></li>
            <li><Link href="/faqs" className="hover:text-[#F2B33D]">FAQs</Link></li>
            <li><Link href="/allergen-info" className="hover:text-[#F2B33D]">Allergen Info</Link></li>
            <li><ComingSoon label="Privacy" /></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#8A7F72]">We accept</span>
          <div className="flex flex-wrap gap-2">
            {['Visa', 'Mastercard', 'Amex', 'Discover', 'Apple Pay', 'Google Pay', 'Cash'].map((p) => (
              <span
                key={p}
                className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 font-mono text-[10px] uppercase tracking-wider text-[#F5EFE4]/80"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-[#8A7F72]">
          <p>
            📍 {selectedLocation?.city || 'Select a branch'} ·{' '}
            {selectedLocation ? `${selectedLocation.currencySymbol}${selectedLocation.currency}` : 'USD'} · ©{' '}
            {new Date().getFullYear()} BLAZE &amp; BUN. All rights reserved. Eat hot, live wild.
          </p>
          <p className="font-mono uppercase tracking-widest">Fire-Grilled. Fast. Unforgettable.</p>
        </div>
      </div>
    </footer>
  );
}

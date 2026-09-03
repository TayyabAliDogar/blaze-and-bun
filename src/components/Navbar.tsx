'use client';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { ChevronDown, User, Loader2, MapPin } from 'lucide-react';
import { useCartStore, useUIStore, useLocationStore, useAuthStore } from '@/store';
import { useToastStore } from '@/store/toast';
import { sfx } from '@/lib/sounds';
import { useBranchAvailability } from '@/lib/useBranchAvailability';
import AuthModal from './AuthModal';

/** User-facing messages for each geolocation failure mode. */
const GEO_ERROR_MESSAGES: Record<string, string> = {
  unsupported: 'Your browser doesn’t support location. Pick a branch above instead.',
  permission_denied:
    'Location access was denied. Please allow your browser to access your location (site settings), then try again.',
  position_unavailable:
    'We couldn’t pinpoint your position. Pick a branch above instead.',
  timeout:
    'Location timed out. Please check your connection and try again.',
  network:
    'Couldn’t reach our location service. Please try again or pick a branch.',
  no_branch:
    'No store is available near you right now. Pick the nearest branch above.',
};

export default function Navbar() {
  const { getTotalItems, openCart } = useCartStore();
  const { toggleMenu, isMenuOpen, closeMenu } = useUIStore();
  const { selectedLocation, setSelectedLocation, locations, detectFromBrowser } = useLocationStore();
  const openAuth = useAuthStore((s) => s.openAuth);
  const user = useAuthStore((s) => s.user);
  const hydrateUser = useAuthStore((s) => s.hydrateUser);
  const showToast = useToastStore((s) => s.show);
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  /** Human-readable detected location (e.g. "Lahore, Pakistan") after a successful run. */
  const [detectedLabel, setDetectedLabel] = useState<string | null>(null);
  const locRef = useRef<HTMLDivElement>(null);
  const selectedAvailability = useBranchAvailability(selectedLocation);
  const isSelectedOpen = selectedAvailability?.isOpen ?? selectedLocation?.isOpen ?? true;

  const handleDetect = async () => {
    if (detectingLocation) return;
    setDetectingLocation(true);
    setDetectedLabel(null);
    try {
      const result = await detectFromBrowser();
      if (result.ok) {
        // Keep a readable "where I am" label so the navbar reflects the user's
        // detected city even though the *branch* may be at a fixed HQ.
        setDetectedLabel(result.city || result.address || result.location.city);
        showToast(`📍 Delivering from ${result.location.name}`, 'success');
        setLocationOpen(false);
        sfx.success();
      } else {
        showToast(GEO_ERROR_MESSAGES[result.reason] ?? 'Couldn’t detect your location.', 'error');
        sfx.error();
      }
    } finally {
      setDetectingLocation(false);
    }
  };

  // The address pill shows the detected user location when known, else the
  // selected branch city.
  const addressLabel = detectedLabel || selectedLocation?.city || 'Select';

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    useLocationStore.getState().initializeLocation();
    hydrateUser();
    return () => cancelAnimationFrame(raf);
  }, [hydrateUser]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!locationOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (locRef.current && !locRef.current.contains(e.target as Node)) setLocationOpen(false);
    };
    document.addEventListener('pointerdown', onDocClick);
    return () => document.removeEventListener('pointerdown', onDocClick);
  }, [locationOpen]);

  useEffect(() => {
    if (!isMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [isMenuOpen, closeMenu]);

  const cartCount = mounted ? getTotalItems() : 0;

  const links = [
    { label: 'Menu', href: '/#menu' },
    { label: 'The Build', href: '/#build' },
    { label: 'Locations', href: '/#locations' },
    { label: 'Reviews', href: '/#reviews' },
  ];

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-[80] transition-all duration-300 ${
          scrolled
            ? 'bg-[#1C120C]/80 backdrop-blur-xl border-b border-white/10 py-3 shadow-[0_12px_28px_-12px_rgba(28,18,12,0.4)]'
            : 'bg-transparent py-5'
        }`}
      >
        <nav className="max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group" onClick={closeMenu}>
            <motion.span
              whileHover={{ rotate: 12, scale: 1.1 }}
              className="text-2xl"
              aria-hidden
            >
              🔥
            </motion.span>
            <span className="font-display text-xl md:text-2xl tracking-tight text-[#F5EFE4]">
              BLAZE<span className="text-[#E8542A]">&</span>BUN
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden lg:flex items-center gap-8">
            {links.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="relative text-sm text-[#F5EFE4]/80 hover:text-[#F5EFE4] font-mono uppercase tracking-[0.12em] text-xs group"
              >
                {link.label}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#E8542A] transition-all duration-300 group-hover:w-full" />
              </Link>
            ))}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            {/* Location selector (dropdown) */}
            <div ref={locRef} className="relative hidden md:block">
              <button
                onClick={() => {
                  setLocationOpen((o) => !o);
                  sfx.click();
                }}
                aria-haspopup="listbox"
                aria-expanded={locationOpen}
                className="flex items-center gap-2 px-3 py-2 rounded-full glass-pill text-xs text-[#F5EFE4] font-mono hover:border-[#E8542A]/50 transition-colors"
              >
                <span>📍</span>
                <span className="max-w-[110px] truncate capitalize">
                  {addressLabel}
                </span>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${isSelectedOpen ? 'bg-[#66B84B]' : 'bg-[#E8542A]'}`}
                  aria-label={isSelectedOpen ? 'Open now' : 'Closed'}
                />
                <ChevronDown
                  size={14}
                  className={`text-[#8A7F72] transition-transform duration-200 ${locationOpen ? 'rotate-180' : ''}`}
                />
              </button>

              <AnimatePresence>
                {locationOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    role="listbox"
                    aria-label="Choose your branch"
                    className="absolute right-0 top-[calc(100%+10px)] w-72 bg-[#1C120C]/95 backdrop-blur-xl border border-white/15 rounded-2xl p-2 shadow-[var(--elev-3)] z-50"
                  >
                    <p className="px-3 pt-2 pb-1 font-mono text-[10px] uppercase tracking-widest text-[#8A7F72]">
                      Pick your nearest blaze
                    </p>
                    <button
                      onClick={handleDetect}
                      disabled={detectingLocation}
                      className="w-full flex items-center gap-2 p-3 rounded-xl text-left text-xs font-mono uppercase tracking-wider text-[#F2B33D] border border-dashed border-[#F2B33D]/40 hover:border-[#F2B33D] transition-colors disabled:opacity-60 mb-1"
                    >
                      {detectingLocation ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <MapPin size={14} />
                      )}
                      {detectingLocation ? 'Finding you…' : '📍 Use my location'}
                    </button>
                    {(locations || []).map((l) => {
                      const active = selectedLocation?.id === l.id;
                      const locIsOpen = l.isOpen ?? true;
                      return (
                        <button
                          key={l.id}
                          role="option"
                          aria-selected={active}
                          onClick={() => {
                            setSelectedLocation(l);
                            setLocationOpen(false);
                            sfx.click();
                          }}
                          className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl text-left transition-colors duration-150 ${
                            active ? 'bg-[#E8542A]/15 border border-[#E8542A]/50' : 'border border-transparent hover:bg-white/5'
                          }`}
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <span className="text-sm shrink-0">📍</span>
                            <span className="min-w-0">
                              <span className="flex items-center gap-1.5 text-sm text-[#F5EFE4] truncate">
                                <span className="block truncate">{l.name}</span>
                                <span
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    locIsOpen ? 'bg-[#66B84B]' : 'bg-[#E8542A]'
                                  }`}
                                  aria-label={locIsOpen ? 'Open now' : 'Closed'}
                                />
                              </span>
                              <span className="block text-xs text-[#8A7F72] truncate">
                                {l.address}, {l.city}
                              </span>
                            </span>
                          </span>
                          <span
                            className={`font-mono text-xs ${active ? 'text-[#F2B33D]' : 'text-[#8A7F72]'}`}
                          >
                            {l.currencySymbol}
                            {active ? ' · ✓' : ''}
                          </span>
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Account */}
            <button
              onClick={() => {
                openAuth();
                sfx.pop();
              }}
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-full glass-pill hover:border-[#E8542A]/50 transition-colors"
              aria-label="Account"
            >
              {user ? (
                <span className="w-5 h-5 rounded-full bg-[#E8542A] flex items-center justify-center text-[11px] font-bold text-[#F5EFE4]">
                  {user.name[0]?.toUpperCase()}
                </span>
              ) : (
                <User size={16} className="text-[#F5EFE4]" strokeWidth={2.2} />
              )}
              <span className="hidden sm:inline text-xs font-mono text-[#F5EFE4]">Account</span>
            </button>

            {/* Cart */}
            <motion.button
              onClick={() => {
                openCart();
                sfx.pop();
              }}
              whileTap={{ scale: 0.92 }}
              className="relative flex items-center gap-2 px-3 py-2 rounded-full bg-[#E8542A] hover:bg-[#FF6A3D] active:bg-[#C9421F] transition-colors inner-catchlight"
              aria-label="Open cart"
            >
              <span>🛒</span>
              <span className="hidden sm:inline text-sm font-mono text-[#F5EFE4]">Cart</span>
              {mounted && cartCount > 0 && (
                <motion.span
                  key={cartCount}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#F2B33D] text-[#1C120C] text-[10px] font-bold flex items-center justify-center"
                >
                  {cartCount}
                </motion.span>
              )}
            </motion.button>

            {/* Mobile hamburger */}
            <button
              onClick={() => {
                toggleMenu();
                sfx.click();
              }}
              className="lg:hidden w-10 h-10 flex flex-col items-center justify-center gap-1.5 bg-white/5 rounded-full"
              aria-label="Toggle menu"
            >
              <span
                className={`block w-5 h-0.5 bg-[#F5EFE4] transition-all duration-300 ${
                  isMenuOpen ? 'rotate-45 translate-y-2' : ''
                }`}
              />
              <span
                className={`block w-5 h-0.5 bg-[#F5EFE4] transition-all duration-300 ${
                  isMenuOpen ? 'opacity-0' : ''
                }`}
              />
              <span
                className={`block w-5 h-0.5 bg-[#F5EFE4] transition-all duration-300 ${
                  isMenuOpen ? '-rotate-45 -translate-y-2' : ''
                }`}
              />
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onClick={closeMenu}
            className="fixed inset-0 z-[75] bg-[#1C120C]/97 backdrop-blur-xl pt-24 lg:hidden"
          >
            <div className="px-6 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
              {links.map((link, i) => (
                <motion.div
                  key={link.label}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="border-b border-white/10"
                >
                  <Link
                    href={link.href}
                    onClick={closeMenu}
                    className="py-4 font-display text-3xl text-[#F5EFE4] flex items-center justify-between"
                  >
                    {link.label}
                    <span className="text-[#E8542A] text-xl">→</span>
                  </Link>
                </motion.div>
              ))}
              <Link
                href="/#locations"
                onClick={closeMenu}
                className="py-4 font-display text-2xl text-[#F5EFE4]/80 flex items-center justify-between"
              >
                <span>
                  📍 {addressLabel}
                </span>
                <span className="text-[#8A7F72] text-sm font-mono uppercase tracking-wider">
                  {selectedLocation?.currencySymbol} {selectedLocation?.currency}
                </span>
              </Link>
              <Link
                href="/checkout"
                onClick={closeMenu}
                className="mt-6 bg-[#E8542A] text-center text-[#F5EFE4] rounded-full py-4 font-mono uppercase tracking-[0.14em] text-sm"
              >
                Checkout
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AuthModal />
    </>
  );
}
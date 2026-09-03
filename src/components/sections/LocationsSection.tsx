'use client';
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, MapPin } from 'lucide-react';
import { useLocationStore, type Location } from '@/store';
import { useToastStore } from '@/store/toast';
import { useBranchAvailability } from '@/lib/useBranchAvailability';
import SectionTransition from '../ui/SectionTransition';
import { sfx } from '@/lib/sounds';

const GEO_ERROR_MESSAGES: Record<string, string> = {
  unsupported: 'Your browser doesn’t support location. Pick a branch above instead.',
  permission_denied:
    'Location access was denied. Please allow your browser to access your location (site settings), then try again.',
  position_unavailable: 'We couldn’t pinpoint your position. Pick a branch above instead.',
  timeout: 'Location timed out. Please check your connection and try again.',
  network: 'Couldn’t reach our location service. Please try again or pick a branch.',
  no_branch: 'No store is available near you right now. Pick the nearest branch above.',
};

export default function LocationsSection() {
  const locations = useLocationStore((s) => s.locations);
  const { setSelectedLocation, detectFromBrowser } = useLocationStore();
  const showToast = useToastStore((s) => s.show);
  const [active, setActive] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const branch = useMemo(
    () => locations.find((b) => b.id === active) ?? locations[0] ?? null,
    [locations, active]
  );
  const availability = useBranchAvailability(branch);

  const chooseBranch = (b: Location, scrollToMenu = false) => {
    setActive(b.id);
    setSelectedLocation(b);
    sfx.click();
    if (scrollToMenu) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      document
        .getElementById('menu')
        ?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }
  };

  const handleDetect = async () => {
    if (detecting) return;
    setDetecting(true);
    try {
      const result = await detectFromBrowser();
      if (result.ok) {
        setActive(result.location.id);
        showToast(`📍 Delivering from ${result.location.name}`, 'success');
        sfx.success();
      } else {
        showToast(GEO_ERROR_MESSAGES[result.reason] ?? 'Couldn’t detect your location.', 'error');
        sfx.error();
      }
    } finally {
      setDetecting(false);
    }
  };

  return (
    <section id="locations" className="relative bg-[#1C120C] text-[#F5EFE4] py-24 md:py-32 grain">
      <SectionTransition from="#241B14" />
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="mb-12">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#F2B33D] mb-4">Find Us</p>
          <h2 className="font-display section-title">
            Where the <span className="italic text-stroke-orange">flame</span> burns.
          </h2>
        </div>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* Branch list */}
          <div className="lg:col-span-2 space-y-3">
            <button
              onClick={handleDetect}
              disabled={detecting}
              className="w-full flex items-center gap-2.5 p-3.5 rounded-2xl border border-dashed border-[#F2B33D]/50 bg-[#F2B33D]/5 text-left text-sm font-mono uppercase tracking-wider text-[#F2B33D] hover:border-[#F2B33D] hover:bg-[#F2B33D]/10 transition-colors disabled:opacity-60"
            >
              {detecting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <MapPin size={16} />
              )}
              {detecting ? 'Finding your nearest blaze…' : '📍 Use my current location'}
            </button>
            {locations.length === 0 && (
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-sm text-[#8A7F72]">
                Loading branches…
              </div>
            )}
            {locations.map((b) => {
              const isActive = branch?.id === b.id;
              const bOpen = b.isOpen ?? true;
              return (
                <motion.div
                  key={b.id}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => chooseBranch(b)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-[#E8542A]/15 border-[#E8542A]/60 shadow-[var(--glow-orange)]'
                      : 'bg-white/5 border-white/10 hover:bg-white/[0.08] hover:border-white/25 hover:shadow-[var(--elev-2)] active:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-display text-xl">{b.name}</h3>
                    {b.isFeatured && (
                      <span className="text-[10px] font-mono uppercase bg-[#F2B33D] text-[#1C120C] px-2 py-0.5 rounded-full">
                        Flagship
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[#F5EFE4]/70">{b.address}, {b.city}</p>
                  <div className="flex items-center justify-between mt-2 text-xs text-[#8A7F72] font-mono">
                    <span>{b.hours}</span>
                    <span className={bOpen ? 'text-[#66B84B]' : 'text-[#E8542A]'}>
                      {bOpen ? '● Open now' : '● Closed'}
                    </span>
                  </div>
                  <div
                    className="flex gap-2 mt-3 pt-3 border-t border-white/10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${b.coordinates.lat},${b.coordinates.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 text-center px-3 py-2 rounded-full border border-white/15 text-[11px] font-mono uppercase tracking-wider text-[#F5EFE4] transition-colors duration-200 hover:bg-[#E8542A]/30 hover:border-[#E8542A]/60"
                    >
                      🧭 Get Directions
                    </a>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        chooseBranch(b, true);
                      }}
                      className="flex-1 px-3 py-2 rounded-full border border-white/15 text-[11px] font-mono uppercase tracking-wider text-[#F5EFE4] transition-colors duration-200 hover:bg-[#E8542A]/30 hover:border-[#E8542A]/60"
                    >
                      🛵 Order Pickup
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Map + details */}
          {branch && (
            <motion.div
              key={branch.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-3 rounded-3xl overflow-hidden border border-white/10 glass-card-dark"
            >
              <div className="relative h-72">
                <iframe
                  title={`Map of ${branch.name}`}
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${branch.coordinates.lng - 0.02}%2C${branch.coordinates.lat - 0.02}%2C${branch.coordinates.lng + 0.02}%2C${branch.coordinates.lat + 0.02}&layer=mapnik&marker=${branch.coordinates.lat}%2C${branch.coordinates.lng}`}
                  className="w-full h-full border-0 map-branded"
                  loading="lazy"
                />
                {/* Branded scrim over the OSM attribution / donation footer */}
                <div
                  className="absolute bottom-0 inset-x-0 h-14 bg-gradient-to-t from-[#1C120C] via-[#1C120C]/70 to-transparent pointer-events-none"
                  aria-hidden="true"
                />
                <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between gap-3">
                  <div className="glass-card-dark rounded-xl px-4 py-2 text-sm">
                    📍 {branch.name}
                  </div>
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${branch.coordinates.lat}&mlon=${branch.coordinates.lng}#map=16/${branch.coordinates.lat}/${branch.coordinates.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="glass-card-dark rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[#F5EFE4] hover:text-[#F2B33D] transition-colors"
                  >
                    Open Map ↗
                  </a>
                </div>
              </div>
              <div className="p-6 grid sm:grid-cols-2 gap-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[#8A7F72] mb-1">Address</p>
                  <p className="text-sm">{branch.address}<br />{branch.city}</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[#8A7F72] mb-1">Phone</p>
                  <p className="text-sm">{branch.phone || '—'}</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[#8A7F72] mb-1">Hours</p>
                  <p className="text-sm">{branch.hours}</p>
                  <p className="text-xs mt-1 font-mono">
                    <span className={availability?.isOpen ? 'text-[#66B84B]' : 'text-[#E8542A]'}>
                      {availability?.isOpen ? '● Open now' : '● Closed'}
                    </span>
                    {availability?.label && (
                      <span className="text-[#8A7F72] ml-2">· {availability.label}</span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[#8A7F72] mb-1">Delivery</p>
                  <p className="text-sm">
                    {branch.deliveryRadiusKm
                      ? `Delivers within ~${branch.deliveryRadiusKm} km`
                      : 'Local delivery available'}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
}
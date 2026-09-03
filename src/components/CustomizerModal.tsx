'use client';
import { useEffect, useMemo, useRef, useState, type ReactNode, type MouseEvent } from 'react';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { MenuItem } from '@/data/menu';
import { useCartStore, useLocationStore, type CartItem } from '@/store';
import { usePrice } from '@/lib/currency';
import { useBranchIsOpen } from '@/lib/useBranchAvailability';
import { sfx } from '@/lib/sounds';
import Button from './ui/Button';

interface CustomizerModalProps {
  item: MenuItem | null;
  onClose: () => void;
}

const SPICE_LABELS = ['Mild', 'Medium Blaze', 'Inferno', 'Reaper X'];

const FOCUSABLE =
  'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function Label({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#F2B33D] mb-3">{children}</p>
  );
}

function OptionChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`pointer-events-auto cursor-pointer px-3 py-2 rounded-full text-xs font-mono transition-all duration-200 border inner-catchlight ${
        active
          ? 'bg-[#E8542A] border-[#E8542A] text-[#F5EFE4] shadow-[var(--glow-orange)]'
          : 'bg-white/5 border-white/10 text-[#F5EFE4] hover:border-[#E8542A]/50 hover:bg-white/[0.09] active:bg-white/10'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Self-contained modal host. Handles:
 *  - body scroll lock (toggled on open, ALWAYS restored on close/unmount),
 *  - Escape-to-close,
 *  - focus trap + initial focus,
 *  - pointer-event isolation (backdrop and panel are explicitly
 *    `pointer-events-auto`; the backdrop closes on click, panel stops propagation).
 *
 * The form state lives in `CustomizerPanel`, keyed by item id so switching
 * products remounts it with fresh, correct state.
 */
export default function CustomizerModal({ item, onClose }: CustomizerModalProps) {
  const open = Boolean(item);
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  // Keep the latest onClose without re-running dependent effects.
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Body scroll lock: never leaves the page stuck; restores the prior value.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // Escape closes the modal.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Focus the first control and trap Tab inside the panel.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    const getFocusables = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.tabIndex >= 0);

    getFocusables()[0]?.focus();

    const onTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const els = getFocusables();
      if (els.length === 0) {
        e.preventDefault();
        return;
      }
      const first = els[0];
      const last = els[els.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onTab);
    return () => document.removeEventListener('keydown', onTab);
  }, [open]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {item && (
        <motion.div
          key="customizer-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="presentation"
          className="pointer-events-auto fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4"
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Customize ${item.name}`}
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', damping: 24, stiffness: 240 }}
            onClick={(e) => e.stopPropagation()}
            className="pointer-events-auto w-full md:max-w-lg max-h-[92vh] overflow-y-auto bg-[#1C120C] border border-white/10 rounded-t-3xl md:rounded-3xl shadow-[var(--elev-3)]"
          >
            <CustomizerPanel key={item.id} item={item} onClose={onClose} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

function CustomizerPanel({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const addItem = useCartStore((s) => s.addItem);
  const openCart = useCartStore((s) => s.openCart);
  const selectedLocation = useLocationStore((s) => s.selectedLocation);
  const branchOpen = useBranchIsOpen(selectedLocation);
  const { fmt, delta } = usePrice();

  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [spiceLevel, setSpiceLevel] = useState(item.isSpicy ? 1 : 0);
  const [selectedBun, setSelectedBun] = useState<string | null>(null);
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const totalPrice = useMemo(() => {
    let price = item.price;
    const size = item.customization?.sizes?.find((s) => s.name === selectedSize);
    if (size) price += size.priceDelta;

    const spiceLevels = item.customization?.spiceLevels;
    if (spiceLevels && Number.isFinite(spiceLevel) && spiceLevel >= 0 && spiceLevel < spiceLevels.length) {
      // `spiceLevel` is the 0-based index of the selected heat option. Apply any
      // upcharge encoded in that option's label (e.g. "Inferno +$0.50").
      const selectedLabel = spiceLevels[spiceLevel];
      const match = selectedLabel?.match(/\+?\$?([\d.]+)/);
      if (match && /\+/.test(selectedLabel ?? '')) {
        price += parseFloat(match[1]) || 0;
      }
    }

    item.customization?.addOns?.forEach((a) => {
      if (selectedAddOns.includes(a.name)) price += a.price;
    });

    if (selectedBun) {
      const match = selectedBun.match(/\+(\$[\d.]+|[\d.]+)/);
      if (match) {
        price += parseFloat(match[1].replace('$', '')) || 0;
      }
    }

    return price;
  }, [item, selectedSize, selectedAddOns, spiceLevel, selectedBun]);

  const toggleAddOn = (name: string) => {
    setSelectedAddOns((prev) =>
      prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name]
    );
    sfx.pop();
  };

  const handleAdd = (e: MouseEvent<Element>) => {
    e.preventDefault();
    if (!branchOpen || item.isOutOfStock) return;
    const payload: Omit<CartItem, 'id'> = {
      menuItemId: item.id,
      name: item.name,
      price: totalPrice,
      image: item.image,
      quantity,
      customizations: {
        size: selectedSize ?? undefined,
        bun: selectedBun ?? undefined,
        extras: selectedAddOns,
        spiceLevel,
        notes: notes.trim() || undefined,
      },
    };
    addItem(payload);
    sfx.add();
    onClose();
    openCart();
  };

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#1C120C]/95 backdrop-blur p-5 flex items-center gap-4 border-b border-white/10">
        {item.image ? (
          <Image
            src={item.image}
            alt={item.name}
            width={64}
            height={64}
            className="w-16 h-16 rounded-2xl object-cover shadow-lg"
          />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-[#2E2820] flex items-center justify-center text-xl">
            📷
          </div>
        )}
        <div className="flex-1">
          <h3 id="customizer-title" className="font-display text-xl text-[#F5EFE4]">{item.name}</h3>
          <p className="font-mono text-[#F2B33D] text-sm">From {fmt(item.price)}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="pointer-events-auto cursor-pointer w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 active:bg-white/15 flex items-center justify-center text-[#F5EFE4]"
        >
          ✕
        </button>
      </div>

      {/* Options */}
      <div className="p-5 space-y-6">
        {item.customization?.sizes && (
          <div>
            <Label>Choose Size</Label>
            <div className="flex flex-wrap gap-2">
              {item.customization.sizes.map((s) => (
                <OptionChip
                  key={s.name}
                  active={selectedSize === s.name}
                  onClick={() => {
                    setSelectedSize(s.name);
                    sfx.click();
                  }}
                >
                  {s.name}{' '}
                  <span className="opacity-60">
                    {s.priceDelta === 0 ? '' : delta(s.priceDelta)}
                  </span>
                </OptionChip>
              ))}
            </div>
          </div>
        )}

        {item.isSpicy && item.customization?.spiceLevels && (
          <div>
            <Label>Heat Level</Label>
            <div className="flex items-center gap-1.5">
              {SPICE_LABELS.slice(0, item.customization.spiceLevels.length).map((label, i) => (
                <motion.button
                  key={label}
                  type="button"
                  whileTap={{ scale: 0.92 }}
                  onClick={() => {
                    setSpiceLevel(i);
                    sfx.click();
                  }}
                  className={`pointer-events-auto cursor-pointer flex-1 py-2.5 rounded-xl text-xs font-mono border flex flex-col items-center gap-0.5 transition-all duration-200 ${
                    spiceLevel === i
                      ? 'bg-[#E8542A] border-[#E8542A] text-[#F5EFE4] shadow-[var(--glow-orange)]'
                      : 'bg-white/5 border-white/10 text-[#F5EFE4] hover:border-[#E8542A]/50 hover:bg-white/[0.09]'
                  }`}
                >
                  <span>{'🌶️'.repeat(i + 1)}</span>
                  {label}
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {item.customization?.bunTypes && (
          <div>
            <Label>Bun / Base</Label>
            <div className="flex flex-wrap gap-2">
              {item.customization.bunTypes.map((b) => (
                <OptionChip
                  key={b}
                  active={selectedBun === b}
                  onClick={() => {
                    setSelectedBun(b);
                    sfx.click();
                  }}
                >
                  {b}
                </OptionChip>
              ))}
            </div>
          </div>
        )}

        {item.customization?.addOns && (
          <div>
            <Label>Add-ons</Label>
            <div className="space-y-2">
              {item.customization.addOns.map((a) => {
                const active = selectedAddOns.includes(a.name);
                return (
                  <button
                    key={a.name}
                    type="button"
                    onClick={() => toggleAddOn(a.name)}
                    className={`pointer-events-auto cursor-pointer w-full flex items-center justify-between p-3 rounded-xl border transition-all duration-200 ${
                      active
                        ? 'bg-[#E8542A]/15 border-[#E8542A]/60 shadow-[var(--glow-orange)]'
                        : 'bg-white/5 border-white/10 hover:border-white/25 hover:bg-white/[0.08] active:bg-white/10'
                    }`}
                  >
                    <span className="text-sm text-[#F5EFE4] flex items-center gap-2">
                      <span
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center text-[8px] ${
                          active ? 'bg-[#E8542A] border-[#E8542A] text-white' : 'border-white/40'
                        }`}
                      >
                        {active ? '✓' : ''}
                      </span>
                      {a.name}
                    </span>
                    <span className="font-mono text-sm text-[#F2B33D]">{delta(a.price)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <Label>Special instructions</Label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="No onions, extra crispy, etc…"
            className="pointer-events-auto w-full p-3 rounded-xl bg-white/5 border border-white/10 text-sm text-[#F5EFE4] placeholder:text-white/30 focus:outline-none focus:border-[#E8542A] resize-none"
            rows={2}
          />
        </div>

        <div className="flex items-center justify-between gap-4 pt-2">
          <div className="flex items-center border border-white/15 rounded-full overflow-hidden">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              aria-label="Decrease quantity"
              className="pointer-events-auto cursor-pointer px-4 py-2.5 text-[#F5EFE4] hover:bg-white/10"
            >
              −
            </button>
            <span className="w-10 text-center font-mono text-[#F5EFE4]">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              aria-label="Increase quantity"
              className="pointer-events-auto cursor-pointer px-4 py-2.5 text-[#F5EFE4] hover:bg-white/10"
            >
              +
            </button>
          </div>
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={handleAdd}
            className="flex-1"
            magnetic={false}
            disabled={!branchOpen || item.isOutOfStock}
          >
            {item.isOutOfStock
              ? 'Sold Out'
              : branchOpen
                ? `Add · ${fmt(totalPrice * quantity)}`
                : 'Currently Closed'}
          </Button>
        </div>
      </div>
    </div>
  );
}
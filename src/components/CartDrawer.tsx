'use client';
import { useState } from 'react';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useCartStore, useLocationStore } from '@/store';
import { computeTotals, usePrice } from '@/lib/currency';
import { useModalDialog } from '@/lib/useModalDialog';
import { sfx } from '@/lib/sounds';
import Button from './ui/Button';

export default function CartDrawer() {
  const { items, isOpen, closeCart, removeItem, updateQuantity, getSubtotal, getTotalItems } =
    useCartStore();
  const selectedLocation = useLocationStore((s) => s.selectedLocation);
  const { fmt } = usePrice();
  const panelRef = useModalDialog(isOpen, closeCart);
  const [checkoutMode, setCheckoutMode] = useState(false);

  // Reset checkout mode to the bag view when the drawer closes. Adjusted during
  // render (not in an effect) so state follows the `isOpen` prop cleanly.
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (prevIsOpen !== isOpen) {
    setPrevIsOpen(isOpen);
    if (!isOpen) setCheckoutMode(false);
  }

  const { subtotal, deliveryFee, tax, total, threshold } = computeTotals(getSubtotal(), selectedLocation);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCart}
            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
          />
          <motion.aside
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-title"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 240 }}
            className="fixed top-0 right-0 z-[85] h-full w-full max-w-md bg-[#1C120C] border-l border-white/10 flex flex-col shadow-[var(--elev-3)]"
          >
            <div className="p-5 flex items-center justify-between border-b border-white/10">
              <div>
                <h2 id="cart-title" className="font-display text-2xl text-[#F5EFE4]">Your Blaze</h2>
                <p className="font-mono text-xs text-[#8A7F72] uppercase tracking-[0.14em]">
                  {getTotalItems()} item{getTotalItems() !== 1 ? 's' : ''} in basket
                </p>
              </div>
              <button
                onClick={closeCart}
                aria-label="Close cart"
                className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#F5EFE4]"
              >
                ✕
              </button>
            </div>

            {items.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
                <div className="text-6xl">🍔</div>
                <h3 className="font-display text-xl text-[#F5EFE4]">Your cart is blazing empty</h3>
                <p className="text-[#8A7F72] text-sm max-w-xs">
                  Fire up your order. Add something delicious from the menu below.
                </p>
                <Button variant="primary" onClick={closeCart}>
                  Browse the Menu
                </Button>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {items.map((item) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex gap-3 p-3 rounded-2xl bg-white/5 border border-white/10"
                    >
                      {item.image ? (
                        <Image
                          src={item.image}
                          alt={item.name}
                          width={64}
                          height={64}
                          className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-[#2E2820] flex items-center justify-center text-lg flex-shrink-0">
                          📷
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between gap-2">
                          <h4 className="text-sm font-medium text-[#F5EFE4] truncate">{item.name}</h4>
                          <button
                            onClick={() => {
                              removeItem(item.id);
                              sfx.remove();
                            }}
                            className="text-[#8A7F72] hover:text-[#E8542A] text-xs flex-shrink-0"
                            aria-label="Remove"
                          >
                            ✕
                          </button>
                        </div>
                        {item.customizations?.size && (
                          <p className="text-xs text-[#8A7F72]">{item.customizations.size}</p>
                        )}
                        {item.customizations?.bun && (
                          <p className="text-xs text-[#8A7F72]">{item.customizations.bun}</p>
                        )}
                        {item.customizations?.extras && item.customizations.extras.length > 0 && (
                          <p className="text-xs text-[#8A7F72] truncate">
                            + {item.customizations.extras.slice(0, 2).join(', ')}
                            {item.customizations.extras.length > 2 ? '…' : ''}
                          </p>
                        )}
                        {item.customizations?.spiceLevel !== undefined && item.customizations.spiceLevel > 0 && (
                          <p className="text-xs text-[#E8542A]">
                            {'🌶️'.repeat(item.customizations.spiceLevel)}
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center border border-white/15 rounded-full overflow-hidden">
                            <button
                              onClick={() => {
                                updateQuantity(item.id, item.quantity - 1);
                                sfx.remove();
                              }}
                              className="px-2.5 py-1 text-[#F5EFE4] hover:bg-white/10 text-sm"
                            >
                              −
                            </button>
                            <span className="w-7 text-center font-mono text-sm text-[#F5EFE4]">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => {
                                updateQuantity(item.id, item.quantity + 1);
                                sfx.add();
                              }}
                              className="px-2.5 py-1 text-[#F5EFE4] hover:bg-white/10 text-sm"
                            >
                              +
                            </button>
                          </div>
                          <span className="font-mono text-sm text-[#F2B33D]">
                            {fmt(item.price * item.quantity)}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="p-5 border-t border-white/10 space-y-3 bg-[#1C120C]">
                  {checkoutMode && subtotal <= threshold && (
                    <div className="flex justify-between text-sm">
                      <span className="text-[#8A7F72]">Delivery fee</span>
                      <span className="font-mono text-[#F5EFE4]">{fmt(deliveryFee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-[#8A7F72]">Subtotal</span>
                    <span className="font-mono text-[#F5EFE4]">{fmt(subtotal)}</span>
                  </div>
                  {checkoutMode && (
                    <div className="flex justify-between items-center">
                      <span className="text-[#8A7F72]">Tax</span>
                      <span className="font-mono text-[#F5EFE4]">{fmt(tax)}</span>
                    </div>
                  )}
                  {checkoutMode && (
                    <div className="flex justify-between items-center text-lg">
                      <span className="text-[#F5EFE4]">Total</span>
                      <span className="font-mono text-[#F2B33D]">{fmt(total)}</span>
                    </div>
                  )}
                  {subtotal <= threshold && !checkoutMode && (
                    <p className="text-xs text-[#8A7F72]">
                      Free delivery on orders over {fmt(threshold)} · add {fmt(threshold - subtotal)} more to
                      unlock
                    </p>
                  )}
                  <div className="flex flex-col gap-2 pt-1">
                    {!checkoutMode && (
                      <Button
                        variant="cream"
                        onClick={() => {
                          setCheckoutMode(true);
                          sfx.click();
                        }}
                        magnetic={false}
                      >
                        Checkout · {fmt(total)}
                      </Button>
                    )}
                    {checkoutMode && (
                      <Button
                        href="/checkout"
                        variant="primary"
                        size="lg"
                        onClick={closeCart}
                        className="w-full"
                        magnetic={false}
                      >
                        Proceed to Secure Checkout →
                      </Button>
                    )}
                    <button
                      onClick={closeCart}
                      className="w-full text-center text-sm text-[#8A7F72] hover:text-[#F5EFE4] py-2"
                    >
                      Continue shopping
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

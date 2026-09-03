'use client';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useCartStore, useAuthStore, useLocationStore } from '@/store';
import { useToastStore } from '@/store/toast';
import { computeTotals, usePrice } from '@/lib/currency';
import { useBranchIsOpen } from '@/lib/useBranchAvailability';
import { sfx } from '@/lib/sounds';
import Button from '@/components/ui/Button';
import Navbar from '@/components/Navbar';
import CartDrawer from '@/components/CartDrawer';
import { useStripeConfig } from '@/components/checkout/useStripeConfig';
import { StripeCardFields, type StripeCardHandle } from '@/components/checkout/StripeCardFields';

type PayMethod = 'card' | 'googlepay' | 'applepay' | 'cod';

interface CartValidateResponse {
  totals?: { subtotal: number; deliveryFee: number; tax: number; total: number };
}

const SCHEDULE_SLOTS = [
  { value: '30', label: '30 min' },
  { value: '60', label: '1 hour' },
  { value: '90', label: '1.5 hours' },
  { value: '120', label: '2 hours' },
  { value: '180', label: '3 hours' },
  { value: '240', label: '4 hours' },
] as const;

let orderIdFallback = 0;
const fallbackOrderId = () => `BB-${(crypto.randomUUID?.() ?? `${++orderIdFallback}`).replace(/-/g, '').slice(0, 6).toUpperCase()}`;

type Errors = Partial<
  Record<'address' | 'phone' | 'number' | 'name' | 'expiry' | 'cvv', string>
>;

const isValidPhone = (p: string) => {
  const cleaned = p.replace(/\D/g, '');
  return cleaned.length >= 10 && /^[+()\-\s\d]{7,20}$/.test(p.trim());
};

function luhn(n: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = n.length - 1; i >= 0; i--) {
    let d = Number(n[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

function isValidExpiry(expiry: string): boolean {
  const parts = expiry.split('/');
  if (parts.length !== 2) return false;
  const mm = Number(parts[0]);
  const yy = 2000 + Number(parts[1]);
  if (!Number.isFinite(mm) || !Number.isFinite(yy)) return false;
  const now = new Date();
  if (mm < 1 || mm > 12) return false;
  if (yy < now.getFullYear()) return false;
  if (yy === now.getFullYear() && mm < now.getMonth() + 1) return false;
  return yy <= now.getFullYear() + 15;
}

function ErrorText({ children }: { children: ReactNode }) {
  return <p className="text-xs text-[#E8542A] mt-1.5 font-mono">{children}</p>;
}

const INPUT = 'w-full px-4 py-3.5 rounded-2xl bg-black/30 backdrop-blur-md border border-white/[0.08] text-sm text-[#F5EFE4] placeholder:text-white/30 focus:outline-none focus:border-[#FF3800]/60 focus:ring-2 focus:ring-[#FF3800]/20 transition-all duration-300';
const GLASS_CARD = 'rounded-3xl p-6 md:p-8 bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)]';

const PAY_ICONS: Record<PayMethod, string> = {
  card: '💳',
  googlepay: 'G',
  applepay: '📱',
  cod: '💵',
};
const PAY_LABELS: Record<PayMethod, string> = {
  card: 'Card',
  googlepay: 'Google Pay',
  applepay: 'Apple Pay',
  cod: 'Cash',
};

export default function CheckoutPage() {
  const { items, getSubtotal, clearCart } = useCartStore();
  const { user, openAuth, addresses, addOrder } = useAuthStore();
  const { fmt, currency } = usePrice();

  const [step, setStep] = useState<'delivery' | 'payment' | 'placed'>('delivery');
  const [payMethod, setPayMethod] = useState<PayMethod>('card');
  const [card, setCard] = useState({ number: '', name: '', expiry: '', cvv: '' });
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [deliveryNow, setDeliveryNow] = useState(true);
  const [scheduleMinutes, setScheduleMinutes] = useState<string>('30');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState('confirmed');
  const [placedTotal, setPlacedTotal] = useState(0);
  const [phone, setPhone] = useState('');
  const [guestAddr, setGuestAddr] = useState({ street: '', city: '', postal: '' });
  const [useManual, setUseManual] = useState(false);
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discountUsd: number; message: string } | null>(null);
  const appliedPromoRef = useRef(0);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoBusy, setPromoBusy] = useState(false);
  const [serverTotals, setServerTotals] = useState<{
    subtotal: number;
    deliveryFee: number;
    tax: number;
    discount: number;
    total: number;
  } | null>(null);
  const [placing, setPlacing] = useState(false);
  const [guestAccessToken, setGuestAccessToken] = useState<string | null>(null);
  const [guestEmailSaved, setGuestEmailSaved] = useState('');
  const stripeConfig = useStripeConfig();
  const [payClientSecret, setPayClientSecret] = useState<string | null>(null);
  const [confirmingStripe, setConfirmingStripe] = useState(false);
  const [pendingCheckout, setPendingCheckout] = useState<{
    orderId: string;
    serverTotal: number;
    accessToken: string | null;
    guestEmailSaved: string;
    orderStatus: string;
  } | null>(null);
  const stripeCardRef = useRef<StripeCardHandle>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const selectedLocation = useLocationStore((s) => s.selectedLocation);
  const branchOpen = useBranchIsOpen(selectedLocation);
  const detectFromBrowser = useLocationStore((s) => s.detectFromBrowser);
  const showToast = useToastStore((s) => s.show);
  const [detectLoading, setDetectLoading] = useState(false);

  const handleDetect = async () => {
    if (detectLoading) return;
    setDetectLoading(true);
    try {
      const result = await detectFromBrowser();
      if (result.ok) {
        if (result.address) {
          setGuestAddr({ street: result.address, city: result.city ?? '', postal: '' });
          setUseManual(true);
          setSelectedAddress(null);
          setErrors((err) => ({ ...err, address: undefined }));
        }
        showToast(`📍 Delivering from ${result.location.name}`, 'success');
        sfx.success();
      } else {
        const msg =
          result.reason === 'permission_denied'
            ? 'Location access was denied. Please allow your browser to access your location (site settings), then try again.'
            : result.reason === 'timeout'
            ? 'Location timed out. Please check your connection and try again.'
            : result.reason === 'no_branch'
            ? 'No store is available near you right now. Enter your address below.'
            : 'Couldn\'t detect your location. Enter your address below.';
        showToast(msg, 'error');
        sfx.error();
      }
    } finally {
      setDetectLoading(false);
    }
  };

  const clientEst = useMemo(() => computeTotals(getSubtotal(), selectedLocation), [getSubtotal, selectedLocation]);
  const subtotal = serverTotals?.subtotal ?? clientEst.subtotal;
  const deliveryFee = serverTotals?.deliveryFee ?? clientEst.deliveryFee;
  const tax = serverTotals?.tax ?? clientEst.tax;
  const discount = serverTotals?.discount ?? 0;
  const total = serverTotals?.total ?? Math.max(0, clientEst.total - discount);

  const serializeItems = () =>
    items.map((i) => ({
      itemId: i.menuItemId,
      quantity: i.quantity,
      ...(i.customizations.size ? { size: i.customizations.size } : {}),
      ...(i.customizations.spiceLevel ? { spiceLevel: i.customizations.spiceLevel } : {}),
      ...(i.customizations.bun ? { bun: i.customizations.bun } : {}),
      ...(i.customizations.extras && i.customizations.extras.length > 0
        ? { extras: i.customizations.extras }
        : {}),
      ...(i.customizations.notes ? { notes: i.customizations.notes } : {}),
      ...(i.customizations.specialInstructions
        ? { specialInstructions: i.customizations.specialInstructions }
        : {}),
    }));

  useEffect(() => {
    if (items.length === 0) return;
    const est = computeTotals(getSubtotal(), selectedLocation);
    const apply = (st?: { subtotal: number; deliveryFee: number; tax: number; total: number } | null) => {
      const subtotal = st?.subtotal ?? est.subtotal;
      const deliveryFee = st?.deliveryFee ?? est.deliveryFee;
      const tax = st?.tax ?? est.tax;
      setServerTotals((prev) => {
        const keptDiscount = prev?.discount ?? appliedPromoRef.current ?? 0;
        const total = Math.max(0, subtotal + deliveryFee + tax - keptDiscount);
        return { subtotal, deliveryFee, tax, discount: keptDiscount, total };
      });
    };
    let active = true;
    fetch('/api/cart/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: serializeItems() }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: CartValidateResponse | null) => {
        if (!active) return;
        apply(data?.totals ?? null);
      })
      .catch(() => { if (active) apply(null); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, selectedLocation]);

  const applyPromo = async () => {
    const code = promoInput.trim();
    if (!code) return;
    setPromoBusy(true);
    setPromoError(null);
    try {
      const res = await fetch('/api/promo/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, items: serializeItems() }),
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        appliedPromoRef.current = data.discountUsd;
        setAppliedPromo({ code: data.promo.code, discountUsd: data.discountUsd, message: data.promo.description });
        setServerTotals((prev) =>
          prev ? { ...prev, discount: data.totals.discount, total: data.totals.total } : prev
        );
      } else {
        setAppliedPromo(null);
        setPromoError(data?.message ?? 'That promo code isn\'t valid.');
      }
    } catch {
      setAppliedPromo(null);
      setPromoError('Could not check that code just now.');
    } finally {
      setPromoBusy(false);
    }
  };

  const showManual = !user || addresses.length === 0 || useManual;
  const addressValid = showManual
    ? Boolean(guestAddr.street.trim()) && Boolean(guestAddr.city.trim()) && Boolean(guestAddr.postal.trim())
    : Boolean(selectedAddress);
  const deliveryValid = addressValid && isValidPhone(phone);

  const digits = card.number.replace(/\s/g, '');
  const cardValid =
    payMethod !== 'card' ||
    (/^\d{14,16}$/.test(digits) &&
      luhn(digits) &&
      card.name.trim().length >= 2 &&
      isValidExpiry(card.expiry) &&
      /^\d{3,4}$/.test(card.cvv));

  const liveStripe = stripeConfig.config.configured;
  const stripeMode = liveStripe && payMethod === 'card';
  const stripePromise = useMemo(
    () => (stripeConfig.config.configured ? stripeConfig.getStripe() : Promise.resolve(null)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stripeConfig.config.configured]
  );

  const payReady = (stripeMode ? true : cardValid) && items.length > 0 && deliveryValid && branchOpen;

  const savedPick = addresses.find((a) => a.id === selectedAddress);
  const deliveryAddress = showManual
    ? `${guestAddr.street.trim()}, ${guestAddr.city.trim()} ${guestAddr.postal.trim()}`
    : savedPick
      ? `${savedPick.line1}, ${savedPick.city} ${savedPick.postal}`
      : '';

  const cardType = useMemo(() => {
    const n = card.number.replace(/\s/g, '');
    if (/^4/.test(n)) return 'Visa';
    if (/^5[1-5]/.test(n)) return 'Mastercard';
    if (/^3[47]/.test(n)) return 'Amex';
    if (/^6/.test(n)) return 'Discover';
    return 'Card';
  }, [card.number]);

  const formatNumber = (v: string) => v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
  const formatExpiry = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 4);
    return d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d;
  };

  const placeOrder = async () => {
    if (!payReady || !branchOpen || placing) return;
    if (payMethod === 'googlepay' || payMethod === 'applepay') {
      setErrors((err) => ({ ...err, name: 'Google Pay and Apple Pay are coming soon. Please use card or cash.' }));
      setPayMethod('card');
      return;
    }
    if (!user && !guestEmail.trim()) {
      setErrors((err) => ({ ...err, name: 'Enter your email so we can confirm your order.' }));
      return;
    }
    setPlacing(true);
    setPromoError(null);
    try {
      const res = await fetch('/api/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: serializeItems(),
          deliveryType: 'delivery',
          paymentMethod: payMethod,
          ...(appliedPromo ? { promoCode: appliedPromo.code } : {}),
          ...(user
            ? {}
            : { guestName: guestName.trim(), guestEmail: guestEmail.trim().toLowerCase(), guestPhone: phone }),
          ...(deliveryAddress ? { deliveryAddress } : {}),
          ...(deliveryNotes.trim() ? { deliveryNotes: deliveryNotes.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPromoError(data?.error ?? 'Could not place your order. Please try again.');
        return;
      }

      // Live Stripe card orders return a clientSecret: the order is created and
      // stays `unpaid` until the user finalizes with Stripe Elements + confirmPayment.
      if (stripeMode && data?.clientSecret) {
        setPayClientSecret(data.clientSecret);
        setPendingCheckout({
          orderId: data?.order?.id ?? fallbackOrderId(),
          serverTotal: data?.totals?.total ?? total,
          accessToken: typeof data?.guestAccessToken === 'string' ? data.guestAccessToken : null,
          guestEmailSaved: user ? '' : guestEmail.trim().toLowerCase(),
          orderStatus: 'confirmed',
        });
        return;
      }

      finalizeOrder({
        orderId: data?.order?.id ?? fallbackOrderId(),
        serverTotal: data?.totals?.total ?? total,
        accessToken: typeof data?.guestAccessToken === 'string' ? data.guestAccessToken : null,
        guestEmailSaved: user ? '' : guestEmail.trim().toLowerCase(),
        orderStatus: 'confirmed',
      });
    } catch {
      setPromoError('Network error while placing your order.');
    } finally {
      setPlacing(false);
    }
  };

  const finalizeOrder = ({
    orderId,
    serverTotal,
    accessToken,
    guestEmailSaved: savedEmail,
    orderStatus,
  }: {
    orderId: string;
    serverTotal: number;
    accessToken: string | null;
    guestEmailSaved: string;
    orderStatus: string;
  }) => {
    addOrder(serverTotal, items, currency, {
      address: deliveryAddress || undefined,
      notes: deliveryNotes.trim() || undefined,
    });
    setOrderId(orderId);
    setPlacedTotal(serverTotal);
    setOrderStatus(orderStatus);
    setStep('placed');
    setGuestAccessToken(accessToken);
    setGuestEmailSaved(savedEmail);
    setPayClientSecret(null);
    setPendingCheckout(null);
    clearCart();
    sfx.success();

    // Card payments are confirmed server-side (webhook-followed in live Stripe,
    // or already-confirmed stub in demo mode). COD orders stay unpaid until delivery.
    const statuses = ['confirmed', 'preparing', 'out-for-delivery', 'delivered'];
    let i = 0;
    timerRef.current = setInterval(() => {
      i++;
      if (i >= statuses.length) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        return;
      }
      setOrderStatus(statuses[i]);
      sfx.click();
    }, 6000);
  };

  const confirmStripePayment = async () => {
    if (confirmingStripe || !payClientSecret) return;
    const handles = stripeCardRef.current?.ready();
    if (!handles || !handles.stripe || !handles.elements) {
      setPromoError('Secure payment is still loading. Please try again.');
      return;
    }
    setConfirmingStripe(true);
    setPromoError(null);
    try {
      const { error } = await handles.stripe.confirmPayment({
        elements: handles.elements,
        clientSecret: payClientSecret,
        redirect: 'if_required',
      });
      if (error) {
        setPromoError(error.message ?? 'Payment could not be completed. Please try again.');
        return;
      }
      if (!pendingCheckout) return;
      setPlacing(false);
      finalizeOrder(pendingCheckout);
    } catch {
      setPromoError('Payment could not be confirmed. Please try again.');
    } finally {
      setConfirmingStripe(false);
    }
  };

  const steps = ['Delivery', 'Payment', 'Placed'];
  const stepIndex = step === 'delivery' ? 0 : step === 'payment' ? 1 : 2;

  return (
    <main className="min-h-screen bg-[#110C08] text-[#F5EFE4] pt-24 pb-20">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 md:px-6">
        <h1 className="font-display text-4xl md:text-5xl mb-2">
          Secure <span className="italic text-stroke-orange">Checkout</span>
        </h1>
        <p className="text-[#8A7F72] text-sm mb-8">Fast. Safe. Delicious.</p>

        {/* Closed-branch banner */}
        {!branchOpen && step !== 'placed' && (
          <div className="mb-8 p-4 rounded-2xl bg-[#E8542A]/15 border border-[#E8542A]/50 text-sm text-[#F5EFE4]">
            🕒 <span className="font-semibold">{selectedLocation?.name ?? 'This branch'} is currently closed.</span>{' '}
            You can fill in your details and pay as soon as we open{' '}
            {selectedLocation?.availabilityLabel ? `(${selectedLocation.availabilityLabel})` : ''}.
          </div>
        )}

        {/* Step indicator */}
        <div className="flex items-center gap-3 mb-10">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2.5">
              <motion.div
                animate={i <= stepIndex ? { scale: [1, 1.15, 1] } : {}}
                transition={{ duration: 0.3 }}
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-mono transition-all duration-300 ${
                  i < stepIndex
                    ? 'bg-[#3D8B40] text-white shadow-[0_0_20px_rgba(61,139,64,0.4)]'
                    : i === stepIndex
                    ? 'bg-gradient-to-br from-[#FF3800] to-[#E8A020] text-white shadow-[0_0_24px_rgba(255,56,0,0.45)]'
                    : 'bg-white/[0.06] text-[#8A7F72]'
                }`}
              >
                {i < stepIndex ? '✓' : i + 1}
              </motion.div>
              <span className={`text-sm font-medium ${i === stepIndex ? 'text-[#F5EFE4]' : 'text-[#8A7F72]'}`}>
                {s}
              </span>
              {i < steps.length - 1 && (
                <div className="w-10 h-px mx-1">
                  <div className={`h-full rounded-full transition-all duration-500 ${i < stepIndex ? 'bg-[#3D8B40]' : 'bg-white/10'}`} />
                </div>
              )}
            </div>
          ))}
        </div>

        {step === 'placed' ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 20 }}
            className="max-w-lg mx-auto"
          >
            {/* ETA Ring + Success */}
            <div className="relative flex items-center justify-center mb-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 12, delay: 0.1 }}
                className="absolute w-40 h-40 rounded-full"
                style={{
                  background: 'conic-gradient(from 0deg, #FF3800, #F2B33D, #3D8B40, #FF3800)',
                  filter: 'blur(18px)',
                  opacity: 0.35,
                }}
              />
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 14, delay: 0.15 }}
                className="relative w-32 h-32 rounded-full bg-gradient-to-br from-[#FF3800] to-[#E8A020] flex items-center justify-center shadow-[0_0_60px_rgba(255,56,0,0.5)]"
              >
                <motion.div
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', damping: 10, delay: 0.4 }}
                  className="text-white text-5xl"
                >
                  ✓
                </motion.div>
              </motion.div>
              {/* Sparkle particles */}
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                  animate={{
                    opacity: [0, 1, 0],
                    scale: [0, 1, 0.5],
                    x: Math.cos((i / 6) * Math.PI * 2) * 90,
                    y: Math.sin((i / 6) * Math.PI * 2) * 90,
                  }}
                  transition={{ duration: 1.2, delay: 0.5 + i * 0.08 }}
                  className="absolute text-[#F2B33D]"
                >
                  <span className="text-[#F2B33D]">✨</span>
                </motion.div>
              ))}
            </div>

            <div className={`${GLASS_CARD} text-center`}>
              <h2 className="font-display text-3xl mb-2">Order Placed!</h2>
              <p className="text-[#8A7F72] mb-1">
                Order <span className="font-mono text-[#F2B33D]">{orderId}</span> · {fmt(placedTotal)}
              </p>
              {deliveryAddress && (
                <p className="text-sm text-[#8A7F72] mb-1 flex items-center justify-center gap-1.5">
                  📍 {deliveryAddress}
                </p>
              )}
              {deliveryNotes.trim() && (
                <p className="text-sm text-[#8A7F72] mb-4">Note: {deliveryNotes}</p>
              )}
              <p className="text-xs text-[#F2B33D] font-mono uppercase tracking-widest mb-8 flex items-center justify-center gap-2">
                ⏱️
                {deliveryNow
                  ? 'ASAP · 25–35 min'
                  : `Delivering in ≈ ${SCHEDULE_SLOTS.find((s) => s.value === scheduleMinutes)?.label ?? '30 min'}`}
              </p>
              <OrderTracker status={orderStatus} />
              {guestAccessToken && (
                <div className="mt-6 p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-left text-sm">
                  <p className="font-mono text-[11px] uppercase tracking-widest text-[#8A7F72] mb-1">Order tracking</p>
                  <p className="text-[#8A7F72] text-xs">
                    {guestEmailSaved ? `Email: ${guestEmailSaved} · ` : ''}Access token (
                    <span className="text-[#F2B33D] font-mono select-all">{guestAccessToken}</span>
                    ) — keep this to view or cancel your order within 2 minutes.
                  </p>
                </div>
              )}
              <Link
                href="/"
                className="inline-flex items-center gap-2 mt-8 px-6 py-3 rounded-2xl bg-white/[0.06] border border-white/[0.08] text-[#F2B33D] hover:bg-white/[0.1] hover:border-[#F2B33D]/30 transition-all duration-300 text-sm font-mono uppercase tracking-wider"
              >
                ← Back to the Menu
              </Link>
            </div>
          </motion.div>
        ) : (
          <div className="grid lg:grid-cols-5 gap-8">
            {/* Left: form */}
            <div className="lg:col-span-3 space-y-6">
              <AnimatePresence mode="wait">
                {step === 'delivery' && (
                  <motion.div key="delivery" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.25 }} className={GLASS_CARD + ' space-y-5'}>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#FF3800] to-[#E8A020] flex items-center justify-center shadow-[0_0_16px_rgba(255,56,0,0.3)]">
                          📍
                        </div>
                      <div>
                        <h2 className="font-display text-2xl">Delivery Details</h2>
                        <p className="text-xs text-[#8A7F72]">Where should we bring the fire?</p>
                      </div>
                    </div>

                    {!user ? (
                      <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-3">
                        <p className="text-sm text-[#F5EFE4]/70">Sign in to use your saved addresses at checkout.</p>
                        <Button variant="primary" size="sm" onClick={openAuth} magnetic={false}>Sign In / Join</Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
                        <span className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FF3800] to-[#E8A020] flex items-center justify-center font-display text-sm">
                          {user.name[0]?.toUpperCase()}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{user.name}</p>
                          <p className="text-xs text-[#8A7F72]">{user.email}</p>
                        </div>
                        <span className="text-[#3D8B40] text-xs flex items-center gap-1">✓ Signed in</span>
                      </div>
                    )}

                    {!user && (
                      <div>
                        <p className="font-mono text-[11px] uppercase tracking-widest text-[#8A7F72] mb-2">Your Details</p>
                        <div className="space-y-2">
                          <input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Your name" required autoComplete="name" className={INPUT} />
                          <input
                            value={guestEmail}
                            onChange={(e) => { setGuestEmail(e.target.value); setErrors((err) => ({ ...err, name: undefined })); }}
                            placeholder="Email for order confirmation" type="email" required autoComplete="email" aria-invalid={Boolean(errors.name)} className={INPUT}
                          />
                        </div>
                        {errors.name && <ErrorText>{errors.name}</ErrorText>}
                        <p className="mt-2 text-xs text-[#8A7F72]">Create an account later with the same email to see this order in your history.</p>
                      </div>
                    )}

                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-widest text-[#8A7F72] mb-2">Delivery Address</p>
                      <button
                        type="button"
                        onClick={handleDetect}
                        disabled={detectLoading}
                        className="mb-3 w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-[#F2B33D]/40 bg-[#F2B33D]/[0.04] text-xs font-mono uppercase tracking-wider text-[#F2B33D] hover:border-[#F2B33D] hover:bg-[#F2B33D]/10 transition-all duration-300 disabled:opacity-60"
                      >
                        {detectLoading ? <><Loader2 size={14} className="animate-spin" /> Finding you…</> : <>📍 Use my current location</>}
                      </button>
                      {!showManual && addresses.length > 0 && (
                        <>
                          <div className="space-y-2">
                            {addresses.map((a) => (
                              <button
                                key={a.id}
                                type="button"
                                onClick={() => { setSelectedAddress(a.id); setErrors((err) => ({ ...err, address: undefined })); sfx.click(); }}
                                className={`w-full text-left p-4 rounded-2xl border text-sm transition-all duration-300 ${
                                  selectedAddress === a.id
                                    ? 'bg-gradient-to-r from-[#FF3800]/[0.12] to-[#E8A020]/[0.08] border-[#FF3800]/50 shadow-[0_0_20px_rgba(255,56,0,0.15)]'
                                    : 'bg-white/[0.04] border-white/[0.08] hover:border-white/20 hover:bg-white/[0.06]'
                                }`}
                              >
                                <span className="font-medium text-[#F2B33D]">{a.label}</span> — {a.line1}, {a.city} {a.postal}
                              </button>
                            ))}
                          </div>
                          <button type="button" onClick={() => { setSelectedAddress(null); setUseManual(true); sfx.click(); }} className="mt-3 text-xs text-[#F2B33D] hover:text-[#FFC93C] transition-colors">+ Enter a different address</button>
                        </>
                      )}
                      {showManual && (
                        <div className="space-y-2">
                          <input
                            value={guestAddr.street}
                            onChange={(e) => { setGuestAddr({ ...guestAddr, street: e.target.value }); setErrors((err) => ({ ...err, address: undefined })); }}
                            onBlur={() => { if (!guestAddr.street.trim() || !guestAddr.city.trim() || !guestAddr.postal.trim()) setErrors((err) => ({ ...err, address: 'Enter your street, city and postal code.' })); }}
                            placeholder="Street address" required aria-invalid={Boolean(errors.address)} className={INPUT}
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input value={guestAddr.city} onChange={(e) => { setGuestAddr({ ...guestAddr, city: e.target.value }); setErrors((err) => ({ ...err, address: undefined })); }} onBlur={() => { if (!guestAddr.street.trim() || !guestAddr.city.trim() || !guestAddr.postal.trim()) setErrors((err) => ({ ...err, address: 'Enter your street, city and postal code.' })); }} placeholder="City" required aria-invalid={Boolean(errors.address)} className={INPUT} />
                            <input value={guestAddr.postal} onChange={(e) => { setGuestAddr({ ...guestAddr, postal: e.target.value }); setErrors((err) => ({ ...err, address: undefined })); }} onBlur={() => { if (!guestAddr.street.trim() || !guestAddr.city.trim() || !guestAddr.postal.trim()) setErrors((err) => ({ ...err, address: 'Enter your street, city and postal code.' })); }} placeholder="Postal code" required aria-invalid={Boolean(errors.address)} className={INPUT} />
                          </div>
                          {user && addresses.length > 0 && (
                            <button type="button" onClick={() => { setUseManual(false); sfx.click(); }} className="mt-3 text-xs text-[#F2B33D] hover:text-[#FFC93C]">Use a saved address instead</button>
                          )}
                        </div>
                      )}
                      {errors.address && <ErrorText>{errors.address}</ErrorText>}
                    </div>

                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-widest text-[#8A7F72] mb-2">Delivery Speed</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => { setDeliveryNow(true); sfx.click(); }}
                          className={`p-4 rounded-2xl border text-sm text-left transition-all duration-300 ${deliveryNow ? 'bg-gradient-to-br from-[#FF3800]/[0.12] to-[#E8A020]/[0.08] border-[#FF3800]/50 shadow-[0_0_20px_rgba(255,56,0,0.12)]' : 'bg-white/[0.04] border-white/[0.08] hover:border-white/20 hover:bg-white/[0.06]'}`}
                        >
                          <span className="block font-medium text-[#F5EFE4]">🔥 ASAP</span>
                          <span className="text-xs text-[#8A7F72]">25–35 min</span>
                        </button>
                        <button
                          onClick={() => { setDeliveryNow(false); sfx.click(); }}
                          className={`p-4 rounded-2xl border text-sm text-left transition-all duration-300 ${!deliveryNow ? 'bg-gradient-to-br from-[#FF3800]/[0.12] to-[#E8A020]/[0.08] border-[#FF3800]/50 shadow-[0_0_20px_rgba(255,56,0,0.12)]' : 'bg-white/[0.04] border-white/[0.08] hover:border-white/20 hover:bg-white/[0.06]'}`}
                        >
                          <span className="block font-medium text-[#F5EFE4]">📅 Schedule</span>
                          <span className="text-xs text-[#8A7F72]">
                            {deliveryNow ? 'Pick a time' : 'In ≈ ' + (SCHEDULE_SLOTS.find((s) => s.value === scheduleMinutes)?.label ?? '30 min')}
                          </span>
                        </button>
                      </div>
                      {!deliveryNow && (
                        <div className="mt-3">
                          <select value={scheduleMinutes} onChange={(e) => { setScheduleMinutes(e.target.value); sfx.click(); }} aria-label="Scheduled delivery time" className={INPUT}>
                            {SCHEDULE_SLOTS.map((s) => (<option key={s.value} value={s.value}>Deliver in ≈ {s.label}</option>))}
                          </select>
                          <p className="mt-2 text-xs text-[#8A7F72]">We&apos;ll time the fire so it lands around then. No charge.</p>
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div>
                          <input
                            className={INPUT}
                            placeholder="Contact phone" type="tel" value={phone}
                            onChange={(e) => { setPhone(e.target.value); setErrors((err) => ({ ...err, phone: undefined })); }}
                            onBlur={() => { if (phone.trim() && !isValidPhone(phone)) setErrors((err) => ({ ...err, phone: 'Enter a valid phone number.' })); }}
                            required aria-invalid={Boolean(errors.phone)}
                          />
                          {errors.phone && <ErrorText>{errors.phone}</ErrorText>}
                        </div>
                        <input className={INPUT} placeholder="Delivery notes (optional)" value={deliveryNotes} onChange={(e) => setDeliveryNotes(e.target.value)} />
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        if (!deliveryValid) {
                          setErrors({
                            address: addressValid ? undefined : showManual ? 'Enter your street, city and postal code.' : 'Select a delivery address.',
                            phone: isValidPhone(phone) ? undefined : 'Enter a valid phone number.',
                          });
                          return;
                        }
                        setErrors({});
                        setStep('payment');
                        sfx.click();
                      }}
                      disabled={!deliveryValid}
                      className="group relative w-full overflow-hidden rounded-2xl py-4 px-6 font-display text-lg tracking-wide text-white transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-[#FF3800] to-[#E8A020]" />
                      <div className="absolute inset-0 bg-gradient-to-r from-[#E8A020] to-[#FF3800] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      <div className="absolute inset-0 bg-[linear-gradient(105deg,transparent_40%,rgba(255,255,255,0.2)_45%,transparent_50%)] translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
                      <span className="relative flex items-center justify-center gap-2">
                        Continue to Payment <span className="group-hover:translate-x-0.5 transition-transform inline-block">→</span>
                      </span>
                      <div className="absolute inset-0 rounded-2xl shadow-[0_0_30px_rgba(255,56,0,0.35)] group-hover:shadow-[0_0_40px_rgba(255,56,0,0.55)] transition-shadow duration-300" />
                    </button>
                    {items.length === 0 && <p className="text-xs text-[#8A7F72] text-center">Your cart is empty — add items before ordering.</p>}
                  </motion.div>
                )}

                {step === 'payment' && (
                  <motion.div key="payment" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }} className={GLASS_CARD + ' space-y-5'}>
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#FF3800] to-[#E8A020] flex items-center justify-center shadow-[0_0_16px_rgba(255,56,0,0.3)]">
                        💳
                      </div>
                      <div>
                        <h2 className="font-display text-2xl">Payment</h2>
                        <p className="text-xs text-[#8A7F72]">Choose how you&apos;d like to pay</p>
                      </div>
                    </div>

                    {/* Payment method tabs */}
                    <div className="grid grid-cols-4 gap-2">
                      {(['card', 'googlepay', 'applepay', 'cod'] as PayMethod[]).map((m) => {
                        const isWallet = m === 'googlepay' || m === 'applepay';
                        const disabled = isWallet;
                        return (
                          <button
                            key={m}
                            type="button"
                            disabled={disabled}
                            onClick={() => { setPayMethod(m); sfx.click(); }}
                            aria-disabled={disabled}
                            title={isWallet ? 'Google Pay and Apple Pay are coming soon' : undefined}
                            className={`group relative p-4 rounded-2xl border text-center transition-all duration-300 overflow-hidden ${
                              disabled
                                ? 'border-white/[0.06] bg-white/[0.02] opacity-50 cursor-not-allowed'
                                : payMethod === m
                                ? 'border-[#FF3800]/60 bg-gradient-to-br from-[#FF3800]/[0.12] to-[#E8A020]/[0.08] shadow-[0_0_20px_rgba(255,56,0,0.2)]'
                                : 'border-white/[0.08] bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.06]'
                            }`}
                          >
                            {payMethod === m && !disabled && (
                              <motion.div layoutId="paymentGlow" className="absolute inset-0 bg-gradient-to-br from-[#FF3800]/[0.08] to-transparent" transition={{ type: 'spring', damping: 25 }} />
                            )}
                            <span className={`relative flex flex-col items-center gap-1.5 ${payMethod === m && !disabled ? 'text-[#F5EFE4]' : 'text-[#8A7F72] group-hover:text-[#F5EFE4]/80'} transition-colors`}>
                              {PAY_ICONS[m]}
                              <span className="text-[10px] font-mono uppercase tracking-wider">
                                {PAY_LABELS[m]}
                                {isWallet && <span className="block text-[8px] normal-case tracking-normal text-[#E8A020]">soon</span>}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {payMethod === 'card' && stripeMode && !payClientSecret && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-sm text-[#8A7F72] flex items-start gap-3">
                        <span className="text-[#F2B33D] mt-0.5 shrink-0 text-lg">🛡️</span>
                        <p>Your card is processed securely by Stripe. Tap “Continue to secure payment” and we&apos;ll open the secure payment form.</p>
                      </motion.div>
                    )}

                    {payMethod === 'card' && stripeMode && payClientSecret && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: 0.25 }} className="space-y-3">
                        <StripeCardFields ref={stripeCardRef} stripePromise={stripePromise} clientSecret={payClientSecret}>
                          <p className="text-xs text-[#8A7F72]">Test mode: use card 4242 4242 4242 4242, any future expiry, and any CVC.</p>
                        </StripeCardFields>
                      </motion.div>
                    )}

                    {payMethod === 'card' && !stripeMode && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: 0.25 }} className="space-y-3">
                        <div>
                          <div className="relative">
                            <input
                              className={INPUT + ' pr-20 font-mono'}
                              placeholder="1234 5678 9012 3456"
                              value={card.number}
                              onChange={(e) => { setCard({ ...card, number: formatNumber(e.target.value) }); setErrors((err) => ({ ...err, number: undefined })); }}
                              onBlur={() => { if (card.number.trim() && !/^\d{14,16}$/.test(digits)) setErrors((err) => ({ ...err, number: 'Enter a valid card number.' })); }}
                              inputMode="numeric" autoComplete="cc-number" aria-invalid={Boolean(errors.number)}
                            />
                            {card.number && (
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-lg bg-white/[0.06] text-[10px] font-bold text-[#F2B33D]">{cardType}</span>
                            )}
                          </div>
                          {errors.number && <ErrorText>{errors.number}</ErrorText>}
                        </div>
                        <input
                          className={INPUT}
                          placeholder="Name on card"
                          value={card.name}
                          onChange={(e) => { setCard({ ...card, name: e.target.value }); setErrors((err) => ({ ...err, name: undefined })); }}
                          onBlur={() => { if (card.name.trim() && card.name.trim().length < 2) setErrors((err) => ({ ...err, name: 'Enter the name on the card.' })); }}
                          autoComplete="cc-name" aria-invalid={Boolean(errors.name)}
                        />
                        {errors.name && <ErrorText>{errors.name}</ErrorText>}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <input
                              className={INPUT + ' font-mono'}
                              placeholder="MM/YY"
                              value={card.expiry}
                              onChange={(e) => { setCard({ ...card, expiry: formatExpiry(e.target.value) }); setErrors((err) => ({ ...err, expiry: undefined })); }}
                              onBlur={() => { if (card.expiry.trim() && !isValidExpiry(card.expiry)) setErrors((err) => ({ ...err, expiry: 'Use a valid MM/YY date.' })); }}
                              inputMode="numeric" autoComplete="cc-exp" aria-invalid={Boolean(errors.expiry)}
                            />
                            {errors.expiry && <ErrorText>{errors.expiry}</ErrorText>}
                          </div>
                          <div>
                            <input
                              className={INPUT + ' font-mono'}
                              placeholder="CVV"
                              value={card.cvv}
                              onChange={(e) => { setCard({ ...card, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) }); setErrors((err) => ({ ...err, cvv: undefined })); }}
                              onBlur={() => { if (card.cvv.trim() && !/^\d{3,4}$/.test(card.cvv)) setErrors((err) => ({ ...err, cvv: 'Enter a valid CVV.' })); }}
                              inputMode="numeric" autoComplete="cc-csc" aria-invalid={Boolean(errors.cvv)}
                            />
                            {errors.cvv && <ErrorText>{errors.cvv}</ErrorText>}
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {payMethod === 'cod' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-sm text-[#8A7F72] flex items-start gap-3">
                        <span className="text-[#F2B33D] mt-0.5 shrink-0 text-lg">💵</span>
                        <p>Pay in cash when your order arrives. Have exact change ready if possible.</p>
                      </motion.div>
                    )}

                    <div className="space-y-3 pt-2">
                      {/* Glossy CTA */}
                      <button
                        onClick={stripeMode && payClientSecret ? confirmStripePayment : placeOrder}
                        disabled={!payReady || placing || Boolean(stripeMode && payClientSecret && confirmingStripe)}
                        className="group relative w-full overflow-hidden rounded-2xl py-4 px-6 font-display text-lg tracking-wide text-white transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-[#FF3800] to-[#E8A020]" />
                        <div className="absolute inset-0 bg-gradient-to-r from-[#E8A020] to-[#FF3800] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <div className="absolute inset-0 bg-[linear-gradient(105deg,transparent_40%,rgba(255,255,255,0.2)_45%,transparent_50%)] translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
                        <span className="relative flex items-center justify-center gap-2">
                          {stripeMode && payClientSecret ? (
                            confirmingStripe ? (
                              <><Loader2 size={18} className="animate-spin" /> Confirming…</>
                            ) : (
                              <><span className="text-sm">🛡️</span> Confirm {fmt(total)} & Place Order</>
                            )
                          ) : placing ? (
                            <><Loader2 size={18} className="animate-spin" /> Placing…</>
                          ) : (
                            <><span className="text-sm">🛡️</span> {stripeMode ? 'Continue to Secure Payment' : `Pay ${fmt(total)} & Place Order`}</>
                          )}
                        </span>
                        <div className="absolute inset-0 rounded-2xl shadow-[0_0_30px_rgba(255,56,0,0.35)] group-hover:shadow-[0_0_40px_rgba(255,56,0,0.55)] transition-shadow duration-300" />
                      </button>
                      <button
                        onClick={() => { setStep('delivery'); sfx.click(); }}
                        className="w-full py-3 rounded-2xl border border-white/[0.12] bg-white/[0.03] text-sm text-[#8A7F72] hover:bg-white/[0.06] hover:text-[#F5EFE4] transition-all duration-300"
                      >
                        <span className="flex items-center justify-center gap-2">← Back to Delivery</span>
                      </button>
                    </div>
                    {items.length === 0 && <p className="text-xs text-[#8A7F72] text-center">Your cart is empty — add items before paying.</p>}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Right: order summary */}
            <div className="lg:col-span-2">
              <div className={GLASS_CARD + ' sticky top-24'}>
                <h3 className="font-display text-xl mb-4">Order Summary</h3>
                {items.length === 0 ? (
                  <p className="text-sm text-[#8A7F72]">Your cart is empty.</p>
                ) : (
                  <div className="space-y-3 max-h-72 overflow-y-auto mb-4 pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    {items.map((item) => (
                      <div key={item.id} className="flex items-center gap-3">
                        {item.image ? (
                          <Image src={item.image} alt={item.name} width={48} height={48} className="w-12 h-12 rounded-xl object-cover ring-1 ring-white/[0.08]" />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-white/[0.04] ring-1 ring-white/[0.08] flex items-center justify-center text-lg">📷</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{item.name}</p>
                          <p className="text-xs text-[#8A7F72]">Qty {item.quantity}</p>
                        </div>
                        <span className="font-mono text-sm text-[#F2B33D]">{fmt(item.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="space-y-2 pt-4 border-t border-white/[0.08] text-sm">
                  <div className="mb-3 pb-3 border-b border-white/[0.08]">
                    <p className="font-mono text-[11px] uppercase tracking-widest text-[#8A7F72] mb-2">Promo code</p>
                    <div className="flex gap-2">
                      <input
                        value={promoInput}
                        onChange={(e) => { setPromoInput(e.target.value); setPromoError(null); }}
                        placeholder="e.g. WELCOME15"
                        disabled={Boolean(appliedPromo)}
                        className={INPUT + ' uppercase text-xs py-2.5'}
                      />
                      <button
                        disabled={promoBusy || !promoInput.trim() || Boolean(appliedPromo)}
                        onClick={applyPromo}
                        className="shrink-0 px-4 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.1] text-xs font-mono uppercase tracking-wider text-[#F5EFE4] hover:bg-white/[0.1] disabled:opacity-40 transition-all"
                      >
                        {promoBusy ? '…' : appliedPromo ? '✓' : 'Apply'}
                      </button>
                    </div>
                    {appliedPromo && <p className="mt-1.5 text-xs text-[#3D8B40]">{appliedPromo.code} applied — {fmt(appliedPromo.discountUsd)} off</p>}
                    {promoError && !appliedPromo && <p className="mt-1.5 text-xs text-[#E8542A]">{promoError}</p>}
                  </div>
                  <div className="flex justify-between"><span className="text-[#8A7F72]">Subtotal</span><span className="font-mono">{fmt(subtotal)}</span></div>
                  {deliveryFee > 0 && <div className="flex justify-between"><span className="text-[#8A7F72]">Delivery fee</span><span className="font-mono">{fmt(deliveryFee)}</span></div>}
                  <div className="flex justify-between"><span className="text-[#8A7F72]">Tax</span><span className="font-mono">{fmt(tax)}</span></div>
                  {discount > 0 && <div className="flex justify-between text-[#3D8B40]"><span>Promo discount</span><span className="font-mono">−{fmt(discount)}</span></div>}
                  <div className="flex justify-between text-lg pt-2 border-t border-white/[0.08]"><span>Total</span><span className="font-mono text-[#F2B33D]">{fmt(total)}</span></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <CartDrawer />
    </main>
  );
}

function OrderTracker({ status }: { status: string }) {
  const stages = [
    { id: 'confirmed', label: 'Confirmed', icon: '✓' },
    { id: 'preparing', label: 'Preparing', icon: '🍳' },
    { id: 'out-for-delivery', label: 'On the way', icon: '🛵' },
    { id: 'delivered', label: 'Delivered', icon: '🍔' },
  ];
  const currentIndex = stages.findIndex((s) => s.id === status);

  return (
    <div className="w-full">
      <div className="flex justify-between mb-4">
        {stages.map((s, i) => (
          <div key={s.id} className="flex-1 text-center">
            <motion.div
              animate={i <= currentIndex ? { scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className={`mx-auto w-10 h-10 rounded-full flex items-center justify-center text-sm mb-1.5 transition-all duration-500 ${
                i < currentIndex
                  ? 'bg-[#3D8B40] text-white shadow-[0_0_16px_rgba(61,139,64,0.4)]'
                  : i === currentIndex
                  ? 'bg-gradient-to-br from-[#FF3800] to-[#E8A020] text-white shadow-[0_0_20px_rgba(255,56,0,0.4)]'
                  : 'bg-white/[0.06] text-[#8A7F72]'
              }`}
            >
              {i < currentIndex ? '✓' : s.icon}
            </motion.div>
            <span className={`text-[10px] font-mono uppercase tracking-wider ${i <= currentIndex ? 'text-[#F5EFE4]' : 'text-[#8A7F72]'}`}>
              {s.label}
            </span>
          </div>
        ))}
      </div>
      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${((currentIndex + 1) / stages.length) * 100}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full bg-gradient-to-r from-[#FF3800] to-[#F2B33D] rounded-full"
        />
      </div>
      <p className="mt-4 text-sm text-[#8A7F72]">
        {status === 'confirmed' && '🔥 Order confirmed! The kitchen is firing up.'}
        {status === 'preparing' && '🍳 Your food is being prepared with extreme care.'}
        {status === 'out-for-delivery' && '🛵 Your rider is on the way — keep an eye out!'}
        {status === 'delivered' && '🍔 Delivered! Enjoy every bite. Thanks for blazing with us.'}
      </p>
    </div>
  );
}

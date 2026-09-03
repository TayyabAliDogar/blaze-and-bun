// Pure money math — safe to import from both client and server bundles.
// All amounts stay USD-denominated; currency conversion only at the display
// boundary (see src/lib/currency.ts). No store/react coupling here.

export type CurrencyCode = "USD" | "GBP";

/** Fixed demo FX rate: GBP pounds per USD dollar. */
export const FX_RATE = 0.79;
/** Flat demo tax rate applied to the subtotal in its display currency. */
export const TAX_RATE = 0.08;

/**
 * Delivery fee policy is denominated in the branch's own currency
 * (free delivery over $50 USD / £50 GBP). Policy numbers are stored in USD
 * equivalents so a single currency path holds.
 */
export const DELIVERY_POLICY: Record<CurrencyCode, { threshold: number; fee: number }> = {
  USD: { threshold: 50, fee: 4.99 },
  GBP: { threshold: 50 / FX_RATE, fee: 4.99 / FX_RATE },
};

export interface MoneyTotals {
  subtotal: number;
  deliveryFee: number;
  tax: number;
  total: number;
  threshold: number;
}

/** Round to 2 decimals, JS-safe (fixed-point friendly math). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Authoritative totals engine used by the server and mirrored by the client
 * estimate. `discountUsd` reduces the final total (tax still applies to the
 * pre-discount subtotal so the promo never inflates the tax line).
 */
export function computeTotalsCore(
  subtotalUsd: number,
  currency: CurrencyCode,
  discountUsd = 0
): MoneyTotals {
  const code = currency === "GBP" ? "GBP" : "USD";
  const policy = DELIVERY_POLICY[code];
  const flat = Math.max(subtotalUsd, 0);
  const deliveryFee = flat > 0 && flat <= policy.threshold ? policy.fee : 0;
  const discount = Math.min(Math.max(discountUsd, 0), flat);
  const tax = round2(flat * TAX_RATE);
  const total = round2(flat + deliveryFee + tax - discount);
  return {
    subtotal: round2(flat),
    deliveryFee,
    tax,
    total,
    threshold: policy.threshold,
  };
}
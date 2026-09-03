'use client';
import { useLocationStore } from '@/store';
import { FX_RATE, computeTotalsCore } from '@/lib/money';

export type CurrencyCode = 'USD' | 'GBP';

interface CurrencyContext {
  currency?: string;
}

/** Convert a USD-denominated amount into the given currency's display amount. */
export function convertAmount(amountUsd: number, currency: CurrencyCode): number {
  return currency === 'GBP' ? amountUsd * FX_RATE : amountUsd;
}

/** Reverse of `convertAmount` — maps a display-currency amount back to USD. */
export function convertToUsd(amount: number, currency: CurrencyCode): number {
  return currency === 'GBP' ? amount / FX_RATE : amount;
}

export function resolve(ctx?: CurrencyContext | null) {
  const currency: CurrencyCode = ctx?.currency === 'GBP' ? 'GBP' : 'USD';
  const locale = currency === 'GBP' ? 'en-GB' : 'en-US';
  return { currency, locale, symbol: currency === 'GBP' ? '£' : '$' };
}

/**
 * All numeric state (menu prices, cart items, totals) stays denominated in USD.
 * Currency conversion happens ONLY at the formatting boundary, so pricing never
 * double-converts no matter where it is routed.
 */
export function formatPrice(amount: number, ctx?: CurrencyContext | null): string {
  const { currency, locale } = resolve(ctx);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(convertAmount(amount, currency));
}

/** Signed delta e.g. "+£1.50" / "−£2.00". Returns '' for zero. */
export function formatPriceDelta(amount: number, ctx?: CurrencyContext | null): string {
  if (amount === 0) return '';
  const sign = amount > 0 ? '+' : '−';
  return `${sign}${formatPrice(Math.abs(amount), ctx)}`;
}

export interface OrderTotals {
  subtotal: number;
  deliveryFee: number;
  tax: number;
  total: number;
  threshold: number;
}

/**
 * Delivery fee policy lives in src/lib/money.ts (server + client share it).
 * Display amounts stay USD; `fmt()` performs the one-time conversion.
 */
export function computeTotals(
  subtotalUsd: number,
  ctx?: CurrencyContext | null
): OrderTotals {
  const { currency } = resolve(ctx);
  return computeTotalsCore(subtotalUsd, currency);
}

/** React hook: formatting helpers tied to the currently selected branch. */
export function usePrice() {
  const location = useLocationStore((s) => s.selectedLocation);
  const { currency, symbol } = resolve(location);
  return {
    currency,
    symbol,
    fmt: (amount: number) => formatPrice(amount, location),
    delta: (amount: number) => formatPriceDelta(amount, location),
  };
}
import Stripe from "stripe";

/**
 * Lazy Stripe client. Null/absent when the gateway isn't configured, so the
 * app runs in demo mode (stub payments) without breaking.
 */
const secretKey = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";

let stripe: Stripe | null = null;

function createClient(): Stripe | null {
  if (!secretKey) return null;
  try {
    return new Stripe(secretKey, { apiVersion: "2026-08-26.dahlia" });
  } catch {
    return null;
  }
}

/** Lazily-initialized singleton. Returns null when Stripe isn't configured. */
export function getStripe(): Stripe | null {
  if (stripe === null && secretKey) stripe = createClient();
  return stripe;
}

/**
 * True when the real Stripe gateway is wired up (non-placeholder keys and a
 * webhook secret are both present). Everything else runs the demo stub path.
 */
export function isStripeConfigured(): boolean {
  return Boolean(secretKey) && Boolean(webhookSecret) && !secretKey.startsWith("sk_test_placeholder");
}

export function getWebhookSecret(): string {
  return webhookSecret;
}

export function getStripePublishableKey(): string {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? "";
}

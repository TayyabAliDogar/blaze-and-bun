'use client';
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import type { Stripe } from '@stripe/stripe-js';
import {
  forwardRef,
  useImperativeHandle,
  type ReactNode,
} from 'react';

export interface StripeCardHandle {
  /** Returns the raw Stripe + Elements handles (for confirmPayment). */
  ready: () => { stripe: Stripe | null; elements: ReturnType<typeof useElements> } | null;
}

/**
 * Renders the Stripe Payment Element inside a styled container, exposing the
 * Stripe + Elements handles through a ref so the parent checkout flow can run
 * `stripe.confirmPayment` with the server-issued clientSecret.
 */
export const StripeCardFields = forwardRef<
  StripeCardHandle,
  {
    stripePromise: Promise<Stripe | null>;
    clientSecret: string;
    children: ReactNode;
  }
>(function StripeCardFields({ stripePromise, clientSecret, children }, ref) {
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <StripeCardFieldsInner ref={ref}>{children}</StripeCardFieldsInner>
    </Elements>
  );
});

const StripeCardFieldsInner = forwardRef<
  StripeCardHandle,
  { children: ReactNode }
>(function StripeCardFieldsInner({ children }, ref) {
  const stripe = useStripe();
  const elements = useElements();
  useImperativeHandle(
    ref,
    () => ({
      ready: () => (stripe && elements ? { stripe, elements } : null),
    }),
    [stripe, elements]
  );
  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-black/30 backdrop-blur-md border border-white/[0.08] p-4">
        <PaymentElement options={{ layout: 'tabs' }} />
      </div>
      {children}
    </div>
  );
});

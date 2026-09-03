'use client';
import { useEffect, useState } from 'react';
import { loadStripe, type Stripe } from '@stripe/stripe-js';

interface StripeConfig {
  configured: boolean;
  publishableKey: string;
}

let stripePromise: Promise<Stripe | null> | null = null;

/**
 * Client-side Stripe config hook. Fetches whether the real gateway is wired up
 * (and its publishable key) once, then lazily loads Stripe.js only when needed.
 */
export function useStripeConfig() {
  const [config, setConfig] = useState<StripeConfig>({ configured: false, publishableKey: '' });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/stripe/config');
        const data = await res.json();
        if (active) {
          setConfig({
            configured: Boolean(data?.configured) && Boolean(data?.publishableKey),
            publishableKey: data?.publishableKey ?? '',
          });
        }
      } catch {
        // keep demo mode defaults
        if (active) setConfig({ configured: false, publishableKey: '' });
      } finally {
        if (active) setLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const getStripe = () => {
    if (!config.publishableKey) return Promise.resolve(null);
    if (!stripePromise) {
      stripePromise = loadStripe(config.publishableKey);
    }
    return stripePromise;
  };

  return { config, loaded, getStripe };
}

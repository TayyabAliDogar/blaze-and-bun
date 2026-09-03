'use client';
import { type ReactNode, useEffect } from 'react';
import { MotionConfig, AnimatePresence, motion } from 'framer-motion';
import { useToastStore } from '@/store/toast';
import { useAuthStore } from '@/store';

const GOOGLE_AUTH_ERRORS: Record<string, string> = {
  google_not_configured:
    'Google sign-in is not set up yet — add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your .env.local and restart the dev server.',
  token_exchange_failed:
    'Google sign-in failed during token exchange. Please try again or use email/password.',
  profile_fetch_failed:
    'Could not retrieve your Google profile. Please try again.',
  no_code:
    'Google sign-in was cancelled or returned an unexpected response.',
  account_disabled:
    'This account has been disabled. Please contact support.',
  google_unavailable:
    'Google sign-in is temporarily unavailable. Please try again or use email/password.',
  internal:
    'Something went wrong with Google sign-in. Please try again or use email/sign-in.',
};

export default function Providers({ children }: { children: ReactNode }) {
  const toasts = useToastStore((s) => s.toasts);
  const dismissToast = useToastStore((s) => s.dismiss);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Read the one-time OAuth/auth error from the URL into a toast. This runs
    // only on the client (post-hydration), so the server and first client
    // render stay identical and no hydration mismatch occurs.
    const params = new URLSearchParams(window.location.search);
    let code: string | null = null;
    if (params.has('auth_error')) {
      code = params.get('auth_error');
    } else if (params.get('auth') === 'google_error') {
      code = params.get('google_error');
    } else if (params.get('auth') === 'google_unavailable') {
      code = 'google_unavailable';
    }
    if (code) {
      useToastStore.getState().show(
        GOOGLE_AUTH_ERRORS[code] ?? `Google sign-in issue: ${code}`,
        'error'
      );
    }

    // Clean the query params so nothing reappears on refresh.
    const url = new URL(window.location.href);
    const hadAuthError =
      url.searchParams.has('auth_error') ||
      url.searchParams.get('auth') === 'google_error' ||
      url.searchParams.get('auth') === 'google_unavailable';
    if (hadAuthError) {
      url.searchParams.delete('auth_error');
      url.searchParams.delete('auth');
      url.searchParams.delete('google_error');
      window.history.replaceState({}, '', url.toString());
    }

    const auth = url.searchParams.get('auth');
    if (auth === 'required') {
      // Route guard fired: prompt the user to sign in so they can continue.
      url.searchParams.delete('auth');
      window.history.replaceState({}, '', url.toString());
      useToastStore.getState().show('Please sign in to continue.', 'default');
      useAuthStore.getState().openAuth();
    } else if (auth === 'forbidden') {
      url.searchParams.delete('auth');
      window.history.replaceState({}, '', url.toString());
      useToastStore.getState().show('You don’t have access to that page.', 'error');
    }
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      {children}

      {/* Global transient toasts (geolocation errors, hints, etc.) */}
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] max-w-md w-[calc(100%-2rem)] px-5 py-4 rounded-2xl bg-[#2A1F14] border shadow-[0_8px_30px_rgba(0,0,0,0.5)] ${
              t.tone === 'error'
                ? 'border-[#E8542A]/40'
                : t.tone === 'success'
                ? 'border-[#66B84B]/40'
                : 'border-white/10'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className={`text-sm leading-relaxed ${t.tone === 'error' ? 'text-[#FF8A63]' : 'text-[#F5EFE4]'}`}>
                {t.message}
              </p>
              <button
                onClick={() => dismissToast(t.id)}
                className="shrink-0 text-[#8A7F72] hover:text-[#F5EFE4] text-xs"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </MotionConfig>
  );
}

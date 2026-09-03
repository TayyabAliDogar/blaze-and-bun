'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store';

const GOOGLE_AUTH_ERROR_MESSAGES: Record<string, string> = {
  google_not_configured:
    "Google sign-in isn't set up yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your .env.local and restart the dev server, or sign in with email/password.",
  token_exchange_failed:
    'Google sign-in failed. Please try again or use email/password.',
  profile_fetch_failed:
    "Couldn't load your Google profile. Please try again or use email/password.",
  no_code:
    'Google sign-in was cancelled or returned an unexpected response.',
  account_disabled:
    'This account has been disabled. Please contact support.',
  google_unavailable:
    'Google sign-in is temporarily unavailable. Please use email/password.',
  internal:
    'Something went wrong with Google sign-in. Please try again or use email/password.',
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/';
  const authError = searchParams.get('error');
  const googleError = searchParams.get('auth_error');
  const signIn = useAuthStore((s) => s.signIn);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  // Surface a route-guard notice or Google OAuth error inline during render
  // (no effect) so no state is synchronously set inside an effect body.
  const [error, setError] = useState<string | null>(() => {
    if (googleError) return GOOGLE_AUTH_ERROR_MESSAGES[googleError] ?? `Google sign-in issue: ${googleError}`;
    if (authError === 'forbidden') return "You don't have permission to access that page.";
    return null;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const err = await signIn({ email: email.trim(), password });
      if (err) {
        setError(err);
        return;
      }

      const { user } = useAuthStore.getState();
      const role = user?.role;

      if ((role === 'admin' || role === 'staff') && next.startsWith('/admin')) {
        router.push(next);
      } else if (role === 'admin' || role === 'staff') {
        router.push('/admin');
      } else {
        router.push(next === '/login' ? '/' : next);
      }
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#1C120C] text-[#F5EFE4] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Link href="/" className="font-display text-3xl">
            Blaze<span className="text-[#E8542A]">&amp;</span>Bun
          </Link>
          <p className="text-[#8A7F72] text-sm mt-2">Sign in to your account</p>
        </div>

        <div className="rounded-3xl p-8 bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-[#E8542A]/10 border border-[#E8542A]/30 text-sm text-[#FF8A63]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-[#8A7F72] mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="w-full px-4 py-3 rounded-xl bg-black/30 backdrop-blur-md border border-white/[0.08] text-sm text-[#F5EFE4] placeholder:text-white/30 focus:outline-none focus:border-[#FF3800]/60 focus:ring-2 focus:ring-[#FF3800]/20 transition-all duration-300"
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-[#8A7F72] mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null); }}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-xl bg-black/30 backdrop-blur-md border border-white/[0.08] text-sm text-[#F5EFE4] placeholder:text-white/30 focus:outline-none focus:border-[#FF3800]/60 focus:ring-2 focus:ring-[#FF3800]/20 transition-all duration-300"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email.trim() || !password}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#FF3800] to-[#E8A020] text-white font-display text-lg tracking-wide disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-[0_0_30px_rgba(255,56,0,0.4)] transition-all duration-300"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <Link
              href="/reset-password"
              className="text-xs text-[#8A7F72] hover:text-[#F2B33D] transition-colors"
            >
              Forgot your password?
            </Link>
          </div>

          <div className="mt-6 text-center text-sm text-[#8A7F72]">
            Don&apos;t have an account?{' '}
            <Link href="/?auth=signup" className="text-[#F2B33D] hover:text-[#FFC93C] transition-colors">
              Sign up
            </Link>
          </div>
        </div>

        <p className="text-center mt-6 text-xs text-[#8A7F72]">
          Admin? Sign in with your admin credentials to access the operations panel.
        </p>
      </motion.div>
    </main>
  );
}

export default function LoginPage() {
  // useSearchParams() must be inside a Suspense boundary so the page can be
  // statically prerendered (CSR bailout) without an error during `next build`.
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#1C120C] flex items-center justify-center">
          <p className="text-[#8A7F72]">Loading…</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

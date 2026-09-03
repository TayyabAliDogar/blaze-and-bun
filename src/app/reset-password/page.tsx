'use client';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';

function ResetPage() {
  const params = useSearchParams();
  const token = params.get('token') || '';
  const email = params.get('email') || '';

  const [mode] = useState<'request' | 'set'>(token ? 'set' : 'request');

  const [emailInput, setEmailInput] = useState(email);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [done, setDone] = useState(false);

  const inputCls =
    'w-full px-4 py-3 rounded-xl bg-black/30 backdrop-blur-md border border-white/[0.08] text-sm text-[#F5EFE4] placeholder:text-white/30 focus:outline-none focus:border-[#FF3800]/60 focus:ring-2 focus:ring-[#FF3800]/20 transition-all duration-300';

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: emailInput.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? 'Something went wrong. Please try again.');
        return;
      }
      setSent(true);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? 'This reset link is invalid or has expired.');
        return;
      }
      setDone(true);
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
          <p className="text-[#8A7F72] text-sm mt-2">
            {mode === 'set' ? 'Choose a new password' : 'Reset your password'}
          </p>
        </div>

        <div className="rounded-3xl p-8 bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-[#E8542A]/10 border border-[#E8542A]/30 text-sm text-[#FF8A63]">
              {error}
            </div>
          )}

          {done && (
            <div className="text-center">
              <p className="text-lg font-display mb-2">Password updated</p>
              <p className="text-sm text-[#8A7F72] mb-6">
                Your password has been changed and you&rsquo;ve been signed out everywhere. Sign in with your new password.
              </p>
              <Link
                href="/login"
                className="inline-block w-full py-3.5 rounded-xl bg-gradient-to-r from-[#FF3800] to-[#E8A020] text-white font-display text-lg tracking-wide text-center transition-all duration-300"
              >
                Sign in
              </Link>
            </div>
          )}

          {sent && !done && (
            <div className="text-center">
              <p className="text-lg font-display mb-2">Check your inbox</p>
              <p className="text-sm text-[#8A7F72]">
                If an account exists for that address, we&rsquo;ve sent a reset link that expires in 30 minutes.
              </p>
              <Link href="/login" className="inline-block mt-6 text-sm text-[#F2B33D] hover:text-[#FFC93C] transition-colors">
                Back to sign in
              </Link>
            </div>
          )}

          {mode === 'request' && !sent && (
            <form onSubmit={handleRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-widest text-[#8A7F72] mb-1.5">Email</label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => { setEmailInput(e.target.value); setError(null); }}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  className={inputCls}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !emailInput.trim()}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#FF3800] to-[#E8A020] text-white font-display text-lg tracking-wide disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-[0_0_30px_rgba(255,56,0,0.4)] transition-all duration-300"
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
              <div className="mt-4 text-center text-sm text-[#8A7F72]">
                Remembered it?{' '}
                <Link href="/login" className="text-[#F2B33D] hover:text-[#FFC93C] transition-colors">Sign in</Link>
              </div>
            </form>
          )}

          {mode === 'set' && !done && (
            <form onSubmit={handleSet} className="space-y-4">
              {email && (
                <p className="text-xs text-[#8A7F72]">Resetting password for <span className="text-[#F5EFE4]">{email}</span></p>
              )}
              <div>
                <label className="block text-xs font-mono uppercase tracking-widest text-[#8A7F72] mb-1.5">New password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null); }}
                  placeholder="8+ characters, letters & numbers"
                  required
                  autoComplete="new-password"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-mono uppercase tracking-widest text-[#8A7F72] mb-1.5">Confirm password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); setError(null); }}
                  placeholder="Re-enter new password"
                  required
                  autoComplete="new-password"
                  className={inputCls}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !password || !confirm}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#FF3800] to-[#E8A020] text-white font-display text-lg tracking-wide disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-[0_0_30px_rgba(255,56,0,0.4)] transition-all duration-300"
              >
                {loading ? 'Saving…' : 'Update password'}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#1C120C] flex items-center justify-center">
          <p className="text-[#8A7F72]">Loading…</p>
        </main>
      }
    >
      <ResetPage />
    </Suspense>
  );
}

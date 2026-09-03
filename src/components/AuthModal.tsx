'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from '@/store';
import { useModalDialog } from '@/lib/useModalDialog';
import { sfx } from '@/lib/sounds';

const inputCls =
  'w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-[#F5EFE4] placeholder:text-white/30 focus:outline-none focus:border-[#E8542A]';

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#8A7F72] mb-1.5 block">
      {children}
    </label>
  );
}

export default function AuthModal() {
  const { isOpen, closeAuth, signIn, signUp, signOut, user, addresses, addAddress, removeAddress, error, clearError } = useAuthStore();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showAddress, setShowAddress] = useState(false);
  const [addr, setAddr] = useState({ label: '', line1: '', city: '', postal: '' });
  const panelRef = useModalDialog(isOpen, closeAuth);

  // Reset transient form state every time the modal closes so a guest who
  // closes mid-way isn't served a stale name/email/password or stale error, and
  // the modal reopens fresh. Local form state is reset via React's sanctioned
  // render-phase "adjustment" pattern (updating our own useState during render is
  // allowed). The external store mutation (clearError) is deferred to an effect so
  // we never call a store set() while rendering — that's what caused the
  // "Cannot update a component while rendering a different component" warning.
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const justClosed = prevIsOpen && !isOpen;
  if (prevIsOpen !== isOpen) {
    setPrevIsOpen(isOpen);
    if (justClosed) {
      setName('');
      setEmail('');
      setPassword('');
      setShowAddress(false);
      setSubmitting(false);
      setAddr({ label: '', line1: '', city: '', postal: '' });
    }
  }

  useEffect(() => {
    if (!justClosed) return;
    clearError();
  }, [justClosed, clearError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      if (mode === 'signup') {
        await signUp({ name, email, password });
      } else {
        await signIn({ email, password });
      }
      sfx.success();
    } finally {
      setSubmitting(false);
    }
  };

  const tabs: { id: 'signin' | 'signup'; label: string }[] = [
    { id: 'signin', label: 'Sign In' },
    { id: 'signup', label: 'Join' },
  ];

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeAuth}
          className="fixed inset-0 z-[95] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-title"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#1C120C] border border-white/10 rounded-3xl shadow-[var(--elev-3)] overflow-y-auto max-h-[90vh]"
          >
            <div className="p-6 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#1C120C] z-10">
              <h2 id="auth-title" className="font-display text-2xl text-[#F5EFE4]">
                {user ? 'Your Account' : 'Welcome to the Blaze'}
              </h2>
              <button
                onClick={closeAuth}
                className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#F5EFE4]"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              {user ? (
                <div className="space-y-5">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-[#E8542A] flex items-center justify-center font-display text-2xl text-[#F5EFE4]">
                      {user.name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-display text-xl text-[#F5EFE4]">{user.name}</p>
                      <p className="text-sm text-[#8A7F72]">{user.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => signOut()}
                    className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-[#F5EFE4] hover:bg-white/15 active:bg-white/20 transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 mb-6 p-1 rounded-full bg-white/5">
                    {tabs.map((t) => {
                      const active = mode === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => {
                            setMode(t.id);
                            clearError();
                            sfx.click();
                          }}
                          className={`relative py-2.5 rounded-full text-sm font-mono uppercase tracking-wider transition-colors duration-200 ${
                            active ? 'text-[#F5EFE4]' : 'text-[#8A7F72] hover:text-[#F5EFE4]'
                          }`}
                        >
                          {active && (
                            <motion.span
                              layoutId="auth-tab"
                              className="absolute inset-0 rounded-full bg-[#E8542A] shadow-[0_6px_14px_-6px_rgba(232,84,42,0.6)]"
                              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                            />
                          )}
                          <span className="relative z-10">{t.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {mode === 'signup' && (
                      <div>
                        <FieldLabel>Name</FieldLabel>
                        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Rivera" required />
                      </div>
                    )}
                    <div>
                      <FieldLabel>Email</FieldLabel>
                      <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" required />
                    </div>
                    <div>
                      <FieldLabel>Password</FieldLabel>
                      <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
                    </div>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-3.5 rounded-full bg-[#E8542A] hover:bg-[#FF6A3D] text-[#F5EFE4] font-mono text-sm uppercase tracking-wider transition-colors disabled:opacity-60"
                    >
                      {submitting ? 'One sec…' : mode === 'signup' ? 'Create Account' : 'Sign In'} →
                    </button>

                    {error && (
                      <p className="mt-3 text-center text-sm text-[#FF6A3D]">{error}</p>
                    )}

                    {mode === 'signin' && (
                      <Link
                        href="/reset-password"
                        className="block text-center mt-3 text-xs text-[#8A7F72] hover:text-[#F2B33D] transition-colors"
                      >
                        Forgot your password?
                      </Link>
                    )}
                  </form>

                  <div className="p-5 rounded-xl bg-white/5 border border-white/10 mt-5">
                    <a
                      href="/api/auth/google"
                      className="w-full flex items-center justify-center gap-3 py-3 rounded-xl bg-white/5 border border-white/10 text-[#F5EFE4] font-medium text-sm hover:bg-white/10 active:bg-white/15 transition-colors inner-catchlight"
                    >
                      <span className="font-bold">G</span> Continue with Google
                    </a>
                    <p className="mt-2 text-center text-xs text-[#8A7F72]">
                      Google sign-in — use email above if you prefer.
                    </p>
                  </div>
                </>
              )}

              {/* Saved addresses */}
              <div className="mt-6 pt-5 border-t border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-mono text-xs uppercase tracking-widest text-[#8A7F72]">
                    Saved Addresses
                  </p>
                  <button
                    onClick={() => {
                      setShowAddress(!showAddress);
                      sfx.click();
                    }}
                    className="text-xs text-[#F2B33D] hover:text-[#FFC93C]"
                  >
                    {showAddress ? 'Cancel' : '+ Add'}
                  </button>
                </div>

                {showAddress && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      addAddress(addr);
                      setAddr({ label: '', line1: '', city: '', postal: '' });
                      setShowAddress(false);
                      sfx.add();
                    }}
                    className="space-y-2 mb-3"
                  >
                    <input className={inputCls} placeholder="Label (Home, Work)" value={addr.label} onChange={(e) => setAddr({ ...addr, label: e.target.value })} required />
                    <input className={inputCls} placeholder="Street address" value={addr.line1} onChange={(e) => setAddr({ ...addr, line1: e.target.value })} required />
                    <div className="grid grid-cols-2 gap-2">
                      <input className={inputCls} placeholder="City" value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} required />
                      <input className={inputCls} placeholder="Postal code" value={addr.postal} onChange={(e) => setAddr({ ...addr, postal: e.target.value })} required />
                    </div>
                    <button type="submit" className="w-full py-2.5 rounded-xl bg-[#F2B33D] text-[#1C120C] text-sm font-medium hover:bg-[#FFC93C] active:bg-[#E3A62E] transition-colors inner-catchlight">
                      Save Address
                    </button>
                  </form>
                )}

                {addresses.length === 0 ? (
                  <p className="text-sm text-[#8A7F72]">No saved addresses yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {addresses.map((a) => (
                      <li key={a.id} className="p-3 rounded-xl bg-white/5 border border-white/10 text-sm text-[#F5EFE4] flex items-center justify-between gap-2">
                        <span>
                          <span className="font-medium text-[#F2B33D]">{a.label}:</span>{' '}
                          {a.line1}, {a.city} {a.postal}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeAddress(a.id)}
                          className="shrink-0 text-[#8A7F72] hover:text-[#E8542A] text-xs cursor-pointer"
                          aria-label={`Remove ${a.label}`}
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

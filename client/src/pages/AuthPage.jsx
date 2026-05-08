import { useState, useEffect, useRef } from 'react';

const mono = { fontFamily: 'var(--font-mono)' };

const ERROR_MAP = {
  'Invalid login credentials': 'Wrong email or password.',
  'Email not confirmed': 'Check your inbox for a confirmation link.',
  'User already registered': 'This email is already registered. Try signing in.',
  'Token has expired or is invalid': 'This confirmation link has expired. Request a new one.',
  'Email rate limit exceeded': 'Too many attempts. Wait a minute.',
  'Auth not configured': 'Authentication is not configured for this environment.',
};

function friendlyError(raw) {
  if (!raw) return null;
  for (const [key, msg] of Object.entries(ERROR_MAP)) {
    if (raw.toLowerCase().includes(key.toLowerCase())) return msg;
  }
  return raw;
}

const RESEND_COOLDOWN = 60;

export default function AuthPage({ signUp, signIn, confirmPending, confirmEmail, onResend }) {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [localConfirmSent, setLocalConfirmSent] = useState(false);

  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef(null);

  useEffect(() => {
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, []);

  function startCooldown() {
    setResendCooldown(RESEND_COOLDOWN);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((v) => {
        if (v <= 1) { clearInterval(cooldownRef.current); return 0; }
        return v - 1;
      });
    }, 1000);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'signup') {
        await signUp(email, password);
        setLocalConfirmSent(true);
        startCooldown();
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      const msg = err.message || 'Something went wrong';
      setError(msg);
      if (msg.toLowerCase().includes('email not confirmed')) {
        setLocalConfirmSent(true);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    setError(null);
    try {
      await onResend(email || confirmEmail);
      startCooldown();
    } catch (err) {
      setError(err.message);
    }
  }

  const showConfirmation = confirmPending || localConfirmSent;
  const pendingEmail = email || confirmEmail || '';

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--color-bg-main)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div
            className="inline-flex items-center justify-center w-12 h-12 text-[11px] font-black tracking-tight mb-5"
            style={{ border: '1px solid var(--color-border-strong)', color: 'var(--color-accent-bright)', backgroundColor: 'var(--color-bg-card)', ...mono }}
          >
            JS
          </div>
          <h1
            className="text-[clamp(2rem,8vw,3.5rem)] font-black uppercase leading-[0.92] tracking-[-0.04em]"
            style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)' }}
          >
            JobSim
          </h1>
          <p className="mt-3 text-[10px] uppercase tracking-[0.22em]" style={{ color: 'var(--color-text-muted)', ...mono }}>
            {showConfirmation ? 'Email verification' : mode === 'signup' ? 'Create account' : 'Sign in to continue'}
          </p>
        </div>

        {showConfirmation ? (
          <div
            className="border p-6 text-center"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-card)' }}
          >
            <div
              className="w-10 h-10 mx-auto mb-5 flex items-center justify-center text-[16px]"
              style={{ border: '1px solid var(--color-border-strong)', color: 'var(--color-accent-bright)' }}
              aria-hidden
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </div>
            <p className="text-[11px] uppercase tracking-[0.16em] leading-relaxed" style={{ color: 'var(--color-text-primary)', ...mono }}>
              Check your inbox
            </p>
            {pendingEmail && (
              <p className="mt-2 text-[10px] tracking-[0.12em]" style={{ color: 'var(--color-text-secondary)', ...mono }}>
                Sent to {pendingEmail}
              </p>
            )}
            <p className="mt-4 text-[9px] uppercase tracking-[0.16em] leading-relaxed" style={{ color: 'var(--color-text-muted)', ...mono }}>
              Click the link in your email to verify your account, then return here to sign in.
            </p>

            {error && (
              <p className="mt-4 text-[9px] uppercase tracking-[0.14em] px-1" style={{ color: 'var(--color-danger)', ...mono }}>
                {friendlyError(error)}
              </p>
            )}

            <div className="mt-6 flex flex-col gap-3 items-center">
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0}
                className="text-[9px] uppercase tracking-[0.2em] cursor-pointer disabled:opacity-40 disabled:cursor-default px-4 py-2 border transition-opacity"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-accent-bright)', ...mono }}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend confirmation'}
              </button>
              <button
                type="button"
                onClick={() => { setMode('signin'); setLocalConfirmSent(false); setError(null); }}
                className="text-[9px] uppercase tracking-[0.18em] cursor-pointer"
                style={{ color: 'var(--color-text-muted)', ...mono }}
              >
                Back to sign in
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-[8px] font-bold uppercase tracking-[0.28em] mb-2" style={{ color: 'var(--color-text-muted)', ...mono }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="ui-input w-full h-11 px-3 text-[11px] tracking-wider"
                  style={mono}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="block text-[8px] font-bold uppercase tracking-[0.28em] mb-2" style={{ color: 'var(--color-text-muted)', ...mono }}>
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="ui-input w-full h-11 px-3 text-[11px] tracking-wider"
                  style={mono}
                  placeholder="••••••••"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                />
              </div>

              {error && (
                <p className="text-[9px] uppercase tracking-[0.14em] px-1" style={{ color: 'var(--color-danger)', ...mono }}>
                  {friendlyError(error)}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="h-11 text-[10px] font-bold uppercase tracking-[0.2em] cursor-pointer disabled:opacity-50 mt-2 border"
                style={{
                  borderColor: 'var(--color-border-strong)',
                  color: 'var(--color-accent-bright)',
                  backgroundColor: 'var(--color-accent-soft)',
                  ...mono,
                }}
              >
                {loading ? 'Loading...' : mode === 'signup' ? 'Create account' : 'Sign in'}
              </button>
            </div>
          </form>
        )}

        {!showConfirmation && (
          <p className="mt-6 text-center text-[10px] uppercase tracking-[0.16em]" style={{ color: 'var(--color-text-muted)', ...mono }}>
            {mode === 'signin' ? (
              <>
                No account?{' '}
                <button type="button" onClick={() => { setMode('signup'); setError(null); }} className="cursor-pointer" style={{ color: 'var(--color-accent-bright)' }}>
                  Sign up
                </button>
              </>
            ) : (
              <>
                Have an account?{' '}
                <button type="button" onClick={() => { setMode('signin'); setError(null); }} className="cursor-pointer" style={{ color: 'var(--color-accent-bright)' }}>
                  Sign in
                </button>
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

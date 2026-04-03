import { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import type { AuthState } from '../hooks/useAuth';

interface AuthModalProps {
  auth: AuthState;
}

export function AuthModal({ auth }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (auth.isLoading) return null;
  if (auth.user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    let errMsg: string | null;
    if (mode === 'login') {
      errMsg = await auth.signIn(email, password);
    } else {
      errMsg = await auth.signUp(email, password, fullName);
      if (!errMsg) {
        // Registration auto-logs in (token returned)
        setIsSubmitting(false);
        return;
      }
    }

    if (errMsg) setError(errMsg);
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-800">
            <span className="text-xl font-black text-white">AH</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900">AHEAD Onboarding AI</h2>
          <p className="mt-1 text-sm text-slate-500">
            {mode === 'login' ? 'Sign in to track your onboarding progress' : 'Create your account to get started'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Your name"
                required
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@ahead.com"
              required
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                required
                minLength={8}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 pr-10 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}
          {success && (
            <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="mt-5 text-center">
          {mode === 'login' ? (
            <p className="text-sm text-slate-500">
              No account yet?{' '}
              <button onClick={() => { setMode('register'); setError(null); }} className="font-medium text-blue-600 hover:underline">
                Register
              </button>
            </p>
          ) : (
            <p className="text-sm text-slate-500">
              Already have an account?{' '}
              <button onClick={() => { setMode('login'); setError(null); }} className="font-medium text-blue-600 hover:underline">
                Sign In
              </button>
            </p>
          )}
        </div>

        <div className="mt-4 rounded-lg bg-slate-50 p-3 text-center text-xs text-slate-500">
          Sign in with your <strong>@ahead.com</strong> email to sync your progress across devices.
          <br />Without an account, progress is saved locally in this browser only.
        </div>
      </div>
    </div>
  );
}

export function UserBadge({ auth, onSignOut }: { auth: AuthState; onSignOut: () => void }) {
  if (!auth.user || !auth.isConfigured) return null;

  const displayName = auth.profile?.fullName ?? auth.user.email ?? '';
  const initials = auth.profile?.fullName
    ? auth.profile.fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : displayName.slice(0, 2).toUpperCase();

  return (
    <div className="flex items-center gap-2">
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
        {initials}
      </div>
      <div className="hidden sm:block">
        <p className="max-w-[120px] truncate text-xs font-medium text-slate-700">
          {displayName}
        </p>
        {auth.isAdmin && (
          <span className="text-xs font-medium text-amber-600">Admin</span>
        )}
      </div>
      <button
        onClick={onSignOut}
        className="rounded px-2 py-0.5 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600"
      >
        Sign out
      </button>
    </div>
  );
}

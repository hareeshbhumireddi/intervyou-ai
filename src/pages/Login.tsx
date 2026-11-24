import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useAppState } from '../hooks/useAppState';
import { ApiError, api } from '../utils/api';
import { safeRedirect } from '../utils/validation';
import { Alert, AuthShell, Button, TextField } from '../components/ui';
import Login3DScene from '../components/Login3DScene';

type LoginState = { registered?: boolean; email?: string; from?: string; reason?: 'expired' } | null;

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LoginState;
  const { completeEmailLogin, signInWithGoogle, serverUnreachable } = useAppState();
  const [email, setEmail] = useState(state?.email || '');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleSignIn = async () => {
    if (loading || googleLoading) return;
    setError('');
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      navigate(safeRedirect(state?.from), { replace: true });
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/popup-closed-by-user') {
        setError('Google sign-in popup was closed before completing.');
      } else {
        setError(err instanceof ApiError || err instanceof Error ? err.message : 'Google sign-in failed. Please try again.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading || googleLoading) return;
    setError('');
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      // Only clear a lingering Firebase session if it belongs to a DIFFERENT email account
      const currentFbEmail = auth.currentUser?.email?.trim().toLowerCase() || '';
      if (auth.currentUser && currentFbEmail && currentFbEmail !== cleanEmail) {
        await signOut(auth).catch(() => undefined);
      }
      const result = await api.login(cleanEmail, password);
      await completeEmailLogin(result.user);
      navigate(safeRedirect(state?.from), { replace: true });
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Sign in failed. Please check your credentials.');
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue your interview practice."
      visual3d={<Login3DScene />}
      footer={<>New here? <Link to="/onboarding" className="font-semibold text-brand-600 hover:underline">Create an account</Link></>}
    >
      {/* Interactive 3D Mini Viewport on Mobile Devices */}
      <div className="mb-6 block lg:hidden">
        <div className="relative h-36 w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-md">
          <Login3DScene />
          <div className="absolute bottom-2 left-3 flex items-center gap-1.5 rounded-full bg-slate-900/80 px-2.5 py-0.5 text-[10px] font-semibold text-blue-300 backdrop-blur-xs">
            <Sparkles className="h-3 w-3 text-blue-400" />
            <span>Interactive 3D Core</span>
          </div>
        </div>
      </div>

      <motion.div
        className="space-y-5"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {state?.registered && <Alert tone="success">Account created. Sign in to get started.</Alert>}
        {state?.reason === 'expired' && <Alert tone="info">Your session expired. Please sign in again.</Alert>}
        {serverUnreachable && <Alert tone="error">Cannot reach the application server. Check that the backend is running.</Alert>}

        <div>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-xs transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 cursor-pointer"
          >
            {googleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z" />
                <path fill="#FBBC05" d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z" />
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z" />
              </svg>
            )}
            <span>{googleLoading ? 'Connecting Google account…' : 'Continue with Google'}</span>
          </button>
          <p className="mt-2 text-center text-[11px] text-slate-500 dark:text-slate-400">
            Syncs your profile picture, resume, and interview history in the cloud across sessions.
          </p>
        </div>

        <div className="relative flex items-center py-1">
          <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
          <span className="mx-3 shrink text-xs font-medium text-slate-400">or sign in with email</span>
          <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-5" aria-label="Sign in">
          <TextField label="Email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <div className="space-y-1.5">
            <TextField label="Password" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="button" onClick={() => setShow((s) => !s)} aria-pressed={show} className="inline-flex items-center gap-1.5 rounded text-sm text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white cursor-pointer">
              {show ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
              {show ? 'Hide password' : 'Show password'}
            </button>
          </div>
          {error && <Alert tone="error">{error}</Alert>}
          <Button type="submit" full loading={loading}>{loading ? 'Signing in…' : 'Sign in'}</Button>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
            <div className="mb-2 font-semibold text-slate-700 dark:text-slate-300">Quick Demo Account:</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setEmail('demo@example.com');
                  setPassword('Password123!');
                  setError('');
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer shadow-xs"
              >
                <span className="h-2 w-2 rounded-full bg-brand-600 animate-pulse"></span>
                demo@example.com
              </button>
            </div>
            <div className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400">
              Demo account password: <code className="font-mono font-semibold text-slate-700 dark:text-slate-300">Password123!</code>
            </div>
          </div>
        </form>
      </motion.div>
    </AuthShell>
  );
}

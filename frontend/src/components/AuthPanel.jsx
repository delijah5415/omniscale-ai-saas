import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

export default function AuthPanel({ onAuthChange }) {
  const [mode, setMode] = useState('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      const { data, error: sessionError } = await supabase.auth.getSession();

      if (!mounted) return;

      if (sessionError) {
        setError(sessionError.message);
        return;
      }

      const currentSession = data.session ?? null;
      setUser(currentSession?.user ?? null);
      onAuthChange?.(currentSession?.user ?? null, currentSession);
    };

    loadSession();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      const currentSession = session ?? null;
      setUser(currentSession?.user ?? null);
      onAuthChange?.(currentSession?.user ?? null, currentSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [onAuthChange]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setError('Enter your email address and password.');
      return;
    }

    if (mode === 'signup') {
      if (password.length < 8) {
        setError('Use a password with at least 8 characters.');
        return;
      }

      if (password !== confirmPassword) {
        setError('The passwords do not match.');
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: window.location.origin
          }
        });

        if (signUpError) throw signUpError;

        if (data.session) {
          setMessage('Account created and signed in successfully.');
        } else {
          setMessage(
            'Account registration received. Check your email for a verification link before signing in.'
          );
        }
      } else {
        const { error: signInError } =
          await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password
          });

        if (signInError) throw signInError;

        setMessage('Signed in successfully.');
      }

      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Authentication failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      setMessage('You have signed out.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to sign out.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mt-7 rounded-2xl border border-slate-700 bg-slate-900 p-6">
      <h3 className="text-xl font-bold">
        {user ? 'Your OmniScale Account' : 'Create Your Account or Sign In'}
      </h3>

      {user ? (
        <div className="mt-4">
          <p className="text-sm text-slate-300">
            Signed in as <strong>{user.email}</strong>
          </p>
          <p className="mt-2 text-sm text-slate-400">
            A valid subscription is still required to access paid features.
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={loading}
            className="mt-5 rounded-xl border border-slate-600 px-5 py-3 font-semibold disabled:opacity-50"
          >
            {loading ? 'Signing out...' : 'Sign Out'}
          </button>
        </div>
      ) : (
        <>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError('');
                setMessage('');
              }}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                mode === 'signup'
                  ? 'bg-sky-500 text-white'
                  : 'border border-slate-700 text-slate-300'
              }`}
            >
              Sign Up
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
                setMessage('');
              }}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                mode === 'login'
                  ? 'bg-indigo-500 text-white'
                  : 'border border-slate-700 text-slate-300'
              }`}
            >
              Log In / Sign In
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Email address
              </label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Password
              </label>
              <input
                type="password"
                autoComplete={
                  mode === 'signup' ? 'new-password' : 'current-password'
                }
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"
                placeholder="At least 8 characters"
              />
            </div>

            {mode === 'signup' && (
              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Confirm password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"
                  placeholder="Re-enter your password"
                />
              </div>
            )}

            {error && (
              <p role="alert" className="text-sm text-red-400">
                {error}
              </p>
            )}

            {message && (
              <p role="status" className="text-sm text-emerald-400">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 px-5 py-3 font-bold disabled:opacity-50"
            >
              {loading
                ? 'Please wait...'
                : mode === 'signup'
                  ? 'Create Account'
                  : 'Sign In'}
            </button>
          </form>
        </>
      )}

      {error && user && (
        <p role="alert" className="mt-4 text-sm text-red-400">{error}</p>
      )}

      {message && user && (
        <p role="status" className="mt-4 text-sm text-emerald-400">{message}</p>
      )}
    </section>
  );
}

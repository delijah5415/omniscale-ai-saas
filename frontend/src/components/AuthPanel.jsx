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
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return;

      if (sessionError) {
        setError(sessionError.message);
        return;
      }

      const currentUser = data.session?.user ?? null;
      setUser(currentUser);
      onAuthChange?.(currentUser, data.session);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const currentUser = session?.user ?? null;
        if (event === 'PASSWORD_RECOVERY') {
          setMode('update-password');
          setError('');
          setMessage('Choose a new password for your account.');
        }
        setUser(currentUser);
        onAuthChange?.(currentUser, session);
      }
    );

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [onAuthChange]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (mode === 'signup' && !agreedToTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy to create an account.');
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (mode !== 'update-password' && !normalizedEmail) {
      setError('Enter your email address.');
      return;
    }

    if (!['forgot-password', 'update-password'].includes(mode) && !password) {
      setError('Enter your password.');
      return;
    }

    if (['signup', 'update-password'].includes(mode) && password.length < 8) {
      setError('Use a password with at least 8 characters.');
      return;
    }

    if (['signup', 'update-password'].includes(mode) && password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'forgot-password') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          normalizedEmail,
          { redirectTo: window.location.origin }
        );
        if (resetError) throw resetError;
        setMessage('If an account exists for that email, a reset link will be sent. Check your inbox and spam folder.');
      } else if (mode === 'update-password') {
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        setPassword('');
        setConfirmPassword('');
        setMode('login');
        setMessage('Your password has been updated successfully.');
      } else if (mode === 'signup') {
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

  const handleDiscordLogin = async () => {
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: {
          redirectTo: window.location.origin
        }
      });

      if (oauthError) throw oauthError;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Discord OAuth login failed.'
      );
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
    <section className="mt-7 rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
      <h3 className="text-xl font-bold text-white">
        {user ? 'Your OmniScale Account' : 'Create Your Account or Sign In'}
      </h3>

      {user && mode !== 'update-password' ? (
        <div className="mt-4">
          <p className="text-sm text-slate-300">
            Signed in as <strong>{user.email || user.user_metadata?.email || 'Discord User'}</strong>
          </p>
          <p className="mt-2 text-sm text-slate-400">
            A valid subscription is required to access paid workspace features.
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={loading}
            className="mt-5 rounded-xl border border-slate-600 px-5 py-3 font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? 'Signing out...' : 'Sign Out'}
          </button>
        </div>
      ) : (
        <>
          {!['forgot-password', 'update-password'].includes(mode) && (
            <>
          {/* Discord OAuth Login Button */}
          <div className="mt-5">
            <button
              type="button"
              onClick={handleDiscordLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] px-4 py-3 font-semibold text-white shadow-lg transition-all disabled:opacity-50"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.011c3.927 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              Continue with Discord
            </button>
          </div>

          <div className="relative my-6 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700" />
            </div>
            <div className="relative bg-slate-900 px-3 text-xs uppercase tracking-wider text-slate-400">
              Or with email
            </div>
          </div>

          <div className="flex gap-3">
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

            </>
          )}

          {mode === 'login' && (
            <div className="mt-3 text-right">
              <button type="button" onClick={() => {
                setMode('forgot-password');
                setError('');
                setMessage('');
                setPassword('');
                setConfirmPassword('');
              }} className="text-sm text-indigo-400 underline">
                Forgot password?
              </button>
            </div>
          )}

          {(mode === 'forgot-password' || mode === 'update-password') && (
            <div className="mt-3">
              <button type="button" onClick={() => {
                setMode('login');
                setError('');
                setMessage('');
                setPassword('');
                setConfirmPassword('');
              }} className="text-sm text-indigo-400 underline">
                Back to sign in
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {mode !== 'update-password' && (
              <div>
                <label className="mb-2 block text-sm text-slate-300">Email address</label>
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
            )}

            {mode !== 'forgot-password' && (
              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  {mode === 'update-password' ? 'New password' : 'Password'}
                </label>
                <input
                  type="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  minLength={8}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"
                  placeholder="At least 8 characters"
                />
              </div>
            )}

            {(mode === 'signup' || mode === 'update-password') && (
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

            {mode === 'signup' && (
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="termsConsent"
                  checked={agreedToTerms}
                  onChange={(event) => setAgreedToTerms(event.target.checked)}
                  required
                  className="mt-1 h-4 w-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="termsConsent" className="text-xs text-slate-400">
                  I agree to the{' '}
                  <a href="/terms" target="_blank" rel="noopener noreferrer"
                     className="text-indigo-400 underline">
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a href="/privacy-policy" target="_blank" rel="noopener noreferrer"
                     className="text-indigo-400 underline">
                    Privacy Policy
                  </a>.
                </label>
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
              disabled={loading || (mode === 'signup' && !agreedToTerms)}
              className="w-full rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 px-5 py-3 font-bold text-white disabled:opacity-50"
            >
              {loading
                ? 'Please wait...'
                : mode === 'signup'
                  ? 'Create Account'
                  : mode === 'forgot-password'
                    ? 'Send Reset Link'
                    : mode === 'update-password'
                      ? 'Update Password'
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
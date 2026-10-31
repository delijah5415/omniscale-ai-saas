import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

function formatDate(value) {
  if (!value) return 'Not available';

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not available'
    : date.toLocaleString();
}

export default function AccountDashboard({ accessToken, onSignOut }) {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const [fullName, setFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadAccount = useCallback(async () => {
    if (!accessToken) {
      setAccount(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/account/me`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Unable to load account.');
      }

      setAccount(result.account);
      setFullName(result.account.fullName || '');
    } catch (err) {
      setError(err.message || 'Unable to load account details.');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  async function handleSaveName(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    const trimmedName = fullName.trim();

    if (trimmedName.length > 80) {
      setError('Your display name must be 80 characters or fewer.');
      return;
    }

    setSavingName(true);

    try {
      const { data, error: updateError } = await supabase.auth.updateUser({
        data: { full_name: trimmedName }
      });

      if (updateError) throw updateError;

      setFullName(data.user?.user_metadata?.full_name || trimmedName);
      setAccount((current) => current
        ? { ...current, fullName: trimmedName }
        : current
      );

      setMessage('Your display name has been updated.');
    } catch (err) {
      setError(err.message || 'Unable to update your display name.');
    } finally {
      setSavingName(false);
    }
  }

  async function handleUpdatePassword(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (newPassword.length < 8) {
      setError('Use a password with at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }

    setUpdatingPassword(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      setNewPassword('');
      setConfirmPassword('');
      setMessage('Your password has been updated successfully.');
    } catch (err) {
      setError(err.message || 'Unable to update your password.');
    } finally {
      setUpdatingPassword(false);
    }
  }

  async function performAccountAction(endpoint, body = {}) {
    setBusy(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(`${API_URL}/account/${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'The requested action failed.');
      }

      if (endpoint === 'delete') {
        if (onSignOut) {
          await onSignOut();
        } else {
          await supabase.auth.signOut();
        }

        window.location.reload();
        return;
      }

      setMessage(result.message || 'Your request was completed.');
      await loadAccount();
    } catch (err) {
      setError(err.message || 'The requested action failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelSubscription() {
    const confirmed = window.confirm(
      'Cancel your OmniScale subscription? Premium access will be disabled after cancellation is processed.'
    );

    if (confirmed) {
      await performAccountAction('cancel-subscription');
    }
  }

  async function handleDeleteAccount() {
    const confirmation = window.prompt(
      'This permanently deletes your OmniScale account. Type DELETE to confirm.'
    );

    if (confirmation !== 'DELETE') {
      if (confirmation !== null) {
        setError('Account deletion was not confirmed.');
      }
      return;
    }

    await performAccountAction('delete');
  }

  async function handleSignOut() {
    setError('');
    setMessage('');
    setBusy(true);

    try {
      if (onSignOut) {
        await onSignOut();
      } else {
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) throw signOutError;
      }
    } catch (err) {
      setError(err.message || 'Unable to sign out.');
    } finally {
      setBusy(false);
    }
  }

  const status = account?.status || 'unknown';

  return (
    <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6 text-left">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-sky-400">
            Account settings
          </p>
          <h2 className="mt-1 text-2xl font-bold text-white">
            Your profile
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Manage your personal details, security and subscription.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={busy}
          className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
        >
          Sign out
        </button>
      </div>

      {loading && (
        <p className="mt-5 text-slate-400">Loading account details…</p>
      )}

      {!loading && account && (
        <div className="mt-6 space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Email address
              </p>
              <p className="mt-1 break-all font-medium text-white">
                {account.email || 'Not available'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Email verification
              </p>
              <p className={`mt-1 font-semibold ${
                account.emailConfirmed ? 'text-emerald-400' : 'text-amber-300'
              }`}>
                {account.emailConfirmed ? 'Verified' : 'Not verified'}
              </p>
              {account.emailConfirmedAt && (
                <p className="mt-1 text-xs text-slate-500">
                  Verified: {formatDate(account.emailConfirmedAt)}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Account created
              </p>
              <p className="mt-1 text-sm text-white">
                {formatDate(account.createdAt)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Last sign-in
              </p>
              <p className="mt-1 text-sm text-white">
                {formatDate(account.lastSignInAt)}
              </p>
            </div>
          </div>

          <form
            onSubmit={handleSaveName}
            className="rounded-xl border border-slate-800 bg-slate-950 p-5"
          >
            <h3 className="font-semibold text-white">Personal information</h3>
            <label
              htmlFor="profile-full-name"
              className="mt-4 block text-sm text-slate-400"
            >
              Display name
            </label>
            <input
              id="profile-full-name"
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              maxLength={80}
              autoComplete="name"
              placeholder="Enter your display name"
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white outline-none focus:border-sky-500"
            />
            <button
              type="submit"
              disabled={savingName}
              className="mt-3 rounded-xl bg-sky-600 px-5 py-3 font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {savingName ? 'Saving…' : 'Save display name'}
            </button>
          </form>

          <form
            onSubmit={handleUpdatePassword}
            className="rounded-xl border border-slate-800 bg-slate-950 p-5"
          >
            <h3 className="font-semibold text-white">Change password</h3>
            <p className="mt-1 text-sm text-slate-400">
              Use at least 8 characters for your new password.
            </p>

            <label
              htmlFor="profile-new-password"
              className="mt-4 block text-sm text-slate-400"
            >
              New password
            </label>
            <input
              id="profile-new-password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={8}
              autoComplete="new-password"
              required
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white outline-none focus:border-sky-500"
            />

            <label
              htmlFor="profile-confirm-password"
              className="mt-4 block text-sm text-slate-400"
            >
              Confirm new password
            </label>
            <input
              id="profile-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={8}
              autoComplete="new-password"
              required
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-white outline-none focus:border-sky-500"
            />

            <button
              type="submit"
              disabled={updatingPassword}
              className="mt-3 rounded-xl border border-slate-700 px-5 py-3 font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {updatingPassword ? 'Updating…' : 'Update password'}
            </button>
          </form>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
            <h3 className="font-semibold text-white">Subscription</h3>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Plan
                </p>
                <p className="mt-1 font-semibold capitalize text-white">
                  {account.plan || 'No plan'}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Status
                </p>
                <p className="mt-1 font-semibold capitalize text-white">
                  {status.replaceAll('_', ' ')}
                </p>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Paid-through / entitlement date
              </p>
              <p className="mt-1 text-sm text-white">
                {formatDate(account.entitlementEndsAt)}
              </p>
            </div>

            {account.updatedAt && (
              <p className="mt-3 text-xs text-slate-500">
                Subscription status last updated: {formatDate(account.updatedAt)}
              </p>
            )}

            {status === 'active' && (
              <button
                type="button"
                disabled={busy}
                onClick={handleCancelSubscription}
                className="mt-5 w-full rounded-xl border border-amber-500/50 px-4 py-3 font-semibold text-amber-300 hover:bg-amber-500/10 disabled:opacity-50"
              >
                {busy ? 'Processing…' : 'Cancel subscription'}
              </button>
            )}
          </div>

          <div className="rounded-xl border border-red-500/20 bg-slate-950 p-5">
            <h3 className="font-semibold text-red-300">Danger zone</h3>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              Permanently delete your account. If your subscription is active,
              the server will attempt to cancel it first. Deletion may be
              blocked while paid access remains or billing details need review.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={handleDeleteAccount}
              className="mt-3 w-full rounded-xl border border-red-500/50 px-4 py-3 font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-50"
            >
              {busy ? 'Processing…' : 'Delete my account'}
            </button>
          </div>
        </div>
      )}

      {!loading && !account && !error && (
        <p className="mt-5 text-sm text-slate-400">
          Account information is not currently available.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-400">
          {error}
        </p>
      )}

      {message && (
        <p role="status" className="mt-4 text-sm text-emerald-400">
          {message}
        </p>
      )}
    </section>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [sendingReauthCode, setSendingReauthCode] = useState(false);
  const [reauthCodeSent, setReauthCodeSent] = useState(false);
  const [reauthCode, setReauthCode] = useState('');

  const [fullName, setFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const accountRequestGeneration = useRef(0);

  const loadAccount = useCallback(async () => {
    const generation = ++accountRequestGeneration.current;

    if (!accessToken) {
      setAccount(null);
      setFullName('');
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

      if (generation !== accountRequestGeneration.current) {
        return;
      }

      setAccount(result.account);
      setFullName(result.account.fullName || '');
    } catch (err) {
      if (generation !== accountRequestGeneration.current) {
        return;
      }

      setAccount(null);
      setFullName('');
      setError(err.message || 'Unable to load account details.');
    } finally {
      if (generation === accountRequestGeneration.current) {
        setLoading(false);
      }
    }
  }, [accessToken]);

  useEffect(() => {
    // Do not display the previous session's profile while a new one loads.
    setAccount(null);
    setFullName('');
    loadAccount();

    return () => {
      // Invalidate any request still pending when the token changes or component unmounts.
      accountRequestGeneration.current += 1;
    };
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

  async function handleSendReauthenticationCode() {
    setError('');
    setMessage('');
    setSendingReauthCode(true);

    try {
      const { error: reauthError } = await supabase.auth.reauthenticate();

      if (reauthError) throw reauthError;

      setReauthCodeSent(true);
      setReauthCode('');
      setMessage('A password-change verification code has been sent to your confirmed email address or phone number.');
    } catch (err) {
      setError(err.message || 'Unable to send the verification code. Please try again.');
    } finally {
      setSendingReauthCode(false);
    }
  }

  async function handleUpdatePassword(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!reauthCodeSent) {
      setError('Request a verification code before updating your password.');
      return;
    }

    const trimmedCode = reauthCode.trim();

    if (!trimmedCode) {
      setError('Enter the verification code you received.');
      return;
    }

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
        password: newPassword,
        nonce: trimmedCode
      });

      if (updateError) throw updateError;

      setNewPassword('');
      setConfirmPassword('');
      setReauthCode('');
      setReauthCodeSent(false);
      setMessage('Your password has been updated successfully.');
    } catch (err) {
      setError(err.message || 'Unable to update your password. Check the verification code and try again.');
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
    const pendingReview = status.toLowerCase() === 'cancelled_pending_review';
    const confirmed = window.confirm(
      pendingReview
        ? 'Retry PayPal cancellation and billing verification? Your account will be retained if the paid-through date still needs review.'
        : 'Cancel your OmniScale subscription? Premium access will remain available until the recorded entitlement end date, if one is verified.'
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
  const displayName = account?.fullName || 'OmniScale member';
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2)
    .map((part) => part[0].toUpperCase()).join('') || 'OM';
  const normalizedStatus = status.toLowerCase();
  const subscriptionActive = normalizedStatus === 'active';
  const cancellationAvailable = [
    'active',
    'cancelled_pending_review'
  ].includes(normalizedStatus);

  return (
    <section className="mx-auto mt-6 w-full max-w-6xl text-left text-slate-100">
      <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl shadow-black/20">
        <div className="relative overflow-hidden border-b border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/70 px-5 py-8 sm:px-8">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-28 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-sky-400/30 bg-gradient-to-br from-sky-500/20 to-indigo-500/20 text-xl font-black text-sky-200 shadow-lg shadow-sky-950/30">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-300">OmniScale account</p>
                <h2 className="mt-1 truncate text-2xl font-black tracking-tight text-white sm:text-3xl">Your profile</h2>
                <p className="mt-1 break-all text-sm text-slate-400">{account?.email || 'Manage your account details'}</p>
              </div>
            </div>
            <button type="button" onClick={handleSignOut} disabled={busy}
              className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-950/60 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
              Sign out
            </button>
          </div>
          <div className="relative mt-7 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${account?.emailConfirmed ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-200'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${account?.emailConfirmed ? 'bg-emerald-400' : 'bg-amber-300'}`} />
              {account?.emailConfirmed ? 'Email verified' : 'Email not verified'}
            </span>
            <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize ${subscriptionActive ? 'border-sky-500/30 bg-sky-500/10 text-sky-200' : 'border-slate-700 bg-slate-950/50 text-slate-300'}`}>
              {status.replaceAll('_', ' ')}
            </span>
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-3 px-6 py-10 text-sm text-slate-400" role="status">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400" />
            Loading your account…
          </div>
        )}

        {!loading && account && (
          <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
            <div className="min-w-0 space-y-6">
              <section>
                <div className="mb-4 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-400">Account overview</p>
                    <h3 className="mt-1 text-lg font-bold text-white">Personal details</h3>
                  </div>
                  <span className="text-xs text-slate-500">Your account information</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Email address</p>
                    <p className="mt-2 break-all text-sm font-medium text-white">{account.email || 'Not available'}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Email verification</p>
                    <p className={`mt-2 text-sm font-semibold ${account.emailConfirmed ? 'text-emerald-300' : 'text-amber-300'}`}>
                      {account.emailConfirmed ? 'Verified' : 'Not verified'}
                    </p>
                    {account.emailConfirmedAt && <p className="mt-1 text-xs text-slate-500">Since {formatDate(account.emailConfirmedAt)}</p>}
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Account created</p>
                    <p className="mt-2 text-sm text-white">{formatDate(account.createdAt)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Last sign-in</p>
                    <p className="mt-2 text-sm text-white">{formatDate(account.lastSignInAt)}</p>
                  </div>
                </div>
              </section>

              <form onSubmit={handleSaveName} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-sky-500/10 p-2.5 text-sky-300" aria-hidden="true">✦</div>
                  <div>
                    <h3 className="font-bold text-white">Profile information</h3>
                    <p className="mt-1 text-sm leading-5 text-slate-400">Choose the name shown across your OmniScale account.</p>
                  </div>
                </div>
                <label htmlFor="profile-full-name" className="mt-5 block text-sm font-medium text-slate-300">Display name</label>
                <input id="profile-full-name" type="text" value={fullName}
                  onChange={(event) => setFullName(event.target.value)} maxLength={80}
                  autoComplete="name" placeholder="Enter your display name"
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20" />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-slate-500">{fullName.length}/80 characters</span>
                  <button type="submit" disabled={savingName || fullName.trim() === (account.fullName || '')}
                    className="rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-950/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
                    {savingName ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </form>

              <form onSubmit={handleUpdatePassword} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 sm:p-6">
                <div>
                  <h3 className="font-bold text-white">Password & security</h3>
                  <p className="mt-1 text-sm text-slate-400">Verify your identity before changing your password.</p>
                </div>

                <div className="mt-5 rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
                  <p className="text-sm leading-6 text-slate-300">
                    Request a verification code using your confirmed Supabase email address or phone number.
                  </p>
                  <button
                    type="button"
                    onClick={handleSendReauthenticationCode}
                    disabled={sendingReauthCode || updatingPassword}
                    className="mt-3 rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-2.5 text-sm font-semibold text-sky-200 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sendingReauthCode ? 'Sending code…' : reauthCodeSent ? 'Send a new code' : 'Send verification code'}
                  </button>
                </div>

                {reauthCodeSent && (
                  <>
                    <div className="mt-5">
                      <label htmlFor="profile-reauth-code" className="block text-sm font-medium text-slate-300">
                        Verification code
                      </label>
                      <input
                        id="profile-reauth-code"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={reauthCode}
                        onChange={(event) => setReauthCode(event.target.value.replace(/\s/g, ''))}
                        required
                        maxLength={12}
                        placeholder="Enter the code you received"
                        className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                      />
                    </div>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="profile-new-password" className="block text-sm font-medium text-slate-300">New password</label>
                        <input id="profile-new-password" type="password" value={newPassword}
                          onChange={(event) => setNewPassword(event.target.value)} minLength={8}
                          autoComplete="new-password" required
                          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20" />
                      </div>
                      <div>
                        <label htmlFor="profile-confirm-password" className="block text-sm font-medium text-slate-300">Confirm password</label>
                        <input id="profile-confirm-password" type="password" value={confirmPassword}
                          onChange={(event) => setConfirmPassword(event.target.value)} minLength={8}
                          autoComplete="new-password" required
                          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20" />
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <span className="text-xs text-slate-500">At least 8 characters</span>
                      <button type="submit" disabled={updatingPassword || !reauthCode.trim() || !newPassword || !confirmPassword}
                        className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-slate-500 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50">
                        {updatingPassword ? 'Updating…' : 'Update password'}
                      </button>
                    </div>
                  </>
                )}
              </form>
            </div>

            <aside className="min-w-0 space-y-5">
              <section className="rounded-2xl border border-indigo-500/25 bg-gradient-to-br from-indigo-950/70 via-slate-950 to-slate-950 p-5 sm:p-6">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-300">Membership</p>
                <h3 className="mt-2 text-xl font-black text-white">Subscription</h3>
                <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-wider text-slate-500">Current plan</p>
                  <p className="mt-1 text-lg font-bold capitalize text-white">{account.plan || 'Free account'}</p>
                  <p className="mt-4 text-xs uppercase tracking-wider text-slate-500">Subscription status</p>
                  <p className={`mt-1 font-semibold capitalize ${subscriptionActive ? 'text-emerald-300' : 'text-slate-200'}`}>{status.replaceAll('_', ' ')}</p>
                </div>
                <div className="mt-4">
                  <p className="text-xs uppercase tracking-wider text-slate-500">Paid-through / entitlement date</p>
                  <p className="mt-1 text-sm font-semibold text-white">{formatDate(account.entitlementEndsAt)}</p>
                </div>
                {account.updatedAt && <p className="mt-3 text-xs text-slate-500">Billing record updated {formatDate(account.updatedAt)}</p>}
                {cancellationAvailable && (
                  <button type="button" disabled={busy} onClick={handleCancelSubscription}
                    className="mt-5 w-full rounded-xl border border-amber-400/40 bg-amber-400/5 px-4 py-3 text-sm font-semibold text-amber-200 transition hover:bg-amber-400/10 disabled:opacity-50">
                    {busy
                      ? 'Processing…'
                      : subscriptionActive
                        ? 'Cancel subscription'
                        : 'Retry cancellation / billing review'}
                  </button>
                )}
                {!subscriptionActive && <p className="mt-4 text-xs leading-5 text-slate-500">Premium workspace access is controlled separately by verified subscription status.</p>}
              </section>

              <section className="rounded-2xl border border-red-500/20 bg-red-950/10 p-5 sm:p-6">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-300">Account control</p>
                <h3 className="mt-2 font-bold text-white">Danger zone</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">Permanently delete your account. If billing is active or the paid-through date cannot be verified, the server will retain the account for review.</p>
                <button type="button" disabled={busy} onClick={handleDeleteAccount}
                  className="mt-4 w-full rounded-xl border border-red-500/40 px-4 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-500/10 disabled:opacity-50">
                  {busy ? 'Processing…' : 'Delete my account'}
                </button>
              </section>
            </aside>
          </div>
        )}

        {!loading && !account && (
          <div className="p-6">
            <p className="text-sm text-slate-400">Account information is not currently available.</p>
            <button type="button" onClick={loadAccount} className="mt-3 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800">Try again</button>
          </div>
        )}

        {error && <div role="alert" className="mx-5 mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 sm:mx-7">{error}</div>}
        {message && <div role="status" className="mx-5 mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 sm:mx-7">{message}</div>}
      </div>
    </section>
  );
}

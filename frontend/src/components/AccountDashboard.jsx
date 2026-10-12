import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

export default function AccountDashboard({ accessToken }) {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadAccount = useCallback(async () => {
    if (!accessToken) {
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
    } catch (err) {
      setError(err.message || 'Unable to load account details.');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

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
        // Remove the current browser session after the server confirms deletion.
        await supabase.auth.signOut();
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

    if (confirmed) await performAccountAction('cancel-subscription');
  }

  async function handleDeleteAccount() {
    const confirmation = window.prompt(
      'This permanently deletes your OmniScale account. Type DELETE to confirm.'
    );

    if (confirmation !== 'DELETE') {
      if (confirmation !== null) setError('Account deletion was not confirmed.');
      return;
    }

    await performAccountAction('delete');
  }

  const status = account?.status || 'unknown';

  return (
    <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6 text-left">
      <h3 className="text-xl font-bold text-white">Account dashboard</h3>
      <p className="mt-2 text-sm text-slate-400">
        Review your account and manage your subscription.
      </p>

      {loading && <p className="mt-4 text-slate-400">Loading account details…</p>}

      {!loading && account && (
        <div className="mt-5 space-y-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Email</p>
            <p className="mt-1 break-all text-white">{account.email}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Plan</p>
              <p className="mt-1 font-semibold capitalize text-white">
                {account.plan || 'No plan'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
              <p className="mt-1 font-semibold capitalize text-white">
                {status.replaceAll('_', ' ')}
              </p>
            </div>
          </div>

          {account.updatedAt && (
            <p className="text-xs text-slate-500">
              Account status last updated: {new Date(account.updatedAt).toLocaleString()}
            </p>
          )}

          {status === 'active' && (
            <button
              type="button"
              disabled={busy}
              onClick={handleCancelSubscription}
              className="w-full rounded-xl border border-amber-500/50 px-4 py-3 font-semibold text-amber-300 hover:bg-amber-500/10 disabled:opacity-50"
            >
              {busy ? 'Processing…' : 'Cancel subscription'}
            </button>
          )}

          <div className="border-t border-slate-800 pt-4">
            <h4 className="font-semibold text-red-300">Danger zone</h4>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              Permanently delete your account. If your subscription is active, the app
              will attempt to cancel it first. This action cannot be undone.
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

      {error && <p role="alert" className="mt-4 text-sm text-red-400">{error}</p>}
      {message && <p role="status" className="mt-4 text-sm text-emerald-400">{message}</p>}
    </section>
  );
}

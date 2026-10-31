const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { supabaseAdmin, getUserProfile, updateUserSubscription } = require('../database');

const router = express.Router();

const PAYPAL_ENV = process.env.PAYPAL_ENV || 'sandbox';
const PAYPAL_BASE_URL =
  PAYPAL_ENV === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

function validEntitlementEnd(profile) {
  const value = profile?.entitlement_ends_at;
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

async function paypalRequest(path, options = {}) {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET;

  if (!clientId || !secret) {
    throw new Error('PayPal is not configured on the server.');
  }

  const tokenResponse = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!tokenResponse.ok) {
    throw new Error('Could not authenticate with PayPal.');
  }

  const { access_token: token } = await tokenResponse.json();

  const response = await fetch(`${PAYPAL_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const body = await response.text();
    console.error('PayPal account operation failed:', response.status, body);
    throw new Error('PayPal could not complete the subscription operation.');
  }

  if (response.status === 204) return null;
  return response.json();
}

async function cancelActiveSubscription(profile, userId) {
  if (!profile) return { providerStatus: 'none', entitlementEndsAt: null, requiresReview: false };

  const profileStatus = String(profile.status || '').toLowerCase();
  const subscriptionId = profile.subscription_id;

  if (!subscriptionId) {
    if (profileStatus === 'active') {
      throw new Error('The active account has no stored PayPal subscription ID. Contact support before deleting this account.');
    }
    return {
      providerStatus: 'not_linked',
      entitlementEndsAt: validEntitlementEnd(profile),
      requiresReview: profileStatus === 'cancelled' || profileStatus === 'canceled' ||
        profileStatus === 'cancelled_pending_review'
    };
  }

  const path = `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`;
  const subscription = await paypalRequest(path);

  // Do not accept missing ownership metadata: the user must match exactly.
  if (String(subscription.custom_id || '') !== String(userId)) {
    throw new Error('Subscription ownership could not be verified. The account was retained for review.');
  }

  let providerStatus = String(subscription.status || '').toUpperCase();

  if (providerStatus === 'ACTIVE') {
    await paypalRequest(`${path}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Requested by the account holder' })
    });

    // Re-fetch provider state rather than assuming the cancellation succeeded.
    const confirmation = await paypalRequest(path);
    providerStatus = String(confirmation.status || '').toUpperCase();
  }

  if (providerStatus !== 'CANCELLED') {
    throw new Error('PayPal has not confirmed a cancelled subscription. The account was retained for review.');
  }

  const entitlementEndsAt = validEntitlementEnd(profile);
  const now = Date.now();
  let localStatus;
  let requiresReview = false;

  if (!entitlementEndsAt) {
    // Do not invent a paid-through date or silently revoke existing access.
    localStatus = 'cancelled_pending_review';
    requiresReview = true;
  } else if (Date.parse(entitlementEndsAt) <= now) {
    localStatus = 'expired';
  } else {
    localStatus = 'cancelled';
  }

  const { error } = await updateUserSubscription(userId, {
    subscriptionId,
    plan: profile.plan_type,
    status: localStatus,
    ...(entitlementEndsAt ? { entitlementEndsAt } : {})
  });

  if (error) {
    console.error('PayPal cancellation confirmed, but local subscription update failed:', error.message);
    throw new Error('PayPal cancellation was confirmed, but the local account update failed. The account was retained; support must reconcile the billing record.');
  }

  return { providerStatus, entitlementEndsAt, requiresReview, localStatus };
}

router.get('/me', requireAuth, async (req, res) => {
  try {
    const profile = await getUserProfile(req.user.id);

    return res.json({
      success: true,
      account: {
        email: req.user.email || '',
        fullName: (
          typeof req.user.user_metadata?.full_name === 'string'
            ? req.user.user_metadata.full_name
            : typeof req.user.user_metadata?.name === 'string'
              ? req.user.user_metadata.name
              : ''
        ),
        emailConfirmed: Boolean(
          req.user.email_confirmed_at || req.user.confirmed_at
        ),
        emailConfirmedAt:
          req.user.email_confirmed_at || req.user.confirmed_at || null,
        createdAt: req.user.created_at || null,
        lastSignInAt: req.user.last_sign_in_at || null,
        plan: profile?.plan_type || null,
        status: profile?.status || 'no_subscription',
        updatedAt: profile?.updated_at || null,
        hasSubscription: Boolean(profile?.subscription_id),
        entitlementEndsAt: validEntitlementEnd(profile)
      }
    });
  } catch (error) {
    console.error('Account lookup failed:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Unable to load account information.'
    });
  }
});

router.post('/cancel-subscription', requireAuth, async (req, res) => {
  try {
    const profile = await getUserProfile(req.user.id);
    const status = String(profile?.status || '').toLowerCase();

    if (!profile || !['active', 'cancelled_pending_review'].includes(status)) {
      return res.status(409).json({
        success: false,
        error: 'There is no cancellable subscription on this account.'
      });
    }

    const result = await cancelActiveSubscription(profile, req.user.id);

    return res.json({
      success: true,
      cancellationConfirmed: result.providerStatus === 'CANCELLED',
      status: result.localStatus || profile.status,
      entitlementEndsAt: result.entitlementEndsAt,
      requiresReview: result.requiresReview,
      hasAccessPendingReview: result.requiresReview,
      message: result.requiresReview
        ? 'PayPal cancellation is confirmed. Your account is retained and access remains pending billing-date review.'
        : result.entitlementEndsAt && Date.parse(result.entitlementEndsAt) > Date.now()
          ? 'PayPal cancellation is confirmed. Access remains available until the recorded entitlement end date.'
          : 'PayPal cancellation is confirmed and the recorded entitlement has expired.'
    });
  } catch (error) {
    console.error('Subscription cancellation failed:', error.message);
    return res.status(502).json({
      success: false,
      cancellationConfirmed: false,
      error: error.message || 'Unable to confirm subscription cancellation. Contact support before retrying.'
    });
  }
});

router.post('/delete', requireAuth, async (req, res) => {
  try {
    const profile = await getUserProfile(req.user.id);
    let cancellationResult = null;

    if (
      profile &&
      (String(profile.status || '').toLowerCase() === 'active' ||
       String(profile.status || '').toLowerCase() === 'cancelled_pending_review' ||
       profile.subscription_id)
    ) {
      cancellationResult = await cancelActiveSubscription(profile, req.user.id);
    }

    const end = cancellationResult?.entitlementEndsAt || validEntitlementEnd(profile);
    const status = String(cancellationResult?.localStatus || profile?.status || '').toLowerCase();
    const stillOwedAccess = end && Date.parse(end) > Date.now();
    const unknownPaidThroughDate =
      status === 'active' || status === 'cancelled_pending_review' ||
      ((status === 'cancelled' || status === 'canceled') && !end) ||
      Boolean(cancellationResult?.requiresReview);

    if (stillOwedAccess || unknownPaidThroughDate) {
      return res.status(409).json({
        success: false,
        deletionBlocked: true,
        cancellationConfirmed: cancellationResult?.providerStatus === 'CANCELLED',
        entitlementEndsAt: end || null,
        requiresReview: unknownPaidThroughDate,
        error: stillOwedAccess
          ? 'Billing is cancelled, but paid access has not ended. The account is retained until the recorded entitlement end date.'
          : 'The paid-through date or billing state cannot be verified. The account is retained for support review.'
      });
    }

    const { error: deleteUserError } =
      await supabaseAdmin.auth.admin.deleteUser(req.user.id);

    if (deleteUserError) {
      console.error('Supabase account deletion failed:', deleteUserError.message);
      return res.status(500).json({
        success: false,
        error: 'The account could not be deleted. Billing may already be cancelled; contact support before retrying.'
      });
    }

    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .delete()
      .eq('user_id', req.user.id);

    if (profileError) {
      console.error('Profile cleanup after account deletion failed:', profileError.message);
    }

    return res.json({ success: true, message: 'Your account has been deleted.' });
  } catch (error) {
    console.error('Account deletion failed:', error.message);
    return res.status(502).json({
      success: false,
      error: error.message || 'Account deletion could not be completed.'
    });
  }
});

module.exports = router;

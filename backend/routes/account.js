const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { supabaseAdmin, getUserProfile, updateUserSubscription } = require('../database');

const router = express.Router();

const PAYPAL_ENV = process.env.PAYPAL_ENV || 'sandbox';
const PAYPAL_BASE_URL =
  PAYPAL_ENV === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

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
  if (profile?.status !== 'active') return;

  if (!profile.subscription_id) {
    throw new Error('An active subscription has no stored PayPal subscription ID. Contact support before deleting this account.');
  }

  const subscription = await paypalRequest(
    `/v1/billing/subscriptions/${encodeURIComponent(profile.subscription_id)}`
  );

  if (subscription.custom_id && subscription.custom_id !== userId) {
    throw new Error('The subscription ownership check failed.');
  }

  if (subscription.status === 'ACTIVE') {
    await paypalRequest(
      `/v1/billing/subscriptions/${encodeURIComponent(profile.subscription_id)}/cancel`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'Requested by the account holder' })
      }
    );
  }

  const { error } = await updateUserSubscription(userId, {
    subscriptionId: profile.subscription_id,
    plan: profile.plan_type,
    status: 'cancelled'
  });

  if (error) {
    throw new Error('PayPal cancellation was processed, but the account status could not be updated. Contact support.');
  }
}

router.get('/me', requireAuth, async (req, res) => {
  try {
    const profile = await getUserProfile(req.user.id);

    return res.json({
      success: true,
      account: {
        email: req.user.email || '',
        plan: profile?.plan_type || null,
        status: profile?.status || 'no_subscription',
        updatedAt: profile?.updated_at || null,
        hasSubscription: Boolean(profile?.subscription_id)
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

    if (!profile || profile.status !== 'active') {
      return res.status(409).json({
        success: false,
        error: 'There is no active subscription to cancel.'
      });
    }

    await cancelActiveSubscription(profile, req.user.id);

    return res.json({
      success: true,
      message: 'Subscription cancellation processed. Premium access has been disabled.'
    });
  } catch (error) {
    console.error('Subscription cancellation failed:', error.message);
    return res.status(502).json({
      success: false,
      error: error.message || 'Unable to cancel the subscription. Contact support before retrying.'
    });
  }
});

router.post('/delete', requireAuth, async (req, res) => {
  try {
    const profile = await getUserProfile(req.user.id);

    // Cancel billing before deleting the user. If PayPal fails, retain the account.
    await cancelActiveSubscription(profile, req.user.id);

    const { error: deleteUserError } =
      await supabaseAdmin.auth.admin.deleteUser(req.user.id);

    if (deleteUserError) {
      console.error('Supabase account deletion failed:', deleteUserError.message);
      return res.status(500).json({
        success: false,
        error: 'The account could not be deleted. Contact support if your subscription was already cancelled.'
      });
    }

    // Clean up the profile if it was not removed by a database cascade.
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .delete()
      .eq('user_id', req.user.id);

    if (profileError) {
      console.error('Profile cleanup after account deletion failed:', profileError.message);
    }

    return res.json({
      success: true,
      message: 'Your account has been deleted.'
    });
  } catch (error) {
    console.error('Account deletion failed:', error.message);
    return res.status(502).json({
      success: false,
      error: error.message || 'Account deletion could not be completed.'
    });
  }
});

module.exports = router;

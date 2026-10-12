const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { generateText } = require('../services/openaiService');
const { requireAuth } = require('../middleware/auth');
const { updateUserSubscription, getUserProfile } = require('../database');

const PAYPAL_ENV = process.env.PAYPAL_ENV || 'sandbox';
const PAYPAL_BASE_URL = PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET;
const PAYPAL_MONTHLY_PLAN_ID = process.env.PAYPAL_MONTHLY_PLAN_ID;
const PAYPAL_YEARLY_PLAN_ID = process.env.PAYPAL_YEARLY_PLAN_ID;
const PAYPAL_RETURN_URL = process.env.PAYPAL_RETURN_URL || 'https://omniscale-ai-saas.vercel.app/';
const PAYPAL_CANCEL_URL = process.env.PAYPAL_CANCEL_URL || 'https://omniscale-ai-saas.vercel.app/';

function requirePayPalConfig() {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET) {
    const error = new Error('PayPal credentials are missing.');
    error.status = 503;
    throw error;
  }
}

async function getPayPalAccessToken() {
  requirePayPalConfig();
  const credentials = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64');
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials'
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error('PayPal authentication failed.');
  return data.access_token;
}

async function paypalRequest(path, options = {}) {
  const token = await getPayPalAccessToken();
  const response = await fetch(`${PAYPAL_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) }
  });
  const data = await response.json();
  if (!response.ok) {
    const err = new Error(data?.message || 'PayPal API request failed.');
    err.status = response.status;
    throw err;
  }
  return data;
}

router.post('/create-subscription', requireAuth, async (req, res) => {
  try {
    const { userEmail, plan } = req.body;
    const normalizedPlan = String(plan || '').toLowerCase();
    let planId = normalizedPlan === 'monthly' ? PAYPAL_MONTHLY_PLAN_ID : (normalizedPlan === 'yearly' || normalizedPlan === 'annual' ? PAYPAL_YEARLY_PLAN_ID : null);

    if (!planId) return res.status(400).json({ success: false, error: 'Valid plan required: monthly or yearly.' });

    const subscription = await paypalRequest('/v1/billing/subscriptions', {
      method: 'POST',
      headers: { 'PayPal-Request-Id': crypto.randomUUID() },
      body: JSON.stringify({
        plan_id: planId,
        custom_id: req.user.id,
        application_context: {
          brand_name: 'OmniScale AI',
          user_action: 'SUBSCRIBE_NOW',
          shipping_preference: 'NO_SHIPPING',
          return_url: PAYPAL_RETURN_URL,
          cancel_url: PAYPAL_CANCEL_URL
        }
      })
    });

    const approvalUrl = subscription.links?.find(l => l.rel === 'approve')?.href;
    if (!approvalUrl) return res.status(502).json({ success: false, error: 'No approval URL from PayPal.' });

    res.json({ success: true, subscriptionId: subscription.id, plan: normalizedPlan, approvalUrl });
  } catch (err) {
    console.error('Create subscription error:', err);
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

router.post('/verify-subscription', requireAuth, async (req, res) => {
  try {
    const { subscriptionId } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({
        success: false,
        error: 'Subscription ID is required.'
      });
    }

    const subscription = await paypalRequest(
      `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`,
      { method: 'GET' }
    );

    if (String(subscription.custom_id || '') !== String(req.user.id)) {
      return res.status(403).json({
        success: false,
        error: 'This PayPal subscription does not belong to the authenticated user.'
      });
    }

    const status = String(subscription.status || '').toUpperCase();
    if (status !== 'ACTIVE') {
      return res.status(402).json({
        success: false,
        error: 'PayPal subscription is not active.',
        status
      });
    }

    const planId = subscription.plan_id;
    if (planId !== PAYPAL_MONTHLY_PLAN_ID && planId !== PAYPAL_YEARLY_PLAN_ID) {
      return res.status(402).json({
        success: false,
        error: 'Unrecognized PayPal subscription plan.'
      });
    }

    const plan = planId === PAYPAL_MONTHLY_PLAN_ID ? 'monthly' : 'yearly';
    const { error: updateError } = await updateUserSubscription(req.user.id, {
      subscriptionId,
      plan,
      status: 'active'
    });

    if (updateError) {
      console.error('Subscription database update failed:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Payment was verified, but subscription access could not be saved. Please contact support.'
      });
    }

    return res.json({
      success: true,
      subscriptionId,
      plan,
      status: 'active',
      message: 'Subscription verified and access updated.'
    });
  } catch (err) {
    console.error('Verify subscription error:', err);
    return res.status(err.status || 500).json({
      success: false,
      error: err.message || 'PayPal subscription verification failed.'
    });
  }
});

router.post('/build-platform', requireAuth, async (req, res) => {
  try {
    const profile = await getUserProfile(req.user.id);
    if (!profile || profile.status !== 'active') {
      return res.status(403).json({ success: false, error: 'Active subscription required to access Platform Builder.' });
    }

    const { platformPrompt } = req.body;
    if (!platformPrompt || !platformPrompt.trim()) {
      return res.status(400).json({ success: false, error: 'Platform prompt is required.' });
    }

    const result = await generateText({
      instructions: 'You are OmniScale AI software architecture assistant. Create full platform technical specifications.',
      input: platformPrompt.trim()
    });

    res.json({ success: true, result, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Platform generation error:', err);
    res.status(500).json({ success: false, error: 'Platform generation failed.' });
  }
});

module.exports = router;

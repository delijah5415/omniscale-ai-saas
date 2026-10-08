const express = require('express');
const crypto = require('crypto');
const { generateText } = require('../services/openaiService');

const router = express.Router();

const PAYPAL_ENV = process.env.PAYPAL_ENV || 'sandbox';
const PAYPAL_BASE_URL =
  PAYPAL_ENV === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET;

const PAYPAL_MONTHLY_PLAN_ID = process.env.PAYPAL_MONTHLY_PLAN_ID;

const PAYPAL_YEARLY_PLAN_ID = process.env.PAYPAL_YEARLY_PLAN_ID;

const PAYPAL_RETURN_URL =
  process.env.PAYPAL_RETURN_URL ||
  'https://omniscale-ai-saas.vercel.app/';

const PAYPAL_CANCEL_URL =
  process.env.PAYPAL_CANCEL_URL ||
  'https://omniscale-ai-saas.vercel.app/';

const OMNISCALE_ACCESS_TOKEN_SECRET =
  process.env.OMNISCALE_ACCESS_TOKEN_SECRET;

function requireAccessTokenSecret() {
  if (!OMNISCALE_ACCESS_TOKEN_SECRET) {
    const error = new Error(
      'OmniScale access token security is not configured. Set OMNISCALE_ACCESS_TOKEN_SECRET.'
    );
    error.status = 503;
    throw error;
  }
}

function createSignedAccessToken(subscriptionId) {
  requireAccessTokenSecret();

  const timestamp = Date.now().toString();

  const encodedSubscriptionId = Buffer
    .from(subscriptionId, 'utf8')
    .toString('base64url');

  const payload = encodedSubscriptionId + '.' + timestamp;

  const signature = crypto
    .createHmac('sha256', OMNISCALE_ACCESS_TOKEN_SECRET)
    .update(payload)
    .digest('hex');

  return encodedSubscriptionId + '.' + timestamp + '.' + signature;
}

function parseSignedAccessToken(accessToken) {
  if (
    !accessToken ||
    typeof accessToken !== 'string' ||
    !OMNISCALE_ACCESS_TOKEN_SECRET
  ) {
    return null;
  }

  const parts = accessToken.split('.');

  if (parts.length !== 3) {
    return null;
  }

  const [encodedSubscriptionId, timestamp, signature] = parts;

  if (
    !encodedSubscriptionId ||
    !/^\d+$/.test(timestamp) ||
    !/^[a-f0-9]{64}$/.test(signature)
  ) {
    return null;
  }

  const age = Date.now() - Number(timestamp);

  if (
    !Number.isFinite(age) ||
    age < 0 ||
    age > 30 * 24 * 60 * 60 * 1000
  ) {
    return null;
  }

  const payload = encodedSubscriptionId + '.' + timestamp;

  const expectedSignature = crypto
    .createHmac('sha256', OMNISCALE_ACCESS_TOKEN_SECRET)
    .update(payload)
    .digest('hex');

  if (
    !crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    )
  ) {
    return null;
  }

  let subscriptionId;

  try {
    subscriptionId = Buffer
      .from(encodedSubscriptionId, 'base64url')
      .toString('utf8');
  } catch {
    return null;
  }

  if (!subscriptionId || subscriptionId.length > 255) {
    return null;
  }

  return {
    subscriptionId,
    timestamp
  };
}

function requirePayPalConfig() {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET) {
    const error = new Error(
      'PayPal is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_SECRET.'
    );
    error.status = 503;
    throw error;
  }
}

async function getPayPalAccessToken() {
  requirePayPalConfig();

  const credentials = Buffer
    .from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`)
    .toString('base64');

  const response = await fetch(
    `${PAYPAL_BASE_URL}/v1/oauth2/token`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    }
  );

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    console.error('PayPal OAuth error:', data);
    throw new Error('Unable to authenticate with PayPal.');
  }

  return data.access_token;
}

async function paypalRequest(path, options = {}) {
  const accessToken = await getPayPalAccessToken();

  const response = await fetch(`${PAYPAL_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {})
    }
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('PayPal API error:', {
      status: response.status,
      data
    });

    const error = new Error(
      data?.message || 'PayPal API request failed.'
    );
    error.status = response.status;
    throw error;
  }

  return data;
}

// Create a PayPal subscription for the selected OmniScale plan.
router.post('/create-subscription', async (req, res) => {
  try {
    const { userEmail, plan } = req.body;

    if (!userEmail || typeof userEmail !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'A valid email address is required.'
      });
    }

    const normalizedPlan = String(plan || '').toLowerCase();

    let planId;

    if (normalizedPlan === 'monthly') {
      planId = PAYPAL_MONTHLY_PLAN_ID;
    } else if (normalizedPlan === 'yearly' || normalizedPlan === 'annual') {
      planId = PAYPAL_YEARLY_PLAN_ID;
    } else {
      return res.status(400).json({
        success: false,
        error: 'A valid subscription plan is required: monthly or yearly.'
      });
    }

    const subscription = await paypalRequest('/v1/billing/subscriptions', {
      method: 'POST',
      headers: {
        'PayPal-Request-Id': crypto.randomUUID()
      },
      body: JSON.stringify({
        plan_id: planId,
        custom_id: userEmail.trim().slice(0, 127),
        application_context: {
          brand_name: 'OmniScale AI',
          user_action: 'SUBSCRIBE_NOW',
          shipping_preference: 'NO_SHIPPING',
          return_url: PAYPAL_RETURN_URL,
          cancel_url: PAYPAL_CANCEL_URL
        }
      })
    });

    const approvalUrl = subscription.links?.find(
      (link) => link.rel === 'approve'
    )?.href;

    if (!approvalUrl) {
      return res.status(502).json({
        success: false,
        error: 'PayPal did not return a subscription approval URL.'
      });
    }

    return res.json({
      success: true,
      subscriptionId: subscription.id,
      plan: normalizedPlan,
      approvalUrl
    });
  } catch (error) {
    console.error('Create PayPal subscription error:', error);

    return res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Unable to create PayPal subscription.'
    });
  }
});

// Verify a PayPal subscription after the customer returns from PayPal.
router.post('/verify-subscription', async (req, res) => {
  try {
    const { subscriptionId } = req.body;

    if (!subscriptionId || typeof subscriptionId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'PayPal subscription ID is required.'
      });
    }

    const subscription = await paypalRequest(
      `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`,
      { method: 'GET' }
    );

    const status = String(subscription.status || '').toUpperCase();

    if (status !== 'ACTIVE') {
      return res.status(402).json({
        success: false,
        error: 'The PayPal subscription is not active.',
        status
      });
    }

    const planId = subscription.plan_id;

    const validPlan =
      planId === PAYPAL_MONTHLY_PLAN_ID ||
      planId === PAYPAL_YEARLY_PLAN_ID;

    if (!validPlan) {
      return res.status(402).json({
        success: false,
        error: 'The PayPal subscription plan could not be verified.'
      });
    }

    const accessToken = createSignedAccessToken(subscriptionId);

    return res.json({
      success: true,
      accessToken,
      subscriptionId,
      plan: planId === PAYPAL_MONTHLY_PLAN_ID ? 'monthly' : 'yearly',
      status,
      message: 'Subscription verified and access granted.'
    });
  } catch (error) {
    console.error('Verify PayPal subscription error:', error);

    return res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Unable to verify PayPal subscription.'
    });
  }
});

// Check whether a PayPal subscription is still active.
router.post('/check-subscription', async (req, res) => {
  try {
    const { subscriptionId } = req.body;

    if (!subscriptionId || typeof subscriptionId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'PayPal subscription ID is required.'
      });
    }

    const subscription = await paypalRequest(
      `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`,
      { method: 'GET' }
    );

    const status = String(subscription.status || '').toUpperCase();

    return res.json({
      success: true,
      subscriptionId,
      status,
      active: status === 'ACTIVE'
    });
  } catch (error) {
    console.error('Check PayPal subscription error:', error);

    return res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Unable to check PayPal subscription.'
    });
  }
});

// OpenAI-powered platform architecture generator.
router.post('/build-platform', async (req, res) => {
  try {
    const { accessToken, platformPrompt } = req.body;

    const tokenData = parseSignedAccessToken(accessToken);

    if (!tokenData) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized. Please complete an active PayPal subscription first.'
      });
    }

    const subscription = await paypalRequest(
      '/v1/billing/subscriptions/' + encodeURIComponent(tokenData.subscriptionId),
      { method: 'GET' }
    );

    const subscriptionStatus =
      String(subscription.status || '').toUpperCase();

    const subscriptionPlanId = subscription.plan_id;

    const validSubscription =
      subscriptionStatus === 'ACTIVE' &&
      (
        subscriptionPlanId === PAYPAL_MONTHLY_PLAN_ID ||
        subscriptionPlanId === PAYPAL_YEARLY_PLAN_ID
      );

    if (!validSubscription) {
      return res.status(401).json({
        success: false,
        error: 'Your OmniScale PayPal subscription is not active.',
        status: subscriptionStatus
      });
    }

    if (
      !platformPrompt ||
      typeof platformPrompt !== 'string' ||
      !platformPrompt.trim()
    ) {
      return res.status(400).json({
        success: false,
        error: 'Platform prompt is required.'
      });
    }

    const result = await generateText({
      instructions: `
You are OmniScale AI's software architecture assistant.

Create a detailed implementation specification for the user's requested
software platform.

Include:
1. Product overview
2. Core user journeys
3. Frontend architecture
4. Backend/API architecture
5. Database schema
6. Authentication and authorization
7. Security controls
8. Payment considerations
9. Deployment architecture
10. Testing strategy
11. Recommended project structure
12. Implementation phases

Do not claim that software has actually been deployed, compiled, tested,
or connected to external services unless that action was actually performed.
Do not invent credentials, API keys, URLs, customers, transactions, or
production infrastructure.
      `.trim(),
      input: platformPrompt.trim()
    });

    res.json({
      success: true,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Platform generation error:', error);

    res.status(500).json({
      success: false,
      error: 'The platform architecture service could not complete the request.'
    });
  }
});

module.exports = router;

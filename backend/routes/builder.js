const express = require('express');
const crypto = require('crypto');
const { generateText } = require('../services/openaiService');

const router = express.Router();

const activeSubscribers = new Map();

const PAYPAL_ENV = process.env.PAYPAL_ENV || 'sandbox';
const PAYPAL_BASE_URL =
  PAYPAL_ENV === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET;
const PAYPAL_CURRENCY = process.env.PAYPAL_CURRENCY || 'USD';
const PAYPAL_PRICE = process.env.PAYPAL_PRICE || '49.00';

function createAccessToken() {
  return `omni_${crypto.randomBytes(32).toString('hex')}`;
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

// Create a real PayPal order.
router.post('/create-order', async (req, res) => {
  try {
    const { userEmail } = req.body;

    if (!userEmail || typeof userEmail !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'A valid email address is required.'
      });
    }

    const order = await paypalRequest('/v2/checkout/orders', {
      method: 'POST',
      headers: {
        'PayPal-Request-Id': crypto.randomUUID()
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: 'omniscale-all-access',
            description: 'OmniScale AI All-Access License',
            custom_id: userEmail.trim(),
            amount: {
              currency_code: PAYPAL_CURRENCY,
              value: PAYPAL_PRICE
            }
          }
        ],
        application_context: {
          brand_name: 'OmniScale AI',
          user_action: 'PAY_NOW',
          return_url: process.env.PAYPAL_RETURN_URL,
          cancel_url: process.env.PAYPAL_CANCEL_URL
        }
      })
    });

    const approvalUrl = order.links?.find(
      (link) => link.rel === 'approve'
    )?.href;

    if (!approvalUrl) {
      return res.status(502).json({
        success: false,
        error: 'PayPal did not return an approval URL.'
      });
    }

    res.json({
      success: true,
      orderId: order.id,
      approvalUrl
    });
  } catch (error) {
    console.error('Create PayPal order error:', error);

    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Unable to create PayPal order.'
    });
  }
});

// Capture and verify a real PayPal order.
router.post('/capture-order', async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'PayPal order ID is required.'
      });
    }

    const capture = await paypalRequest(
      `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
      {
        method: 'POST',
        headers: {
          'PayPal-Request-Id': crypto.randomUUID()
        },
        body: JSON.stringify({})
      }
    );

    if (capture.status !== 'COMPLETED') {
      return res.status(402).json({
        success: false,
        error: 'PayPal payment was not completed.',
        status: capture.status
      });
    }

    const purchaseUnit = capture.purchase_units?.[0];
    const capturedPayment =
      purchaseUnit?.payments?.captures?.[0];

    const capturedAmount =
      capturedPayment?.amount?.value;

    const capturedCurrency =
      capturedPayment?.amount?.currency_code;

    if (
      capturedAmount !== PAYPAL_PRICE ||
      capturedCurrency !== PAYPAL_CURRENCY
    ) {
      console.error('PayPal amount mismatch:', {
        expectedAmount: PAYPAL_PRICE,
        expectedCurrency: PAYPAL_CURRENCY,
        capturedAmount,
        capturedCurrency,
        orderId
      });

      return res.status(402).json({
        success: false,
        error: 'Payment amount or currency could not be verified.'
      });
    }

    const accessToken = createAccessToken();

    activeSubscribers.set(accessToken, {
      orderId,
      createdAt: Date.now(),
      email: purchaseUnit.custom_id || null
    });

    res.json({
      success: true,
      accessToken,
      orderId,
      message: 'Payment verified and access granted.'
    });
  } catch (error) {
    console.error('Capture PayPal order error:', error);

    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Unable to capture PayPal order.'
    });
  }
});

// OpenAI-powered platform architecture generator.
router.post('/build-platform', async (req, res) => {
  try {
    const { accessToken, platformPrompt } = req.body;

    if (!accessToken || !activeSubscribers.has(accessToken)) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized. Please complete PayPal payment first.'
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

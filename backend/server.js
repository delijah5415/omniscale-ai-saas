const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || true,
  credentials: true
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Helper function to request PayPal OAuth2 Access Token
async function getPayPalAccessToken() {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error('PayPal client credentials are not configured.');
  }

  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    body: 'grant_type=client_credentials',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || 'Failed to authenticate with PayPal.');
  }
  return data.access_token;
}

// 1. Create Order Route (Replaces simulated checkout with live PayPal API)
app.post('/api/builder/create-order', async (req, res) => {
  try {
    const { userEmail } = req.body;
    if (!userEmail || !userEmail.trim()) {
      return res.status(400).json({ success: false, error: 'Email address is required.' });
    }

    const accessToken = await getPayPalAccessToken();

    const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: 'USD',
              value: '49.00',
            },
            description: 'OmniScale AI Platform - One-Time All-Access License',
          },
        ],
        application_context: {
          return_url: `${process.env.CLIENT_ORIGIN || 'http://localhost:3000'}/?status=success`,
          cancel_url: `${process.env.CLIENT_ORIGIN || 'http://localhost:3000'}/?status=cancel`,
          user_action: 'PAY_NOW',
        },
      }),
    });

    const orderData = await response.json();
    if (!response.ok) {
      throw new Error(orderData.message || 'Failed to create PayPal order.');
    }

    const approvalUrl = orderData.links?.find((link) => link.rel === 'approve')?.href;
    if (!approvalUrl) {
      throw new Error('PayPal did not return an approval URL.');
    }

    res.json({ success: true, approvalUrl });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Unable to initiate PayPal checkout.'
    });
  }
});

// 2. Capture Order Route (Verifies payment server-side and returns a signed access token)
app.post('/api/builder/capture-order', async (req, res) => {
  try {
    const { orderId, userEmail } = req.body;
    if (!orderId) {
      return res.status(400).json({ success: false, error: 'Missing PayPal order ID.' });
    }

    const paypalToken = await getPayPalAccessToken();

    const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paypalToken}`,
        'Content-Type': 'application/json',
      },
    });

    const captureData = await response.json();

    if (!response.ok || captureData.status !== 'COMPLETED') {
      throw new Error('PayPal payment could not be captured or completed.');
    }

    // Verify paid amount matches the required license price ($49.00)
    const amountPaid = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value;
    if (amountPaid !== '49.00') {
      throw new Error('Payment amount mismatch.');
    }

    // Issue JWT signed access token valid for 30 days
    const accessToken = jwt.sign(
      {
        email: userEmail,
        orderId: captureData.id,
        paid: true
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      accessToken
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message || 'PayPal payment verification failed.'
    });
  }
});

const aiRoutes = require('./routes/ai');
const builderRoutes = require('./routes/builder');

app.use('/api/ai', aiRoutes);
app.use('/api/builder', builderRoutes);

app.get('/', (req, res) => {
  res.json({
    success: true,
    status: 'OmniScale AI Micro-SaaS API is running',
    service: 'OmniScale AI SaaS API',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    service: 'omniscale-api',
    timestamp: new Date().toISOString()
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'API route not found',
    path: req.path
  });
});

app.use((err, req, res, next) => {
  console.error('Unhandled API error:', err);

  res.status(err.status || 500).json({
    success: false,
    error: 'Internal server error'
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`OmniScale API running on port ${PORT}`);
  });
}

module.exports = app;  

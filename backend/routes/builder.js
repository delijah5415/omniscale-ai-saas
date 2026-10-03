const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const { generateText, model } = require('../services/openaiService');

// Temporary in-memory entitlement store.
// Replace with a persistent database before scaling to multiple server instances.
const activeSubscribers = new Map();

function createAccessToken() {
  return `omni_${crypto.randomBytes(32).toString('hex')}`;
}

// This endpoint is retained for development/testing.
// Production payment verification must be connected to PayPal's capture API.
router.post('/verify-payment', (req, res) => {
  const { paypalOrderId, userEmail } = req.body;

  if (!paypalOrderId) {
    return res.status(400).json({
      success: false,
      error: 'PayPal order ID is required.'
    });
  }

  const accessToken = createAccessToken();

  activeSubscribers.set(accessToken, {
    paypalOrderId,
    userEmail: userEmail || null,
    createdAt: new Date().toISOString()
  });

  res.json({
    success: true,
    accessToken,
    message: 'Development entitlement created.'
  });
});

router.post('/build-platform', async (req, res) => {
  try {
    const { accessToken, platformPrompt } = req.body;

    if (!accessToken || !activeSubscribers.has(accessToken)) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized. Complete payment before using the platform builder.'
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

    const instructions = `
You are OmniScale AI's No-Code Platform Architect.

The user describes a software platform they want to build.

Analyze the requirements and produce a detailed implementation-ready architecture.

Return:

1. Platform summary
2. User roles
3. Core features
4. Frontend architecture
5. Backend architecture
6. API endpoints
7. Database schema
8. Authentication and authorization
9. Payment architecture if required
10. Security controls
11. Recommended technology stack
12. Deployment architecture
13. Environment variables required
14. Development phases
15. Testing strategy
16. Production-readiness checklist

Do not falsely claim that source code has already been written, deployed, or published.
The result is an architecture and implementation specification unless actual deployment tools are explicitly connected.
`;

    const input = `
Build an implementation specification for this platform:

${platformPrompt.trim()}
`;

    const result = await generateText({
      instructions,
      input
    });

    res.json({
      success: true,
      result,
      model,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Platform builder error:', error);

    res.status(500).json({
      success: false,
      error: 'The platform architecture could not be generated.',
      detail:
        process.env.NODE_ENV === 'production'
          ? undefined
          : error.message
    });
  }
});

module.exports = router;

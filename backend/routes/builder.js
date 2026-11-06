const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { generateText } = require('../services/openaiService');
const { requireAuth } = require('../middleware/auth');
const { updateUserSubscription, getUserProfile } = require('../database');
const { getSubscriptionEntitlement } = require('../subscriptionEntitlement');

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

router.get('/subscription-status', requireAuth, async (req, res) => {
  try {
    const profile = await getUserProfile(req.user.id);
    const entitlement = getSubscriptionEntitlement(profile);
    const status = entitlement.status;

    return res.json({
      success: true,
      active: entitlement.hasAccess,
      hasAccess: entitlement.hasAccess,
      entitlementEndsAt: entitlement.entitlementEndsAt,
      requiresReview: entitlement.requiresReview,
      status,
      plan: profile?.plan_type || null,
      hasSubscription: Boolean(profile?.subscription_id),
      updatedAt: profile?.updated_at || null
    });
  } catch (error) {
    console.error('Subscription status lookup failed:', error.message);

    return res.status(503).json({
      success: false,
      error: 'Subscription status is temporarily unavailable. Please retry.'
    });
  }
});

router.post('/build-platform', requireAuth, async (req, res) => {
  const stages = [];
  const addStage = (name, status, detail) => {
    stages.push({ name, status, detail, timestamp: new Date().toISOString() });
  };
  const routeError = (statusCode, message) =>
    Object.assign(new Error(message), { statusCode });

  try {
    const platformPrompt = req.body?.platformPrompt;
    const preferences = req.body?.preferences ?? {};

    if (typeof platformPrompt !== 'string' || !platformPrompt.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Platform prompt is required.'
      });
    }

    if (platformPrompt.length > 12000) {
      return res.status(400).json({
        success: false,
        error: 'Platform prompt must not exceed 12,000 characters.'
      });
    }

    if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) {
      return res.status(400).json({
        success: false,
        error: 'Preferences must be a valid object.'
      });
    }

    addStage('Request validation', 'completed', 'Project request validated.');

    const profile = await getUserProfile(req.user.id);

    if (!getSubscriptionEntitlement(profile).hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Active subscription required to access Platform Builder.'
      });
    }

    addStage('Access verification', 'completed', 'Subscription entitlement verified.');

    const preferenceLimits = {
      framework: 80,
      language: 40,
      styling: 80,
      database: 80,
      authentication: 80,
      additionalFeatures: 2000
    };

    const defaults = {
      framework: 'React + Vite',
      language: 'JavaScript',
      styling: 'Tailwind CSS',
      database: 'Supabase',
      authentication: 'Supabase Auth',
      additionalFeatures: ''
    };

    const safePreferences = {};

    for (const [key, limit] of Object.entries(preferenceLimits)) {
      const value = preferences[key];

      if (value !== undefined && typeof value !== 'string') {
        throw routeError(400, 'Preference "' + key + '" must be text.');
      }

      const normalized = value === undefined ? defaults[key] : value.trim();

      if (normalized.length > limit) {
        throw routeError(400, 'Preference "' + key + '" exceeds its character limit.');
      }

      safePreferences[key] = normalized || defaults[key];
    }

    addStage('AI generation', 'running', 'Request submitted to the configured AI model.');

    let raw;

    try {
      raw = await generateText({
        instructions: [
          'You are OmniScale AI, a senior full-stack software engineer.',
          'Generate a practical starter application, not merely a technical essay.',
          'Return ONLY valid JSON without Markdown fences.',
          'Required shape: {"projectName":"...","summary":"...","architecture":"...","files":[{"path":"relative/path","content":"complete file contents"}],"previewHtml":"standalone HTML preview","buildCommands":["command"]}.',
          'Generate 5 to 15 useful, coherent application files, including framework entry files. Do not generate root README.md, preview.html, or omniscale-project-manifest.json because the ZIP exporter creates those files.',
          'Match all selected preferences. Never include real credentials, secrets, or private keys.',
          'Use placeholders in .env.example only.',
          'Preview HTML must be self-contained and must not load external scripts.',
          'Never claim the project has been compiled, tested, or deployed.',
          'Build commands are suggestions only and must never be executed by this server.'
        ].join(' '),
        input: JSON.stringify({
          request: platformPrompt.trim(),
          preferences: safePreferences
        })
      });
    } catch (error) {
      console.error('Platform AI generation request failed:', {
        name: error?.name,
        status: error?.status,
        code: error?.code
      });

      throw routeError(502, 'The AI generation service is temporarily unavailable. Please retry.');
    }

    if (typeof raw !== 'string' || !raw.trim() || raw.length > 750000) {
      throw routeError(502, 'AI returned an empty or oversized project response. Please retry.');
    }

    addStage('AI generation', 'completed', 'AI response received.');

    let project;

    try {
      let cleaned = raw.trim();
      const fence = String.fromCharCode(96).repeat(3);

      if (cleaned.startsWith(fence)) {
        cleaned = cleaned.split('\n').slice(1).join('\n');

        if (cleaned.trimEnd().endsWith(fence)) {
          cleaned = cleaned.trimEnd().slice(0, -fence.length);
        }
      }

      project = JSON.parse(cleaned.trim());
    } catch {
      throw routeError(502, 'AI returned an invalid project manifest. Please retry generation.');
    }

    if (!project || typeof project !== 'object' || Array.isArray(project)) {
      throw routeError(502, 'AI returned an invalid project manifest.');
    }

    if (!Array.isArray(project.files) ||
        project.files.length < 1 ||
        project.files.length > 30) {
      throw routeError(502, 'AI project manifest is incomplete or exceeds the file limit.');
    }

    if (project.projectName !== undefined &&
        typeof project.projectName !== 'string') {
      throw routeError(502, 'AI returned an invalid project name.');
    }

    if (project.summary !== undefined &&
        typeof project.summary !== 'string') {
      throw routeError(502, 'AI returned an invalid project summary.');
    }

    const forbiddenNames = new Set([
      '.env', '.git', 'node_modules', '.vercel', '.ssh'
    ]);

    const isProtectedEnvFile = (name) => {
      const lowerName = name.toLowerCase();
      return lowerName === '.env' ||
        (lowerName.startsWith('.env.') && lowerName !== '.env.example');
    };

    const reservedWindowsName =
      /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/i;

    const invalidPathCharacters = /[<>:"|?*\x00-\x1f]/;

    const reservedRootFiles = new Set([
      'preview.html',
      'readme.md',
      'omniscale-project-manifest.json'
    ]);

    let totalBytes = 0;
    const seenPaths = new Set();

    const files = project.files.map((item) => {
      if (!item || typeof item.path !== 'string' ||
          typeof item.content !== 'string') {
        throw routeError(502, 'A generated project file has an invalid format.');
      }

      const filePath = item.path;
      const segments = filePath.split('/');

      if (!filePath || filePath.length > 180 ||
          filePath !== filePath.trim() ||
          filePath.startsWith('/') ||
          filePath.includes('\\') ||
          segments.some((part) =>
            !part ||
            part === '.' ||
            part === '..' ||
            part !== part.trim() ||
            /[. ]$/.test(part) ||
            invalidPathCharacters.test(part) ||
            forbiddenNames.has(part.toLowerCase()) ||
            isProtectedEnvFile(part) ||
            reservedWindowsName.test(part)
          )) {
        throw routeError(502, 'A generated project file contains an unsafe path.');
      }

      if (segments.length === 1 &&
          reservedRootFiles.has(filePath.toLowerCase())) {
        throw routeError(502, 'A generated project file uses a reserved ZIP filename.');
      }

      const normalizedPath = filePath.toLowerCase();

      if (seenPaths.has(normalizedPath)) {
        throw routeError(502, 'Generated project contains duplicate file paths.');
      }

      if ([...seenPaths].some((existingPath) =>
        existingPath.startsWith(normalizedPath + '/') ||
        normalizedPath.startsWith(existingPath + '/')
      )) {
        throw routeError(502, 'Generated project contains conflicting file and directory paths.');
      }

      seenPaths.add(normalizedPath);

      const bytes = Buffer.byteLength(item.content, 'utf8');

      if (bytes > 80000) {
        throw routeError(502, 'A generated project file exceeds 80 KB.');
      }

      totalBytes += bytes;

      if (totalBytes > 500000) {
        throw routeError(502, 'Generated project exceeds 500 KB.');
      }

      return { path: filePath, content: item.content };
    });

    if (typeof project.previewHtml !== 'string' ||
        !project.previewHtml.trim() ||
        project.previewHtml.length > 150000) {
      throw routeError(502, 'Generated project preview is missing or too large.');
    }

    if (project.architecture !== undefined &&
        typeof project.architecture !== 'string' &&
        (!project.architecture ||
         typeof project.architecture !== 'object' ||
         Array.isArray(project.architecture))) {
      throw routeError(502, 'AI returned invalid architecture information.');
    }

    const architecture = typeof project.architecture === 'string'
      ? project.architecture
      : JSON.stringify(project.architecture ?? '');

    if (architecture.length > 5000) {
      throw routeError(502, 'Generated architecture information is too large.');
    }

    if (project.buildCommands !== undefined &&
        !Array.isArray(project.buildCommands)) {
      throw routeError(502, 'AI returned invalid build commands.');
    }

    const buildCommands = (project.buildCommands || []).map((command) => {
      if (typeof command !== 'string') {
        throw routeError(502, 'A generated build command has an invalid format.');
      }

      return command.slice(0, 300);
    }).slice(0, 20);

    const safeProject = {
      projectName: (project.projectName || 'OmniScale Project').slice(0, 100),
      summary: (project.summary || '').slice(0, 3000),
      architecture,
      preferences: safePreferences,
      files,
      previewHtml: project.previewHtml,
      buildCommands
    };

    addStage('Manifest parsing', 'completed', 'Structured project response parsed.');
    addStage('File validation', 'completed', files.length + ' files passed validation.');
    addStage('Project preparation', 'completed', 'Project files and preview are ready.');

    return res.json({
      success: true,
      project: safeProject,
      result: safeProject.summary,
      stages,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Platform generation error:', {
      name: err?.name,
      statusCode: err?.statusCode,
      message: err?.statusCode ? err.message : 'Internal generation error'
    });

    addStage('Generation', 'failed', 'Project generation could not be completed.');

    return res.status(err?.statusCode || 500).json({
      success: false,
      error: err?.statusCode
        ? err.message
        : 'Project generation failed. Please try again.',
      stages
    });
  }
});

module.exports = router;

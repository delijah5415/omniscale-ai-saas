const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
require('dotenv').config();

const app = express();

const PORT = process.env.PORT || 5000;

// Allow only explicitly configured frontend origins.
const allowedOrigins = new Set(
  (
    process.env.CLIENT_ORIGINS ||
    process.env.CLIENT_ORIGIN ||
    'https://omniscale-ai-saas.vercel.app,https://omniscale-ai-scale.vercel.app'
  ).split(',').map(origin => origin.trim()).filter(Boolean)
);

app.use(helmet());

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: req => req.method === 'OPTIONS',
  message: { success: false, error: 'Too many API requests. Try again later.' }
});

const aiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: req => req.method === 'OPTIONS',
  message: { success: false, error: 'AI request limit reached. Try again later.' }
});

const buildRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: req => req.method === 'OPTIONS',
  message: { success: false, error: 'Build request limit reached. Try again later.' }
});

const workspaceChatRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: req => req.method === 'OPTIONS',
  message: { success: false, error: 'AI Workspace request limit reached. Try again later.' }
});

app.use('/api/ai-workspace/chat', workspaceChatRateLimit);
app.use('/api', apiRateLimit);
app.use('/api/ai/generate', aiRateLimit);
app.use('/api/builder/build-platform', buildRateLimit);


const aiRoutes = require('./routes/ai');
const aiWorkspaceRoutes = require('./routes/aiWorkspace');
const builderRoutes = require('./routes/builder');
const accountRoutes = require('./routes/account');

app.use('/api/ai', aiRoutes);
app.use('/api/ai-workspace', aiWorkspaceRoutes);
app.use('/api/builder', builderRoutes);
app.use('/api/account', accountRoutes);
const messagesRouter = require('./routes/messages');
app.use('/api/messages', messagesRouter);

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

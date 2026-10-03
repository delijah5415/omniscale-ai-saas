const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

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

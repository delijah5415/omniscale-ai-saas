const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Import Routes
const aiRoutes = require('./routes/ai');
const builderRoutes = require('./routes/builder');

app.use('/api/ai', aiRoutes);
app.use('/api/builder', builderRoutes);

app.get('/', (req, res) => {
  res.json({ status: 'OmniScale AI Micro-SaaS API is running globally 🚀' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
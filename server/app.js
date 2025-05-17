require('dotenv').config({ path: '../.env' });
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');

const app = express();
app.use(cors());

// Must be BEFORE other middleware that parses the body
app.use('/api/user/webhook', express.raw({ type: 'application/json' }));

// Configure Express to parse raw bodies for webhooks and JSON for other routes
app.use((req, res, next) => {
  if (req.originalUrl === '/api/user/webhook') {
    // Skip body parsing for webhook endpoint - we'll use express.raw in the route
    next();
  } else {
    // Use JSON parsing for all other routes
    express.json()(req, res, next);
  }
});

// Connect MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
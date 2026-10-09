const express = require('express');
const cors = require('cors');
const config = require('./src/config');
const db = require('./src/db');
const redisHelper = require('./src/redis');
const emailService = require('./src/emailService');
const authRoutes = require('./src/routes/authRoutes');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging for beginner visibility
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString().split('T')[1].slice(0, 8)}] ${req.method} ${req.url}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'FoodApp Auth Backend' });
});

// Mount Authentication Routes under /api/auth
app.use('/api/auth', authRoutes);

// Fallback 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start Server after connecting to Database and Mailer
async function startServer() {
  try {
    // 1. Initialize PostgreSQL database and tables
    await db.initDatabase();

    // 2. Initialize Emailer
    await emailService.initMailer();

    // 3. Start Express HTTP Server
    app.listen(config.port, '0.0.0.0', () => {
      console.log(`🚀 [Server] Backend running on port ${config.port}`);
      console.log(`👉 API Base URL: http://localhost:${config.port}/api/auth`);
      console.log(`👉 Frontend URL: ${config.appUrl}`);
    });
  } catch (err) {
    console.error('❌ [Server] Failed to initialize server:', err);
    process.exit(1);
  }
}

startServer();

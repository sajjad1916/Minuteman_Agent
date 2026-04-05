require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const fs = require('fs');

const settings = require('./config/settings');
const logger = require('./src/middleware/logger');

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// Run migrations on startup
const db = require('./db/database');
const schema = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8');
db.exec(schema);
logger.info('[startup] Database schema applied');

// Import services
const sequencer = require('./src/services/sequencer');
const { classifyCustomers } = require('./src/services/classification');
const serviceTitan = require('./src/services/serviceTitan');

// Express app
const app = express();
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    logger.info(`[http] ${req.method} ${req.path}`);
  }
  next();
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// API routes
const authRouter = require('./src/routes/auth');
const { requireAuth } = authRouter;
app.use('/api/auth', authRouter);

// Protected routes — require valid token
app.use('/api/dashboard', requireAuth, require('./src/routes/dashboard'));
app.use('/api/campaigns', requireAuth, require('./src/routes/campaigns'));
app.use('/api/customers', requireAuth, require('./src/routes/customers'));
app.use('/api/sequences', requireAuth, require('./src/routes/sequences'));
app.use('/api/templates', requireAuth, require('./src/routes/templates'));

// Manual triggers (protected)
app.post('/api/actions/run-reviews', requireAuth, async (req, res) => {
  try {
    const sent = await sequencer.processReviewRequests();
    res.json({ success: true, sent });
  } catch (err) {
    logger.error(`[action] Review processing failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/actions/run-sequences', requireAuth, async (req, res) => {
  try {
    const synced = await serviceTitan.syncEstimateStatuses();
    const enrolled = await sequencer.enrollUnsoldEstimates();
    const sent = await sequencer.processSequences();
    res.json({ success: true, synced, enrolled, sent });
  } catch (err) {
    logger.error(`[action] Sequence processing failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/actions/run-classification', requireAuth, async (req, res) => {
  try {
    const customers = await serviceTitan.getCustomersForClassification();
    const results = await classifyCustomers(customers);
    res.json({ success: true, classified: results.length });
  } catch (err) {
    logger.error(`[action] Classification failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: settings.appMode,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Settings endpoint (protected)
app.get('/api/settings', requireAuth, (req, res) => {
  res.json({
    appMode: settings.appMode,
    guardrails: settings.guardrails,
    googleReviewLink: settings.googleReviewLink,
  });
});

// Fallback to index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Cron Jobs ──

// Process review requests every 30 minutes
cron.schedule('*/30 * * * *', async () => {
  logger.info('[cron] Running review request processing...');
  try {
    await sequencer.processReviewRequests();
  } catch (err) {
    logger.error(`[cron] Review processing failed: ${err.message}`);
  }
});

// Process campaign sequences every hour at :15
cron.schedule('15 * * * *', async () => {
  logger.info('[cron] Running sequence processing...');
  try {
    await serviceTitan.syncEstimateStatuses();
    await sequencer.enrollUnsoldEstimates();
    await sequencer.processSequences();
  } catch (err) {
    logger.error(`[cron] Sequence processing failed: ${err.message}`);
  }
});

// Run customer classification weekly on Monday at 6 AM
cron.schedule('0 6 * * 1', async () => {
  logger.info('[cron] Running weekly customer classification...');
  try {
    const customers = await serviceTitan.getCustomersForClassification();
    await classifyCustomers(customers);
  } catch (err) {
    logger.error(`[cron] Classification failed: ${err.message}`);
  }
});

// Start server
app.listen(settings.port, () => {
  logger.info(`[startup] Minuteman Marketing Agent running on port ${settings.port}`);
  logger.info(`[startup] Mode: ${settings.appMode}`);
  logger.info(`[startup] Dashboard: http://localhost:${settings.port}`);
  logger.info(`[startup] Guardrails: ${settings.guardrails.dailySmsCap} SMS/day, ${settings.guardrails.dailyEmailCap} email/day`);
});

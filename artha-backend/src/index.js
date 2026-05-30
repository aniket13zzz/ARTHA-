require('dotenv').config();
const express = require('express');
const config  = require('./config');

const bot            = require('./integrations/telegram/bot');
const paperclipRoutes = require('./routes/paperclip');
const agentRoutes    = require('./routes/agents');
const companyRoutes  = require('./routes/company');

const app = express();
app.use(express.json());

// ─── HEALTH ──────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ARTHA Backend',
    version: '1.0.0',
    ts: new Date().toISOString(),
    agents: 7,
  });
});

// ─── TELEGRAM WEBHOOK ────────────────────────────────────────────────────────
// Telegram posts every message here
app.post('/webhook/telegram', (req, res) => {
  bot.handleUpdate(req.body);
  res.sendStatus(200);
});

// ─── PAPERCLIP ROUTES ────────────────────────────────────────────────────────
// All Paperclip webhooks + invocations
// Protected by Bearer token (PAPERCLIP_WEBHOOK_SECRET)
app.use('/api/webhook', paperclipRoutes);

// ─── AGENT ROUTES ────────────────────────────────────────────────────────────
// Direct agent invocation for testing / internal use
app.use('/api/agents', agentRoutes);

// ─── COMPANY ROUTES ──────────────────────────────────────────────────────────
app.use('/api/company', companyRoutes);

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ─── ERROR HANDLER ───────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── START ───────────────────────────────────────────────────────────────────
app.listen(config.PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║         ARTHA AI Backend v1.0            ║
╠══════════════════════════════════════════╣
║  Port    : ${config.PORT}                          ║
║  Mode    : ${config.NODE_ENV}               ║
╠══════════════════════════════════════════╣
║  Routes:                                 ║
║  POST /webhook/telegram                  ║
║  POST /api/webhook/invoke     ← Paperclip║
║  POST /api/webhook/heartbeat  ← Paperclip║
║  POST /api/webhook/approval-result       ║
║  POST /api/webhook/budget-alert          ║
║  POST /api/webhook/strategy-proposed     ║
║  GET  /api/agents/health                 ║
║  POST /api/agents/:agent                 ║
║  GET  /api/agents/entries/:id            ║
║  POST /api/company/onboard               ║
╚══════════════════════════════════════════╝
  `);
});

module.exports = app;

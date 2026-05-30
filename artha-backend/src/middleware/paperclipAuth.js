const config = require('../config');

// Verify every request from Paperclip has correct secret
function paperclipAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const expected = `Bearer ${config.PAPERCLIP.secret}`;

  if (!authHeader || authHeader !== expected) {
    console.warn('[Auth] Unauthorized Paperclip request from:', req.ip);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

// Verify Telegram webhook (no auth needed — validated by Telegraf internally)
function telegramAuth(req, res, next) {
  next();
}

module.exports = { paperclipAuth, telegramAuth };

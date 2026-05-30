require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',

  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,

  DB: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'artha_mvp',
    user: process.env.DB_USER || 'artha',
    password: process.env.DB_PASSWORD || 'artha123',
  },

  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,

  PAPERCLIP: {
    secret: process.env.PAPERCLIP_WEBHOOK_SECRET || 'artha-secret-2024',
    baseUrl: process.env.PAPERCLIP_BASE_URL || 'http://localhost:3100',
    apiKey: process.env.PAPERCLIP_API_KEY,
    companyId: process.env.PAPERCLIP_COMPANY_ID,
  },

  OPENCLAW: {
    baseUrl: process.env.OPENCLAW_BASE_URL || 'http://localhost:18789',
    apiKey: process.env.OPENCLAW_API_KEY,
  },
};

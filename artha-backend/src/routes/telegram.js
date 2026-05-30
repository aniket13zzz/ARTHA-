const ceo    = require('../agents/ceo/router');
const memory = require('../agents/memory/store');
const { getOrCreateCompany } = require('../db/queries');

// Called by bot.js for every Telegram message
async function handleTelegramMessage({ message, telegramId, chatId }) {
  const company = await getOrCreateCompany(telegramId);
  await memory.addToSession(company.id, { role: 'user', content: message });

  const response = await ceo.route({ message, company });

  await memory.addToSession(company.id, { role: 'assistant', content: response });
  return response;
}

module.exports = { handleTelegramMessage };

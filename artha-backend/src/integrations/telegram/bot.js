const { Telegraf } = require('telegraf');
const config = require('../../config');

let bot;

function getBot() {
  if (!bot) {
    bot = new Telegraf(config.TELEGRAM_BOT_TOKEN);
    setupHandlers(bot);
  }
  return bot;
}

function setupHandlers(bot) {
  bot.start((ctx) => {
    ctx.reply('🙏 Welcome to ARTHA AI!\n\nBusiness type?\n\n1️⃣ Kirana / Retail\n2️⃣ Software / IT\n3️⃣ Agency / Consultant\n\nReply number.');
  });

  bot.on('text', async (ctx) => {
    const message = ctx.message.text;
    const telegramId = String(ctx.from.id);
    const chatId = ctx.chat.id;

    // Check approval reply first
    const paperclip = require('../paperclip/client');
    const approvalResult = await paperclip.processInlineReply(message);
    if (approvalResult) {
      const msg = approvalResult.status === 'approved'
        ? '✅ Approved! Executing now.'
        : '❌ Cancelled. No action taken.';
      return ctx.reply(msg);
    }

    // Normal message → route handler
    try {
      const { handleTelegramMessage } = require('../../routes/telegram');
      const reply = await handleTelegramMessage({ message, telegramId, chatId });
      await ctx.reply(reply);
    } catch (err) {
      console.error('[Bot] Error:', err.message);
      await ctx.reply('Something went wrong. Try again.');
    }
  });

  bot.catch((err) => {
    console.error('[Bot] Unhandled error:', err.message);
  });
}

module.exports = getBot();

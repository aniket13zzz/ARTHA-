const { logAudit } = require('../../db/queries');

// COMMUNICATION — formats + routes all outgoing messages
// For MVP: Telegram only. WhatsApp/Email added later.

const LANGUAGE_TEMPLATES = {
  english: {
    entry_done: (p) => `✅ Entry Done!\nType: ${p.type}\nAmount: ₹${Number(p.amount).toLocaleString('en-IN')}\nParty: ${p.party || 'N/A'}`,
    cash_low: (d) => `⚠️ CASH ALERT\nRunway: ${d.days} days\nAction: Collect ₹${d.amount?.toLocaleString('en-IN')} from ${d.party}`,
    gst_due: (d) => `📅 GST DUE\nDeadline: ${d.date}\nEstimated: ₹${d.amount?.toLocaleString('en-IN')}`,
    approval_needed: (d) => `⚠️ Approval Required\n\n${d.summary}\n\nReply:\nYES ${d.approvalId}\nNO ${d.approvalId}`,
    weekly_report: (d) => `📊 Weekly Report\n\nRevenue: ₹${d.revenue?.toLocaleString('en-IN')}\nExpenses: ₹${d.expenses?.toLocaleString('en-IN')}\nProfit: ₹${d.profit?.toLocaleString('en-IN')}`,
  },
  hindi: {
    entry_done: (p) => `✅ एंट्री हो गई!\nप्रकार: ${p.type}\nराशि: ₹${Number(p.amount).toLocaleString('en-IN')}\nपार्टी: ${p.party || 'N/A'}`,
    cash_low: (d) => `⚠️ नकद अलर्ट\nरनवे: ${d.days} दिन\nएक्शन: ${d.party} से ₹${d.amount?.toLocaleString('en-IN')} लें`,
    gst_due: (d) => `📅 GST की तारीख\nडेडलाइन: ${d.date}\nअनुमानित: ₹${d.amount?.toLocaleString('en-IN')}`,
    approval_needed: (d) => `⚠️ स्वीकृति चाहिए\n\n${d.summary}\n\nजवाब दें:\nHAAN ${d.approvalId}\nNAHIN ${d.approvalId}`,
  }
};

async function send({ company, messageType, data, bot, chatId }) {
  const lang = company?.language || 'english';
  const templates = LANGUAGE_TEMPLATES[lang] || LANGUAGE_TEMPLATES.english;
  const template = templates[messageType];

  if (!template) {
    console.warn(`[COMMUNICATION] Unknown message type: ${messageType}`);
    return;
  }

  const text = template(data);

  // Telegram
  if (bot && chatId) {
    await bot.telegram.sendMessage(chatId, text);
  }

  await logAudit(company.id, 'COMMUNICATION', 'message_sent', { messageType, lang }, { chatId });
  return text;
}

function formatAlert(type, data) {
  const alerts = {
    cash_low: `⚠️ CASH ALERT\nRunway: ${data.days} days`,
    gst_due: `📅 GST DUE — ${data.date}`,
    entry_confirm: `✅ ₹${data.amount?.toLocaleString('en-IN')} — ${data.type}`,
    approval_needed: `⚠️ Approval: ${data.actionType}`,
  };
  return alerts[type] || JSON.stringify(data);
}

function formatMorningBriefing(data) {
  return [
    `🌅 Good Morning!`,
    `Cash: ₹${data.cash?.toLocaleString('en-IN')}`,
    data.pendingCollections > 0 ? `📥 Pending collections: ₹${data.pendingCollections?.toLocaleString('en-IN')}` : null,
    data.gstDue ? `📅 GST due in ${data.gstDueDays} days` : null,
    data.lowStock?.length > 0 ? `📦 Low stock: ${data.lowStock.join(', ')}` : null,
  ].filter(Boolean).join('\n');
}

module.exports = { send, formatAlert, formatMorningBriefing };

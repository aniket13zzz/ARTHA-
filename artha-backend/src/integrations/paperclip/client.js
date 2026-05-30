const axios = require('axios');
const config = require('../../config');
const db = require('../../db/connect');

// In-memory store for pending approvals (MVP fallback)
const pendingApprovals = new Map();

// ─── SEND APPROVAL REQUEST ───────────────────────────────────────────────────
async function sendApprovalRequest({ company, telegramId, actionType, summary, approvalId }) {
  // Store locally always
  pendingApprovals.set(approvalId, { company, actionType, status: 'pending', telegramId });

  // Try Paperclip API first
  if (config.PAPERCLIP.apiKey && config.PAPERCLIP.companyId) {
    try {
      const res = await axios.post(
        `${config.PAPERCLIP.baseUrl}/api/approvals`,
        {
          companyId: config.PAPERCLIP.companyId,
          agentName: 'EXECUTION',
          actionType,
          summary,
          metadata: { arthaApprovalId: approvalId, arthaCompanyId: company.id },
          notifyChannel: 'telegram',
          telegramChatId: telegramId,
        },
        {
          headers: {
            'Authorization': `Bearer ${config.PAPERCLIP.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        }
      );

      // Store Paperclip's approval ID
      await db.query(
        `UPDATE approvals SET paperclip_approval_id = $1 WHERE id = $2`,
        [res.data?.approvalId, approvalId]
      );

      console.log(`[Paperclip] Approval sent. PaperclipID=${res.data?.approvalId}`);
      return { sent: true, via: 'paperclip', paperclipId: res.data?.approvalId };
    } catch (err) {
      console.warn(`[Paperclip] API failed, falling back to Telegram inline: ${err.message}`);
    }
  }

  // Fallback: send inline YES/NO via Telegram bot
  const bot = require('../telegram/bot');
  if (bot && telegramId) {
    await bot.telegram.sendMessage(
      telegramId,
      `⚠️ Approval Required\n\n${summary}\n\nReply:\nYES ${approvalId}\nNO ${approvalId}`
    );
    console.log(`[Paperclip] Approval sent via Telegram inline. ApprovalID=${approvalId}`);
  }

  return { sent: true, via: 'telegram_inline', approvalId };
}

// ─── PROCESS INLINE APPROVAL REPLY (fallback) ────────────────────────────────
async function processInlineReply(message) {
  const match = message.match(/^(YES|NO|HAAN|NAHIN)\s+([a-zA-Z0-9_-]+)$/i);
  if (!match) return null;

  const [, decision, approvalId] = match;
  const isApproved = ['yes', 'haan'].includes(decision.toLowerCase());

  // Update DB
  await db.query(
    `UPDATE approvals SET status = $1, decided_at = NOW() WHERE id = $2`,
    [isApproved ? 'approved' : 'rejected', approvalId]
  );

  const approval = pendingApprovals.get(approvalId);
  if (approval) {
    approval.status = isApproved ? 'approved' : 'rejected';
    pendingApprovals.set(approvalId, approval);
  }

  return { approvalId, status: isApproved ? 'approved' : 'rejected', approval };
}

// ─── REPORT TASK COMPLETION TO PAPERCLIP ─────────────────────────────────────
async function reportTaskComplete({ paperclipTaskId, agentName, result, status = 'completed' }) {
  if (!config.PAPERCLIP.apiKey || !paperclipTaskId) return;

  try {
    await axios.post(
      `${config.PAPERCLIP.baseUrl}/api/tasks/${paperclipTaskId}/complete`,
      { agentName, status, result },
      { headers: { 'Authorization': `Bearer ${config.PAPERCLIP.apiKey}` }, timeout: 5000 }
    );
    console.log(`[Paperclip] Task ${paperclipTaskId} marked ${status}`);
  } catch (err) {
    console.warn(`[Paperclip] Could not report task completion: ${err.message}`);
  }
}

// ─── REPORT BUDGET USAGE TO PAPERCLIP ────────────────────────────────────────
async function reportBudgetUsage({ agentName, costCents }) {
  if (!config.PAPERCLIP.apiKey) return;

  try {
    await axios.post(
      `${config.PAPERCLIP.baseUrl}/api/agents/${agentName}/usage`,
      { costCents, timestamp: new Date().toISOString() },
      { headers: { 'Authorization': `Bearer ${config.PAPERCLIP.apiKey}` }, timeout: 3000 }
    );
  } catch (err) {
    // Non-critical — don't crash
  }
}

module.exports = {
  sendApprovalRequest,
  processInlineReply,
  reportTaskComplete,
  reportBudgetUsage,
};

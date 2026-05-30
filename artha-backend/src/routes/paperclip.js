const express = require('express');
const router = express.Router();
const { paperclipAuth } = require('../middleware/paperclipAuth');
const ceo        = require('../agents/ceo/router');
const lekhak     = require('../agents/lekhak/parser');
const tejas      = require('../agents/tejas/gst');
const vivek      = require('../agents/vivek/reports');
const memory     = require('../agents/memory/store');
const execution  = require('../agents/execution/writer');
const communication = require('../agents/communication/sender');
const paperclip  = require('../integrations/paperclip/client');
const openclaw   = require('../integrations/openclaw/client');
const { getCompanyById, createAgentTask, updateAgentTask, logAudit } = require('../db/queries');

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/webhook/invoke
// Paperclip + OpenClaw call this endpoint to invoke any ARTHA agent
// Body: { agent, task, companyId, paperclipTaskId, context }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/invoke', paperclipAuth, async (req, res) => {
  const { agent, task, companyId, paperclipTaskId, context } = req.body;

  console.log(`[Paperclip] /invoke agent=${agent} task=${task} taskId=${paperclipTaskId}`);

  // Respond immediately — process async
  res.json({ status: 'accepted', executionId: `exec_${Date.now()}` });

  // Process in background
  setImmediate(async () => {
    try {
      const company = await getCompanyById(companyId);
      if (!company) {
        console.error(`[Paperclip] Company not found: ${companyId}`);
        return;
      }

      const dbTask = await createAgentTask(companyId, agent, task || 'heartbeat', context || {}, paperclipTaskId);
      const message = context?.message || context?.task || task || 'heartbeat';

      let result;

      switch (agent?.toLowerCase()) {
        case 'ceo':
          result = await ceo.route({ message, company, paperclipTaskId });
          break;

        case 'lekhak':
          result = await lekhak.parseTransaction({ message, company, paperclipTaskId });
          break;

        case 'tejas':
          result = await tejas.handleGST({ message, company, paperclipTaskId });
          break;

        case 'vivek':
          result = await vivek.generateReport({ message, company, paperclipTaskId });
          break;

        case 'memory':
          result = await memory.recall({ message, company });
          break;

        case 'execution':
          // EXECUTION only runs on approved actions
          if (context?.approvalId) {
            result = await execution.executeApprovedAction({ approvalId: context.approvalId, company });
          } else {
            result = { error: 'EXECUTION requires approvalId in context' };
          }
          break;

        case 'communication':
          result = communication.formatAlert(context?.alertType || 'entry_confirm', context?.data || {});
          break;

        default:
          result = { error: `Unknown agent: ${agent}` };
      }

      await updateAgentTask(dbTask.id, 'completed', { result });
      await paperclip.reportTaskComplete({ paperclipTaskId, agentName: agent, result, status: 'completed' });

      console.log(`[Paperclip] Agent ${agent} done. TaskID=${paperclipTaskId}`);
    } catch (err) {
      console.error(`[Paperclip] Agent ${agent} failed:`, err.message);
      await paperclip.reportTaskComplete({ paperclipTaskId, agentName: agent, result: { error: err.message }, status: 'failed' });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/webhook/heartbeat
// Paperclip sends heartbeat to check agent health
// ─────────────────────────────────────────────────────────────────────────────
router.post('/heartbeat', paperclipAuth, async (req, res) => {
  const { agentName, taskId, companyId } = req.body;
  console.log(`[Paperclip] Heartbeat — agent=${agentName} taskId=${taskId}`);

  await openclaw.sendHeartbeatResponse({
    taskId,
    agentName,
    status: 'alive',
    output: { ts: new Date().toISOString(), agentName, status: 'idle' },
  });

  res.json({ status: 'alive', agent: agentName, ts: new Date().toISOString() });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/webhook/approval-result
// Paperclip sends approval decision (approved/rejected) back to ARTHA
// ─────────────────────────────────────────────────────────────────────────────
router.post('/approval-result', paperclipAuth, async (req, res) => {
  const { approvalId, arthaApprovalId, status, decidedBy, companyId } = req.body;
  const realApprovalId = arthaApprovalId || approvalId;

  console.log(`[Paperclip] Approval result — id=${realApprovalId} status=${status}`);

  const db = require('../db/connect');
  await db.query(
    `UPDATE approvals SET status = $1, decided_at = NOW() WHERE id = $2`,
    [status, realApprovalId]
  );

  if (status === 'approved') {
    const company = await getCompanyById(companyId);
    if (company) {
      await execution.executeApprovedAction({ approvalId: realApprovalId, company });
    }
  }

  await logAudit(companyId, 'PAPERCLIP', 'approval_result', { approvalId: realApprovalId, status, decidedBy }, {});

  res.json({ received: true, approvalId: realApprovalId, status });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/webhook/budget-alert
// Paperclip sends alert when agent hits 80%/100% budget
// ─────────────────────────────────────────────────────────────────────────────
router.post('/budget-alert', paperclipAuth, async (req, res) => {
  const { agentName, usedCents, limitCents, percent, companyId } = req.body;

  console.warn(`[Paperclip] Budget alert — ${agentName} at ${percent}% (${usedCents}/${limitCents} cents)`);

  if (percent >= 100) {
    // Agent paused by Paperclip — notify owner via Telegram
    const company = await getCompanyById(companyId);
    if (company) {
      const bot = require('../integrations/telegram/bot');
      await bot.telegram.sendMessage(
        company.owner_telegram_id,
        `🔴 ${agentName} agent paused — monthly budget exhausted.\nUsed: ₹${(usedCents / 100).toFixed(0)}\nContact founder to increase limit.`
      );
    }
  }

  await logAudit(companyId, 'PAPERCLIP', 'budget_alert', { agentName, percent, usedCents, limitCents }, {});
  res.json({ received: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/webhook/strategy-proposed
// Paperclip asks founder to approve CEO's initial strategy
// ─────────────────────────────────────────────────────────────────────────────
router.post('/strategy-proposed', paperclipAuth, async (req, res) => {
  const { strategy, companyId, approvalId } = req.body;

  console.log(`[Paperclip] Strategy proposed for company=${companyId}`);

  const company = await getCompanyById(companyId);
  if (company) {
    const bot = require('../integrations/telegram/bot');
    await bot.telegram.sendMessage(
      company.owner_telegram_id,
      `📋 CEO Strategy Proposal\n\n${strategy}\n\nApprove?\nYES ${approvalId}\nNO ${approvalId}`
    );
  }

  res.json({ received: true });
});

module.exports = router;

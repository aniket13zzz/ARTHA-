const db = require('../../db/connect');
const { logAudit } = require('../../db/queries');
const paperclip = require('../../integrations/paperclip/client');

// Sensitive actions that need Paperclip approval
const APPROVAL_REQUIRED = ['gst_filing', 'tax_payment', 'bulk_delete', 'reverse_entry'];

async function writeEntry({ parsed, company, paperclipTaskId = null }) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    if (!parsed.amount || parsed.amount <= 0) throw new Error('Invalid amount');
    if (!parsed.type) throw new Error('Invalid type');

    const result = await client.query(
      `INSERT INTO journal_entries
         (company_id, date, type, amount, party, item, description,
          quantity, unit, payment_mode, raw_message, confidence)
       VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        company.id, parsed.type, parsed.amount, parsed.party,
        parsed.item, parsed.item || parsed.party,
        parsed.quantity, parsed.unit,
        parsed.payment_mode || 'unknown',
        parsed.raw_message, parsed.confidence
      ]
    );

    await client.query(
      `INSERT INTO audit_log (company_id, agent, action, payload, result, paperclip_task_id)
       VALUES ($1, 'EXECUTION', 'journal_write', $2, $3, $4)`,
      [company.id, JSON.stringify(parsed), JSON.stringify({ id: result.rows[0].id }), paperclipTaskId]
    );

    await client.query('COMMIT');
    return { id: result.rows[0].id, success: true };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[EXECUTION] Write failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

async function requestSensitiveAction({ actionType, payload, company, telegramId }) {
  if (!APPROVAL_REQUIRED.includes(actionType)) {
    throw new Error(`${actionType} is not a sensitive action`);
  }

  console.log(`[EXECUTION] Approval needed for: ${actionType}`);

  // Store pending approval in DB
  const res = await db.query(
    `INSERT INTO approvals (company_id, action_type, action_payload)
     VALUES ($1, $2, $3) RETURNING id`,
    [company.id, actionType, JSON.stringify(payload)]
  );
  const approvalId = res.rows[0].id;

  // Notify via Paperclip
  const summary = buildApprovalSummary(actionType, payload);
  await paperclip.sendApprovalRequest({ company, telegramId, actionType, summary, approvalId });

  await logAudit(company.id, 'EXECUTION', 'approval_requested', { actionType, approvalId }, { status: 'pending' });

  return { approvalId, status: 'pending', message: summary };
}

async function executeApprovedAction({ approvalId, company }) {
  const res = await db.query('SELECT * FROM approvals WHERE id = $1', [approvalId]);
  const approval = res.rows[0];
  if (!approval || approval.status !== 'approved') throw new Error('Approval not found or not approved');

  await db.query(
    `UPDATE approvals SET status = 'executing', decided_at = NOW() WHERE id = $1`,
    [approvalId]
  );

  console.log(`[EXECUTION] Executing approved action: ${approval.action_type}`);
  await logAudit(company.id, 'EXECUTION', 'approved_action_executed', { approvalId, action: approval.action_type }, {});

  return { success: true, action: approval.action_type };
}

function buildApprovalSummary(actionType, payload) {
  const summaries = {
    gst_filing: `📋 GST Filing Request\nMonth: ${payload.month || 'current'}\nEstimated tax: ₹${payload.amount?.toLocaleString('en-IN') || 'calculating...'}`,
    tax_payment: `💰 Tax Payment Request\nAmount: ₹${payload.amount?.toLocaleString('en-IN')}\nType: ${payload.taxType || 'GST'}`,
    bulk_delete: `🗑️ Bulk Delete Request\nEntries: ${payload.count} records\nDate range: ${payload.dateRange}`,
    reverse_entry: `↩️ Entry Reversal Request\nEntry ID: ${payload.entryId}\nAmount: ₹${payload.amount?.toLocaleString('en-IN')}`,
  };
  return summaries[actionType] || `Action: ${actionType}`;
}

module.exports = { writeEntry, requestSensitiveAction, executeApprovedAction };

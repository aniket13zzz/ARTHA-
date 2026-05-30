const db = require('../../db/connect');
const { logAudit } = require('../../db/queries');

const MAX_MESSAGES = 10;

async function addToSession(companyId, message) {
  try {
    const res = await db.query('SELECT last_messages FROM sessions WHERE company_id = $1', [companyId]);
    let messages = res.rows[0]?.last_messages || [];
    messages.push({ ...message, ts: new Date().toISOString() });
    if (messages.length > MAX_MESSAGES) messages = messages.slice(-MAX_MESSAGES);

    await db.query(
      `INSERT INTO sessions (company_id, telegram_id, last_messages)
       VALUES ($1, (SELECT owner_telegram_id FROM companies WHERE id=$1), $2)
       ON CONFLICT (company_id) DO UPDATE SET last_messages = $2, updated_at = NOW()`,
      [companyId, JSON.stringify(messages)]
    );
  } catch (err) {
    console.error('[MEMORY] Session error:', err.message);
  }
}

async function getSession(companyId) {
  const res = await db.query('SELECT * FROM sessions WHERE company_id = $1', [companyId]);
  return res.rows[0] || { last_messages: [], current_task: {} };
}

async function recall({ message, company }) {
  const session = await getSession(company.id);
  const recent = session.last_messages.slice(-5);
  if (recent.length === 0) return "No recent context. Start a new transaction!";

  await logAudit(company.id, 'MEMORY', 'recall', { message }, { count: recent.length });

  const lines = recent.map(m => `${m.role === 'user' ? 'You' : 'ARTHA'}: ${m.content.substring(0, 100)}`);
  return `🧠 Recent Context:\n\n${lines.join('\n')}`;
}

async function rememberVendor(companyId, vendorData) {
  const existing = await db.query(
    'SELECT * FROM vendors WHERE company_id = $1 AND name ILIKE $2',
    [companyId, vendorData.name]
  );
  if (existing.rows.length > 0) return existing.rows[0];

  const res = await db.query(
    `INSERT INTO vendors (company_id, name, name_variants, gstin, usual_items)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [companyId, vendorData.name, vendorData.variants || [], vendorData.gstin || null, vendorData.items || []]
  );
  return res.rows[0];
}

async function rememberCustomer(companyId, customerData) {
  const existing = await db.query(
    'SELECT * FROM customers WHERE company_id = $1 AND name ILIKE $2',
    [companyId, customerData.name]
  );
  if (existing.rows.length > 0) return existing.rows[0];

  const res = await db.query(
    `INSERT INTO customers (company_id, name, phone, gstin)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [companyId, customerData.name, customerData.phone || null, customerData.gstin || null]
  );
  return res.rows[0];
}

module.exports = { addToSession, getSession, recall, rememberVendor, rememberCustomer };

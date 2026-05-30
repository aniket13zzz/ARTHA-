const db = require('./connect');

async function getOrCreateCompany(telegramId) {
  let res = await db.query(
    'SELECT * FROM companies WHERE owner_telegram_id = $1',
    [telegramId]
  );
  if (res.rows.length > 0) return res.rows[0];

  const newCo = await db.query(
    `INSERT INTO companies (name, owner_telegram_id)
     VALUES ('New Business', $1) RETURNING *`,
    [telegramId]
  );
  return newCo.rows[0];
}

async function updateCompany(companyId, fields) {
  const keys = Object.keys(fields);
  const values = Object.values(fields);
  const setClauses = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  const res = await db.query(
    `UPDATE companies SET ${setClauses} WHERE id = $1 RETURNING *`,
    [companyId, ...values]
  );
  return res.rows[0];
}

async function getCompanyById(companyId) {
  const res = await db.query('SELECT * FROM companies WHERE id = $1', [companyId]);
  return res.rows[0] || null;
}

async function getRecentEntries(companyId, limit = 5) {
  const res = await db.query(
    `SELECT * FROM journal_entries WHERE company_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [companyId, limit]
  );
  return res.rows;
}

async function getSummary(companyId) {
  const res = await db.query(
    `SELECT type, SUM(amount) as total, COUNT(*) as count
     FROM journal_entries
     WHERE company_id = $1
       AND date >= date_trunc('month', CURRENT_DATE)
     GROUP BY type`,
    [companyId]
  );
  return res.rows;
}

async function logAudit(companyId, agent, action, payload, result, paperclipTaskId = null) {
  await db.query(
    `INSERT INTO audit_log (company_id, agent, action, payload, result, paperclip_task_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [companyId, agent, action, JSON.stringify(payload), JSON.stringify(result), paperclipTaskId]
  );
}

async function createAgentTask(companyId, agentName, taskType, payload, paperclipTaskId = null) {
  const res = await db.query(
    `INSERT INTO agent_tasks (company_id, agent_name, task_type, payload, paperclip_task_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [companyId, agentName, taskType, JSON.stringify(payload), paperclipTaskId]
  );
  return res.rows[0];
}

async function updateAgentTask(taskId, status, result) {
  await db.query(
    `UPDATE agent_tasks SET status = $1, result = $2, completed_at = NOW() WHERE id = $3`,
    [status, JSON.stringify(result), taskId]
  );
}

module.exports = {
  getOrCreateCompany, updateCompany, getCompanyById,
  getRecentEntries, getSummary, logAudit,
  createAgentTask, updateAgentTask
};

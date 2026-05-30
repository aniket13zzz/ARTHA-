const db = require('../../db/connect');
const { getSummary, getRecentEntries, logAudit } = require('../../db/queries');

async function generateReport({ message, company, paperclipTaskId = null }) {
  const lower = message.toLowerCase();

  let report;
  if (lower.includes('cash') || lower.includes('balance')) report = await cashBalance(company);
  else if (lower.includes('week')) report = await weeklyReport(company);
  else if (lower.includes('runway') || lower.includes('burn')) report = await runwayReport(company);
  else report = await monthlyReport(company);

  await logAudit(company.id, 'VIVEK', 'generate_report', { message }, { report_type: lower }, paperclipTaskId);
  return report;
}

async function monthlyReport(company) {
  const summary = await getSummary(company.id);
  const data = {};
  summary.forEach(r => { data[r.type] = parseFloat(r.total || 0); });

  const revenue = (data.sale || 0) + (data.receipt || 0);
  const expenses = (data.expense || 0) + (data.purchase || 0) + (data.payment || 0);
  const profit = revenue - expenses;
  const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : 0;

  return [
    '📊 Monthly Report',
    `Revenue:  ₹${revenue.toLocaleString('en-IN')}`,
    `Expenses: ₹${expenses.toLocaleString('en-IN')}`,
    `Profit:   ₹${profit.toLocaleString('en-IN')} (${margin}% margin)`,
    '',
    profit > 0 ? '✅ Profitable this month.' : '⚠️ Expenses exceed revenue.',
  ].join('\n');
}

async function weeklyReport(company) {
  const res = await db.query(
    `SELECT type, SUM(amount) as total FROM journal_entries
     WHERE company_id = $1 AND date >= CURRENT_DATE - INTERVAL '7 days'
     GROUP BY type`,
    [company.id]
  );
  const data = {};
  res.rows.forEach(r => { data[r.type] = parseFloat(r.total || 0); });
  const revenue = (data.sale || 0) + (data.receipt || 0);
  const expenses = (data.expense || 0) + (data.purchase || 0);
  return `📅 Last 7 Days\n\nRevenue:  ₹${revenue.toLocaleString('en-IN')}\nExpenses: ₹${expenses.toLocaleString('en-IN')}\nNet:      ₹${(revenue - expenses).toLocaleString('en-IN')}`;
}

async function cashBalance(company) {
  const entries = await getRecentEntries(company.id, 50);
  let balance = 0;
  entries.forEach(e => {
    if (['sale', 'receipt'].includes(e.type)) balance += parseFloat(e.amount);
    else balance -= parseFloat(e.amount);
  });
  const status = balance > 50000 ? '✅ Healthy' : balance > 15000 ? '⚠️ Low' : '🔴 Critical';
  return `💰 Cash Position\n\nBalance: ₹${balance.toLocaleString('en-IN')}\nStatus: ${status}\n\n(Based on last 50 entries. Connect bank for exact figure.)`;
}

async function runwayReport(company) {
  const res = await db.query(
    `SELECT SUM(amount) as total FROM journal_entries
     WHERE company_id = $1 AND type IN ('expense','purchase','payment')
     AND date >= CURRENT_DATE - INTERVAL '30 days'`,
    [company.id]
  );
  const monthlyBurn = parseFloat(res.rows[0]?.total || 0);
  const cashRes = await getRecentEntries(company.id, 50);
  let cash = 0;
  cashRes.forEach(e => {
    if (['sale', 'receipt'].includes(e.type)) cash += parseFloat(e.amount);
    else cash -= parseFloat(e.amount);
  });
  const months = monthlyBurn > 0 ? (cash / monthlyBurn).toFixed(1) : '∞';
  const status = parseFloat(months) > 12 ? '🟢 GREEN' : parseFloat(months) > 6 ? '🟡 YELLOW' : '🔴 RED';
  return `🛣️ Runway Report\n\nCash: ₹${cash.toLocaleString('en-IN')}\nMonthly Burn: ₹${monthlyBurn.toLocaleString('en-IN')}\nRunway: ${months} months\nStatus: ${status}`;
}

module.exports = { generateReport, monthlyReport, weeklyReport };

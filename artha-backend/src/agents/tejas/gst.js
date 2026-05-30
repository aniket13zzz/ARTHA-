// TEJAS — DETERMINISTIC. Zero AI for calculations.
const { logAudit } = require('../../db/queries');

const GST_RATES = {
  '1006': 0,  '1001': 0,  '0401': 0,  '0701': 0,  // exempt
  '1701': 5,  '0902': 5,  '1507': 5,  '3004': 5,  // 5%
  '6109': 12, '8517': 12, '7318': 12,              // 12%
  '8471': 18, '9983': 18, '8504': 18,              // 18%
  '8703': 28, '2402': 28, '8415': 28,              // 28%
};

const TDS_SECTIONS = {
  '194C': { rate: 0.02, label: 'Contractor (company)', threshold: 30000 },
  '194J': { rate: 0.10, label: 'Professional/Technical', threshold: 30000 },
  '194I': { rate: 0.10, label: 'Rent > 50k/month', threshold: 50000 },
  '194H': { rate: 0.05, label: 'Commission/Brokerage', threshold: 15000 },
};

function calculateGST({ amount, hsnCode, sellerState, buyerState }) {
  const rate = GST_RATES[hsnCode] !== undefined ? GST_RATES[hsnCode] : 18;
  const isInterstate = sellerState !== buyerState;
  const gstAmount = Math.round((amount * rate) / 100 * 100) / 100;
  const half = Math.round(gstAmount / 2 * 100) / 100;

  return {
    base: amount, rate, isInterstate,
    igst: isInterstate ? gstAmount : 0,
    cgst: isInterstate ? 0 : half,
    sgst: isInterstate ? 0 : half,
    total: amount + gstAmount,
    gstAmount
  };
}

function calculateTDS({ amount, section }) {
  const rule = TDS_SECTIONS[section];
  if (!rule) return null;
  if (amount < rule.threshold) return { applicable: false, reason: `Below threshold ₹${rule.threshold}` };
  const tdsAmount = Math.round(amount * rule.rate * 100) / 100;
  return { applicable: true, section, rate: rule.rate * 100, amount: tdsAmount, net: amount - tdsAmount, label: rule.label };
}

async function handleGST({ message, company, paperclipTaskId = null }) {
  const lower = message.toLowerCase();

  // TDS query
  if (lower.includes('tds')) {
    const amountMatch = message.match(/(\d[\d,]*)/);
    if (!amountMatch) return "Include amount for TDS. Example: 'TDS on Rs.50000 professional fee'";
    const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    const section = lower.includes('professional') || lower.includes('consultant') ? '194J' :
                    lower.includes('contractor') ? '194C' :
                    lower.includes('rent') ? '194I' : '194J';
    const result = calculateTDS({ amount, section });
    if (!result.applicable) return `TDS not applicable: ${result.reason}`;
    return `🧮 TDS (${result.section})\nAmount: ₹${amount.toLocaleString('en-IN')}\nRate: ${result.rate}%\nTDS: ₹${result.amount.toLocaleString('en-IN')}\nNet Pay: ₹${result.net.toLocaleString('en-IN')}\nSection: ${result.label}`;
  }

  // GST query
  const amountMatch = message.match(/(?:rs\.?|inr|₹)?\s*(\d[\d,]*(?:\.\d+)?)\s*(?:lakh|l\b)?/i);
  if (!amountMatch) return "Include amount. Example: 'GST on Rs.10000 IT service'";

  let amount = parseFloat(amountMatch[1].replace(/,/g, ''));
  if (lower.includes('lakh')) amount *= 100000;

  let hsnCode = '9999';
  if (lower.includes('service') || lower.includes('software') || lower.includes('it ') || lower.includes('cloud') || lower.includes('saas')) hsnCode = '9983';
  else if (lower.includes('rice') || lower.includes('wheat') || lower.includes('grain')) hsnCode = '1006';
  else if (lower.includes('phone') || lower.includes('mobile')) hsnCode = '8517';
  else if (lower.includes('computer') || lower.includes('laptop')) hsnCode = '8471';
  else if (company?.business_type === 'software') hsnCode = '9983';

  const isInterstate = lower.includes('interstate') || lower.includes('other state');
  const result = calculateGST({ amount, hsnCode, sellerState: 'MH', buyerState: isInterstate ? 'DL' : 'MH' });

  await logAudit(company.id, 'TEJAS', 'gst_calc', { amount, hsnCode, isInterstate }, result, paperclipTaskId);

  const lines = ['🧮 GST Calculation', `Base: ₹${result.base.toLocaleString('en-IN')}`, `Rate: ${result.rate}%`];
  if (result.isInterstate) lines.push(`IGST (${result.rate}%): ₹${result.igst.toLocaleString('en-IN')}`);
  else { lines.push(`CGST (${result.rate / 2}%): ₹${result.cgst.toLocaleString('en-IN')}`); lines.push(`SGST (${result.rate / 2}%): ₹${result.sgst.toLocaleString('en-IN')}`); }
  lines.push(`Total: ₹${result.total.toLocaleString('en-IN')}`);
  if (result.rate === 0) lines.push('\n✅ GST exempt item.');
  return lines.join('\n');
}

module.exports = { handleGST, calculateGST, calculateTDS };

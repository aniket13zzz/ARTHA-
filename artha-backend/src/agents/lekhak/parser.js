const Anthropic = require('@anthropic-ai/sdk');
const config = require('../../config');
const { logAudit } = require('../../db/queries');

const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

const PARSE_PROMPT = `You are LEKHAK, Indian business transaction parser.
Parse message into JSON. Support Hindi/English/Hinglish.

Return ONLY this JSON:
{
  "type": "sale|purchase|expense|receipt|payment",
  "amount": number,
  "party": "string or null",
  "item": "string or null",
  "quantity": number or null,
  "unit": "string or null",
  "payment_mode": "cash|upi|bank|credit|unknown",
  "confidence": 0.0-1.0
}

Rules:
- amount = plain number, no commas, no Rs symbol
- confidence: 0.95=clear, 0.7=some ambiguity, 0.5=guessing
- Return ONLY valid JSON. No markdown. No explanation.

Examples:
"Aaj 50kg rice 2500 mein becha" -> {"type":"sale","amount":2500,"party":null,"item":"rice","quantity":50,"unit":"kg","payment_mode":"cash","confidence":0.95}
"AWS bill Rs.18000 aaya" -> {"type":"expense","amount":18000,"party":"AWS","item":"cloud hosting","quantity":null,"unit":null,"payment_mode":"unknown","confidence":0.92}
"TechCorp retainer 2 lakh pending" -> {"type":"receipt","amount":200000,"party":"TechCorp","item":"retainer","quantity":null,"unit":null,"payment_mode":"unknown","confidence":0.88}`;

async function parseTransaction({ message, company, paperclipTaskId = null }) {
  try {
    const res = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: `${PARSE_PROMPT}\n\nMessage: "${message}"` }]
    });

    let parsed;
    try {
      parsed = JSON.parse(res.content[0].text.trim());
    } catch (e) {
      return "Could not parse transaction. Try: 'Sold rice 50kg Rs.2500'";
    }

    parsed.raw_message = message;

    if (parsed.confidence < 0.70) {
      return `Not sure. Did you mean:\nType: ${parsed.type}\nAmount: ₹${parsed.amount}\nParty: ${parsed.party || 'unknown'}\n\nReply YES to confirm.`;
    }

    // EXECUTION writes to DB
    const execution = require('../execution/writer');
    const result = await execution.writeEntry({ parsed, company, paperclipTaskId });

    await logAudit(company.id, 'LEKHAK', 'parse_transaction', { message }, { parsed, entryId: result.id }, paperclipTaskId);

    return formatConfirmation(parsed);
  } catch (err) {
    console.error('[LEKHAK] Error:', err.message);
    return 'Error processing transaction. Try again.';
  }
}

function formatConfirmation(p) {
  const emoji = { sale: '💰', purchase: '🛒', expense: '💸', receipt: '✅', payment: '📤' }[p.type] || '✅';
  const lines = [
    `${emoji} Entry Done!`,
    `Type: ${p.type}`,
    `Amount: ₹${Number(p.amount).toLocaleString('en-IN')}`,
  ];
  if (p.party) lines.push(`Party: ${p.party}`);
  if (p.item) lines.push(`Item: ${p.item}${p.quantity ? ` (${p.quantity}${p.unit || ''})` : ''}`);
  lines.push(`Mode: ${p.payment_mode}`);
  return lines.join('\n');
}

module.exports = { parseTransaction };

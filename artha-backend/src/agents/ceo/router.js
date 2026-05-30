const Anthropic = require('@anthropic-ai/sdk');
const config = require('../../config');
const { updateCompany, logAudit } = require('../../db/queries');
const skillActivator = require('../../skills/activator');

const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

const ROUTING_PROMPT = `You are ARTHA CEO agent for Indian business finance.
Classify message into ONE category only:
- ENTRY: any financial transaction (sale/purchase/expense/payment/receipt/invoice)
- GST: GST calc/validation/filing/ITC
- REPORT: P&L/cashflow/profit/balance/summary/scorecard
- MEMORY: recall past data/context/history
- ONBOARDING: setup/business type/first message
- UNKNOWN: cannot classify

Reply ONLY category name. Nothing else.`;

async function route({ message, company, paperclipTaskId = null }) {
  // New user → onboard first
  if (!company.onboarding_complete) {
    return await handleOnboarding({ message, company });
  }

  const intentRes = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 20,
    messages: [{ role: 'user', content: `${ROUTING_PROMPT}\n\nMessage: "${message}"` }]
  });

  const intent = intentRes.content[0].text.trim().toUpperCase();
  console.log(`[CEO] Intent=${intent} | Task=${paperclipTaskId || 'direct'}`);

  await logAudit(company.id, 'CEO', 'route', { message, intent }, { routed_to: intent }, paperclipTaskId);

  // Lazy-load agents to avoid circular deps
  switch (intent) {
    case 'ENTRY':
      return await require('../lekhak/parser').parseTransaction({ message, company, paperclipTaskId });
    case 'GST':
      return await require('../tejas/gst').handleGST({ message, company, paperclipTaskId });
    case 'REPORT':
      return await require('../vivek/reports').generateReport({ message, company, paperclipTaskId });
    case 'MEMORY':
      return await require('../memory/store').recall({ message, company });
    case 'ONBOARDING':
      return await handleOnboarding({ message, company });
    default:
      return "ARTHA here. Not understood.\n\nTry:\n• 'Sold rice 50kg Rs.2500'\n• 'GST on Rs.10000 IT service'\n• 'Show this month report'";
  }
}

async function handleOnboarding({ message, company }) {
  const lower = message.toLowerCase();
  let bizType = null;

  if (lower.includes('1') || lower.includes('kirana') || lower.includes('shop') || lower.includes('retail')) bizType = 'kirana';
  else if (lower.includes('2') || lower.includes('software') || lower.includes('tech') || lower.includes('saas')) bizType = 'software';
  else if (lower.includes('3') || lower.includes('agency') || lower.includes('consultant') || lower.includes('freelance')) bizType = 'agency';

  if (bizType) {
    const profile = skillActivator.activate(bizType);
    await updateCompany(company.id, {
      business_type: bizType,
      skill_profile: JSON.stringify(profile),
      onboarding_complete: true
    });
    return `✅ ${bizType.toUpperCase()} profile loaded.\n\nSkills active:\n${profile.activeSkills.slice(0, 4).map(s => '• ' + s).join('\n')}\n\nReady. Send first transaction.`;
  }

  return `🙏 Welcome to ARTHA AI!\n\nBusiness type?\n\n1️⃣ Kirana / Retail\n2️⃣ Software / IT\n3️⃣ Agency / Consultant\n\nReply number.`;
}

module.exports = { route };

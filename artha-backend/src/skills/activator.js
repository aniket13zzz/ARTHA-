const software = require('./profiles/software');
const kirana   = require('./profiles/kirana');
const agency   = require('./profiles/agency');

const PROFILES = { software, kirana, agency };

function activate(businessType) {
  return PROFILES[businessType] || kirana;
}

function detectFromMessage(message) {
  const lower = message.toLowerCase();
  if (lower.includes('software') || lower.includes('saas') || lower.includes('tech')) return 'software';
  if (lower.includes('kirana') || lower.includes('shop') || lower.includes('dukan')) return 'kirana';
  if (lower.includes('agency') || lower.includes('consultant') || lower.includes('freelance')) return 'agency';
  return null;
}

module.exports = { activate, detectFromMessage };

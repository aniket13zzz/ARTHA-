const axios = require('axios');
const config = require('../../config');

// ─── TRIGGER PIPELINE ─────────────────────────────────────────────────────────
async function triggerPipeline(pipelineName, payload) {
  try {
    const res = await axios.post(
      `${config.OPENCLAW.baseUrl}/api/pipelines/${pipelineName}/trigger`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${config.OPENCLAW.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );
    console.log(`[OpenClaw] Pipeline ${pipelineName} triggered`);
    return res.data;
  } catch (err) {
    console.warn(`[OpenClaw] Pipeline trigger failed: ${err.message}`);
    return { triggered: false, error: err.message };
  }
}

// ─── SEND HEARTBEAT RESPONSE ──────────────────────────────────────────────────
async function sendHeartbeatResponse({ taskId, agentName, status, output }) {
  if (!config.OPENCLAW.apiKey) return;

  try {
    await axios.post(
      `${config.OPENCLAW.baseUrl}/api/heartbeat/${taskId}/response`,
      { agentName, status, output, timestamp: new Date().toISOString() },
      {
        headers: { 'Authorization': `Bearer ${config.OPENCLAW.apiKey}` },
        timeout: 5000,
      }
    );
  } catch (err) {
    console.warn(`[OpenClaw] Heartbeat response failed: ${err.message}`);
  }
}

module.exports = { triggerPipeline, sendHeartbeatResponse };

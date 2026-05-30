const express = require('express');
const router = express.Router();
const ceo       = require('../agents/ceo/router');
const lekhak    = require('../agents/lekhak/parser');
const tejas     = require('../agents/tejas/gst');
const vivek     = require('../agents/vivek/reports');
const memory    = require('../agents/memory/store');
const execution = require('../agents/execution/writer');
const { getCompanyById, getRecentEntries, getSummary } = require('../db/queries');

// GET /api/agents/health — all agents alive check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    agents: ['CEO','LEKHAK','TEJAS','VIVEK','MEMORY','EXECUTION','COMMUNICATION'],
    ts: new Date().toISOString(),
  });
});

// POST /api/agents/ceo — direct CEO invoke
router.post('/ceo', async (req, res) => {
  try {
    const { message, companyId } = req.body;
    if (!message || !companyId) return res.status(400).json({ error: 'message + companyId required' });
    const company = await getCompanyById(companyId);
    if (!company) return res.status(404).json({ error: 'Company not found' });
    const result = await ceo.route({ message, company });
    res.json({ agent: 'CEO', result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agents/lekhak — parse transaction
router.post('/lekhak', async (req, res) => {
  try {
    const { message, companyId } = req.body;
    if (!message || !companyId) return res.status(400).json({ error: 'message + companyId required' });
    const company = await getCompanyById(companyId);
    if (!company) return res.status(404).json({ error: 'Company not found' });
    const result = await lekhak.parseTransaction({ message, company });
    res.json({ agent: 'LEKHAK', result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agents/tejas — GST calculation
router.post('/tejas', async (req, res) => {
  try {
    const { message, companyId } = req.body;
    if (!message || !companyId) return res.status(400).json({ error: 'message + companyId required' });
    const company = await getCompanyById(companyId);
    if (!company) return res.status(404).json({ error: 'Company not found' });
    const result = await tejas.handleGST({ message, company });
    res.json({ agent: 'TEJAS', result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agents/vivek — reports
router.post('/vivek', async (req, res) => {
  try {
    const { message, companyId } = req.body;
    if (!message || !companyId) return res.status(400).json({ error: 'message + companyId required' });
    const company = await getCompanyById(companyId);
    if (!company) return res.status(404).json({ error: 'Company not found' });
    const result = await vivek.generateReport({ message, company });
    res.json({ agent: 'VIVEK', result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agents/memory/recall — recall context
router.post('/memory/recall', async (req, res) => {
  try {
    const { message, companyId } = req.body;
    const company = await getCompanyById(companyId);
    if (!company) return res.status(404).json({ error: 'Company not found' });
    const result = await memory.recall({ message, company });
    res.json({ agent: 'MEMORY', result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agents/execution/approve — trigger approved action
router.post('/execution/approve', async (req, res) => {
  try {
    const { approvalId, companyId } = req.body;
    if (!approvalId || !companyId) return res.status(400).json({ error: 'approvalId + companyId required' });
    const company = await getCompanyById(companyId);
    if (!company) return res.status(404).json({ error: 'Company not found' });
    const result = await execution.executeApprovedAction({ approvalId, company });
    res.json({ agent: 'EXECUTION', result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agents/entries/:companyId — recent entries
router.get('/entries/:companyId', async (req, res) => {
  try {
    const entries = await getRecentEntries(req.params.companyId, 20);
    res.json({ entries });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agents/summary/:companyId — monthly summary
router.get('/summary/:companyId', async (req, res) => {
  try {
    const summary = await getSummary(req.params.companyId);
    res.json({ summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

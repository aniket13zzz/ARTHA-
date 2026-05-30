const express = require('express');
const router = express.Router();
const { getOrCreateCompany, updateCompany, getCompanyById } = require('../db/queries');
const skillActivator = require('../skills/activator');

// POST /api/company/onboard — create or fetch company by telegram ID
router.post('/onboard', async (req, res) => {
  try {
    const { telegramId } = req.body;
    if (!telegramId) return res.status(400).json({ error: 'telegramId required' });
    const company = await getOrCreateCompany(telegramId);
    res.json({ company });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/company/set-type — set business type + activate skill profile
router.post('/set-type', async (req, res) => {
  try {
    const { companyId, businessType } = req.body;
    if (!companyId || !businessType) return res.status(400).json({ error: 'companyId + businessType required' });

    const profile = skillActivator.activate(businessType);
    const updated = await updateCompany(companyId, {
      business_type: businessType,
      skill_profile: JSON.stringify(profile),
      onboarding_complete: true,
    });

    res.json({ company: updated, profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/company/:id — get company details
router.get('/:id', async (req, res) => {
  try {
    const company = await getCompanyById(req.params.id);
    if (!company) return res.status(404).json({ error: 'Company not found' });
    res.json({ company });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/company/:id — update company fields
router.patch('/:id', async (req, res) => {
  try {
    const allowed = ['name', 'gstin', 'language'];
    const fields = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) fields[k] = req.body[k]; });
    if (Object.keys(fields).length === 0) return res.status(400).json({ error: 'No valid fields to update' });
    const updated = await updateCompany(req.params.id, fields);
    res.json({ company: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

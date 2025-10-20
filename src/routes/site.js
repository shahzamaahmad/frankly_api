
const express = require('express');
const router = express.Router();
const Site = require('../models/site');
const { checkPermission, checkAdmin } = require('../middlewares/checkPermission');

router.post('/', checkAdmin(), async (req, res) => {
  try {
    if (!req.body.siteCode || !req.body.siteName) {
      return res.status(400).json({ error: 'Site code and name are required' });
    }
    const s = new Site(req.body);
    await s.save();
    if (global.io) global.io.emit('site:created', s);
    res.status(201).json(s);
  } catch (err) {
    console.error('Create site error:', err);
    res.status(400).json({ error: 'Failed to create site' });
  }
});

router.get('/', checkPermission(), async (req, res) => {
  try {
    const list = await Site.find()
      .populate('engineer', 'username fullName')
      .populate('siteManager', 'username fullName')
      .populate('safetyOfficer', 'username fullName')
      .lean();
    res.json(list);
  } catch (err) {
    console.error('Get sites error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', checkPermission(), async (req, res) => {
  try {
    const item = await Site.findById(req.params.id)
      .populate('engineer', 'username fullName')
      .populate('siteManager', 'username fullName')
      .populate('safetyOfficer', 'username fullName');
    if (!item) return res.status(404).json({ error: 'Site not found' });
    res.json(item);
  } catch (err) {
    console.error('Get site error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', checkAdmin(), async (req, res) => {
  try {
    const allowedFields = ['siteCode', 'siteName', 'engineer', 'siteManager', 'safetyOfficer', 'location', 'status', 'description'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    const updated = await Site.findByIdAndUpdate(req.params.id, updates, { new: true })
      .populate('engineer', 'username fullName')
      .populate('siteManager', 'username fullName')
      .populate('safetyOfficer', 'username fullName');
    if (!updated) return res.status(404).json({ error: 'Site not found' });
    if (global.io) global.io.emit('site:updated', updated);
    res.json(updated);
  } catch (err) {
    console.error('Update site error:', err);
    res.status(400).json({ error: 'Failed to update site' });
  }
});

router.delete('/:id', checkAdmin(), async (req, res) => {
  try {
    const site = await Site.findById(req.params.id);
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }
    await Site.findByIdAndDelete(req.params.id);
    if (global.io) global.io.emit('site:deleted', { id: req.params.id });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Delete site error:', err);
    res.status(400).json({ error: 'Failed to delete site' });
  }
});

module.exports = router;

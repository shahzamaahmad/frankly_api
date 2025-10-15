
const express = require('express');
const router = express.Router();
const Site = require('../models/site');

router.post('/', async (req, res) => {
  try {
    const s = new Site(req.body);
    await s.save();
    res.status(201).json(s);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const list = await Site.find()
      .populate('engineer', 'username fullName')
      .populate('siteManager', 'username fullName')
      .populate('safetyOfficer', 'username fullName');
    res.json(list);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const item = await Site.findById(req.params.id)
      .populate('engineer', 'username fullName')
      .populate('siteManager', 'username fullName')
      .populate('safetyOfficer', 'username fullName');
    if (!item) return res.status(404).json({ message: 'Not found' });
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updated = await Site.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate('engineer', 'username fullName')
      .populate('siteManager', 'username fullName')
      .populate('safetyOfficer', 'username fullName');
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await Site.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;


const express = require('express');
const router = express.Router();
const Transaction = require('../models/transaction');
const Site = require('../models/site');

// Create transaction - if siteName provided but site not existing, create site
router.post('/', async (req, res) => {
  try {
    const body = req.body;
    if (body.siteName) {
      let site = await Site.findOne({ name: body.siteName });
      if (!site) {
        site = new Site({ name: body.siteName });
        await site.save();
      }
      body.site = site._id;
      delete body.siteName;
    }
    const t = new Transaction(body);
    await t.save();
    res.status(201).json(t);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const list = await Transaction.find().populate('site');
    res.json(list);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const item = await Transaction.findById(req.params.id).populate('site');
    if (!item) return res.status(404).json({ message: 'Not found' });
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updated = await Transaction.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await Transaction.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

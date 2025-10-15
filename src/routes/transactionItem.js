
const express = require('express');
const router = express.Router();
const TransactionItem = require('../models/transactionItem');
const Inventory = require('../models/inventory');

// Create transaction item(s) - supports single or bulk insert
router.post('/', async (req, res) => {
  try {
    const body = req.body;
    const isArray = Array.isArray(body);
    const items = isArray ? body : [body];
    
    const results = [];
    for (const item of items) {
      if (item.itemSku) {
        const invItem = await Inventory.findOne({ sku: item.itemSku });
        if (!invItem) return res.status(400).json({ message: 'Inventory item not found' });
        item.itemName = invItem._id;
        delete item.itemSku;
      }
      const ti = new TransactionItem(item);
      await ti.save();
      results.push(ti);
    }
    res.status(201).json(isArray ? results : results[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all (with optional transaction filter)
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.transactionId) filter.transactionId = req.query.transactionId;
    const list = await TransactionItem.find(filter).populate('itemName').populate('transactionId');
    res.json(list);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const item = await TransactionItem.findById(req.params.id).populate('itemName').populate('transactionId');
    if (!item) return res.status(404).json({ message: 'Not found' });
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updated = await TransactionItem.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await TransactionItem.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

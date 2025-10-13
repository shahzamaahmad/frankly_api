
const express = require('express');
const router = express.Router();
const DeliveryItem = require('../models/deliveryItem');
const Inventory = require('../models/inventory');

router.post('/', async (req, res) => {
  try {
    const body = req.body;
    if (body.itemSku) {
      const item = await Inventory.findOne({ sku: body.itemSku });
      if (!item) return res.status(400).json({ message: 'Inventory item not found' });
      body.item = item._id;
      delete body.itemSku;
    }
    const di = new DeliveryItem(body);
    await di.save();
    res.status(201).json(di);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.deliveryId) filter.deliveryId = req.query.deliveryId;
    const list = await DeliveryItem.find(filter).populate('itemName').populate('deliveryId');
    res.json(list);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const item = await DeliveryItem.findById(req.params.id).populate('itemName').populate('deliveryId');
    if (!item) return res.status(404).json({ message: 'Not found' });
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updated = await DeliveryItem.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await DeliveryItem.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

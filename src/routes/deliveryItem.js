
const express = require('express');
const router = express.Router();
const DeliveryItem = require('../models/deliveryItem');
const Inventory = require('../models/inventory');

router.post('/', async (req, res) => {
  try {
    const body = req.body;
    const isArray = Array.isArray(body);
    const items = isArray ? body : [body];
    
    const results = [];
    for (const item of items) {
      if (!item.deliveryId || (!item.itemName && !item.itemSku) || !item.quantity || item.quantity <= 0) {
        return res.status(400).json({ error: 'Delivery ID, item, and valid quantity are required' });
      }
      
      if (item.itemSku) {
        const invItem = await Inventory.findOne({ sku: item.itemSku });
        if (!invItem) return res.status(400).json({ error: 'Inventory item not found' });
        item.itemName = invItem._id;
        delete item.itemSku;
      }
      const di = new DeliveryItem({ deliveryId: item.deliveryId, itemName: item.itemName, quantity: item.quantity, receivedQuantity: item.receivedQuantity });
      await di.save();
      results.push(di);
    }
    res.status(201).json(isArray ? results : results[0]);
  } catch (err) {
    console.error('DeliveryItem creation error:', err);
    res.status(400).json({ error: 'Failed to create delivery item' });
  }
});

router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.deliveryId && typeof req.query.deliveryId === 'string') filter.deliveryId = req.query.deliveryId;
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
    if (req.body.quantity !== undefined && req.body.quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be greater than 0' });
    }
    const updates = {};
    if (req.body.quantity !== undefined) updates.quantity = req.body.quantity;
    if (req.body.receivedQuantity !== undefined) updates.receivedQuantity = req.body.receivedQuantity;
    const updated = await DeliveryItem.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!updated) return res.status(404).json({ error: 'Delivery item not found' });
    res.json(updated);
  } catch (err) {
    console.error('DeliveryItem update error:', err);
    res.status(400).json({ error: 'Failed to update delivery item' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const item = await DeliveryItem.findByIdAndDelete(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Delivery item not found' });
    }
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('DeliveryItem deletion error:', err);
    res.status(400).json({ error: 'Failed to delete delivery item' });
  }
});

module.exports = router;

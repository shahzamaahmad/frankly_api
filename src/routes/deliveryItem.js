
const express = require('express');
const router = express.Router();
const DeliveryItem = require('../models/deliveryItem');
const Inventory = require('../models/inventory');
const checkPermission = require('../middlewares/checkPermission');

router.post('/', checkPermission('addDeliveries'), async (req, res) => {
  try {
    const body = req.body;
    console.log('POST /delivery-items - Received body:', JSON.stringify(body));
    const isArray = Array.isArray(body);
    const items = isArray ? body : [body];
    
    const results = [];
    for (const item of items) {
      console.log('Processing item:', JSON.stringify(item));
      if (!item.deliveryId || (!item.itemName && !item.itemSku) || !item.quantity || item.quantity <= 0) {
        console.log('Validation failed for item');
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
      console.log('Saved delivery item:', di._id);
      results.push(di);
    }
    console.log('POST /delivery-items - Returning', results.length, 'items');
    res.status(201).json(isArray ? results : results[0]);
  } catch (err) {
    console.error('DeliveryItem creation error:', err);
    res.status(400).json({ error: 'Failed to create delivery item' });
  }
});

router.get('/', checkPermission('viewDeliveries'), async (req, res) => {
  try {
    const filter = {};
    if (req.query.deliveryId && typeof req.query.deliveryId === 'string') filter.deliveryId = req.query.deliveryId;
    console.log('GET /delivery-items - Filter:', JSON.stringify(filter));
    const list = await DeliveryItem.find(filter).populate('itemName').populate('deliveryId');
    console.log('GET /delivery-items - Found', list.length, 'items');
    res.json(list);
  } catch (err) {
    console.error('GET /delivery-items error:', err);
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id', checkPermission('viewDeliveries'), async (req, res) => {
  try {
    const item = await DeliveryItem.findById(req.params.id).populate('itemName').populate('deliveryId');
    if (!item) return res.status(404).json({ message: 'Not found' });
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', checkPermission('editDeliveries'), async (req, res) => {
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

router.delete('/:id', checkPermission('deleteDeliveries'), async (req, res) => {
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

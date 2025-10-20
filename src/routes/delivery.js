
const express = require('express');
const router = express.Router();
const Delivery = require('../models/delivery');
const Inventory = require('../models/inventory');
const multer = require('multer');

const getDubaiTime = () => new Date(new Date().getTime() + (4 * 60 * 60 * 1000));
const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});
const { uploadBufferToCloudinary } = require('../utils/cloudinary');
const { checkPermission, checkAdmin } = require('../middlewares/checkPermission');
const { createLog } = require('../utils/logger');

router.post('/', checkAdmin(), (req, res, next) => {
  upload.single('invoice')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  try {
    const body = req.body;
    
    if (body.deliveryDate && typeof body.deliveryDate === 'string') {
      body.deliveryDate = new Date(body.deliveryDate);
    }
    
    try {
      if (req.file) {
        body.invoiceImage = await uploadBufferToCloudinary(req.file.buffer, req.file.originalname || 'invoice');
      } else if (body.invoiceBase64) {
        const b = Buffer.from(body.invoiceBase64, 'base64');
        body.invoiceImage = await uploadBufferToCloudinary(b, 'invoice');
      }
    } catch (e) {
      console.error('CDN upload failed:', e.message);
      if (req.file) body.invoiceImage = req.file.buffer.toString('base64');
      else if (body.invoiceBase64) body.invoiceImage = body.invoiceBase64;
    }
    
    if (typeof body.items === 'string') {
      body.items = JSON.parse(body.items);
    }
    
    const Transaction = require('../models/transaction');
    const DeliveryModel = require('../models/delivery');
    
    const now = getDubaiTime();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const dateStr = `${dd}${mm}${yyyy}`;
    const todayPrefix = `DEL-${dateStr}-`;
    const lastDelivery = await Delivery.findOne({ deliveryId: { $regex: `^${todayPrefix}` } }).sort({ deliveryId: -1 });
    let nextNum = 1;
    if (lastDelivery) {
      const match = lastDelivery.deliveryId.match(/-(\d+)$/);
      if (match) nextNum = parseInt(match[1]) + 1;
    }
    body.deliveryId = `${todayPrefix}${String(nextNum).padStart(4, '0')}`;
    
    if (body.items && Array.isArray(body.items)) {
      for (const item of body.items) {
        if (item.itemName && item.quantity > 0) {
          const inv = await Inventory.findById(item.itemName);
          if (inv) {
            const deliveries = await DeliveryModel.find({ 'items.itemName': item.itemName });
            const totalDelivered = deliveries.reduce((sum, d) => {
              return sum + d.items.filter(i => i.itemName.toString() === item.itemName).reduce((s, i) => s + i.quantity, 0);
            }, 0) + item.quantity;
            
            const transactions = await Transaction.find({ item: item.itemName });
            const totalIssued = transactions.filter(t => t.type === 'ISSUE').reduce((sum, t) => sum + t.quantity, 0);
            const totalReturned = transactions.filter(t => t.type === 'RETURN').reduce((sum, t) => sum + t.quantity, 0);
            
            const newStock = inv.initialStock + totalDelivered - totalIssued + totalReturned;
            await Inventory.findByIdAndUpdate(item.itemName, { currentStock: newStock });
          }
        }
      }
    }
    
    const d = new Delivery(body);
    await d.save();
    
    await createLog('ADD_DELIVERY', req.user.id, req.user.username, `Added delivery: ${body.deliveryNumber || d._id}`);
    if (global.io) {
      global.io.emit('delivery:created', d);
    }
    res.status(201).json(d);
  } catch (err) {
    console.error('Create delivery error:', err);
    res.status(400).json({ error: 'Failed to create delivery' });
  }
});

router.get('/', checkPermission(), async (req, res) => {
  try {
    const list = await Delivery.find().populate('items.itemName', 'name sku');
    res.json(list);
  } catch (err) {
    console.error('Get deliveries error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', checkPermission(), async (req, res) => {
  try {
    const item = await Delivery.findById(req.params.id).populate('items.itemName', 'name sku');
    if (!item) return res.status(404).json({ error: 'Delivery not found' });
    res.json(item);
  } catch (err) {
    console.error('Get delivery error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', checkAdmin(), (req, res, next) => {
  upload.single('invoice')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  try {
    const body = req.body;
    
    const oldDelivery = await Delivery.findById(req.params.id);
    if (!oldDelivery) return res.status(404).json({ error: 'Delivery not found' });
    
    if (oldDelivery.items && Array.isArray(oldDelivery.items)) {
      for (const item of oldDelivery.items) {
        await Inventory.findByIdAndUpdate(
          item.itemName,
          { $inc: { currentStock: -item.quantity } }
        );
      }
    }
    
    try {
      if (req.file) {
        body.invoiceImage = await uploadBufferToCloudinary(req.file.buffer, req.file.originalname || 'invoice');
      }
    } catch (e) {
      console.error('CDN upload failed:', e.message);
      if (req.file) body.invoiceImage = req.file.buffer.toString('base64');
    }
    
    if (typeof body.items === 'string') {
      body.items = JSON.parse(body.items);
    }
    
    if (body.items && Array.isArray(body.items)) {
      for (const item of body.items) {
        if (item.itemName && item.quantity > 0) {
          await Inventory.findByIdAndUpdate(
            item.itemName,
            { $inc: { currentStock: item.quantity } }
          );
        }
      }
    }
    
    const shouldClearInvoice = typeof body.invoiceImage === 'string' && body.invoiceImage === '';
    if (shouldClearInvoice) delete body.invoiceImage;
    const updateOps = {};
    if (Object.keys(body).length) updateOps['$set'] = body;
    if (shouldClearInvoice) updateOps['$unset'] = { invoiceImage: '' };
    const updated = await Delivery.findByIdAndUpdate(req.params.id, updateOps, { new: true });
    
    await createLog('EDIT_DELIVERY', req.user.id, req.user.username, `Edited delivery: ${req.params.id}`);
    if (global.io) {
      global.io.emit('delivery:updated', updated);
    }
    res.json(updated);
  } catch (err) {
    console.error('Update delivery error:', err);
    res.status(400).json({ error: 'Failed to update delivery' });
  }
});

router.delete('/:id', checkAdmin(), async (req, res) => {
  try {
    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) {
      return res.status(404).json({ error: 'Delivery not found' });
    }
    
    if (delivery.items && Array.isArray(delivery.items)) {
      for (const item of delivery.items) {
        await Inventory.findByIdAndUpdate(
          item.itemName,
          { $inc: { currentStock: -item.quantity } }
        );
      }
    }

    await Delivery.findByIdAndDelete(req.params.id);
    
    await createLog('DELETE_DELIVERY', req.user.id, req.user.username, `Deleted delivery: ${req.params.id}`);
    if (global.io) {
      global.io.emit('delivery:deleted', { id: req.params.id });
    }
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Delete delivery error:', err);
    res.status(400).json({ error: 'Failed to delete delivery' });
  }
});

module.exports = router;

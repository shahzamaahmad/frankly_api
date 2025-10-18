
const express = require('express');
const router = express.Router();
const Delivery = require('../models/delivery');
const Inventory = require('../models/inventory');
const multer = require('multer');
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
const checkPermission = require('../middlewares/checkPermission');
const { createLog } = require('../utils/logger');

router.post('/', checkPermission('addDeliveries'), (req, res, next) => {
  upload.single('invoice')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  try {
    const body = req.body;
    
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
    
    const d = new Delivery(body);
    await d.save();
    
    await createLog('ADD_DELIVERY', req.user.id, req.user.username, `Added delivery: ${body.deliveryNumber || d._id}`);

    res.status(201).json(d);
  } catch (err) {
    console.error('Create delivery error:', err);
    res.status(400).json({ error: 'Failed to create delivery' });
  }
});

router.get('/', checkPermission('viewDeliveries'), async (req, res) => {
  try {
    const list = await Delivery.find().populate('items.itemName');
    res.json(list);
  } catch (err) {
    console.error('Get deliveries error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', checkPermission('viewDeliveries'), async (req, res) => {
  try {
    const item = await Delivery.findById(req.params.id).populate('items.itemName');
    if (!item) return res.status(404).json({ error: 'Delivery not found' });
    res.json(item);
  } catch (err) {
    console.error('Get delivery error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', checkPermission('editDeliveries'), (req, res, next) => {
  upload.single('invoice')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  try {
    const body = req.body;
    try {
      if (req.file) {
        body.invoiceImage = await uploadBufferToCloudinary(req.file.buffer, req.file.originalname || 'invoice');
      }
    } catch (e) {
      console.error('CDN upload failed:', e.message);
      if (req.file) body.invoiceImage = req.file.buffer.toString('base64');
    }
    const shouldClearInvoice = typeof body.invoiceImage === 'string' && body.invoiceImage === '';
    if (shouldClearInvoice) delete body.invoiceImage;
    const updateOps = {};
    if (Object.keys(body).length) updateOps['$set'] = body;
    if (shouldClearInvoice) updateOps['$unset'] = { invoiceImage: '' };
    const updated = await Delivery.findByIdAndUpdate(req.params.id, updateOps, { new: true });
    
    await createLog('EDIT_DELIVERY', req.user.id, req.user.username, `Edited delivery: ${req.params.id}`);
    
    res.json(updated);
  } catch (err) {
    console.error('Update delivery error:', err);
    res.status(400).json({ error: 'Failed to update delivery' });
  }
});

router.delete('/:id', checkPermission('deleteDeliveries'), async (req, res) => {
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
    
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Delete delivery error:', err);
    res.status(400).json({ error: 'Failed to delete delivery' });
  }
});

module.exports = router;

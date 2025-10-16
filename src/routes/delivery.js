
const express = require('express');
const router = express.Router();
const Delivery = require('../models/delivery');
const DeliveryItem = require('../models/deliveryItem');
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
    
    if (!body.deliveryNumber || !body.supplier) {
      return res.status(400).json({ error: 'Delivery number and supplier are required' });
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
    const d = new Delivery(body);
    await d.save();
    
    await createLog('ADD_DELIVERY', req.user.id, req.user.username, `Added delivery: ${body.deliveryNumber || d._id}`);

    if (body.items && Array.isArray(body.items)) {
      for (const item of body.items) {
        if (!item.itemName || !item.quantity || item.quantity <= 0) continue;
        
        const deliveryItem = new DeliveryItem({
          deliveryId: d._id,
          itemName: item.itemName,
          quantity: item.quantity
        });
        await deliveryItem.save();

        await Inventory.findByIdAndUpdate(
          item.itemName,
          { $inc: { currentStock: item.quantity } }
        );
      }
    }

    res.status(201).json(d);
  } catch (err) {
    console.error('Create delivery error:', err);
    res.status(400).json({ error: 'Failed to create delivery' });
  }
});

router.get('/', checkPermission('viewDeliveries'), async (req, res) => {
  try {
    const list = await Delivery.find();
    res.json(list);
  } catch (err) {
    console.error('Get deliveries error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', checkPermission('viewDeliveries'), async (req, res) => {
  try {
    const item = await Delivery.findById(req.params.id);
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
    
    const deliveryItems = await DeliveryItem.find({ deliveryId: req.params.id });
    
    for (const item of deliveryItems) {
      await Inventory.findByIdAndUpdate(
        item.itemName,
        { $inc: { currentStock: -item.quantity } }
      );
    }

    await DeliveryItem.deleteMany({ deliveryId: req.params.id });
    await Delivery.findByIdAndDelete(req.params.id);
    
    await createLog('DELETE_DELIVERY', req.user.id, req.user.username, `Deleted delivery: ${req.params.id}`);
    
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Delete delivery error:', err);
    res.status(400).json({ error: 'Failed to delete delivery' });
  }
});

module.exports = router;

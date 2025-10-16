
const express = require('express');
const router = express.Router();
const Delivery = require('../models/delivery');
const DeliveryItem = require('../models/deliveryItem');
const Inventory = require('../models/inventory');
const multer = require('multer');
const upload = multer();
const { uploadBufferToCloudinary } = require('../utils/cloudinary');
const checkPermission = require('../middlewares/checkPermission');

router.post('/', checkPermission('addDeliveries'), upload.single('invoice'), async (req, res) => {
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
    const d = new Delivery(body);
    await d.save();

    if (body.items && Array.isArray(body.items)) {
      for (const item of body.items) {
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
    res.status(400).json({ error: err.message });
  }
});

router.get('/', checkPermission('viewDeliveries'), async (req, res) => {
  try {
    const list = await Delivery.find();
    res.json(list);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id', checkPermission('viewDeliveries'), async (req, res) => {
  try {
    const item = await Delivery.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Not found' });
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', checkPermission('editDeliveries'), upload.single('invoice'), async (req, res) => {
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
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', checkPermission('deleteDeliveries'), async (req, res) => {
  try {
    const deliveryItems = await DeliveryItem.find({ deliveryId: req.params.id });
    
    for (const item of deliveryItems) {
      await Inventory.findByIdAndUpdate(
        item.itemName,
        { $inc: { currentStock: -item.quantity } }
      );
    }

    await DeliveryItem.deleteMany({ deliveryId: req.params.id });
    await Delivery.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

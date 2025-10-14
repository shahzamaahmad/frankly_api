
const express = require('express');
const router = express.Router();
const Delivery = require('../models/delivery');
const multer = require('multer');
const upload = multer();
const { uploadBufferToCloudflare } = require('../utils/cloudflare');
const { uploadBufferToCloudinary } = require('../utils/cloudinary');

router.post('/', upload.single('invoice'), async (req, res) => {
  try {
    const body = req.body;
    try {
      if (req.file) {
        if (process.env.CLOUDINARY_URL) {
          body.invoice = await uploadBufferToCloudinary(req.file.buffer, req.file.originalname || 'invoice');
        } else if (process.env.CF_API_TOKEN) {
          body.invoice = await uploadBufferToCloudflare(req.file.buffer, req.file.originalname || 'invoice');
        } else {
          body.invoice = req.file.buffer.toString('base64');
        }
      } else if (body.invoiceBase64) {
        if (process.env.CLOUDINARY_URL) {
          const b = Buffer.from(body.invoiceBase64, 'base64');
          body.invoice = await uploadBufferToCloudinary(b, 'invoice');
        } else if (process.env.CF_API_TOKEN) {
          const b = Buffer.from(body.invoiceBase64, 'base64');
          body.invoice = await uploadBufferToCloudflare(b, 'invoice');
        } else {
          body.invoice = body.invoiceBase64;
        }
      }
    } catch (e) {
      console.error('CDN upload failed for invoice, falling back:', e.message || e);
      if (req.file) body.invoice = req.file.buffer.toString('base64');
      else if (body.invoiceBase64) body.invoice = body.invoiceBase64;
    }
    const d = new Delivery(body);
    await d.save();
    res.status(201).json(d);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const list = await Delivery.find();
    res.json(list);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const item = await Delivery.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Not found' });
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', upload.single('invoice'), async (req, res) => {
  try {
    const body = req.body;
    try {
      if (req.file && process.env.CF_API_TOKEN) {
        const cdnUrl = await uploadBufferToCloudflare(req.file.buffer, req.file.originalname || 'invoice');
        body.invoice = cdnUrl;
      } else if (req.file) {
        body.invoice = req.file.buffer.toString('base64');
      }
    } catch (e) {
      console.error('CDN upload failed for invoice on update, falling back:', e.message || e);
      if (req.file) body.invoice = req.file.buffer.toString('base64');
    }
    const updated = await Delivery.findByIdAndUpdate(req.params.id, body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await Delivery.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

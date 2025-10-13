
const express = require('express');
const router = express.Router();
const Delivery = require('../models/delivery');
const multer = require('multer');
const upload = multer();

router.post('/', upload.single('invoice'), async (req, res) => {
  try {
    const body = req.body;
    if (req.file) {
      body.invoice = { data: req.file.buffer, contentType: req.file.mimetype, filename: req.file.originalname };
    } else if (body.invoiceBase64) {
      const b = Buffer.from(body.invoiceBase64, 'base64');
      body.invoice = { data: b, contentType: body.invoiceContentType || 'application/pdf', filename: body.invoiceFilename || 'invoice' };
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
    if (req.file) {
      body.invoice = { data: req.file.buffer, contentType: req.file.mimetype, filename: req.file.originalname };
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

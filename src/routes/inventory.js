
const express = require('express');
const router = express.Router();
const Inventory = require('../models/inventory');
const multer = require('multer');
const upload = multer();

// Create inventory (with optional image upload - base64/binary)
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const data = req.body;
    if (req.file) {
      data.image = { data: req.file.buffer, contentType: req.file.mimetype };
    } else if (data.imageBase64) {
      // if frontend sends base64 string
      const b = Buffer.from(data.imageBase64, 'base64');
      data.image = { data: b, contentType: data.imageContentType || 'image/png' };
    }
    const inv = new Inventory(data);
    await inv.save();
    res.status(201).json(inv);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all (with optional filters)
router.get('/', async (req, res) => {
  try {
    const filters = {};
    if (req.query.type) filters.type = req.query.type;
    if (req.query.origin) filters.origin = req.query.origin;
    const list = await Inventory.find(filters);
    res.json(list);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get single
router.get('/:id', async (req, res) => {
  try {
    const inv = await Inventory.findById(req.params.id);
    if (!inv) return res.status(404).json({ message: 'Not found' });
    res.json(inv);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update (PUT)
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const data = req.body;
    if (req.file) {
      data.image = { data: req.file.buffer, contentType: req.file.mimetype };
    }
    const updated = await Inventory.findByIdAndUpdate(req.params.id, data, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Patch
router.patch('/:id', async (req, res) => {
  try {
    const updated = await Inventory.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete
router.delete('/:id', async (req, res) => {
  try {
    await Inventory.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;


const express = require('express');
const router = express.Router();
const Inventory = require('../models/inventory');
const multer = require('multer');
const upload = multer();
const axios = require('axios');
const FormData = require('form-data');

const { uploadBufferToCloudflare } = require('../utils/cloudflare');
const { uploadBufferToCloudinary } = require('../utils/cloudinary');

// Create inventory (with optional image upload - base64/binary)
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const data = req.body;
    // If Cloudflare configured, upload file/base64 to Cloudflare and store CDN URL string
    try {
      if (req.file) {
        if (process.env.CLOUDINARY_URL) {
          data.image = await uploadBufferToCloudinary(req.file.buffer, req.file.originalname || 'image');
        } else if (process.env.CF_API_TOKEN) {
          data.image = await uploadBufferToCloudflare(req.file.buffer, req.file.originalname || 'image');
        } else {
          data.image = req.file.buffer.toString('base64');
        }
      } else if (data.imageBase64) {
        if (process.env.CLOUDINARY_URL) {
          const b = Buffer.from(data.imageBase64, 'base64');
          data.image = await uploadBufferToCloudinary(b, 'image');
        } else if (process.env.CF_API_TOKEN) {
          const b = Buffer.from(data.imageBase64, 'base64');
          data.image = await uploadBufferToCloudflare(b, 'image');
        } else {
          data.image = data.imageBase64; // store base64 string
        }
      }
    } catch (e) {
      console.error('CDN upload failed, falling back:', e.message || e);
      // If CDN fails, fallback to legacy storage behaviors
      if (req.file) data.image = req.file.buffer.toString('base64');
      else if (data.imageBase64) data.image = data.imageBase64;
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
    try {
      if (req.file && CF_API_TOKEN) {
        const cdnUrl = await uploadBufferToCloudflare(req.file.buffer, req.file.originalname || 'image');
        data.image = cdnUrl;
      } else if (req.file) {
        data.image = req.file.buffer.toString('base64');
      }
    } catch (e) {
      console.error('CDN upload failed on update, falling back:', e.message || e);
      if (req.file) data.image = req.file.buffer.toString('base64');
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

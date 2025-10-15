const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer();
const { uploadBufferToCloudinary } = require('../utils/cloudinary');

router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  try {
    const cdnUrl = await uploadBufferToCloudinary(req.file.buffer, req.file.originalname || 'file');
    res.json({ cdnUrl });
  } catch (err) {
    res.status(500).json({ error: 'CDN upload failed', detail: err?.message });
  }
});

module.exports = router;

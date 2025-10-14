const express = require('express');
const router = express.Router();
const axios = require('axios');
const FormData = require('form-data');
const multer = require('multer');
const upload = multer(); // memory storage

const { uploadBufferToCloudflare, cdnDeliveryUrl } = require('../utils/cloudflare');

if (!process.env.CF_ACCOUNT_ID || !process.env.CF_API_TOKEN || !process.env.CF_ACCOUNT_HASH) {
  console.warn('Cloudflare env vars not set (CF_ACCOUNT_ID/CF_API_TOKEN/CF_ACCOUNT_HASH). Uploads to CDN will fail.');
}

router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  try {
    const cdnUrl = await uploadBufferToCloudflare(req.file.buffer, req.file.originalname || 'file');
    // Return a consistent shape
    res.json({ cdnUrl, imageId: null, raw: null });
  } catch (err) {
    console.error('Cloudflare upload error', err?.response?.data || err);
    res.status(500).json({ error: 'Cloudflare upload failed', detail: err?.message || err });
  }
});

module.exports = router;

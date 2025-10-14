const express = require('express');
const router = express.Router();
const axios = require('axios');
const FormData = require('form-data');
const multer = require('multer');
const upload = multer(); // memory storage

const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CF_API_TOKEN;
const CF_ACCOUNT_HASH = process.env.CF_ACCOUNT_HASH;

if (!CF_ACCOUNT_ID || !CF_API_TOKEN || !CF_ACCOUNT_HASH) {
  console.warn('Cloudflare env vars not set (CF_ACCOUNT_ID/CF_API_TOKEN/CF_ACCOUNT_HASH). Uploads to CDN will fail.');
}

const CF_UPLOAD_URL = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/images/v1`;
function cdnDeliveryUrl(imageId, variant = 'public') {
  return `https://imagedelivery.net/${CF_ACCOUNT_HASH}/${imageId}/${variant}`;
}

router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  try {
    const form = new FormData();
    form.append('file', req.file.buffer, { filename: req.file.originalname });

    const resp = await axios.post(CF_UPLOAD_URL, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${CF_API_TOKEN}`,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    const result = resp.data && resp.data.result;
    if (!result) return res.status(500).json({ error: 'Cloudflare upload failed', raw: resp.data });
    const cdnUrl = cdnDeliveryUrl(result.id, 'public');
    res.json({ cdnUrl, imageId: result.id, raw: result });
  } catch (err) {
    console.error('Cloudflare upload error', err?.response?.data || err);
    res.status(500).json({ error: 'Cloudflare upload failed', detail: err?.message || err });
  }
});

module.exports = router;

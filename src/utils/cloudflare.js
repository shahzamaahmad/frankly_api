const axios = require('axios');
const FormData = require('form-data');

const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CF_API_TOKEN;
const CF_ACCOUNT_HASH = process.env.CF_ACCOUNT_HASH;

const CF_UPLOAD_URL = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/images/v1`;

function cdnDeliveryUrl(imageId, variant = 'public') {
  return `https://imagedelivery.net/${CF_ACCOUNT_HASH}/${imageId}/${variant}`;
}

async function uploadBufferToCloudflare(buffer, filename) {
  if (!CF_API_TOKEN || !CF_ACCOUNT_ID) throw new Error('Cloudflare not configured');
  const form = new FormData();
  form.append('file', buffer, { filename });
  const resp = await axios.post(CF_UPLOAD_URL, form, {
    headers: { ...form.getHeaders(), Authorization: `Bearer ${CF_API_TOKEN}` },
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });
  const result = resp.data && resp.data.result;
  if (!result) throw new Error('Cloudflare upload failed');
  return cdnDeliveryUrl(result.id, 'public');
}

module.exports = { uploadBufferToCloudflare, cdnDeliveryUrl };

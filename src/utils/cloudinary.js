const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

// If CLOUDINARY_URL is set, cloudinary.v2 will read it automatically.
// Optionally, you can configure cloudinary explicitly here.
if (process.env.CLOUDINARY_URL) {
  try {
    cloudinary.config();
  } catch (e) {
    // ignore - config may already be fine
  }
}

async function uploadBufferToCloudinary(buffer, filename) {
  if (!process.env.CLOUDINARY_URL) throw new Error('Cloudinary not configured');
  return new Promise((resolve, reject) => {
    const opts = { resource_type: 'auto' };
    // Strip extension for public_id to avoid duplicates; Cloudinary will add extension
    if (filename) {
      const id = filename.replace(/\.[^/.]+$/, '');
      opts.public_id = id;
    }
    const uploadStream = cloudinary.uploader.upload_stream(opts, (error, result) => {
      if (error) return reject(error);
      // result.secure_url is the CDN URL
      return resolve(result.secure_url || result.url);
    });
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

module.exports = { uploadBufferToCloudinary };

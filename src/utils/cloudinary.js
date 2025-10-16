const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

async function uploadBufferToCloudinary(buffer, filename) {
  return new Promise((resolve, reject) => {
    if (!buffer || buffer.length === 0) {
      return reject(new Error('Invalid buffer'));
    }
    
    const opts = { resource_type: 'auto' };
    if (filename) {
      const sanitized = filename.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/\.[^/.]+$/, '');
      opts.public_id = sanitized;
    }
    const uploadStream = cloudinary.uploader.upload_stream(opts, (error, result) => {
      if (error) return reject(error);
      resolve(result.secure_url || result.url);
    });
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

module.exports = { uploadBufferToCloudinary };

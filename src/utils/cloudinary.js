const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

cloudinary.config({
  cloud_name: 'daoummcel',
  api_key: '359941915345927',
  api_secret: 'my0lB_-mevYyarmob6sZsa4fquo',
});

async function uploadBufferToCloudinary(buffer, filename) {
  return new Promise((resolve, reject) => {
    if (!buffer || buffer.length === 0) {
      return reject(new Error('Invalid buffer'));
    }
    
    const opts = { resource_type: 'auto', folder: 'inventory' };
    if (filename) {
      const sanitized = filename.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/\.[^/.]+$/, '');
      opts.public_id = sanitized;
    }
    const uploadStream = cloudinary.uploader.upload_stream(opts, (error, result) => {
      if (error) {
        console.error('Cloudinary upload error:', error);
        return reject(error);
      }
      resolve(result.secure_url || result.url);
    });
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

module.exports = { uploadBufferToCloudinary };

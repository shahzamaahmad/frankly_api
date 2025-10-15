const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

async function uploadBufferToCloudinary(buffer, filename) {
  return new Promise((resolve, reject) => {
    const opts = { resource_type: 'auto' };
    if (filename) opts.public_id = filename.replace(/\.[^/.]+$/, '');
    const uploadStream = cloudinary.uploader.upload_stream(opts, (error, result) => {
      if (error) return reject(error);
      resolve(result.secure_url || result.url);
    });
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

module.exports = { uploadBufferToCloudinary };

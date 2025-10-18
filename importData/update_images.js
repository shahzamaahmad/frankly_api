const fs = require('fs');
const https = require('https');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const Inventory = require('../src/models/inventory');
require('dotenv').config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: 'daoummcel',
  api_key: '359941915345927',
  api_secret: 'my0lB_-mevYyarmob6sZsa4fquo'
});

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/warehouse_db')
  .then(() => console.log('Connected to MongoDB\n'))
  .catch(err => { console.error(err); process.exit(1); });

// Function to convert Google Drive link to direct download link
function getDirectDownloadLink(driveUrl) {
  const fileIdMatch = driveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (fileIdMatch) {
    return `https://drive.google.com/uc?export=download&id=${fileIdMatch[1]}`;
  }
  return driveUrl;
}

// Function to download image from URL
function downloadImage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { followAllRedirects: true }, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        https.get(response.headers.location, (res) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => resolve(Buffer.concat(chunks)));
          res.on('error', reject);
        });
      } else {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
      }
    }).on('error', reject);
  });
}

// Function to upload to Cloudinary
async function uploadToCloudinary(buffer, sku) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'inventory',
        public_id: sku,
        overwrite: true
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    );
    uploadStream.end(buffer);
  });
}

// Main function
async function updateImages() {
  try {
    // Read CSV file with SKU and Google Drive links
    // Format: SKU,GoogleDriveLink
    const csvPath = '../images.csv';
    
    if (!fs.existsSync(csvPath)) {
      console.log('Please create images.csv file with format: SKU,GoogleDriveLink');
      console.log('Example:');
      console.log('S100HGSBU,https://drive.google.com/file/d/1ABC123/view');
      console.log('FBC245,https://drive.google.com/file/d/1XYZ789/view');
      process.exit(0);
    }

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    console.log(`Processing ${lines.length} images...\n`);
    
    let updated = 0;
    let errors = 0;

    for (const line of lines) {
      const [sku, driveUrl] = line.split(',').map(s => s.trim());
      
      if (!sku || !driveUrl) continue;

      try {
        console.log(`Processing ${sku}...`);
        
        // Find item in database
        const item = await Inventory.findOne({ sku });
        if (!item) {
          console.log(`  Item not found: ${sku}`);
          errors++;
          continue;
        }

        // Download image from Google Drive
        const directUrl = getDirectDownloadLink(driveUrl);
        console.log(`  Downloading from Google Drive...`);
        const imageBuffer = await downloadImage(directUrl);
        
        // Upload to Cloudinary
        console.log(`  Uploading to Cloudinary...`);
        const cloudinaryUrl = await uploadToCloudinary(imageBuffer, sku);
        
        // Update database
        item.imageUrl = cloudinaryUrl;
        await item.save();
        
        console.log(`  ✓ Updated: ${cloudinaryUrl}\n`);
        updated++;
        
      } catch (err) {
        console.log(`  ✗ Error: ${err.message}\n`);
        errors++;
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Updated: ${updated}`);
    console.log(`Errors: ${errors}`);
    console.log(`Total: ${lines.length}`);
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

updateImages();

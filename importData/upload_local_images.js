const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const Inventory = require('../src/models/inventory');
require('dotenv').config();

cloudinary.config({
  cloud_name: 'daoummcel',
  api_key: '359941915345927',
  api_secret: 'my0lB_-mevYyarmob6sZsa4fquo'
});

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/warehouse_db')
  .then(() => console.log('Connected to MongoDB\n'))
  .catch(err => { console.error(err); process.exit(1); });

async function uploadLocalImages() {
  try {
    const imagesFolder = path.join(__dirname, '../../images');
    
    if (!fs.existsSync(imagesFolder)) {
      console.log('Please create "images" folder in the main project directory');
      console.log('Put your images there with filename as SKU (e.g., S100HGSBU.jpg)');
      process.exit(0);
    }

    const files = fs.readdirSync(imagesFolder).filter(f => 
      /\.(jpg|jpeg|png|gif|webp)$/i.test(f)
    );

    console.log(`Found ${files.length} images\n`);

    let updated = 0;
    let errors = 0;

    for (const file of files) {
      // Extract SKU from filename like VM1680B5.Image.083021.jpg -> VM1680B5
      const sku = file.split('.')[0];
      const filePath = path.join(imagesFolder, file);

      try {
        console.log(`Processing ${sku}...`);

        const item = await Inventory.findOne({ sku });
        if (!item) {
          console.log(`  Item not found: ${sku}`);
          errors++;
          continue;
        }

        console.log(`  Uploading to Cloudinary...`);
        const result = await cloudinary.uploader.upload(filePath, {
          folder: 'inventory',
          public_id: sku,
          overwrite: true
        });

        item.imageUrl = result.secure_url;
        await item.save();

        console.log(`  ✓ Updated: ${result.secure_url}\n`);
        updated++;

      } catch (err) {
        console.log(`  ✗ Error: ${err.message}\n`);
        errors++;
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Updated: ${updated}`);
    console.log(`Errors: ${errors}`);
    console.log(`Total: ${files.length}`);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

uploadLocalImages();

require('dotenv').config();
const mongoose = require('mongoose');
const Inventory = require('../src/models/inventory');

const DEFAULT_IMAGE_URL = 'https://res.cloudinary.com/daoummcel/image/upload/v1760768254/default_hcnkxg.jpg';

async function fixImageUrls() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const items = await Inventory.find({});
    let fixed = 0;

    for (const item of items) {
      if (item.imageUrl && !item.imageUrl.startsWith('http')) {
        item.imageUrl = DEFAULT_IMAGE_URL;
        await item.save();
        console.log(`Fixed: ${item.sku}`);
        fixed++;
      }
    }

    console.log(`\n✓ Fixed ${fixed} items with invalid image URLs`);
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixImageUrls();

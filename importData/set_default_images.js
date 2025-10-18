require('dotenv').config();
const mongoose = require('mongoose');
const Inventory = require('../src/models/inventory');

const DEFAULT_IMAGE_URL = 'https://res.cloudinary.com/daoummcel/image/upload/v1760768254/default_hcnkxg.jpg';

async function setDefaultImages() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const result = await Inventory.updateMany(
      { $or: [{ imageUrl: null }, { imageUrl: '' }, { imageUrl: { $exists: false } }] },
      { $set: { imageUrl: DEFAULT_IMAGE_URL } }
    );

    console.log(`\n✓ Updated ${result.modifiedCount} items with default image`);
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

setDefaultImages();

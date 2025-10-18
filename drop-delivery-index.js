// Run this script once to drop the old deliveryId index
// Usage: node drop-delivery-index.js

require('dotenv').config();
const mongoose = require('mongoose');

async function dropIndex() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const collection = db.collection('deliveries');
    
    // Drop the deliveryId_1 index
    await collection.dropIndex('deliveryId_1');
    console.log('Successfully dropped deliveryId_1 index');
    
    await mongoose.connection.close();
    console.log('Done');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

dropIndex();

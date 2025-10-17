const mongoose = require('mongoose');
require('dotenv').config();

async function fixIndex() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('sites');

    // Drop the old 'site' index
    try {
      await collection.dropIndex('site_1');
      console.log('Dropped old site_1 index');
    } catch (err) {
      console.log('Index site_1 not found or already dropped');
    }

    console.log('Done!');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

fixIndex();

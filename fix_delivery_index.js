const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/warehouse_db')
  .then(async () => {
    console.log('Connected to MongoDB\n');
    
    const db = mongoose.connection.db;
    const collection = db.collection('deliveries');
    
    const indexes = await collection.indexes();
    console.log('Current indexes:', JSON.stringify(indexes, null, 2));
    
    // Drop the problematic deliveryId index if it exists
    try {
      await collection.dropIndex('deliveryId_1');
      console.log('\nDropped deliveryId_1 index');
    } catch (err) {
      console.log('\nNo deliveryId_1 index to drop');
    }
    
    console.log('\nFixed!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });

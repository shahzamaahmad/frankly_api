require('dotenv').config();
const mongoose = require('mongoose');

// Import all models
const User = require('./src/models/user');
const Inventory = require('./src/models/inventory');
const Site = require('./src/models/site');
const Transaction = require('./src/models/transaction');
const Delivery = require('./src/models/delivery');
const DeliveryItem = require('./src/models/deliveryItem');
const Attendance = require('./src/models/attendance');
const Notification = require('./src/models/notification');

async function buildIndexes() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    console.log('\nBuilding indexes...\n');

    const models = [
      { name: 'User', model: User },
      { name: 'Inventory', model: Inventory },
      { name: 'Site', model: Site },
      { name: 'Transaction', model: Transaction },
      { name: 'Delivery', model: Delivery },
      { name: 'DeliveryItem', model: DeliveryItem },
      { name: 'Attendance', model: Attendance },
      { name: 'Notification', model: Notification },
    ];

    for (const { name, model } of models) {
      console.log(`Building indexes for ${name}...`);
      await model.createIndexes();
      const indexes = await model.collection.getIndexes();
      console.log(`✓ ${name}: ${Object.keys(indexes).length} indexes created`);
      console.log(`  Indexes: ${Object.keys(indexes).join(', ')}\n`);
    }

    console.log('All indexes built successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error building indexes:', error);
    process.exit(1);
  }
}

buildIndexes();

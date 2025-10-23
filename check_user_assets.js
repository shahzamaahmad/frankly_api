require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/user');

async function checkUserAssets() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const users = await User.find({}).select('username fullName assets').lean();
    console.log('\nUsers with assets:');
    users.forEach(user => {
      console.log(`\n- ${user.fullName || user.username}`);
      console.log(`  Assets count: ${user.assets?.length || 0}`);
      if (user.assets && user.assets.length > 0) {
        user.assets.forEach((asset, i) => {
          console.log(`  ${i + 1}. Item: ${asset.item}, Qty: ${asset.quantity}, Condition: ${asset.condition}`);
        });
      }
    });

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkUserAssets();

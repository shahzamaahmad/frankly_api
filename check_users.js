require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/user');

async function checkUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const users = await User.find({}).select('username fullName').lean();
    console.log('\nUsers in database:');
    users.forEach(user => {
      console.log(`- username: "${user.username}", fullName: "${user.fullName || 'NOT SET'}"`);
    });

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkUsers();

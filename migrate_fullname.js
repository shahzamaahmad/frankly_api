require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/user');

async function migrateFullName() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const users = await User.find({});
    console.log(`Found ${users.length} users`);

    let updated = 0;
    for (const user of users) {
      if (!user.fullName && user.username) {
        user.fullName = user.username;
        await user.save();
        updated++;
        console.log(`Updated user: ${user.username} -> fullName: ${user.fullName}`);
      }
    }

    console.log(`\nMigration complete! Updated ${updated} users.`);
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

migrateFullName();

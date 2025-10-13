// import_users.js
const fs = require('fs');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const Users = require('./models/user');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

const results = [];
fs.createReadStream('user.csv')
  .pipe(csv())
  .on('data', (data) => {
    results.push({
      name: data['name'],
      username: data['username'],
      password: data['password'],
      role: data['role'],
      email: data['email'],
      mobileNumber: data['mobile']
    });
  })
  .on('end', async () => {
    try {
      await Users.insertMany(results);
      console.log('Data imported successfully for users');
      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  });

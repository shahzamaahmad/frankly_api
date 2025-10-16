// import_sites.js
const fs = require('fs');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const Sites = require('./models/site');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

const results = [];
fs.createReadStream('site.csv')
  .pipe(csv())
  .on('data', (data) => {
    results.push({
      site: data['site'],
      sector: data['sector'],
      location: data['location'],
      client: data['client'],
      projectDescription: data['projectDescription'],
      siteLocation: data['siteLocation'],
      value: data['value'],
      engineer: data['engineer'],
      remark: data['remark'],
      status: data['status']
    });
  })
  .on('error', (err) => {
    console.error('CSV read error:', err);
    process.exit(1);
  })
  .on('end', async () => {
    try {
      if (results.length === 0) {
        console.log('No data to import');
        process.exit(0);
        return;
      }
      await Sites.insertMany(results, { ordered: false });
      console.log('Data imported successfully for sites');
      process.exit(0);
    } catch (err) {
      console.error('Import error:', err.message);
      process.exit(1);
    }
  });

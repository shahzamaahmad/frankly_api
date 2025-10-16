// import_deliveries.js
const fs = require('fs');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const Deliveries = require('./src/models/delivery');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

function parseDate(dateStr) {
  if (!dateStr) return null;
  const [day, month, year] = dateStr.split('/');
  return new Date(`${year}-${month}-${day}`);
}

const results = [];
fs.createReadStream('del.csv')
  .pipe(csv())
  .on('data', (data) => {
    results.push({
      deliveryId: data['deliveryId'],
      deliveryDate: parseDate(data['deliveryDate']),
      seller: data['seller'],
      amount: data['amount'],
      receivedBy: data['receivedBy'],
      remarks: data['remarks'],
      invoice: data['Invoice']
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
      await Deliveries.insertMany(results, { ordered: false });
      console.log('Data imported successfully for deliveries');
      process.exit(0);
    } catch (err) {
      console.error('Import error:', err.message);
      process.exit(1);
    }
  });

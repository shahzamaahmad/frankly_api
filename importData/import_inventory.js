// import_inventory.js
const fs = require('fs');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const Inventory = require('./models/inventory');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

const results = [];
fs.createReadStream('inventory.csv')
  .pipe(csv())
  .on('data', (data) => {
    results.push({
      sku: data['sku'],
      itemName: data['itemName'],
      type: data['type'],
      origin: data['origin'],
      initialStock: data['initialStock'],
      currentStock: data['currentStock'],
      uom: data['uom'],
      size: data['size'],
      Remark: data['remark'],
      Image: data['image']
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
      await Inventory.insertMany(results, { ordered: false });
      console.log('Data imported successfully for inventory');
      process.exit(0);
    } catch (err) {
      console.error('Import error:', err.message);
      process.exit(1);
    }
  });

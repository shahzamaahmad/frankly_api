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
  .on('end', async () => {
    try {
      await Inventory.insertMany(results);
      console.log('Data imported successfully for inventory');
      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  });

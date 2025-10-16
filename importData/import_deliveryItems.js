const mongoose = require('mongoose');
const fs = require('fs');
const csv = require('csv-parser');

const Delivery = require('./src/models/delivery');
const Inventory = require('./src/models/Inventory');
const DeliveryItem = require('./src/models/DeliveryItem');
require('dotenv').config();


mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));
const rows = [];

fs.createReadStream('deli.csv')
  .pipe(csv())
  .on('data', (row) => rows.push(row))
  .on('error', (err) => {
    console.error('CSV read error:', err);
    process.exit(1);
  })
  .on('end', async () => {
    try {
      if (rows.length === 0) {
        console.log('No data to import');
        process.exit(0);
        return;
      }
      for (const row of rows) {
        try {
          const delivery = await Delivery.findOne({ deliveryId: row.deliveryId });
          if (!delivery) {
            console.error(`Delivery not found for ID: ${row.deliveryId}`);
            continue;
          }

          const inventoryItem = await Inventory.findOne({ sku: row.itemName });
          if (!inventoryItem) {
            console.error(`Inventory not found for SKU: ${row.itemName}`);
            continue;
          }

          await DeliveryItem.create({
            deliveryId: delivery._id,
            itemName: inventoryItem._id,
            quantity: row.quantity
          });

          console.log(`Imported item: ${row.itemName} for delivery: ${row.deliveryId}`);

        } catch (err) {
          console.error('Error importing row:', err.message);
        }
      }
      console.log('Import finished!');
      process.exit(0);
    } catch (err) {
      console.error('Import error:', err.message);
      process.exit(1);
    }
  });
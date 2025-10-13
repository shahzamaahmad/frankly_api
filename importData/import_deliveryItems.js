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
  .on('end', async () => {
    for (const row of rows) {
      try {
        // Lookup Delivery ObjectId
        const delivery = await Delivery.findOne({ deliveryId: row.deliveryId }); // your custom ID field
        if (!delivery) {
          console.error(`Delivery not found for ID: ${row.deliveryId}`);
          continue;
        }

        // Lookup Inventory ObjectId
        const inventoryItem = await Inventory.findOne({ sku: row.itemName }); // your SKU/Item field
        if (!inventoryItem) {
          console.error(`Inventory not found for SKU: ${row.itemName}`);
          continue;
        }

        // Create DeliveryItem with ObjectId references
        await DeliveryItem.create({
          deliveryId: delivery._id,
          itemName: inventoryItem._id,
          quantity: row.quantity,  // adjust if you have more fields
        });

        console.log(`Imported item: ${row.itemName} for delivery: ${row.deliveryId}`);

      } catch (err) {
        console.error('Error importing row:', row, err.message);
      }
    }
    console.log('Import finished!');
    process.exit();
  });
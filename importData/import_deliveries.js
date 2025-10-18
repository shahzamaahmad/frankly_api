const fs = require('fs');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const Delivery = require('../src/models/delivery');
const DeliveryItem = require('../src/models/deliveryItem');
const Inventory = require('../src/models/inventory');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/warehouse_db')
  .then(() => console.log('Connected to MongoDB\n'))
  .catch(err => { console.error(err); process.exit(1); });

const deliveryMap = new Map();
const deliveryItems = [];
let imported = 0;
let errors = 0;

fs.createReadStream('../DeliveryItems.csv')
  .pipe(csv())
  .on('data', (row) => {
    const deliveryId = row['DeliveryID']?.trim();
    const itemName = row['Item']?.trim();
    const quantity = parseInt(row['Quantity']) || 0;

    if (!deliveryId || !itemName || quantity <= 0) return;

    if (!deliveryMap.has(deliveryId)) {
      deliveryMap.set(deliveryId, []);
    }
    deliveryMap.get(deliveryId).push({ itemName, quantity });
  })
  .on('end', async () => {
    try {
      console.log(`Processing ${deliveryMap.size} deliveries...\n`);

      for (const [deliveryId, items] of deliveryMap) {
        try {
          const existing = await Delivery.findOne({ invoiceNumber: deliveryId });
          let delivery;
          
          if (existing) {
            delivery = existing;
          } else {
            delivery = await Delivery.create({
              deliveryDate: new Date(),
              seller: 'Imported',
              amount: 0,
              invoiceNumber: deliveryId,
              remarks: 'Imported from CSV'
            });
            console.log(`Created delivery: ${deliveryId}`);
          }

          for (const { itemName, quantity } of items) {
            const item = await Inventory.findOne({ name: { $regex: new RegExp(`^${itemName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
            
            if (!item) {
              console.log(`Item not found: ${itemName}`);
              errors++;
              continue;
            }

            const existingItem = await DeliveryItem.findOne({ deliveryId: delivery._id, itemName: item._id });
            if (existingItem) continue;

            await DeliveryItem.create({
              deliveryId: delivery._id,
              itemName: item._id,
              quantity,
              receivedQuantity: quantity
            });
            
            imported++;
            console.log(`Imported: ${itemName} - ${quantity}`);
          }
        } catch (err) {
          console.log(`Error processing delivery ${deliveryId}: ${err.message}`);
          errors++;
        }
      }

      console.log(`\n=== Import Summary ===`);
      console.log(`Deliveries: ${deliveryMap.size}`);
      console.log(`Items imported: ${imported}`);
      console.log(`Errors: ${errors}`);
      process.exit(0);
    } catch (err) {
      console.error('Import error:', err.message);
      process.exit(1);
    }
  });

// import_inventory.js
const fs = require('fs');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const Inventory = require('../src/models/inventory');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/warehouse_db')
  .then(() => console.log('Connected to MongoDB\n'))
  .catch(err => { console.error(err); process.exit(1); });

const results = [];
let imported = 0;
let skipped = 0;

fs.createReadStream('../InventoryItem.csv')
  .pipe(csv())
  .on('data', (data) => {
    const sku = data['Sku']?.trim();
    const name = data['Item']?.trim();
    if (!sku || !name) return;
    
    results.push({
      sku,
      name,
      category: data['Type']?.trim() || 'General',
      origin: data['Origin']?.trim() || 'DXB',
      initialStock: parseInt(data['Initial Stock']) || 0,
      currentStock: parseInt(data['Current Stock']) || 0,
      unitOfMeasure: data['UoM']?.trim() || 'PCS',
      size: data['Size']?.trim() || '',
      remark: data['Remark ']?.trim() || '',
      imageUrl: data['Image']?.trim() || ''
    });
  })
  .on('error', (err) => {
    console.error('CSV read error:', err);
    process.exit(1);
  })
  .on('end', async () => {
    try {
      console.log(`Processing ${results.length} items...\n`);
      
      for (const item of results) {
        try {
          const existing = await Inventory.findOne({ sku: item.sku });
          if (existing) {
            skipped++;
            continue;
          }
          await Inventory.create(item);
          imported++;
          console.log(`Imported: ${item.name}`);
        } catch (err) {
          console.log(`Error importing ${item.name}: ${err.message}`);
        }
      }
      
      console.log(`\n=== Import Summary ===`);
      console.log(`Imported: ${imported}`);
      console.log(`Skipped (already exists): ${skipped}`);
      console.log(`Total: ${results.length}`);
      process.exit(0);
    } catch (err) {
      console.error('Import error:', err.message);
      process.exit(1);
    }
  });

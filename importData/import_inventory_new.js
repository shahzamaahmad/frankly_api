require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const InventorySchema = new mongoose.Schema({
  sku: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  initialStock: { type: Number, default: 0 },
  currentStock: { type: Number, default: 0, min: 0 },
  description: { type: String },
  remark: { type: String },
  category: { type: String },
  subCategory: { type: String },
  unitCost: { type: Number },
  currency: { type: String, default: 'AED' },
  unitOfMeasure: { type: String },
  weightKg: { type: Number },
  size: { type: String },
  color: { type: String },
  brand: { type: String },
  modelNumber: { type: String },
  serialNumber: { type: String },
  warrantyMonths: { type: Number },
  datePurchased: { type: Date },
  expectedLifespanMonths: { type: Number },
  status: { type: String, default: 'active' },
  reorderLevel: { type: Number },
  maxStockLevel: { type: Number },
  imageUrl: { type: String },
  barcode: { type: String }
}, { timestamps: true });

const Inventory = mongoose.model('Inventory', InventorySchema);

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\r\n').filter(line => line.trim());
  const headers = lines[0].split(',');
  
  const items = [];
  for (let i = 1; i < lines.length; i++) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let char of lines[i]) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    if (values.length >= 6) {
      items.push({
        sku: values[0] || '',
        name: values[1] || '',
        category: values[2] || '',
        origin: values[3] || '',
        initialStock: parseInt(values[4]) || 0,
        currentStock: parseInt(values[5]) || 0,
        unitOfMeasure: values[6] || 'PCS',
        size: values[7] || '',
        remark: values[8] || '',
        imageUrl: values[9] || '',
        status: 'active'
      });
    }
  }
  
  return items;
}

async function importData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const csvPath = path.join(__dirname, '../../Inventory - Inventory.csv');
    const items = parseCSV(csvPath);
    
    console.log(`Parsed ${items.length} items from CSV`);
    
    let imported = 0;
    let skipped = 0;
    
    for (const item of items) {
      try {
        const existing = await Inventory.findOne({ sku: item.sku });
        if (existing) {
          console.log(`Skipped: ${item.sku} (already exists)`);
          skipped++;
        } else {
          await Inventory.create(item);
          console.log(`Imported: ${item.sku} - ${item.name}`);
          imported++;
        }
      } catch (err) {
        console.error(`Error importing ${item.sku}:`, err.message);
        skipped++;
      }
    }
    
    console.log(`\nImport complete!`);
    console.log(`Imported: ${imported}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Total: ${items.length}`);
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
}

importData();

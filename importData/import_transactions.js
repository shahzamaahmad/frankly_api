const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Transaction = require('../src/models/transaction');
const Inventory = require('../src/models/inventory');
const Site = require('../src/models/site');

async function importTransactions() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const csvPath = path.join(__dirname, '..', '..', 'transactions.csv');
    const csvData = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvData.split('\n').filter(line => line.trim());
    
    const dataLines = lines.slice(1);
    
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    let transactionCounter = 1;

    for (const line of dataLines) {
      const parts = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          parts.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      parts.push(current.trim().replace(/^"|"$/g, ''));

      if (parts.length < 8) continue;

      const [, , itemName, outQty, inQty, inDate, lastUpdate, siteName] = parts;

      try {
        // Find item by name
        const item = await Inventory.findOne({ name: new RegExp(`^${itemName.replace(/"/g, '')}$`, 'i') });
        if (!item) {
          console.log(`Item not found: ${itemName}`);
          errors++;
          continue;
        }

        // Find or create site
        let site = await Site.findOne({ siteName: siteName.trim() });
        if (!site) {
          site = new Site({
            siteCode: siteName.trim().replace(/\s+/g, '_').toUpperCase(),
            siteName: siteName.trim(),
            client: { name: 'Unknown' }
          });
          await site.save();
          console.log(`Created site: ${siteName}`);
        }

        // Create ISSUE transaction if outQty exists
        if (outQty && parseInt(outQty) > 0) {
          const issueTransaction = new Transaction({
            transactionId: `TXN${Date.now()}${transactionCounter++}`,
            type: 'ISSUE',
            item: item._id,
            site: site._id,
            quantity: parseInt(outQty),
            timestamp: lastUpdate ? new Date(lastUpdate) : new Date()
          });
          await issueTransaction.save();
          console.log(`Imported ISSUE: ${itemName} - ${outQty}`);
          imported++;
        }

        // Create RETURN transaction if inQty and inDate exist
        if (inQty && parseInt(inQty) > 0 && inDate && inDate.trim()) {
          const returnTransaction = new Transaction({
            transactionId: `TXN${Date.now()}${transactionCounter++}`,
            type: 'RETURN',
            item: item._id,
            site: site._id,
            quantity: parseInt(inQty),
            timestamp: new Date(inDate)
          });
          await returnTransaction.save();
          console.log(`Imported RETURN: ${itemName} - ${inQty}`);
          imported++;
        }

      } catch (err) {
        console.error(`Error importing ${itemName}:`, err.message);
        errors++;
      }
    }

    console.log('\n=== Import Summary ===');
    console.log(`Imported: ${imported}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Errors: ${errors}`);
    console.log(`Total lines: ${dataLines.length}`);

    process.exit(0);
  } catch (err) {
    console.error('Import error:', err);
    process.exit(1);
  }
}

importTransactions();

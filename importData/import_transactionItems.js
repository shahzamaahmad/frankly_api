const fs = require('fs');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const TransactionItem = require('./src/models/transactionItem');
const Transaction = require('./src/models/transactions');
const Inventory = require('./src/models/Inventory');
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

fs.createReadStream('transi.csv')
  .pipe(csv())
  .on('data', (data) => results.push(data))
  .on('end', async () => {
    try {
      for (const row of results) {
        // Lookup Transaction by txnID
        const transaction = await Transaction.findOne({ transactionId: row.transactionId });
        if (!transaction) {
          console.warn(`Transaction not found: ${row.transactionId}`);
          continue;
        }

        // Lookup Inventory item by name
        const inventoryItem = await Inventory.findOne({ itemName: row.itemName });
        if (!inventoryItem) {
          console.warn(`Inventory item not found: ${row.itemName}`);
          continue;
        }

        await TransactionItem.create({
          transaction: transaction._id,       // <-- use ObjectId
          itemName: inventoryItem._id,       // <-- use ObjectId
          outQuantity: row.outQuantity || 0,
          inQuantity: row.inQuantity || 0,
          outDate: parseDate(row.outDate),
          inDate: parseDate(row.inDate)
        });
      }

      console.log('Transaction Items imported successfully');
      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  });

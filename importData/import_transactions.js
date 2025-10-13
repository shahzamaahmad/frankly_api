// import_transactions.js
const fs = require('fs');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const Transaction = require('./src/models/transaction');
const Site = require('./src/models/site');
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

fs.createReadStream('trans.csv')
  .pipe(csv())
  .on('data', (data) => results.push(data))
  .on('end', async () => {
    try {
      for (const row of results) {
        // Lookup Site by name
        let site = await Site.findOne({ Site: row.Site }); // assuming column name is 'Site'
        if (!site) {
          // If site doesn't exist, create it
          site = await Site.create({ Site: row.Site });
        }

        // Create transaction using Site _id
        await Transaction.create({
          transactionId: row['transactionId'],
          taker: row['taker'],
          site: site._id,        // <-- must use ObjectId
          outDate: parseDate(row['outDate']),
          inDate: parseDate(row['inDate']),
          returnee: row['returnee'],
          remark: row['remark']
        });
      }

      console.log('Transactions imported successfully');
      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  });

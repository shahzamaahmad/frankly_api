const mongoose = require('mongoose');
require('dotenv').config();

const Transaction = require('./src/models/transaction');
const Inventory = require('./src/models/inventory');
const Site = require('./src/models/site');
const User = require('./src/models/user');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/warehouse_db')
  .then(async () => {
    console.log('Connected to MongoDB\n');

    // Check total transactions
    const totalTxns = await Transaction.countDocuments();
    console.log(`Total Transactions: ${totalTxns}\n`);

    // Check for transactions with missing references
    const txns = await Transaction.find().limit(10);
    
    console.log('Checking first 10 transactions for issues:\n');
    
    for (const txn of txns) {
      const issues = [];
      
      // Check if item exists
      if (txn.item) {
        const item = await Inventory.findById(txn.item);
        if (!item) issues.push(`Item ${txn.item} not found`);
      } else {
        issues.push('Item is null');
      }
      
      // Check if site exists
      if (txn.site) {
        const site = await Site.findById(txn.site);
        if (!site) issues.push(`Site ${txn.site} not found`);
      } else {
        issues.push('Site is null');
      }
      
      // Check if employee exists (optional)
      if (txn.employee) {
        const emp = await User.findById(txn.employee);
        if (!emp) issues.push(`Employee ${txn.employee} not found`);
      }
      
      if (issues.length > 0) {
        console.log(`Transaction ${txn.transactionId}:`);
        issues.forEach(issue => console.log(`  - ${issue}`));
        console.log('');
      }
    }
    
    // Check for duplicate transaction IDs
    const duplicates = await Transaction.aggregate([
      { $group: { _id: '$transactionId', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]);
    
    if (duplicates.length > 0) {
      console.log('Duplicate Transaction IDs found:');
      duplicates.forEach(d => console.log(`  - ${d._id} (${d.count} times)`));
    } else {
      console.log('No duplicate transaction IDs found');
    }
    
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });

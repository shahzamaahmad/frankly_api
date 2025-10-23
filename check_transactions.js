require('dotenv').config();
const mongoose = require('mongoose');
const Transaction = require('./src/models/transaction');

async function checkTransactions() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const transactions = await Transaction.find({})
      .populate('employee', 'fullName username')
      .limit(5)
      .lean();
    
    console.log('\nSample transactions:');
    transactions.forEach(txn => {
      console.log(`\nTransaction ID: ${txn.transactionId}`);
      console.log(`Employee (raw):`, txn.employee);
      if (txn.employee) {
        console.log(`  - fullName: "${txn.employee.fullName || 'NOT SET'}"`);
        console.log(`  - username: "${txn.employee.username}"`);
      } else {
        console.log('  - Employee is NULL');
      }
    });

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkTransactions();

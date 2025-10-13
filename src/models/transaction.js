
const mongoose = require('mongoose');

function generateTransactionID() {
  const date = new Date();
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  const HH = String(date.getHours()).padStart(2, '0');
  const MM = String(date.getMinutes()).padStart(2, '0');
  const SS = String(date.getSeconds()).padStart(2, '0');
  return `txn${dd}${mm}${yy}${HH}${MM}${SS}`;
}


const TransactionSchema = new mongoose.Schema({
  transactionId: { type: String, required: true, unique: true, default: generateTransactionID },
  taker: { type: String },
  site: { type: mongoose.Schema.Types.ObjectId, ref: 'Site' },
  outDate: { type: Date },
  inDate: { type: Date },
  returnee: { type: String },
  remark: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', TransactionSchema);

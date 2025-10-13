
const mongoose = require('mongoose');

function generateTransactionItemID() {
  const date = new Date();
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  const HH = String(date.getHours()).padStart(2, '0');
  const MM = String(date.getMinutes()).padStart(2, '0');
  const SS = String(date.getSeconds()).padStart(2, '0');
  return `txnitem${dd}${mm}${yy}${HH}${MM}${SS}`;
}

const TransactionItemSchema = new mongoose.Schema({
  transactionItemId: { type: String, required: true, unique: true, default: generateTransactionItemID },
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', required: true },
  itemName: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', required: true },
  outQuantity: { type: Number, default: 0 },
  inQuantity: { type: Number, default: 0 },
  outDate: { type: Date },
  inDate: { type: Date },
  remark: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('TransactionItem', TransactionItemSchema);

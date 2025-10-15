
const mongoose = require('mongoose');

const TransactionItemSchema = new mongoose.Schema({
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', required: true },
  itemName: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', required: true },
  outQuantity: { type: Number, default: 0 },
  inQuantity: { type: Number, default: 0 },
  outDate: { type: Date },
  inDate: { type: Date },
  remark: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('TransactionItem', TransactionItemSchema);

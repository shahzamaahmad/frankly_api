
const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  taker: { type: String },
  site: { type: mongoose.Schema.Types.ObjectId, ref: 'Site' },
  outDate: { type: Date },
  inDate: { type: Date },
  returnee: { type: String },
  remark: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', TransactionSchema);

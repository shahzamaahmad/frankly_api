const mongoose = require('mongoose');

const stockTransferSchema = new mongoose.Schema({
  transferId: { type: String, required: true, unique: true },
  items: [{
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', required: true },
    quantity: { type: Number, required: true }
  }],
  fromSite: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
  toSite: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'CANCELLED'], default: 'PENDING' },
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  requestDate: { type: Date, default: Date.now },
  approvalDate: { type: Date },
  notes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('StockTransfer', stockTransferSchema);

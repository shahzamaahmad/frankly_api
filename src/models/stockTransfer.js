const mongoose = require('mongoose');

const stockTransferSchema = new mongoose.Schema({
  transferId: { type: String, required: true, unique: true },
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', required: true },
  fromSite: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
  toSite: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
  quantity: { type: Number, required: true },
  status: { type: String, enum: ['PENDING', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED'], default: 'PENDING' },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  requestDate: { type: Date, default: Date.now },
  approvalDate: { type: Date },
  transferDate: { type: Date },
  receiveDate: { type: Date },
  notes: { type: String },
  reason: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('StockTransfer', stockTransferSchema);

const mongoose = require('mongoose');

const assetTransactionSchema = new mongoose.Schema({
  transactionId: { type: String, required: true, unique: true },
  type: { type: String, enum: ['ASSIGN', 'RETURN'], required: true },
  asset: { type: mongoose.Schema.Types.ObjectId, ref: 'OfficeAsset', required: true },
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  quantity: { type: Number, required: true, default: 1 },
  assignDate: { type: Date, required: true },
  returnDate: { type: Date },
  condition: { type: String, enum: ['New', 'Good', 'Fair', 'Poor'] },
  notes: { type: String },
  status: { type: String, enum: ['ACTIVE', 'RETURNED'], default: 'ACTIVE' }
}, {
  timestamps: true
});

assetTransactionSchema.index({ transactionId: 1 });
assetTransactionSchema.index({ asset: 1 });
assetTransactionSchema.index({ employee: 1 });
assetTransactionSchema.index({ assignedBy: 1 });
assetTransactionSchema.index({ assignDate: 1 });
assetTransactionSchema.index({ status: 1 });

module.exports = mongoose.model('AssetTransaction', assetTransactionSchema);
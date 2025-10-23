const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    enum: ['ISSUE', 'RETURN'],
    required: true
  },
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  site: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site',
    required: true
  },
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventory',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  remark: {
    type: String
  },
  returnDetails: {
    notes: String
  },
  relatedTo: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false
});

transactionSchema.index({ site: 1 });
transactionSchema.index({ item: 1 });
transactionSchema.index({ timestamp: -1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ employee: 1 });
transactionSchema.index({ transactionId: 1 });
transactionSchema.index({ site: 1, timestamp: -1 });
transactionSchema.index({ item: 1, timestamp: -1 });
transactionSchema.index({ employee: 1, timestamp: -1 });
transactionSchema.index({ type: 1, timestamp: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);

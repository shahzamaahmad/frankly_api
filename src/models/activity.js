const mongoose = require('mongoose');

const ActivitySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true },
  itemType: { type: String, enum: ['inventory', 'site', 'transaction', 'delivery', 'employee', 'attendance'], required: true },
  itemId: { type: mongoose.Schema.Types.ObjectId },
  itemName: { type: String },
  details: { type: String },
}, { timestamps: true });

ActivitySchema.index({ user: 1, createdAt: -1 });
ActivitySchema.index({ createdAt: -1 });

module.exports = mongoose.model('Activity', ActivitySchema);

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subtitle: String,
  message: { type: String, required: true },
  imageUrl: String,
  linkType: { type: String, enum: ['none', 'inventory', 'site', 'transaction', 'delivery', 'employee'], default: 'none' },
  linkId: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  sentAt: Date,
  status: { type: String, enum: ['draft', 'sent'], default: 'draft' }
});

module.exports = mongoose.model('Notification', notificationSchema);

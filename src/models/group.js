const mongoose = require('mongoose');

const GroupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  avatar: String,
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

GroupSchema.index({ members: 1 });
GroupSchema.index({ createdAt: -1 });
GroupSchema.index({ isActive: 1 });

module.exports = mongoose.model('Group', GroupSchema);

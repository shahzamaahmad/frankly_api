const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  type: { type: String, enum: ['text', 'image', 'file'], default: 'text' },
  fileUrl: String,
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

MessageSchema.index({ group: 1, createdAt: -1 });
MessageSchema.index({ sender: 1 });
MessageSchema.index({ isDeleted: 1 });

module.exports = mongoose.model('Message', MessageSchema);

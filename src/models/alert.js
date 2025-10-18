const mongoose = require('mongoose');

const AlertSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  sendingDate: { type: Date, required: true },
  expiryDate: { type: Date },
  sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  sentToAll: { type: Boolean, default: false },
  dismissedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

AlertSchema.pre('save', function(next) {
  try {
    if (!this.expiryDate) {
      this.expiryDate = new Date(this.sendingDate.getTime() + 2 * 24 * 60 * 60 * 1000);
    }
    return next();
  } catch (err) {
    console.error('Alert pre-save error:', err);
    return next(err);
  }
});

AlertSchema.index({ expiryDate: 1 });
AlertSchema.index({ createdAt: -1 });
AlertSchema.index({ sendingDate: -1 });
AlertSchema.index({ sentBy: 1 });
AlertSchema.index({ expiryDate: 1, sendingDate: -1 });

module.exports = mongoose.model('Alert', AlertSchema, 'notifications');

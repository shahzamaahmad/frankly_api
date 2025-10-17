const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  sendingDate: { type: Date, required: true },
  expiryDate: { type: Date },
  sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  sentToAll: { type: Boolean, default: false },
}, { timestamps: true });

NotificationSchema.pre('save', function(next) {
  try {
    if (!this.expiryDate) {
      this.expiryDate = new Date(this.sendingDate.getTime() + 2 * 24 * 60 * 60 * 1000);
    }
    return next();
  } catch (err) {
    console.error('Notification pre-save error:', err);
    return next(err);
  }
});

NotificationSchema.index({ expiryDate: 1 });
NotificationSchema.index({ createdAt: -1 });
NotificationSchema.index({ sendingDate: -1 });
NotificationSchema.index({ sentBy: 1 });
NotificationSchema.index({ expiryDate: 1, sendingDate: -1 });

module.exports = mongoose.model('Notification', NotificationSchema);

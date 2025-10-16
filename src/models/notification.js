const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  sendingDate: { type: Date, required: true },
  expiryDate: { type: Date },
  sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

NotificationSchema.pre('save', function(next) {
  if (!this.expiryDate) {
    this.expiryDate = new Date(this.sendingDate.getTime() + 2 * 24 * 60 * 60 * 1000);
  }
  next();
});

module.exports = mongoose.model('Notification', NotificationSchema);

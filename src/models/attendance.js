const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  checkIn: {
    type: Date,
    required: true,
    index: true
  },
  checkOut: {
    type: Date,
    index: true
  },
  checkInLocation: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    address: { type: String, required: true }
  },
  checkOutLocation: {
    latitude: Number,
    longitude: Number,
    address: String
  },
  workingHours: {
    type: Number,
    default: 0
  },
  date: {
    type: String,
    required: true,
    index: true
  },
  sessionNumber: {
    type: Number,
    default: 1,
    index: true
  },
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved'
  },
  rejectionReason: String,
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date
}, {
  timestamps: true
});

attendanceSchema.index({ user: 1, date: 1 });
attendanceSchema.index({ date: 1, checkIn: 1 });
attendanceSchema.index({ user: 1, checkIn: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
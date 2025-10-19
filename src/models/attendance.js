const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  checkIn: {
    type: Date,
    required: true
  },
  checkOut: {
    type: Date
  },
  checkInLocation: {
    latitude: Number,
    longitude: Number,
    address: String
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
    required: true
  },
  sessionNumber: {
    type: Number,
    default: 1
  },
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  rejectionReason: {
    type: String
  }
}, { timestamps: true });

attendanceSchema.index({ user: 1, date: 1 });
attendanceSchema.index({ date: 1 });
attendanceSchema.index({ user: 1 });
attendanceSchema.index({ checkIn: -1 });
attendanceSchema.index({ checkOut: 1 });
attendanceSchema.index({ date: 1, checkIn: -1 });
attendanceSchema.index({ user: 1, checkIn: -1 });
attendanceSchema.index({ sessionNumber: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);

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
  }
}, { timestamps: true });

attendanceSchema.index({ user: 1, date: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);

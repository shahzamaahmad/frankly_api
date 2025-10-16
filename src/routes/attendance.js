const express = require('express');
const router = express.Router();
const Attendance = require('../models/attendance');
const { createLog } = require('../utils/logger');

router.post('/checkin', async (req, res) => {
  try {
    const { latitude, longitude, address, date, checkInTime } = req.body;
    
    if (!latitude || !longitude || !address) {
      return res.status(400).json({ message: 'Location data is required' });
    }
    
    const recordCheckIn = checkInTime ? new Date(checkInTime) : new Date();
    const recordDate = date || new Date().toISOString().split('T')[0];
    console.log(`/checkin - Using date: ${recordDate}, checkInTime: ${recordCheckIn}`);
    
    const openAttendance = await Attendance.findOne({
      user: req.user.id,
      checkOut: null
    });
    
    if (openAttendance) {
      return res.status(400).json({ message: 'Please check out first before checking in again' });
    }
    
    const attendance = new Attendance({
      user: req.user.id,
      checkIn: recordCheckIn,
      checkInLocation: { latitude, longitude, address },
      date: recordDate
    });
    
    await attendance.save();
    console.log(`/checkin - Saved attendance with date: ${attendance.date}`);
    await createLog('CHECKIN', req.user.id, req.user.username, `Checked in at ${address || 'unknown location'}`);
    res.status(201).json(attendance);
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/checkout/:id', async (req, res) => {
  try {
    const { latitude, longitude, address, checkOutTime } = req.body;
    
    if (!latitude || !longitude || !address) {
      return res.status(400).json({ message: 'Location data is required' });
    }
    
    const attendance = await Attendance.findById(req.params.id);
    
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }
    
    if (attendance.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const recordCheckOut = checkOutTime ? new Date(checkOutTime) : new Date();
    const workingHours = Math.floor((recordCheckOut - attendance.checkIn) / 1000);
    
    attendance.checkOut = recordCheckOut;
    attendance.checkOutLocation = { latitude, longitude, address };
    attendance.workingHours = workingHours;
    await attendance.save();
    
    await createLog('CHECKOUT', req.user.id, req.user.username, `Checked out at ${address || 'unknown location'} - ${Math.floor(workingHours / 3600)}h ${Math.floor((workingHours % 3600) / 60)}m`);
    
    res.json(attendance);
  } catch (error) {
    console.error('Check-out error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { date, userId } = req.query;
    const query = {};
    
    if (date && typeof date === 'string') query.date = date;
    if (userId && typeof userId === 'string') query.user = userId;
    
    const records = await Attendance.find(query)
      .populate('user', 'fullName username')
      .sort({ checkIn: -1 });
    
    res.json(records);
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/today', async (req, res) => {
  try {
    const date = new Date().toISOString().split('T')[0];
    console.log(`/today - Looking for date: ${date}, user: ${req.user.id}`);
    const records = await Attendance.find({ date, user: req.user.id })
      .populate('user', 'fullName username')
      .sort({ checkIn: -1 });
    console.log(`/today - Found ${records.length} records`);
    for (const r of records) {
      console.log(`  Record: date=${r.date}, checkIn=${r.checkIn}, checkOut=${r.checkOut}`);
    }
    
    let totalSeconds = 0;
    for (const record of records) {
      if (record.checkOut) {
        totalSeconds += record.workingHours;
      } else {
        totalSeconds += Math.floor((new Date() - record.checkIn) / 1000);
      }
    }
    
    res.json({ records, totalWorkingSeconds: totalSeconds });
  } catch (error) {
    console.error('Get today attendance error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const attendance = await Attendance.findByIdAndDelete(req.params.id);
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }
    await createLog('DELETE_ATTENDANCE', req.user.id, req.user.username, `Deleted attendance record`);
    res.json({ message: 'Attendance deleted' });
  } catch (error) {
    console.error('Delete attendance error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;

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
    
    const todayRecordsCount = await Attendance.countDocuments({
      user: req.user.id,
      date: recordDate
    });
    const sessionNumber = todayRecordsCount + 1;
    
    const attendance = new Attendance({
      user: req.user.id,
      checkIn: recordCheckIn,
      checkInLocation: { latitude, longitude, address },
      date: recordDate,
      sessionNumber
    });
    
    await attendance.save();
    console.log(`/checkin - Saved attendance with date: ${attendance.date}`);
    createLog('CHECKIN', req.user.id, req.user.username, `Checked in at ${address || 'unknown location'}`).catch(e => console.error('Log failed:', e));
    res.status(201).json(attendance);
  } catch (error) {
    console.error('Check-in error:', error.message, error.stack);
    res.status(500).json({ message: 'Internal server error', error: error.message });
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
    
    createLog('CHECKOUT', req.user.id, req.user.username, `Checked out at ${address || 'unknown location'} - ${Math.floor(workingHours / 3600)}h ${Math.floor((workingHours % 3600) / 60)}m`).catch(e => console.error('Log failed:', e));
    
    res.json(attendance);
  } catch (error) {
    console.error('Check-out error:', error.message, error.stack);
    res.status(500).json({ message: 'Internal server error', error: error.message });
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
    console.error('Get attendance error:', error.message, error.stack);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

router.get('/today', async (req, res) => {
  try {
    const clientDate = req.query.date;
    const date = clientDate || new Date().toISOString().split('T')[0];
    
    const records = await Attendance.find({ date, user: req.user.id })
      .populate('user', 'fullName username')
      .select('user checkIn checkOut workingHours date sessionNumber')
      .sort({ checkIn: -1 })
      .lean();
    
    let totalSeconds = 0;
    const now = new Date();
    for (const record of records) {
      if (record.checkOut) {
        totalSeconds += record.workingHours;
      } else {
        const elapsed = Math.floor((now - new Date(record.checkIn)) / 1000);
        totalSeconds += Math.max(0, elapsed);
      }
    }
    
    res.json({ records, totalWorkingSeconds: totalSeconds });
  } catch (error) {
    console.error('Get today attendance error:', error.message, error.stack);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const attendance = await Attendance.findByIdAndDelete(req.params.id);
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }
    createLog('DELETE_ATTENDANCE', req.user.id, req.user.username, `Deleted attendance record`).catch(e => console.error('Log failed:', e));
    res.json({ message: 'Attendance deleted' });
  } catch (error) {
    console.error('Delete attendance error:', error.message, error.stack);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

module.exports = router;

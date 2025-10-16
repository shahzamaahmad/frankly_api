const express = require('express');
const router = express.Router();
const Attendance = require('../models/attendance');
const { createLog } = require('../utils/logger');

router.post('/checkin', async (req, res) => {
  try {
    const { latitude, longitude, address, date } = req.body;
    const recordDate = date || new Date().toISOString().split('T')[0];
    
    const openAttendance = await Attendance.findOne({
      user: req.user.id,
      checkOut: null
    });
    
    if (openAttendance) {
      return res.status(400).json({ message: 'Please check out first before checking in again' });
    }
    
    const attendance = new Attendance({
      user: req.user.id,
      checkIn: new Date(),
      checkInLocation: { latitude, longitude, address },
      date: recordDate
    });
    
    await attendance.save();
    await createLog('CHECKIN', req.user.id, req.user.username, `Checked in at ${address || 'unknown location'}`);
    res.status(201).json(attendance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/checkout/:id', async (req, res) => {
  try {
    const { latitude, longitude, address } = req.body;
    const attendance = await Attendance.findById(req.params.id);
    
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }
    
    const checkOutTime = new Date();
    const workingHours = Math.floor((checkOutTime - attendance.checkIn) / 1000);
    
    attendance.checkOut = checkOutTime;
    attendance.checkOutLocation = { latitude, longitude, address };
    attendance.workingHours = workingHours;
    await attendance.save();
    
    await createLog('CHECKOUT', req.user.id, req.user.username, `Checked out at ${address || 'unknown location'} - ${Math.floor(workingHours / 3600)}h ${Math.floor((workingHours % 3600) / 60)}m`);
    
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { date, userId } = req.query;
    const query = {};
    
    if (date) query.date = date;
    if (userId) query.user = userId;
    
    const records = await Attendance.find(query)
      .populate('user', 'fullName username')
      .sort({ checkIn: -1 });
    
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/today', async (req, res) => {
  try {
    const date = new Date().toISOString().split('T')[0];
    const records = await Attendance.find({ date })
      .populate('user', 'fullName username')
      .sort({ checkIn: -1 });
    
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
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
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

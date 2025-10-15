const express = require('express');
const router = express.Router();
const Attendance = require('../models/attendance');

router.post('/checkin', async (req, res) => {
  try {
    const { latitude, longitude, address } = req.body;
    const date = new Date().toISOString().split('T')[0];
    
    const attendance = new Attendance({
      user: req.user.id,
      checkIn: new Date(),
      checkInLocation: { latitude, longitude, address },
      date
    });
    
    await attendance.save();
    res.status(201).json(attendance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/checkout/:id', async (req, res) => {
  try {
    const { latitude, longitude, address } = req.body;
    const attendance = await Attendance.findByIdAndUpdate(
      req.params.id,
      {
        checkOut: new Date(),
        checkOutLocation: { latitude, longitude, address }
      },
      { new: true }
    );
    
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }
    
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
    else query.user = req.user.id;
    
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
    const records = await Attendance.find({
      user: req.user.id,
      date
    }).sort({ checkIn: -1 });
    
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const Attendance = require('../models/attendance');
const User = require('../models/user');
const { authMiddleware } = require('../middlewares/auth');

// Check in
router.post('/checkin', authMiddleware, async (req, res) => {
  try {
    const { latitude, longitude, address, date, checkInTime, userId } = req.body;
    
    if (!latitude || !longitude || !address) {
      return res.status(400).json({ error: 'Location data is required' });
    }

    const targetUserId = userId || req.user.id;
    const checkInDate = date || new Date().toISOString().split('T')[0];
    const checkInDateTime = checkInTime ? new Date(checkInTime) : new Date();

    // Check if user already checked in today
    const existingAttendance = await Attendance.findOne({
      user: targetUserId,
      date: checkInDate,
      checkOut: null
    });

    if (existingAttendance) {
      return res.status(400).json({ error: 'Already checked in for today' });
    }

    // Get session number for today
    const todayAttendance = await Attendance.find({
      user: targetUserId,
      date: checkInDate
    }).sort({ sessionNumber: -1 });

    const sessionNumber = todayAttendance.length > 0 ? todayAttendance[0].sessionNumber + 1 : 1;

    const attendance = new Attendance({
      user: targetUserId,
      checkIn: checkInDateTime,
      checkInLocation: { latitude, longitude, address },
      date: checkInDate,
      sessionNumber
    });

    await attendance.save();

    // Send push notification if admin is checking in someone else
    if (userId && userId !== req.user.id) {
      try {
        const axios = require('axios');
        await axios.post('https://onesignal.com/api/v1/notifications', {
          app_id: process.env.ONESIGNAL_APP_ID,
          include_external_user_ids: [targetUserId],
          headings: { en: 'Checked In' },
          contents: { en: `You have been checked in and approved by ${req.user.fullName}` }
        }, {
          headers: { 'Authorization': `Basic ${process.env.ONESIGNAL_API_KEY}` }
        });
      } catch (notifError) {
        console.error('Notification error:', notifError.message);
      }
    }

    res.json({ 
      success: true, 
      attendance: {
        id: attendance._id,
        checkIn: attendance.checkIn,
        sessionNumber: attendance.sessionNumber
      }
    });
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Check out
router.put('/checkout/:id', authMiddleware, async (req, res) => {
  try {
    const { latitude, longitude, address, checkOutTime } = req.body;
    
    if (!latitude || !longitude || !address) {
      return res.status(400).json({ error: 'Location data is required' });
    }

    const attendance = await Attendance.findById(req.params.id);
    if (!attendance) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }

    if (attendance.checkOut) {
      return res.status(400).json({ error: 'Already checked out' });
    }

    const checkOutDateTime = checkOutTime ? new Date(checkOutTime) : new Date();
    const workingHours = (checkOutDateTime - attendance.checkIn) / (1000 * 60 * 60);

    attendance.checkOut = checkOutDateTime;
    attendance.checkOutLocation = { latitude, longitude, address };
    attendance.workingHours = Math.max(0, workingHours);

    await attendance.save();

    // Send push notification if admin is checking out someone else
    if (attendance.user.toString() !== req.user.id) {
      try {
        const axios = require('axios');
        await axios.post('https://onesignal.com/api/v1/notifications', {
          app_id: process.env.ONESIGNAL_APP_ID,
          include_external_user_ids: [attendance.user.toString()],
          headings: { en: 'Checked Out' },
          contents: { en: `You have been checked out by ${req.user.fullName}` }
        }, {
          headers: { 'Authorization': `Basic ${process.env.ONESIGNAL_API_KEY}` }
        });
      } catch (notifError) {
        console.error('Notification error:', notifError.message);
      }
    }

    res.json({ success: true, workingHours: attendance.workingHours });
  } catch (error) {
    console.error('Check-out error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get today's attendance
router.get('/today', authMiddleware, async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const attendance = await Attendance.find({ date: targetDate })
      .populate('user', 'username fullName role')
      .select('user checkIn checkOut workingHours sessionNumber approvalStatus')
      .lean()
      .sort({ checkIn: -1 });

    res.json({ records: attendance });
  } catch (error) {
    console.error('Today attendance error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all attendance
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { date, userId } = req.query;
    const query = {};
    
    if (date) query.date = date;
    if (userId) query.user = userId;

    const attendance = await Attendance.find(query)
      .populate('user', 'username fullName role')
      .sort({ checkIn: -1 })
      .lean();

    res.json(attendance);
  } catch (error) {
    console.error('Attendance fetch error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get monthly report
router.get('/monthly-report', authMiddleware, async (req, res) => {
  try {
    const { userId, year, month } = req.query;
    
    if (!userId || !year || !month) {
      return res.status(400).json({ error: 'userId, year, and month are required' });
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    const dateRange = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      dateRange.push(d.toISOString().split('T')[0]);
    }

    const attendance = await Attendance.find({
      user: userId,
      date: { $in: dateRange }
    }).sort({ date: 1, sessionNumber: 1 });

    const report = {
      userId,
      year: parseInt(year),
      month: parseInt(month),
      totalDays: dateRange.length,
      presentDays: [...new Set(attendance.map(a => a.date))].length,
      totalHours: attendance.reduce((sum, a) => sum + (a.workingHours || 0), 0),
      records: attendance
    };

    res.json(report);
  } catch (error) {
    console.error('Monthly report error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update attendance
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { checkIn, checkOut } = req.body;
    
    const attendance = await Attendance.findById(req.params.id);
    if (!attendance) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }

    if (checkIn) attendance.checkIn = new Date(checkIn);
    if (checkOut) attendance.checkOut = new Date(checkOut);
    
    if (attendance.checkIn && attendance.checkOut) {
      const workingHours = (attendance.checkOut - attendance.checkIn) / (1000 * 60 * 60);
      attendance.workingHours = Math.max(0, workingHours);
    }

    await attendance.save();
    res.json({ success: true });
  } catch (error) {
    console.error('Update attendance error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete attendance
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await Attendance.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete attendance error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get pending attendance for approval
router.get('/pending', authMiddleware, async (req, res) => {
  try {
    const attendance = await Attendance.find({ approvalStatus: 'pending' })
      .populate('user', 'username fullName role')
      .sort({ checkIn: -1 });

    res.json(attendance);
  } catch (error) {
    console.error('Pending attendance error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Approve attendance
router.put('/:id/approve', authMiddleware, async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id);
    if (!attendance) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }

    attendance.approvalStatus = 'approved';
    attendance.approvedBy = req.user.id;
    attendance.approvedAt = new Date();

    await attendance.save();
    res.json({ success: true });
  } catch (error) {
    console.error('Approve attendance error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reject attendance
router.put('/:id/reject', authMiddleware, async (req, res) => {
  try {
    const { reason } = req.body;
    
    const attendance = await Attendance.findById(req.params.id);
    if (!attendance) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }

    attendance.approvalStatus = 'rejected';
    attendance.rejectionReason = reason;
    attendance.approvedBy = req.user.id;
    attendance.approvedAt = new Date();

    await attendance.save();
    res.json({ success: true });
  } catch (error) {
    console.error('Reject attendance error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get active employee locations
router.get('/active-locations', authMiddleware, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const activeAttendance = await Attendance.find({
      date: today,
      checkOut: null
    }).populate('user', 'username fullName role');

    const locations = activeAttendance.map(att => ({
      userId: att.user._id,
      username: att.user.username,
      fullName: att.user.fullName,
      role: att.user.role,
      checkIn: att.checkIn,
      location: att.checkInLocation,
      sessionNumber: att.sessionNumber
    }));

    res.json(locations);
  } catch (error) {
    console.error('Active locations error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const Attendance = require('../models/attendance');

/**
 * @swagger
 * tags:
 *   name: Attendance
 *   description: Attendance tracking
 */

/**
 * @swagger
 * /attendance/checkin:
 *   post:
 *     summary: Check in
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - latitude
 *               - longitude
 *               - address
 *             properties:
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *               address:
 *                 type: string
 *     responses:
 *       201:
 *         description: Checked in successfully
 */
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
    console.log(`Checkout request: id=${req.params.id}, user=${req.user.username}`);
    const { latitude, longitude, address, checkOutTime } = req.body;
    
    if (!latitude || !longitude || !address) {
      return res.status(400).json({ message: 'Location data is required' });
    }
    
    const attendance = await Attendance.findById(req.params.id);
    console.log(`Attendance found: ${attendance ? 'yes' : 'no'}`);
    if (attendance) {
      console.log(`Attendance user: ${attendance.user}, Request user: ${req.user.id}`);
    }
    
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
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
    if (!req.user.permissions?.viewReportAttendance) {
      return res.status(403).json({ message: 'Permission denied' });
    }
    
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
    
    if (req.user.permissions?.viewReportAttendance) {
      const records = await Attendance.find({ date })
        .populate('user', 'fullName username')
        .select('user checkIn checkOut workingHours date sessionNumber')
        .sort({ checkIn: -1 })
        .lean();
      
      res.json({ records });
    } else {
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
    }
  } catch (error) {
    console.error('Get today attendance error:', error.message, error.stack);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

router.get('/monthly-report', async (req, res) => {
  try {
    if (!req.user.permissions?.viewReportAttendance) {
      return res.status(403).json({ message: 'Permission denied' });
    }
    
    const { userId, year, month } = req.query;
    
    if (!userId || !year || !month) {
      return res.status(400).json({ message: 'userId, year, and month are required' });
    }
    
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(month), 0);
    
    const records = await Attendance.find({
      user: userId,
      date: {
        $gte: startDate.toISOString().split('T')[0],
        $lte: endDate.toISOString().split('T')[0]
      }
    }).lean();
    
    const dailyRecords = {};
    for (const record of records) {
      if (!dailyRecords[record.date]) {
        dailyRecords[record.date] = { sessions: [], totalWorkingHours: 0 };
      }
      dailyRecords[record.date].sessions.push(record);
      dailyRecords[record.date].totalWorkingHours += record.workingHours || 0;
    }
    
    const report = [];
    const today = new Date();
    const maxDate = endDate < today ? endDate : today;
    
    for (let d = new Date(startDate); d <= maxDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      if (dailyRecords[dateStr]) {
        report.push({
          date: dateStr,
          status: 'present',
          sessions: dailyRecords[dateStr].sessions,
          totalWorkingHours: dailyRecords[dateStr].totalWorkingHours
        });
      } else {
        report.push({
          date: dateStr,
          status: 'absent',
          sessions: [],
          totalWorkingHours: 0
        });
      }
    }
    
    const totalHours = Object.values(dailyRecords).reduce((sum, day) => sum + day.totalWorkingHours, 0);
    const presentDays = Object.keys(dailyRecords).length;
    const absentDays = report.length - presentDays;
    
    res.json({ report, totalHours, presentDays, absentDays });
  } catch (error) {
    console.error('Monthly report error:', error.message, error.stack);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    if (!req.user.permissions?.editReportAttendance) {
      return res.status(403).json({ message: 'Permission denied' });
    }
    
    const { checkIn, checkOut } = req.body;
    const attendance = await Attendance.findById(req.params.id);
    
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }
    
    if (checkIn) attendance.checkIn = new Date(checkIn);
    if (checkOut) {
      attendance.checkOut = new Date(checkOut);
      const workingHours = Math.floor((attendance.checkOut - attendance.checkIn) / 1000);
      attendance.workingHours = workingHours;
    } else {
      attendance.checkOut = null;
      attendance.workingHours = 0;
    }
    
    await attendance.save();
    createLog('EDIT_ATTENDANCE', req.user.id, req.user.username, `Edited attendance record`).catch(e => console.error('Log failed:', e));
    res.json(attendance);
  } catch (error) {
    console.error('Update attendance error:', error.message, error.stack);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (!req.user.permissions?.deleteReportAttendance) {
      return res.status(403).json({ message: 'Permission denied' });
    }
    
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

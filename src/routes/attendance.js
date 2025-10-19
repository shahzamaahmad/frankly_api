const express = require('express');
const router = express.Router();
const Attendance = require('../models/attendance');
const User = require('../models/user');
const axios = require('axios');

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

const getDubaiTime = () => new Date(new Date().getTime() + (4 * 60 * 60 * 1000));
const getDubaiDate = () => getDubaiTime().toISOString().split('T')[0];

router.post('/checkin', async (req, res) => {
  try {
    const { latitude, longitude, address, userId } = req.body;
    
    if (!latitude || !longitude || !address) {
      return res.status(400).json({ message: 'Location data is required' });
    }
    
    const targetUserId = userId || req.user.id;
    
    if (userId && userId !== req.user.id && !req.user.permissions?.approveAttendance) {
      return res.status(403).json({ message: 'Permission denied to check in for other users' });
    }
    
    const recordCheckIn = getDubaiTime();
    const recordDate = getDubaiDate();
    console.log(`/checkin - Using date: ${recordDate}, checkInTime: ${recordCheckIn}`);
    
    const openAttendance = await Attendance.findOne({
      user: targetUserId,
      checkOut: null
    });
    
    if (openAttendance && !userId) {
      return res.status(400).json({ message: 'Please check out first before checking in again' });
    }
    
    if (openAttendance && userId && req.user.permissions?.approveAttendance) {
      const workingHours = Math.floor((getDubaiTime() - openAttendance.checkIn) / 1000);
      openAttendance.checkOut = getDubaiTime();
      openAttendance.checkOutLocation = { latitude, longitude, address };
      openAttendance.workingHours = workingHours;
      await openAttendance.save();
      
      const logMsg = `Checked out ${targetUserId} at ${address || 'unknown location'}`;
      createLog('CHECKOUT', req.user.id, req.user.username, logMsg).catch(e => console.error('Log failed:', e));
      
      if (process.env.ONESIGNAL_APP_ID && process.env.ONESIGNAL_REST_API_KEY) {
        console.log('Sending OneSignal checkout notification to user:', targetUserId);
        axios.post('https://onesignal.com/api/v1/notifications', {
          app_id: process.env.ONESIGNAL_APP_ID,
          include_external_user_ids: [targetUserId],
          headings: { en: 'Checked Out' },
          contents: { en: `You have been checked out by ${req.user.fullName || req.user.username}` }
        }, {
          headers: { 'Authorization': `Basic ${process.env.ONESIGNAL_REST_API_KEY}` }
        }).then(response => {
          console.log('OneSignal checkout notification sent:', response.data);
        }).catch(e => {
          console.error('OneSignal checkout error:', e.response?.data || e.message);
        });
      } else {
        console.log('OneSignal not configured for checkout');
      }
      
      if (global.io) global.io.emit('attendance:checkout', openAttendance);
      return res.json(openAttendance);
    }
    
    const todayRecordsCount = await Attendance.countDocuments({
      user: targetUserId,
      date: recordDate
    });
    const sessionNumber = todayRecordsCount + 1;
    
    const attendance = new Attendance({
      user: targetUserId,
      checkIn: recordCheckIn,
      checkInLocation: { latitude, longitude, address },
      date: recordDate,
      sessionNumber,
      approvalStatus: userId && req.user.permissions?.approveAttendance ? 'approved' : 'pending',
      approvedBy: userId && req.user.permissions?.approveAttendance ? req.user.id : null,
      approvedAt: userId && req.user.permissions?.approveAttendance ? getDubaiTime() : null
    });
    
    await attendance.save();
    console.log(`/checkin - Saved attendance with date: ${attendance.date}`);
    const logMsg = userId ? `Checked in ${targetUserId} at ${address || 'unknown location'}` : `Checked in at ${address || 'unknown location'}`;
    createLog('CHECKIN', req.user.id, req.user.username, logMsg).catch(e => console.error('Log failed:', e));
    
    if (userId && req.user.permissions?.approveAttendance) {
      if (process.env.ONESIGNAL_APP_ID && process.env.ONESIGNAL_REST_API_KEY) {
        console.log('Sending OneSignal notification to user:', targetUserId);
        axios.post('https://onesignal.com/api/v1/notifications', {
          app_id: process.env.ONESIGNAL_APP_ID,
          include_external_user_ids: [targetUserId],
          headings: { en: 'Checked In' },
          contents: { en: `You have been checked in and approved by ${req.user.fullName || req.user.username}` }
        }, {
          headers: { 'Authorization': `Basic ${process.env.ONESIGNAL_REST_API_KEY}` }
        }).then(response => {
          console.log('OneSignal notification sent successfully:', response.data);
        }).catch(e => {
          console.error('OneSignal error:', e.response?.data || e.message);
        });
      } else {
        console.log('OneSignal not configured - missing APP_ID or REST_API_KEY');
      }
    }
    
    const populatedAttendance = await Attendance.findById(attendance._id).populate('user', 'fullName username');
    if (global.io) global.io.emit('attendance:checkin', populatedAttendance);
    res.status(201).json(populatedAttendance);
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
    
    const recordCheckOut = getDubaiTime();
    const workingHours = Math.floor((recordCheckOut - attendance.checkIn) / 1000);
    
    attendance.checkOut = recordCheckOut;
    attendance.checkOutLocation = { latitude, longitude, address };
    attendance.workingHours = workingHours;
    await attendance.save();
    
    createLog('CHECKOUT', req.user.id, req.user.username, `Checked out at ${address || 'unknown location'} - ${Math.floor(workingHours / 3600)}h ${Math.floor((workingHours % 3600) / 60)}m`).catch(e => console.error('Log failed:', e));
    if (global.io) global.io.emit('attendance:checkout', attendance);
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
    const date = clientDate || getDubaiDate();
    
    const records = await Attendance.find({ date, user: req.user.id })
      .populate('user', 'fullName username')
      .select('user checkIn checkOut workingHours date sessionNumber checkInLocation checkOutLocation')
      .sort({ checkIn: -1 })
      .lean();
    
    let totalSeconds = 0;
    const now = getDubaiTime();
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

router.get('/monthly-report', async (req, res) => {
  try {
    if (!req.user.permissions?.viewReportAttendance) {
      return res.status(403).json({ message: 'Permission denied' });
    }
    
    const { userId, year, month } = req.query;
    
    if (!userId || !year || !month) {
      return res.status(400).json({ message: 'userId, year, and month are required' });
    }
    
    const startDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1));
    const endDate = new Date(Date.UTC(parseInt(year), parseInt(month), 0));
    
    const records = await Attendance.find({
      user: userId,
      date: {
        $gte: startDate.toISOString().split('T')[0],
        $lte: endDate.toISOString().split('T')[0]
      },
      approvalStatus: 'approved'
    }).select('user checkIn checkOut workingHours date sessionNumber approvalStatus approvedBy approvedAt rejectionReason _id').lean();
    
    console.log(`Monthly report: Found ${records.length} approved records for user ${userId} in ${year}-${month}`);
    
    const dailyRecords = {};
    for (const record of records) {
      if (!dailyRecords[record.date]) {
        dailyRecords[record.date] = { sessions: [], totalWorkingHours: 0 };
      }
      dailyRecords[record.date].sessions.push(record);
      dailyRecords[record.date].totalWorkingHours += record.workingHours || 0;
    }
    console.log(`Daily records grouped: ${Object.keys(dailyRecords).length} days with approved attendance`);
    
    const report = [];
    
    for (let d = new Date(startDate); d <= endDate; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const isSunday = d.getDay() === 0;
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
          status: isSunday ? 'rest' : 'absent',
          sessions: [],
          totalWorkingHours: 0
        });
      }
    }
    
    const totalHours = Object.values(dailyRecords).reduce((sum, day) => sum + day.totalWorkingHours, 0);
    const presentDays = Object.keys(dailyRecords).length;
    const absentDays = report.length - presentDays;
    
    console.log(`Report summary: ${report.length} total days, ${presentDays} approved present, ${absentDays} absent`);
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

router.get('/active-locations', async (req, res) => {
  try {
    if (!req.user.permissions?.viewEmployeeTracking && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Permission denied' });
    }
    
    const allRecords = await Attendance.find({ 
      checkOut: null,
      checkIn: { $exists: true }
    })
      .populate('user', 'fullName username')
      .lean();
    console.log('Active employees query result:', allRecords.length);
    allRecords.forEach(r => {
      console.log(`- ${r.user?.fullName}: checkIn=${r.checkIn}, checkOut=${r.checkOut}`);
    });
    
    res.json(allRecords);
  } catch (error) {
    console.error('Get active locations error:', error.message, error.stack);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

router.get('/pending', async (req, res) => {
  try {
    const records = await Attendance.find({ approvalStatus: 'pending' })
      .populate('user', 'fullName username')
      .sort({ checkIn: -1 });
    
    res.json(records);
  } catch (error) {
    console.error('Get pending attendance error:', error.message, error.stack);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

router.put('/:id/approve', async (req, res) => {
  try {
    if (!req.user.permissions?.approveAttendance) {
      return res.status(403).json({ message: 'Permission denied' });
    }
    
    const attendance = await Attendance.findById(req.params.id).populate('user', 'fullName username');
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }
    
    attendance.approvalStatus = 'approved';
    attendance.approvedBy = req.user.id;
    attendance.approvedAt = getDubaiTime();
    await attendance.save();
    
    createLog('APPROVE_ATTENDANCE', req.user.id, req.user.username, `Approved attendance for ${attendance.user?.fullName || attendance.user?.username || 'user'}`).catch(e => console.error('Log failed:', e));
    if (global.io) global.io.emit('attendance:approved', attendance);
    res.json(attendance);
  } catch (error) {
    console.error('Approve attendance error:', error.message, error.stack);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

router.put('/:id/reject', async (req, res) => {
  try {
    if (!req.user.permissions?.approveAttendance) {
      return res.status(403).json({ message: 'Permission denied' });
    }
    
    const { reason } = req.body;
    const attendance = await Attendance.findById(req.params.id).populate('user', 'fullName username');
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }
    
    attendance.approvalStatus = 'rejected';
    attendance.approvedBy = req.user.id;
    attendance.approvedAt = getDubaiTime();
    attendance.rejectionReason = reason;
    await attendance.save();
    
    createLog('REJECT_ATTENDANCE', req.user.id, req.user.username, `Rejected attendance for ${attendance.user?.fullName || attendance.user?.username || 'user'}`).catch(e => console.error('Log failed:', e));
    if (global.io) global.io.emit('attendance:rejected', attendance);
    res.json(attendance);
  } catch (error) {
    console.error('Reject attendance error:', error.message, error.stack);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

module.exports = router;

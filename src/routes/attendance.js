const express = require('express');
const axios = require('axios');
const { countRows, fetchById, fetchMany, deleteRow, indexById, insertRow, uniqueIds, updateRow } = require('../lib/db');
const { createLog } = require('../utils/logger');

const router = express.Router();

const getDubaiTime = () => new Date(new Date().getTime() + (4 * 60 * 60 * 1000));
const getDubaiDate = () => getDubaiTime().toISOString().split('T')[0];

async function fetchUserMap(ids) {
  const userIds = uniqueIds(ids);
  if (!userIds.length) {
    return new Map();
  }

  const users = await fetchMany('users', { filters: [{ column: 'id', operator: 'in', value: userIds }] });
  return indexById(users.map((user) => ({
    id: user.id || user._id,
    fullName: user.fullName,
    username: user.username,
  })));
}

function normalizeAttendance(record, userMap = new Map()) {
  if (!record) {
    return null;
  }

  const user = record.userId ? (userMap.get(String(record.userId)) || record.userId) : record.userId;

  return {
    ...record,
    user,
    date: record.attendanceDate || record.date,
    checkInLocation: {
      latitude: record.checkInLatitude,
      longitude: record.checkInLongitude,
      address: record.checkInAddress,
    },
    checkOutLocation: record.checkOut || record.checkOutLatitude || record.checkOutLongitude || record.checkOutAddress
      ? {
        latitude: record.checkOutLatitude,
        longitude: record.checkOutLongitude,
        address: record.checkOutAddress,
      }
      : null,
  };
}

async function populateAttendances(records) {
  if (!records.length) {
    return [];
  }

  const userMap = await fetchUserMap(records.map((record) => record.userId));
  return records.map((record) => normalizeAttendance(record, userMap));
}

async function populateAttendance(record) {
  const records = await populateAttendances(record ? [record] : []);
  return records[0] || null;
}

function calculateWorkingSeconds(checkIn, checkOut) {
  const start = new Date(checkIn).getTime();
  const end = new Date(checkOut).getTime();
  return Math.max(0, Math.floor((end - start) / 1000));
}

function hasLocationData(latitude, longitude, address) {
  return latitude !== undefined && latitude !== null &&
    longitude !== undefined && longitude !== null &&
    address !== undefined && address !== null && address !== '';
}

async function sendAttendanceNotification(targetUserId, title, message) {
  if (!process.env.ONESIGNAL_APP_ID || !process.env.ONESIGNAL_REST_API_KEY) {
    return;
  }

  try {
    await axios.post('https://onesignal.com/api/v1/notifications', {
      app_id: process.env.ONESIGNAL_APP_ID,
      include_external_user_ids: [targetUserId],
      headings: { en: title },
      contents: { en: message }
    }, {
      headers: { Authorization: `Basic ${process.env.ONESIGNAL_REST_API_KEY}` }
    });
  } catch (error) {
    console.error('OneSignal attendance error:', error.response?.data || error.message);
  }
}

router.post('/checkin', async (req, res) => {
  try {
    const { latitude, longitude, address, userId } = req.body;

    if (!hasLocationData(latitude, longitude, address)) {
      return res.status(400).json({ message: 'Location data is required' });
    }

    const targetUserId = userId || req.user.id;

    if (userId && userId !== req.user.id && !req.user.permissions?.approveAttendance) {
      return res.status(403).json({ message: 'Permission denied to check in for other users' });
    }

    const recordCheckIn = getDubaiTime();
    const recordDate = getDubaiDate();

    const openAttendances = await fetchMany('attendance', {
      filters: [
        { column: 'userId', operator: 'eq', value: targetUserId },
        { column: 'checkOut', operator: 'is', value: null },
      ],
      orderBy: 'checkIn',
      ascending: false,
      limit: 1,
    });
    const openAttendance = openAttendances[0];

    if (openAttendance && !userId) {
      return res.status(400).json({ message: 'Please check out first before checking in again' });
    }

    if (openAttendance && userId && req.user.permissions?.approveAttendance) {
      const checkedOut = await updateRow('attendance', openAttendance.id || openAttendance._id, {
        checkOut: getDubaiTime().toISOString(),
        checkOutLatitude: latitude,
        checkOutLongitude: longitude,
        checkOutAddress: address,
        workingHours: calculateWorkingSeconds(openAttendance.checkIn, getDubaiTime()),
      });

      createLog('CHECKOUT', req.user.id, req.user.username, `Checked out ${targetUserId} at ${address || 'unknown location'}`).catch((error) => {
        console.error('Log failed:', error);
      });

      await sendAttendanceNotification(
        targetUserId,
        'Checked Out',
        `You have been checked out by ${req.user.fullName || req.user.username}`
      );

      return res.json(await populateAttendance(checkedOut));
    }

    const sessionNumber = (await countRows('attendance', [
      { column: 'userId', operator: 'eq', value: targetUserId },
      { column: 'attendanceDate', operator: 'eq', value: recordDate },
    ])) + 1;

    const attendance = await insertRow('attendance', {
      userId: targetUserId,
      userName: userId && req.user.permissions?.approveAttendance ? undefined : (req.user.fullName || req.user.username),
      checkIn: recordCheckIn.toISOString(),
      checkInLatitude: latitude,
      checkInLongitude: longitude,
      checkInAddress: address,
      attendanceDate: recordDate,
      sessionNumber,
      approvalStatus: userId && req.user.permissions?.approveAttendance ? 'approved' : 'pending',
      workingHours: 0,
    });

    const logMessage = userId
      ? `Checked in ${targetUserId} at ${address || 'unknown location'}`
      : `Checked in at ${address || 'unknown location'}`;
    createLog('CHECKIN', req.user.id, req.user.username, logMessage).catch((error) => {
      console.error('Log failed:', error);
    });

    if (userId && req.user.permissions?.approveAttendance) {
      await sendAttendanceNotification(
        targetUserId,
        'Checked In',
        `You have been checked in and approved by ${req.user.fullName || req.user.username}`
      );
    }

    const populatedAttendance = await populateAttendance(attendance);
    res.status(201).json(populatedAttendance);
  } catch (error) {
    console.error('Check-in error:', error.message, error.stack);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

router.put('/checkout/:id', async (req, res) => {
  try {
    const { latitude, longitude, address } = req.body;

    if (!hasLocationData(latitude, longitude, address)) {
      return res.status(400).json({ message: 'Location data is required' });
    }

    const attendance = await fetchById('attendance', req.params.id);
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    const recordCheckOut = getDubaiTime();
    const workingHours = calculateWorkingSeconds(attendance.checkIn, recordCheckOut);

    const updated = await updateRow('attendance', req.params.id, {
      checkOut: recordCheckOut.toISOString(),
      checkOutLatitude: latitude,
      checkOutLongitude: longitude,
      checkOutAddress: address,
      workingHours,
    });

    createLog(
      'CHECKOUT',
      req.user.id,
      req.user.username,
      `Checked out at ${address || 'unknown location'} - ${Math.floor(workingHours / 3600)}h ${Math.floor((workingHours % 3600) / 60)}m`
    ).catch((error) => {
      console.error('Log failed:', error);
    });

    const populated = await populateAttendance(updated);
    res.json(populated);
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

    const filters = [];
    if (req.query.date && typeof req.query.date === 'string') filters.push({ column: 'attendanceDate', operator: 'eq', value: req.query.date });
    if (req.query.userId && typeof req.query.userId === 'string') filters.push({ column: 'userId', operator: 'eq', value: req.query.userId });

    const records = await fetchMany('attendance', {
      filters,
      orderBy: 'checkIn',
      ascending: false,
    });

    res.json(await populateAttendances(records));
  } catch (error) {
    console.error('Get attendance error:', error.message, error.stack);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

router.get('/today', async (req, res) => {
  try {
    const date = req.query.date || getDubaiDate();

    const records = await fetchMany('attendance', {
      filters: [
        { column: 'attendanceDate', operator: 'eq', value: date },
        { column: 'userId', operator: 'eq', value: req.user.id },
      ],
      orderBy: 'checkIn',
      ascending: false,
    });

    const populatedRecords = await populateAttendances(records);
    let totalSeconds = 0;
    const now = getDubaiTime();

    for (const record of populatedRecords) {
      if (record.checkOut) {
        totalSeconds += Number(record.workingHours || 0);
      } else {
        totalSeconds += calculateWorkingSeconds(record.checkIn, now);
      }
    }

    res.json({ records: populatedRecords, totalWorkingSeconds: totalSeconds });
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

    const startDate = new Date(Date.UTC(Number.parseInt(year, 10), Number.parseInt(month, 10) - 1, 1));
    const endDate = new Date(Date.UTC(Number.parseInt(year, 10), Number.parseInt(month, 10), 0));

    const records = await fetchMany('attendance', {
      filters: [
        { column: 'userId', operator: 'eq', value: userId },
        { column: 'attendanceDate', operator: 'gte', value: startDate.toISOString().split('T')[0] },
        { column: 'attendanceDate', operator: 'lte', value: endDate.toISOString().split('T')[0] },
        { column: 'approvalStatus', operator: 'eq', value: 'approved' },
      ],
      orderBy: 'attendanceDate',
      ascending: true,
    });

    const dailyRecords = {};
    for (const record of records) {
      const recordDate = record.attendanceDate || record.date;
      if (!dailyRecords[recordDate]) {
        dailyRecords[recordDate] = { sessions: [], totalWorkingHours: 0 };
      }
      dailyRecords[recordDate].sessions.push(normalizeAttendance(record));
      dailyRecords[recordDate].totalWorkingHours += Number(record.workingHours || 0);
    }

    const report = [];
    for (let date = new Date(startDate); date <= endDate; date = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)) {
      const dateStr = date.toISOString().split('T')[0];
      const isSunday = date.getDay() === 0;
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

    const attendance = await fetchById('attendance', req.params.id);
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    const updates = {};
    if (req.body.checkIn) {
      updates.checkIn = new Date(req.body.checkIn).toISOString();
    }
    if (req.body.checkOut) {
      updates.checkOut = new Date(req.body.checkOut).toISOString();
      updates.workingHours = calculateWorkingSeconds(updates.checkIn || attendance.checkIn, updates.checkOut);
    } else if (req.body.checkOut === null) {
      updates.checkOut = null;
      updates.workingHours = 0;
    }

    const updated = await updateRow('attendance', req.params.id, updates);
    createLog('EDIT_ATTENDANCE', req.user.id, req.user.username, 'Edited attendance record').catch((error) => {
      console.error('Log failed:', error);
    });
    res.json(await populateAttendance(updated));
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

    const attendance = await deleteRow('attendance', req.params.id);
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }
    createLog('DELETE_ATTENDANCE', req.user.id, req.user.username, 'Deleted attendance record').catch((error) => {
      console.error('Log failed:', error);
    });
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

    const records = await fetchMany('attendance', {
      filters: [{ column: 'checkOut', operator: 'is', value: null }],
      orderBy: 'checkIn',
      ascending: false,
    });

    res.json(await populateAttendances(records));
  } catch (error) {
    console.error('Get active locations error:', error.message, error.stack);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

router.get('/pending', async (req, res) => {
  try {
    const records = await fetchMany('attendance', {
      filters: [{ column: 'approvalStatus', operator: 'eq', value: 'pending' }],
      orderBy: 'checkIn',
      ascending: false,
    });

    res.json(await populateAttendances(records));
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

    const attendance = await fetchById('attendance', req.params.id);
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    const updated = await updateRow('attendance', req.params.id, {
      approvalStatus: 'approved',
    });

    const populated = await populateAttendance(updated);
    createLog(
      'APPROVE_ATTENDANCE',
      req.user.id,
      req.user.username,
      `Approved attendance for ${populated.user?.fullName || populated.user?.username || 'user'}`
    ).catch((error) => {
      console.error('Log failed:', error);
    });
    res.json(populated);
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

    const attendance = await fetchById('attendance', req.params.id);
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    const updated = await updateRow('attendance', req.params.id, {
      approvalStatus: 'rejected',
    });

    const populated = await populateAttendance(updated);
    createLog(
      'REJECT_ATTENDANCE',
      req.user.id,
      req.user.username,
      `Rejected attendance for ${populated.user?.fullName || populated.user?.username || 'user'}`
    ).catch((error) => {
      console.error('Log failed:', error);
    });
    res.json(populated);
  } catch (error) {
    console.error('Reject attendance error:', error.message, error.stack);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

module.exports = router;

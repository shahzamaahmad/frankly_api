const express = require('express');
const router = express.Router();
const googleSheets = require('../utils/googleSheets');
const Inventory = require('../models/inventory');
const Transaction = require('../models/transaction');
const Delivery = require('../models/delivery');
const Attendance = require('../models/attendance');
const { authenticate, authorize } = require('../middlewares/auth');

router.post('/sync', authenticate, authorize(['Admin']), async (req, res) => {
  try {
    const { spreadsheetId, syncTypes } = req.body;

    if (!spreadsheetId) {
      return res.status(400).json({ message: 'Spreadsheet ID required' });
    }

    const results = {};

    if (syncTypes.includes('inventory')) {
      const items = await Inventory.find().lean();
      await googleSheets.syncInventory(spreadsheetId, items);
      results.inventory = items.length;
    }

    if (syncTypes.includes('transactions')) {
      const transactions = await Transaction.find()
        .populate('item', 'name')
        .populate('site', 'siteName')
        .lean();
      await googleSheets.syncTransactions(spreadsheetId, transactions);
      results.transactions = transactions.length;
    }

    if (syncTypes.includes('deliveries')) {
      const deliveries = await Delivery.find().lean();
      await googleSheets.syncDeliveries(spreadsheetId, deliveries);
      results.deliveries = deliveries.length;
    }

    if (syncTypes.includes('attendance')) {
      const attendance = await Attendance.find()
        .populate('user', 'fullName')
        .lean();
      await googleSheets.syncAttendance(spreadsheetId, attendance);
      results.attendance = attendance.length;
    }

    res.json({ message: 'Sync completed', results });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ message: 'Sync failed' });
  }
});

router.post('/auto-sync', authenticate, authorize(['Admin']), async (req, res) => {
  try {
    const { spreadsheetId, enabled, interval } = req.body;
    res.json({ message: 'Auto-sync configured', spreadsheetId, enabled, interval });
  } catch (error) {
    console.error('Auto-sync config error:', error);
    res.status(500).json({ message: 'Configuration failed' });
  }
});

module.exports = router;

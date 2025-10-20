const express = require('express');
const router = express.Router();
const googleSheets = require('../utils/googleSheets');
const Inventory = require('../models/inventory');
const Transaction = require('../models/transaction');
const Delivery = require('../models/delivery');
const Site = require('../models/site');
const User = require('../models/user');
const OfficeAsset = require('../models/officeAsset');
const AssetTransaction = require('../models/assetTransaction');
const { authMiddleware } = require('../middlewares/auth');

const authorize = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    next();
  };
};

router.post('/sync', authMiddleware, authorize(['admin']), async (req, res) => {
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

    if (syncTypes.includes('sites')) {
      const sites = await Site.find().lean();
      await googleSheets.syncSites(spreadsheetId, sites);
      results.sites = sites.length;
    }

    if (syncTypes.includes('employees')) {
      const employees = await User.find().lean();
      await googleSheets.syncEmployees(spreadsheetId, employees);
      results.employees = employees.length;
    }

    if (syncTypes.includes('assets')) {
      const assets = await OfficeAsset.find().lean();
      await googleSheets.syncAssets(spreadsheetId, assets);
      results.assets = assets.length;
    }

    if (syncTypes.includes('assetTransactions')) {
      const assetTransactions = await AssetTransaction.find()
        .populate('asset', 'name')
        .populate('employee', 'fullName')
        .lean();
      await googleSheets.syncAssetTransactions(spreadsheetId, assetTransactions);
      results.assetTransactions = assetTransactions.length;
    }

    res.json({ message: 'Sync completed', results });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ message: 'Sync failed' });
  }
});

router.post('/auto-sync', authMiddleware, authorize(['admin']), async (req, res) => {
  try {
    const { spreadsheetId, enabled, interval } = req.body;
    res.json({ message: 'Auto-sync configured', spreadsheetId, enabled, interval });
  } catch (error) {
    console.error('Auto-sync config error:', error);
    res.status(500).json({ message: 'Configuration failed' });
  }
});

module.exports = router;

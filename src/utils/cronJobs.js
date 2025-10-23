const cron = require('node-cron');
const googleSheets = require('./googleSheets');
const Inventory = require('../models/inventory');
const Transaction = require('../models/transaction');
const Delivery = require('../models/delivery');
const Site = require('../models/site');
const User = require('../models/user');
const OfficeAsset = require('../models/officeAsset');
const AssetTransaction = require('../models/assetTransaction');

const startDailySync = () => {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  
  if (!spreadsheetId || !process.env.GOOGLE_SHEETS_CREDENTIALS) {
    console.log('Google Sheets auto-sync disabled - missing configuration');
    return;
  }

  cron.schedule('0 2 * * *', async () => {
    console.log('Starting daily Google Sheets sync...');
    
    try {
      const [inventory, transactions, deliveries, sites, employees, assets, assetTransactions] = await Promise.all([
        Inventory.find().lean(),
        Transaction.find().populate('item', 'name').populate('site', 'siteName').lean(),
        Delivery.find().lean(),
        Site.find().lean(),
        User.find().lean(),
        OfficeAsset.find().lean(),
        AssetTransaction.find().populate('asset', 'name').populate('employee', 'fullName').lean()
      ]);

      await Promise.all([
        googleSheets.syncInventory(spreadsheetId, inventory),
        googleSheets.syncTransactions(spreadsheetId, transactions),
        googleSheets.syncDeliveries(spreadsheetId, deliveries),
        googleSheets.syncSites(spreadsheetId, sites),
        googleSheets.syncEmployees(spreadsheetId, employees),
        googleSheets.syncAssets(spreadsheetId, assets),
        googleSheets.syncAssetTransactions(spreadsheetId, assetTransactions)
      ]);

      console.log('Daily Google Sheets sync completed successfully');
    } catch (error) {
      console.error('Daily Google Sheets sync failed:', error.message);
    }
  });

  console.log('Daily Google Sheets sync scheduled at 2:00 AM');
};

module.exports = { startDailySync };

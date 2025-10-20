const { google } = require('googleapis');

class GoogleSheetsService {
  constructor() {
    this.auth = null;
    this.sheets = null;
  }

  async initialize() {
    if (!process.env.GOOGLE_SHEETS_CREDENTIALS) {
      console.log('Google Sheets sync disabled - no credentials');
      return false;
    }

    try {
      const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS);
      this.auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
      console.log('Google Sheets sync enabled');
      return true;
    } catch (error) {
      console.error('Google Sheets init failed:', error.message);
      return false;
    }
  }

  async syncInventory(spreadsheetId, items) {
    if (!this.sheets) return;

    const values = [
      ['SKU', 'Name', 'Category', 'Current Stock', 'Unit Cost', 'Status', 'Last Updated'],
      ...items.map(item => [
        item.sku || '',
        item.name || '',
        item.category || '',
        item.currentStock || 0,
        item.unitCost || 0,
        item.status || '',
        new Date().toISOString()
      ])
    ];

    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Inventory!A1',
      valueInputOption: 'RAW',
      resource: { values }
    });
  }

  async syncTransactions(spreadsheetId, transactions) {
    if (!this.sheets) return;

    const values = [
      ['Transaction ID', 'Type', 'Item', 'Quantity', 'Site', 'Taker', 'Date'],
      ...transactions.map(txn => [
        txn.transactionId || '',
        txn.type || '',
        txn.item?.name || txn.item || '',
        txn.quantity || 0,
        txn.site?.siteName || txn.site || '',
        txn.taker || '',
        txn.outDate ? new Date(txn.outDate).toLocaleDateString() : ''
      ])
    ];

    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Transactions!A1',
      valueInputOption: 'RAW',
      resource: { values }
    });
  }

  async syncDeliveries(spreadsheetId, deliveries) {
    if (!this.sheets) return;

    const values = [
      ['Delivery ID', 'Seller', 'Amount', 'Currency', 'Date', 'Received By'],
      ...deliveries.map(del => [
        del.deliveryId || '',
        del.seller || '',
        del.amount || 0,
        del.currency || 'AED',
        del.deliveryDate ? new Date(del.deliveryDate).toLocaleDateString() : '',
        del.receivedBy || ''
      ])
    ];

    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Deliveries!A1',
      valueInputOption: 'RAW',
      resource: { values }
    });
  }

  async syncSites(spreadsheetId, sites) {
    if (!this.sheets) return;

    const values = [
      ['Site Code', 'Site Name', 'Sector', 'Location', 'Status', 'Engineer', 'Manager'],
      ...sites.map(site => [
        site.siteCode || '',
        site.siteName || '',
        site.sector || '',
        site.location || '',
        site.status || '',
        site.engineer || '',
        site.siteManager || ''
      ])
    ];

    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Sites!A1',
      valueInputOption: 'RAW',
      resource: { values }
    });
  }

  async syncEmployees(spreadsheetId, employees) {
    if (!this.sheets) return;

    const values = [
      ['Employee ID', 'Full Name', 'Username', 'Role', 'Email', 'Phone', 'Status'],
      ...employees.map(emp => [
        emp.employeeId || '',
        emp.fullName || '',
        emp.username || '',
        emp.role || '',
        emp.email || '',
        emp.phone || '',
        emp.isActive ? 'Active' : 'Inactive'
      ])
    ];

    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Employees!A1',
      valueInputOption: 'RAW',
      resource: { values }
    });
  }

  async syncAssets(spreadsheetId, assets) {
    if (!this.sheets) return;

    const values = [
      ['Asset Code', 'Name', 'Category', 'Current Stock', 'Unit Cost', 'Condition', 'Status'],
      ...assets.map(asset => [
        asset.assetCode || '',
        asset.name || '',
        asset.category || '',
        asset.currentStock || 0,
        asset.unitCost || 0,
        asset.condition || '',
        asset.status || ''
      ])
    ];

    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Assets!A1',
      valueInputOption: 'RAW',
      resource: { values }
    });
  }

  async syncAssetTransactions(spreadsheetId, transactions) {
    if (!this.sheets) return;

    const values = [
      ['Transaction ID', 'Type', 'Asset', 'Quantity', 'Employee', 'Date', 'Condition'],
      ...transactions.map(txn => [
        txn.transactionId || '',
        txn.type || '',
        txn.asset?.name || txn.asset || '',
        txn.quantity || 0,
        txn.employee?.fullName || txn.employee || '',
        txn.date ? new Date(txn.date).toLocaleDateString() : '',
        txn.condition || ''
      ])
    ];

    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'AssetTransactions!A1',
      valueInputOption: 'RAW',
      resource: { values }
    });
  }
}

module.exports = new GoogleSheetsService();

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

  async syncAttendance(spreadsheetId, attendance) {
    if (!this.sheets) return;

    const values = [
      ['Employee', 'Date', 'Check In', 'Check Out', 'Working Hours', 'Session'],
      ...attendance.map(att => [
        att.user?.fullName || att.user || '',
        att.date || '',
        att.checkIn ? new Date(att.checkIn).toLocaleTimeString() : '',
        att.checkOut ? new Date(att.checkOut).toLocaleTimeString() : '',
        att.workingHours || 0,
        att.sessionNumber || 1
      ])
    ];

    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Attendance!A1',
      valueInputOption: 'RAW',
      resource: { values }
    });
  }
}

module.exports = new GoogleSheetsService();

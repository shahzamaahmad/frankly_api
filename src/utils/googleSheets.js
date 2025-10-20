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
      ['SKU', 'Name', 'Category', 'Sub Category', 'Brand', 'Barcode', 'Initial Stock', 'Current Stock', 'Unit Cost', 'Reorder Level', 'Status', 'Supplier Name', 'Supplier Contact', 'Location', 'Description', 'Created At', 'Updated At'],
      ...items.map(item => [
        item.sku || '',
        item.name || '',
        item.category || '',
        item.subCategory || '',
        item.brand || '',
        item.barcode || '',
        item.initialStock || 0,
        item.currentStock || 0,
        item.unitCost || 0,
        item.reorderLevel || 0,
        item.status || '',
        item.supplier?.name || '',
        item.supplier?.contact || '',
        item.location || '',
        item.description || '',
        item.createdAt ? new Date(item.createdAt).toISOString() : '',
        item.updatedAt ? new Date(item.updatedAt).toISOString() : ''
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
      ['Transaction ID', 'Type', 'Item', 'Quantity', 'Site', 'Employee', 'Remark', 'Out Date', 'In Date', 'Return Condition', 'Return Notes', 'Related To', 'Created At'],
      ...transactions.map(txn => [
        txn.transactionId || '',
        txn.type || '',
        txn.item?.name || txn.item || '',
        txn.quantity || 0,
        txn.site?.siteName || txn.site || '',
        txn.employee?.fullName || txn.employee || '',
        txn.remark || '',
        txn.outDate ? new Date(txn.outDate).toLocaleDateString() : '',
        txn.inDate ? new Date(txn.inDate).toLocaleDateString() : '',
        txn.returnDetails?.condition || '',
        txn.returnDetails?.notes || '',
        txn.relatedTo || '',
        txn.createdAt ? new Date(txn.createdAt).toISOString() : ''
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
      ['Delivery ID', 'Seller', 'Amount', 'Currency', 'Delivery Date', 'Received By', 'Invoice Number', 'Notes', 'Created At'],
      ...deliveries.map(del => [
        del.deliveryId || '',
        del.seller || '',
        del.amount || 0,
        del.currency || 'AED',
        del.deliveryDate ? new Date(del.deliveryDate).toLocaleDateString() : '',
        del.receivedBy || '',
        del.invoiceNumber || '',
        del.notes || '',
        del.createdAt ? new Date(del.createdAt).toISOString() : ''
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
      ['Site Code', 'Site Name', 'Sector', 'Location', 'Client Name', 'Client Contact', 'Project Description', 'Site Location', 'Value', 'Engineer', 'Manager', 'Safety Officer', 'Status', 'Start Date', 'End Date', 'Progress', 'Remark', 'Created At'],
      ...sites.map(site => [
        site.siteCode || '',
        site.siteName || '',
        site.sector || '',
        site.location || '',
        site.client?.name || '',
        site.client?.contact || '',
        site.projectDescription || '',
        site.siteLocation || '',
        site.value || 0,
        site.engineer || '',
        site.siteManager || '',
        site.safetyOfficer || '',
        site.status || '',
        site.startDate ? new Date(site.startDate).toLocaleDateString() : '',
        site.endDate ? new Date(site.endDate).toLocaleDateString() : '',
        site.progress || 0,
        site.remark || '',
        site.createdAt ? new Date(site.createdAt).toISOString() : ''
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
      ['Employee ID', 'Full Name', 'Username', 'Role', 'Email', 'Phone', 'Department', 'Joining Date', 'Salary', 'Country', 'Date of Birth', 'Emergency Contact', 'Emirates ID', 'Emirates ID Expiry', 'Passport Number', 'Status', 'Created At'],
      ...employees.map(emp => [
        emp.employeeId || '',
        emp.fullName || '',
        emp.username || '',
        emp.role || '',
        emp.email || '',
        emp.phone || '',
        emp.department || '',
        emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString() : '',
        emp.salary || 0,
        emp.country || '',
        emp.dateOfBirth ? new Date(emp.dateOfBirth).toLocaleDateString() : '',
        emp.emergencyContact || '',
        emp.emiratesIdNumber || '',
        emp.emiratesIdExpiryDate ? new Date(emp.emiratesIdExpiryDate).toLocaleDateString() : '',
        emp.passportNumber || '',
        emp.isActive ? 'Active' : 'Inactive',
        emp.createdAt ? new Date(emp.createdAt).toISOString() : ''
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
      ['Asset Code', 'Name', 'Category', 'Brand', 'Model', 'Serial Number', 'Initial Stock', 'Current Stock', 'Unit Cost', 'Purchase Date', 'Warranty Expiry', 'Condition', 'Status', 'Location', 'Description', 'Created At'],
      ...assets.map(asset => [
        asset.assetCode || '',
        asset.name || '',
        asset.category || '',
        asset.brand || '',
        asset.model || '',
        asset.serialNumber || '',
        asset.initialStock || 0,
        asset.currentStock || 0,
        asset.unitCost || 0,
        asset.purchaseDate ? new Date(asset.purchaseDate).toLocaleDateString() : '',
        asset.warrantyExpiry ? new Date(asset.warrantyExpiry).toLocaleDateString() : '',
        asset.condition || '',
        asset.status || '',
        asset.location || '',
        asset.description || '',
        asset.createdAt ? new Date(asset.createdAt).toISOString() : ''
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
      ['Transaction ID', 'Type', 'Asset', 'Quantity', 'Employee', 'Date', 'Condition', 'Remarks', 'Return Date', 'Return Condition', 'Created At'],
      ...transactions.map(txn => [
        txn.transactionId || '',
        txn.type || '',
        txn.asset?.name || txn.asset || '',
        txn.quantity || 0,
        txn.employee?.fullName || txn.employee || '',
        txn.date ? new Date(txn.date).toLocaleDateString() : '',
        txn.condition || '',
        txn.remarks || '',
        txn.returnDate ? new Date(txn.returnDate).toLocaleDateString() : '',
        txn.returnCondition || '',
        txn.createdAt ? new Date(txn.createdAt).toISOString() : ''
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

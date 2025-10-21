const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '✨ Frankly Warehouse Management API',
      version: '1.0.0',
      description: `
# 🏗️ Frankly Built Contracting LLC - Warehouse Management System

Comprehensive API for managing construction inventory, transactions, deliveries, sites, employees, and attendance.

## 🚀 Features
- **Inventory Management**: Track items, stock levels, and barcodes
- **Transactions**: Issue and return items to sites
- **Stock Transfers**: Transfer items between sites
- **Deliveries**: Record supplier deliveries
- **Site Management**: Manage construction sites
- **Employee Management**: User roles and permissions
- **Attendance**: GPS-enabled check-in/check-out
- **Office Assets**: Track company assets
- **Google Sheets Integration**: Auto-sync data

## 🔐 Authentication
All endpoints (except /auth) require JWT Bearer token in Authorization header.
      `,
      contact: {
        name: 'Frankly Built Contracting LLC',
        url: 'https://frankly.ae',
      },
    },
    servers: [
      {
        url: 'http://localhost:4000',
        description: 'Development server',
      },
      {
        url: 'https://frankly-api-1.onrender.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token obtained from /api/auth/login',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            username: { type: 'string' },
            fullName: { type: 'string' },
            role: { type: 'string', enum: ['Admin', 'Manager', 'Employee', 'Storekeeper'] },
            email: { type: 'string' },
            phone: { type: 'string' },
            isActive: { type: 'boolean' },
          },
        },
        Inventory: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            sku: { type: 'string' },
            name: { type: 'string' },
            category: { type: 'string' },
            initialStock: { type: 'number' },
            currentStock: { type: 'number' },
            unitOfMeasure: { type: 'string' },
            barcode: { type: 'string' },
            imageUrl: { type: 'string' },
            status: { type: 'string', enum: ['Active', 'Inactive'] },
          },
        },
        Transaction: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            transactionId: { type: 'string' },
            type: { type: 'string', enum: ['ISSUE', 'RETURN'] },
            item: { type: 'string' },
            quantity: { type: 'number' },
            site: { type: 'string' },
            employee: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        Site: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            siteCode: { type: 'string' },
            siteName: { type: 'string' },
            location: { type: 'string' },
            status: { type: 'string', enum: ['Active', 'Completed', 'On Hold'] },
          },
        },
        Delivery: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            seller: { type: 'string' },
            amount: { type: 'number' },
            deliveryDate: { type: 'string', format: 'date' },
            invoiceUrl: { type: 'string' },
          },
        },
        Attendance: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            user: { type: 'string' },
            checkIn: { type: 'string', format: 'date-time' },
            checkOut: { type: 'string', format: 'date-time' },
            workingHours: { type: 'number' },
            date: { type: 'string' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: [
      { name: '🔐 Authentication', description: 'User authentication and authorization' },
      { name: '📦 Inventory', description: 'Inventory item management' },
      { name: '🔄 Transactions', description: 'Issue and return transactions' },
      { name: '🔀 Stock Transfers', description: 'Transfer items between sites' },
      { name: '🚚 Deliveries', description: 'Supplier delivery management' },
      { name: '🏗️ Sites', description: 'Construction site management' },
      { name: '👥 Users', description: 'Employee and user management' },
      { name: '⏰ Attendance', description: 'Employee attendance tracking' },
      { name: '💼 Office Assets', description: 'Company asset management' },
      { name: '📊 Google Sheets', description: 'Data synchronization' },
      { name: '📱 OneSignal', description: 'Push notifications' },
      { name: '📞 Contacts', description: 'Contact management' },
      { name: '🔔 Notifications', description: 'System notifications' },
      { name: '⭐ Favorites', description: 'User favorites' },
      { name: '📝 Activities', description: 'Activity logs' },
      { name: '📤 Uploads', description: 'File uploads' },
      { name: '⚙️ Config', description: 'App configuration' },
    ],
  },
  apis: ['./src/routes/*.js', './src/server.js'],
};

module.exports = swaggerJsdoc(options);

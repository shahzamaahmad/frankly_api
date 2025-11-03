# ✨ Frankly Warehouse Management API

RESTful API for Frankly Built Contracting LLC warehouse management system built with Node.js, Express, and MongoDB.

## 🚀 Features

- **Authentication**: JWT-based authentication with role-based access control
- **Inventory Management**: Track items, stock levels, barcodes, and images
- **Transactions**: Issue and return items to construction sites
- **Stock Transfers**: Transfer items between sites with approval workflow
- **Deliveries**: Record supplier deliveries with invoice uploads
- **Site Management**: Manage construction sites and track site inventory
- **Employee Management**: User roles, permissions, and profiles
- **Attendance**: GPS-enabled check-in/check-out with working hours tracking
- **Office Assets**: Track company assets and assignments
- **Google Sheets Integration**: Auto-sync data daily at 2 AM
- **Real-time Updates**: Socket.io for live data synchronization
- **Push Notifications**: OneSignal integration for mobile notifications

## 📋 Prerequisites

- Node.js 16.x or higher
- MongoDB 5.0 or higher
- Cloudinary account (for image storage)
- Google Sheets API credentials (optional)
- OneSignal account (optional, for push notifications)

## 🛠️ Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd api
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```env
PORT=4000
MONGODB_URI=mongodb://localhost:27017/frankly_warehouse
JWT_SECRET=your_super_secret_jwt_key_here
ALLOWED_ORIGINS=http://localhost:3000,https://frankly.ae

# Cloudinary (required for image uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Google Sheets (optional)
GOOGLE_SHEETS_CREDENTIALS={"type":"service_account",...}
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id

# OneSignal (optional)
ONESIGNAL_APP_ID=your_app_id
ONESIGNAL_API_KEY=your_api_key
```

4. Start the server:
```bash
# Development
npm run dev

# Production
npm start
```

## 📚 API Documentation

Interactive API documentation available at:
- **Local**: http://localhost:4000/api-docs
- **Production**: https://frankly-api-1.onrender.com/api-docs

## 🔐 Authentication

All endpoints (except `/api/auth/*`) require JWT Bearer token:

```bash
Authorization: Bearer <your_jwt_token>
```

### Login
```bash
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password123"
}
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "...",
    "username": "admin",
    "fullName": "Admin User",
    "role": "Admin"
  }
}
```

## 📡 API Endpoints

### 🔐 Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/change-password` - Change password

### 📦 Inventory
- `GET /api/inventory` - Get all items
- `POST /api/inventory` - Add new item
- `GET /api/inventory/:id` - Get item by ID
- `PUT /api/inventory/:id` - Update item
- `DELETE /api/inventory/:id` - Delete item
- `GET /api/inventory/barcode/:barcode` - Search by barcode

### 🔄 Transactions
- `GET /api/transactions` - Get all transactions
- `POST /api/transactions` - Create transaction
- `GET /api/transactions/:id` - Get transaction by ID
- `PUT /api/transactions/:id` - Update transaction
- `DELETE /api/transactions/:id` - Delete transaction

### 🔀 Stock Transfers
- `GET /api/stock-transfers` - Get all transfers
- `POST /api/stock-transfers/request` - Request transfer
- `POST /api/stock-transfers/:id/approve` - Approve transfer
- `DELETE /api/stock-transfers/:id` - Delete transfer

### 🚚 Deliveries
- `GET /api/deliveries` - Get all deliveries
- `POST /api/deliveries` - Create delivery
- `GET /api/deliveries/:id` - Get delivery by ID
- `PUT /api/deliveries/:id` - Update delivery
- `DELETE /api/deliveries/:id` - Delete delivery

### 🏗️ Sites
- `GET /api/sites` - Get all sites
- `POST /api/sites` - Create site
- `GET /api/sites/:id` - Get site by ID
- `PUT /api/sites/:id` - Update site
- `DELETE /api/sites/:id` - Delete site
- `GET /api/sites/:id/items` - Get site inventory

### 👥 Users
- `GET /api/users` - Get all users
- `POST /api/users` - Create user
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user
- `PUT /api/users/:id/permissions` - Update permissions

### ⏰ Attendance
- `GET /api/attendance` - Get all attendance
- `POST /api/attendance/checkin` - Check in
- `PUT /api/attendance/checkout/:id` - Check out
- `GET /api/attendance/today` - Today's attendance
- `GET /api/attendance/user/:userId` - User attendance history

### 💼 Office Assets
- `GET /api/office-assets` - Get all assets
- `POST /api/office-assets` - Create asset
- `GET /api/office-assets/:id` - Get asset by ID
- `PUT /api/office-assets/:id` - Update asset
- `DELETE /api/office-assets/:id` - Delete asset

### 📊 Google Sheets
- `POST /api/google-sheets/sync` - Manual sync all data
- `POST /api/google-sheets/sync/inventory` - Sync inventory
- `POST /api/google-sheets/sync/transactions` - Sync transactions

### 📤 Uploads
- `POST /api/uploads` - Upload file to Cloudinary

### 📞 Contacts
- `GET /api/contacts` - Get all contacts
- `POST /api/contacts` - Create contact

### 🔔 Notifications
- `GET /api/notifications` - Get all notifications
- `POST /api/notifications` - Create notification

### 📝 Activities
- `GET /api/activities` - Get recent activities

### ⚙️ Config
- `GET /api/app-config` - Get app configuration

### 💚 Health Check
- `GET /api/health` - Server health status

## 🔌 Real-time Events (Socket.io)

Connect with JWT token:
```javascript
const socket = io('http://localhost:4000', {
  auth: { token: 'your_jwt_token' }
});
```

### Events Emitted by Server:
- `permissionsUpdated` - User permissions changed
- `inventory:created` - New inventory item
- `inventory:updated` - Inventory item updated
- `inventory:deleted` - Inventory item deleted
- `transaction:created` - New transaction
- `transaction:updated` - Transaction updated
- `transaction:deleted` - Transaction deleted
- `delivery:created` - New delivery
- `delivery:updated` - Delivery updated
- `delivery:deleted` - Delivery deleted
- `site:created` - New site
- `site:updated` - Site updated
- `site:deleted` - Site deleted
- `attendance:checkin` - Employee checked in
- `attendance:checkout` - Employee checked out

## 📦 Database Models

### User
- username, password (hashed), fullName, role, email, phone
- emiratesIdNumber, emiratesIdExpiryDate, dateOfBirth
- permissions, isActive

### Inventory
- sku, name, category, initialStock, currentStock
- unitOfMeasure, barcode, imageUrl, status

### Transaction
- transactionId, type (ISSUE/RETURN), item, quantity
- site, employee, timestamp

### Site
- siteCode, siteName, location, status
- client, engineer, sector

### Delivery
- seller, amount, deliveryDate, invoiceUrl

### Attendance
- user, checkIn, checkOut, workingHours
- checkInLocation, checkOutLocation, date

## 🔒 Security Features

- JWT authentication with bcrypt password hashing
- Role-based access control (RBAC)
- CORS configuration with whitelist
- Security headers (HSTS, XSS Protection, etc.)
- Input validation and sanitization
- Rate limiting ready
- MongoDB injection prevention

## 🚀 Deployment

### Environment Variables (Production)
```env
NODE_ENV=production
PORT=4000
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/frankly
JWT_SECRET=<strong-random-secret>
ALLOWED_ORIGINS=https://frankly.ae,https://app.frankly.ae
```

### Start Production Server
```bash
npm start
```

### Using PM2
```bash
npm install -g pm2
pm2 start src/server.js --name frankly-api
pm2 save
pm2 startup
```

## 📊 Monitoring

- Health check endpoint: `/api/health`
- Logs stored in `logs/` directory
- Winston logger for error tracking
- Keep-alive service prevents server sleep

## 🔧 Scripts

```bash
npm start          # Start production server
npm run dev        # Start development server with nodemon
npm test           # Run tests (if configured)
```

## 📝 Logging

Logs are stored in:
- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only

## 🌐 CORS Configuration

Configure allowed origins in `.env`:
```env
ALLOWED_ORIGINS=http://localhost:3000,https://frankly.ae
```

## 📱 Push Notifications

OneSignal integration for mobile push notifications:
- Check-in/check-out notifications
- Document expiry alerts
- System notifications

## 📊 Google Sheets Auto-Sync

Daily automatic sync at 2:00 AM (Asia/Dubai timezone):
- Inventory
- Transactions
- Deliveries
- Sites
- Employees
- Office Assets

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

Proprietary - Frankly Built Contracting LLC

## 📞 Support

For support, contact: support@frankly.ae

---

**Version**: 1.0.0  
**Last Updated**: 2024  
**Company**: Frankly Built Contracting LLC, Dubai, UAE


require('dotenv').config();

process.env.TZ = 'Asia/Dubai';

const loadRoute = (path) => {
  try {
    return require(path);
  } catch (err) {
    console.error(`Failed to load route ${path}:`, err.message);
    throw err;
  }
};

const express = loadRoute('express');
const mongoose = loadRoute('mongoose');
const cors = loadRoute('cors');
const swaggerUi = loadRoute('swagger-ui-express');
const swaggerSpec = loadRoute('./swagger');



let authRoutes, inventoryRoutes, siteRoutes, deliveryRoutes;
let uploadsRoutes, usersRoutes, transactionRoutes, attendanceRoutes;
let logRoutes, onesignalRoutes, contactsRoutes, appConfigRoutes, notificationsRoutes;
let favoritesRoutes, activitiesRoutes, officeAssetsRoutes, assetTransactionsRoutes, stockTransferRoutes, googleSheetsRoutes;

const initRoutes = () => {
  authRoutes = loadRoute('./routes/auth');
  inventoryRoutes = loadRoute('./routes/inventory');
  siteRoutes = loadRoute('./routes/site');
  deliveryRoutes = loadRoute('./routes/delivery');
  uploadsRoutes = loadRoute('./routes/uploads');
  usersRoutes = loadRoute('./routes/users');
  transactionRoutes = loadRoute('./routes/transaction');
  attendanceRoutes = loadRoute('./routes/attendance');
  logRoutes = loadRoute('./routes/log');
  onesignalRoutes = loadRoute('./routes/onesignal');
  contactsRoutes = loadRoute('./routes/contacts');
  appConfigRoutes = loadRoute('./routes/appConfig');
  notificationsRoutes = loadRoute('./routes/notifications');
  favoritesRoutes = loadRoute('./routes/favorites');
  activitiesRoutes = loadRoute('./routes/activities');
  officeAssetsRoutes = loadRoute('./routes/officeAssets');
  assetTransactionsRoutes = loadRoute('./routes/assetTransactions');
  stockTransferRoutes = loadRoute('./routes/stockTransfer');
  googleSheetsRoutes = loadRoute('./routes/googleSheets');
};

initRoutes();

const { authMiddleware } = loadRoute('./middlewares/auth');

const app = express();

app.set('trust proxy', 1);

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];
app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  next();
});

app.get('/api/health', (req, res) => {
  console.log('💚 Keep-alive ping received');
  res.json({ 
    status: '✨ Frankly API is alive and running',
    server: 'frankly.ae',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    message: '🚀 All systems operational'
  });
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api/auth', authRoutes);

// protect the rest
try {
  app.use('/api/inventory', authMiddleware, inventoryRoutes);
  app.use('/api/sites', authMiddleware, siteRoutes);
  app.use('/api/deliveries', authMiddleware, deliveryRoutes);
  app.use('/api/uploads', authMiddleware, uploadsRoutes);
  app.use('/api/users', authMiddleware, usersRoutes);
  app.use('/api/transactions', authMiddleware, transactionRoutes);
  app.use('/api/attendance', authMiddleware, attendanceRoutes);
  app.use('/api/logs', authMiddleware, logRoutes);
  app.use('/api/onesignal', authMiddleware, onesignalRoutes);
  app.use('/api/contacts', authMiddleware, contactsRoutes);
  app.use('/api/app-config', appConfigRoutes);
  app.use('/api/notifications', authMiddleware, notificationsRoutes);
  app.use('/api/favorites', authMiddleware, favoritesRoutes);
  app.use('/api/activities', authMiddleware, activitiesRoutes);
  app.use('/api/office-assets', authMiddleware, officeAssetsRoutes);
  app.use('/api/asset-transactions', authMiddleware, assetTransactionsRoutes);
  app.use('/api/stock-transfers', authMiddleware, stockTransferRoutes);
  app.use('/api/google-sheets', authMiddleware, googleSheetsRoutes);
} catch (err) {
  console.error('Route setup error:', err);
  process.exit(1);
}

app.use((err, req, res, _next) => {
  console.error('Error:', err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 4000;

const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');

const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  socket.join(`user:${socket.userId}`);
  socket.on('disconnect', () => {});
});

global.io = io;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10,
  minPoolSize: 2,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
}).then(async () => {
  console.log('✅ MongoDB connected');
  const googleSheets = require('./utils/googleSheets');
  await googleSheets.initialize();
  const { startDailySync } = require('./utils/cronJobs');
  startDailySync();
}).catch(err => {
  console.error('MongoDB connection error:', err.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err.message);
  console.error('Stack:', err.stack);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  try {
    await mongoose.connection.close();
  } catch (err) {
    console.error('Error closing MongoDB connection:', err);
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
  } catch (err) {
    console.error('Error closing MongoDB connection:', err);
  }
  process.exit(0);
});

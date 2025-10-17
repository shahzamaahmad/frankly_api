
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

const authRoutes = require('./routes/auth');
const inventoryRoutes = require('./routes/inventory');
const siteRoutes = require('./routes/site');
const deliveryRoutes = require('./routes/delivery');
const deliveryItemRoutes = require('./routes/deliveryItem');
const uploadsRoutes = require('./routes/uploads');
const usersRoutes = require('./routes/users');
const transactionRoutes = require('./routes/transaction');
const attendanceRoutes = require('./routes/attendance');
const notificationRoutes = require('./routes/notification');
const logRoutes = require('./routes/log');
const onesignalRoutes = require('./routes/notifications');

const { authMiddleware } = require('./middlewares/auth');

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

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api/auth', authRoutes);

// protect the rest
app.use('/api/inventory', authMiddleware, inventoryRoutes);
app.use('/api/sites', authMiddleware, siteRoutes);
app.use('/api/deliveries', authMiddleware, deliveryRoutes);
app.use('/api/delivery-items', authMiddleware, deliveryItemRoutes);
app.use('/api/uploads', authMiddleware, uploadsRoutes);
app.use('/api/users', authMiddleware, usersRoutes);
app.use('/api/transactions', authMiddleware, transactionRoutes);
app.use('/api/attendance', authMiddleware, attendanceRoutes);
app.use('/api/notifications', authMiddleware, notificationRoutes);
app.use('/api/logs', authMiddleware, logRoutes);
app.use('/api/onesignal', authMiddleware, onesignalRoutes);

const PORT = process.env.PORT || 4000;

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10,
  minPoolSize: 2,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
}).then(() => {
  console.log('MongoDB connected');
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

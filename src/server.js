
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const morgan = require('morgan');
const logger = require('./utils/logger');

const authRoutes = require('./routes/auth');
const inventoryRoutes = require('./routes/inventory');
const siteRoutes = require('./routes/site');
const deliveryRoutes = require('./routes/delivery');
const deliveryItemRoutes = require('./routes/deliveryItem');
const uploadsRoutes = require('./routes/uploads');
const usersRoutes = require('./routes/users');
const transactionRoutes = require('./routes/transaction');

const { authMiddleware } = require('./middlewares/auth');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// HTTP request logging via morgan -> winston
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined', { stream: logger.stream }));
} else {
  app.use(morgan('dev', { stream: logger.stream }));
}

// routes that don't need auth
app.use('/api/auth', authRoutes);

// protect the rest
app.use('/api/inventory', authMiddleware, inventoryRoutes);
app.use('/api/sites', authMiddleware, siteRoutes);
app.use('/api/deliveries', authMiddleware, deliveryRoutes);
app.use('/api/delivery-items', authMiddleware, deliveryItemRoutes);
app.use('/api/uploads', authMiddleware, uploadsRoutes);
app.use('/api/users', authMiddleware, usersRoutes);
app.use('/api/transactions', authMiddleware, transactionRoutes);

const PORT = process.env.PORT || 4000;

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  logger.info('MongoDB connected');
  app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
}).catch(err => {
  logger.error('MongoDB connection error: %s', err.message);
  process.exit(1);
});

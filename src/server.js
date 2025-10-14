
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const inventoryRoutes = require('./routes/inventory');
const transactionRoutes = require('./routes/transaction');
const transactionItemRoutes = require('./routes/transactionItem');
const siteRoutes = require('./routes/site');
const deliveryRoutes = require('./routes/delivery');
const deliveryItemRoutes = require('./routes/deliveryItem');
const uploadsRoutes = require('./routes/uploads');

const { authMiddleware } = require('./middlewares/auth');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// routes that don't need auth
app.use('/api/auth', authRoutes);

// protect the rest
app.use('/api', authMiddleware);

app.use('/api/inventory', inventoryRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/transaction-items', transactionItemRoutes);
app.use('/api/sites', siteRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/delivery-items', deliveryItemRoutes);
app.use('/api/uploads', uploadsRoutes);

const PORT = process.env.PORT || 4000;

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('MongoDB connected');
  app.listen(PORT, () => console.log('Server running on port', PORT));
}).catch(err => {
  console.error('MongoDB connection error:', err.message);
  process.exit(1);
});

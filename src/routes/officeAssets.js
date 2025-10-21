const express = require('express');
const multer = require('multer');
const OfficeAsset = require('../models/officeAsset');
const AssetTransaction = require('../models/assetTransaction');
const { authMiddleware } = require('../middlewares/auth');
const cloudinary = require('../utils/cloudinary');

const router = express.Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// GET all office assets
router.get('/', authMiddleware, async (req, res) => {
  try {
    const assets = await OfficeAsset.find().populate('assignedTo', 'fullName').lean();
    res.json(assets);
  } catch (err) {
    console.error('Error fetching office assets:', err);
    res.status(500).json({ message: 'Failed to fetch office assets' });
  }
});

// GET office asset by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const asset = await OfficeAsset.findById(req.params.id).populate('assignedTo', 'fullName');
    if (!asset) {
      return res.status(404).json({ message: 'Office asset not found' });
    }
    res.json(asset);
  } catch (err) {
    console.error('Error fetching office asset:', err);
    res.status(500).json({ message: 'Failed to fetch office asset' });
  }
});

// POST create office asset
const { checkAdmin } = require('../middlewares/checkPermission');
router.post('/', authMiddleware, checkAdmin(), upload.single('image'), async (req, res) => {
  try {
    const { sku, name, category, subCategory, brand, model, serialNumber, quantity, purchaseDate, purchasePrice, currentValue, condition, location, assignedTo, status, description, transactionType } = req.body;

    if (!sku || !name || !category) {
      return res.status(400).json({ message: 'SKU, name, and category are required' });
    }

    const initialStock = parseInt(quantity) || 1;
    const assetData = { sku, name, category, subCategory, brand, model, serialNumber, initialStock, currentStock: initialStock, purchaseDate, purchasePrice, currentValue, condition, location, assignedTo, status, description };

    // Handle initial transaction if assignedTo is provided
    if (assignedTo && transactionType) {
      const transactionQuantity = parseInt(quantity) || 1;
      if (transactionType === 'ASSIGN') {
        assetData.currentStock = Math.max(0, assetData.currentStock - transactionQuantity);
      }
    }

    if (req.file) {
      try {
        const { uploadBufferToCloudinary } = require('../utils/cloudinary');
        const imageUrl = await uploadBufferToCloudinary(req.file.buffer, req.file.originalname);
        assetData.imageUrl = imageUrl;
      } catch (uploadError) {
        console.error('Cloudinary upload failed:', uploadError);
        assetData.imageData = req.file.buffer;
      }
    }

    const asset = new OfficeAsset(assetData);
    await asset.save();
    
    const Log = require('../models/log');
    await Log.create({
      userId: req.user._id,
      username: req.user.username,
      action: 'ADD',
      details: `Added office asset: ${asset.name} (${asset.sku})`,
      timestamp: new Date()
    });
    
    console.log('Asset saved with imageUrl:', asset.imageUrl);
    res.status(201).json(asset);
  } catch (err) {
    console.error('Error creating office asset:', err);
    if (err.code === 11000) {
      res.status(400).json({ message: 'SKU already exists' });
    } else {
      res.status(500).json({ message: 'Failed to create office asset' });
    }
  }
});

// PUT update office asset
router.put('/:id', authMiddleware, checkAdmin(), upload.single('image'), async (req, res) => {
  try {
    const { sku, name, category, subCategory, brand, model, serialNumber, quantity, purchaseDate, purchasePrice, currentValue, condition, location, assignedTo, status, description } = req.body;

    const currentAsset = await OfficeAsset.findById(req.params.id);
    if (!currentAsset) {
      return res.status(404).json({ message: 'Office asset not found' });
    }

    const updateData = { sku, name, category, subCategory, brand, model, serialNumber, purchaseDate, purchasePrice, currentValue, condition, location, assignedTo, status, description };
    if (quantity) updateData.initialStock = parseInt(quantity);

    if (req.file) {
      try {
        const { uploadBufferToCloudinary } = require('../utils/cloudinary');
        const imageUrl = await uploadBufferToCloudinary(req.file.buffer, req.file.originalname);
        updateData.imageUrl = imageUrl;
        updateData.imageData = undefined;
      } catch (uploadError) {
        console.error('Cloudinary upload failed:', uploadError);
        updateData.imageData = req.file.buffer;
        updateData.imageUrl = undefined;
      }
    }

    // Handle stock changes based on transaction type
    if (req.body.transactionType) {
      const transactionType = req.body.transactionType;
      const transactionQuantity = parseInt(req.body.quantity) || 1;
      
      if (transactionType === 'ASSIGN') {
        updateData.currentStock = Math.max(0, currentAsset.currentStock - transactionQuantity);
      } else if (transactionType === 'RETURN') {
        updateData.currentStock = currentAsset.currentStock + transactionQuantity;
      }
    }

    // Only create transaction if transactionType is provided
    if (req.body.transactionType && (assignedTo || currentAsset.assignedTo)) {
      const transactionType = req.body.transactionType;
      const transactionQuantity = parseInt(req.body.quantity) || 1;
      
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = String(now.getFullYear()).slice(-2);
      const datePrefix = `OTXN-${day}${month}${year}`;
      
      const existingTransactions = await AssetTransaction.find({
        transactionId: { $regex: `^${datePrefix}-` }
      }).sort({ transactionId: -1 }).limit(1);
      
      let sequenceNumber = 1;
      if (existingTransactions.length > 0) {
        const lastId = existingTransactions[0].transactionId;
        const lastSequence = parseInt(lastId.split('-')[2]) || 0;
        sequenceNumber = lastSequence + 1;
      }
      
      const transactionId = `${datePrefix}-${String(sequenceNumber).padStart(3, '0')}`;
      const transaction = new AssetTransaction({
        transactionId,
        type: transactionType,
        asset: req.params.id,
        employee: assignedTo || currentAsset.assignedTo,
        assignedBy: req.user._id,
        quantity: transactionQuantity,
        assignDate: new Date(),
        returnDate: transactionType === 'RETURN' ? new Date() : undefined,
        condition: condition || currentAsset.condition,
        status: transactionType === 'ASSIGN' ? 'ACTIVE' : 'RETURNED'
      });
      await transaction.save();
      
      const Log = require('../models/log');
      await Log.create({
        userId: req.user._id,
        username: req.user.username,
        action: 'ADD',
        details: `${transactionType} office asset: ${currentAsset.name} to employee`,
        timestamp: new Date()
      });
      
      const io = req.app.get('io');
      if (io) io.emit('assetTransaction:created', transaction);
    }

    const asset = await OfficeAsset.findByIdAndUpdate(req.params.id, updateData, { new: true });
    
    const Log = require('../models/log');
    await Log.create({
      userId: req.user._id,
      username: req.user.username,
      action: 'EDIT',
      details: `Edited office asset: ${asset.name} (${asset.sku})`,
      timestamp: new Date()
    });
    
    const io = req.app.get('io');
    if (io) io.emit('officeAsset:updated', asset);
    
    res.json(asset);
  } catch (err) {
    console.error('Error updating office asset:', err);
    res.status(500).json({ message: 'Failed to update office asset' });
  }
});

// DELETE office asset
router.delete('/:id', authMiddleware, checkAdmin(), async (req, res) => {
  try {
    const asset = await OfficeAsset.findByIdAndDelete(req.params.id);
    if (!asset) {
      return res.status(404).json({ message: 'Office asset not found' });
    }
    
    const Log = require('../models/log');
    await Log.create({
      userId: req.user._id,
      username: req.user.username,
      action: 'DELETE',
      details: `Deleted office asset: ${asset.name} (${asset.sku})`,
      timestamp: new Date()
    });
    
    res.json({ message: 'Office asset deleted successfully' });
  } catch (err) {
    console.error('Error deleting office asset:', err);
    res.status(500).json({ message: 'Failed to delete office asset' });
  }
});

router.get('/:id/transactions', authMiddleware, async (req, res) => {
  try {
    const AssetTransaction = require('../models/assetTransaction');
    const transactions = await AssetTransaction.find({ asset: req.params.id })
      .populate('employee', 'fullName')
      .populate('assignedBy', 'fullName')
      .sort({ createdAt: -1 })
      .lean();
    res.json(transactions);
  } catch (err) {
    console.error('Get asset transactions error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
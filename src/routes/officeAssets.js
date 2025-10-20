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
router.post('/', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    const { sku, name, category, subCategory, brand, model, serialNumber, quantity, purchaseDate, purchasePrice, currentValue, condition, location, assignedTo, status, description } = req.body;

    if (!sku || !name || !category) {
      return res.status(400).json({ message: 'SKU, name, and category are required' });
    }

    const assetData = { sku, name, category, subCategory, brand, model, serialNumber, quantity, purchaseDate, purchasePrice, currentValue, condition, location, assignedTo, status, description };

    if (req.file) {
      try {
        const result = await cloudinary.uploader.upload_stream(
          { resource_type: 'image', folder: 'office_assets' },
          (error, result) => {
            if (error) throw error;
            return result;
          }
        );
        
        result.end(req.file.buffer);
        assetData.imageUrl = result.secure_url;
      } catch (uploadError) {
        assetData.imageData = req.file.buffer;
      }
    }

    const asset = new OfficeAsset(assetData);
    await asset.save();
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
router.put('/:id', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    const { sku, name, category, subCategory, brand, model, serialNumber, quantity, purchaseDate, purchasePrice, currentValue, condition, location, assignedTo, status, description } = req.body;

    const currentAsset = await OfficeAsset.findById(req.params.id);
    if (!currentAsset) {
      return res.status(404).json({ message: 'Office asset not found' });
    }

    const updateData = { sku, name, category, subCategory, brand, model, serialNumber, quantity, purchaseDate, purchasePrice, currentValue, condition, location, assignedTo, status, description };

    if (req.file) {
      try {
        const result = await cloudinary.uploader.upload_stream(
          { resource_type: 'image', folder: 'office_assets' },
          (error, result) => {
            if (error) throw error;
            return result;
          }
        );
        
        result.end(req.file.buffer);
        updateData.imageUrl = result.secure_url;
        updateData.imageData = undefined;
      } catch (uploadError) {
        updateData.imageData = req.file.buffer;
        updateData.imageUrl = undefined;
      }
    }

    // Check if assignedTo changed and create transaction
    if (assignedTo && assignedTo !== currentAsset.assignedTo?.toString()) {
      const transactionId = `AST${Date.now()}`;
      const transaction = new AssetTransaction({
        transactionId,
        type: 'ASSIGN',
        asset: req.params.id,
        employee: assignedTo,
        assignedBy: req.user._id,
        quantity: quantity || currentAsset.quantity,
        assignDate: new Date(),
        condition: condition || currentAsset.condition,
        status: 'ACTIVE'
      });
      await transaction.save();
    }

    const asset = await OfficeAsset.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.json(asset);
  } catch (err) {
    console.error('Error updating office asset:', err);
    res.status(500).json({ message: 'Failed to update office asset' });
  }
});

// DELETE office asset
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const asset = await OfficeAsset.findByIdAndDelete(req.params.id);
    if (!asset) {
      return res.status(404).json({ message: 'Office asset not found' });
    }
    res.json({ message: 'Office asset deleted successfully' });
  } catch (err) {
    console.error('Error deleting office asset:', err);
    res.status(500).json({ message: 'Failed to delete office asset' });
  }
});

module.exports = router;
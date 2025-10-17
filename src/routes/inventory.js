
const express = require('express');
const router = express.Router();
const Inventory = require('../models/inventory');

/**
 * @swagger
 * tags:
 *   name: Inventory
 *   description: Inventory management
 */

/**
 * @swagger
 * /inventory:
 *   get:
 *     summary: Get all inventory items
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of inventory items
 *   post:
 *     summary: Create inventory item
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - itemName
 *               - sku
 *               - category
 *             properties:
 *               itemName:
 *                 type: string
 *               sku:
 *                 type: string
 *               category:
 *                 type: string
 *               currentStock:
 *                 type: number
 *     responses:
 *       201:
 *         description: Item created
 */
const multer = require('multer');
const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});
const { uploadBufferToCloudinary } = require('../utils/cloudinary');
const checkPermission = require('../middlewares/checkPermission');

// Create inventory (with optional image upload - base64/binary)
router.post('/', checkPermission('addInventory'), (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  try {
    const data = req.body;
    
    if (!data.itemName || !data.sku || !data.category) {
      return res.status(400).json({ error: 'Item name, SKU, and category are required' });
    }
    
    if (data.currentStock !== undefined && data.currentStock < 0) {
      return res.status(400).json({ error: 'Stock cannot be negative' });
    }
    
    try {
      if (req.file) {
        data.image = await uploadBufferToCloudinary(req.file.buffer, req.file.originalname || 'image');
      } else if (data.imageBase64) {
        const b = Buffer.from(data.imageBase64, 'base64');
        data.image = await uploadBufferToCloudinary(b, 'image');
      }
    } catch (e) {
      console.error('CDN upload failed:', e.message);
      if (req.file) data.image = req.file.buffer.toString('base64');
      else if (data.imageBase64) data.image = data.imageBase64;
    }
    const inv = new Inventory(data);
    await inv.save();
    res.status(201).json(inv);
  } catch (err) {
    console.error('Create inventory error:', err);
    res.status(400).json({ error: 'Failed to create inventory item' });
  }
});

// Get all (with optional filters)
router.get('/', checkPermission('viewInventory'), async (req, res) => {
  try {
    const Transaction = require('../models/transaction');
    const User = require('../models/user');
    
    const filters = {};
    if (req.query.type && typeof req.query.type === 'string') filters.type = req.query.type;
    if (req.query.origin && typeof req.query.origin === 'string') filters.origin = req.query.origin;
    
    const list = await Inventory.find(filters).lean();
    
    for (const item of list) {
      const transactions = await Transaction.find({ item: item._id }).lean();
      const users = await User.find({ 'assets.item': item._id }).lean();
      
      let issued = 0;
      let returned = 0;
      
      for (const txn of transactions) {
        if (txn.type === 'ISSUE') issued += txn.quantity || 0;
        if (txn.type === 'RETURN') returned += txn.quantity || 0;
      }
      
      let assignedToEmployees = 0;
      for (const user of users) {
        for (const asset of user.assets || []) {
          if (asset.item && asset.item.toString() === item._id.toString()) {
            assignedToEmployees += asset.quantity || 0;
          }
        }
      }
      
      item.currentStock = (item.initialStock || 0) - issued + returned - assignedToEmployees;
    }
    
    res.json(list);
  } catch (err) {
    console.error('Get inventory error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single
router.get('/:id', checkPermission('viewInventory'), async (req, res) => {
  try {
    const Transaction = require('../models/transaction');
    const User = require('../models/user');
    
    const inv = await Inventory.findById(req.params.id).lean();
    if (!inv) return res.status(404).json({ error: 'Inventory item not found' });
    
    const transactions = await Transaction.find({ item: inv._id }).lean();
    const users = await User.find({ 'assets.item': inv._id }).lean();
    
    let issued = 0;
    let returned = 0;
    
    for (const txn of transactions) {
      if (txn.type === 'ISSUE') issued += txn.quantity || 0;
      if (txn.type === 'RETURN') returned += txn.quantity || 0;
    }
    
    let assignedToEmployees = 0;
    for (const user of users) {
      for (const asset of user.assets || []) {
        if (asset.item && asset.item.toString() === inv._id.toString()) {
          assignedToEmployees += asset.quantity || 0;
        }
      }
    }
    
    inv.currentStock = (inv.initialStock || 0) - issued + returned - assignedToEmployees;
    
    res.json(inv);
  } catch (err) {
    console.error('Get inventory item error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update (PUT)
router.put('/:id', checkPermission('editInventory'), (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  try {
    const data = req.body;
    try {
      if (typeof data.image === 'string' && data.image === '') {
        data.image = '';
      } else if (req.file) {
        data.image = await uploadBufferToCloudinary(req.file.buffer, req.file.originalname || 'image');
      }
    } catch (e) {
      console.error('CDN upload failed:', e.message);
      if (req.file) data.image = req.file.buffer.toString('base64');
    }
    // Build update operations: support clearing image via sending image == ''
    const updateOps = {};
    const shouldClearImage = typeof data.image === 'string' && data.image === '';
    // Remove image key from set fields so we can $unset instead
    if (shouldClearImage) delete data.image;
    if (Object.keys(data).length) updateOps['$set'] = data;
    if (shouldClearImage) updateOps['$unset'] = { image: '' };
    const updated = await Inventory.findByIdAndUpdate(req.params.id, updateOps, { new: true });
    if (!updated) return res.status(404).json({ error: 'Inventory item not found' });
    res.json(updated);
  } catch (err) {
    console.error('Update inventory error:', err);
    res.status(400).json({ error: 'Failed to update inventory item' });
  }
});

// Patch
router.patch('/:id', checkPermission('editInventory'), async (req, res) => {
  try {
    const allowedFields = ['currentStock', 'status', 'remark'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    const updated = await Inventory.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!updated) return res.status(404).json({ error: 'Inventory item not found' });
    res.json(updated);
  } catch (err) {
    console.error('Patch inventory error:', err);
    res.status(400).json({ error: 'Failed to update inventory item' });
  }
});

// Delete
router.delete('/:id', checkPermission('deleteInventory'), async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    await Inventory.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Delete inventory error:', err);
    res.status(400).json({ error: 'Failed to delete inventory item' });
  }
});

module.exports = router;

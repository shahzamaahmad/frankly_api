
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
    if (!file) return cb(null, true);
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
    if (err && err.message !== 'Invalid file type') return res.status(400).json({ error: err.message });
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
    
    if (data.image) {
      data.imageUrl = data.image;
      delete data.image;
    }
    
    try {
      if (req.file) {
        data.imageUrl = await uploadBufferToCloudinary(req.file.buffer, req.file.originalname || 'image');
      } else if (data.imageBase64) {
        const b = Buffer.from(data.imageBase64, 'base64');
        data.imageUrl = await uploadBufferToCloudinary(b, 'image');
      }
    } catch (e) {
      console.error('CDN upload failed:', e.message);
      if (req.file) data.imageUrl = req.file.buffer.toString('base64');
      else if (data.imageBase64) data.imageUrl = data.imageBase64;
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
    const itemIds = list.map(i => i._id);
    
    const [txnAgg, userAgg] = await Promise.all([
      Transaction.aggregate([
        { $match: { item: { $in: itemIds } } },
        { $group: {
          _id: '$item',
          issued: { $sum: { $cond: [{ $eq: ['$type', 'ISSUE'] }, '$quantity', 0] } },
          returned: { $sum: { $cond: [{ $eq: ['$type', 'RETURN'] }, '$quantity', 0] } }
        }}
      ]),
      User.aggregate([
        { $match: { 'assets.item': { $in: itemIds } } },
        { $unwind: '$assets' },
        { $match: { 'assets.item': { $in: itemIds } } },
        { $group: { _id: '$assets.item', total: { $sum: '$assets.quantity' } } }
      ])
    ]);
    
    const txnMap = {};
    txnAgg.forEach(t => { txnMap[t._id.toString()] = t; });
    
    const assetMap = {};
    userAgg.forEach(a => { assetMap[a._id.toString()] = a.total || 0; });
    
    for (const item of list) {
      const id = item._id.toString();
      const txn = txnMap[id] || { issued: 0, returned: 0 };
      const assigned = assetMap[id] || 0;
      item.currentStock = (item.initialStock || 0) - txn.issued + txn.returned - assigned;
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
    
    const [txnAgg, userAgg] = await Promise.all([
      Transaction.aggregate([
        { $match: { item: inv._id } },
        { $group: {
          _id: null,
          issued: { $sum: { $cond: [{ $eq: ['$type', 'ISSUE'] }, '$quantity', 0] } },
          returned: { $sum: { $cond: [{ $eq: ['$type', 'RETURN'] }, '$quantity', 0] } }
        }}
      ]),
      User.aggregate([
        { $match: { 'assets.item': inv._id } },
        { $unwind: '$assets' },
        { $match: { 'assets.item': inv._id } },
        { $group: { _id: null, total: { $sum: '$assets.quantity' } } }
      ])
    ]);
    
    const txn = txnAgg[0] || { issued: 0, returned: 0 };
    const assigned = userAgg[0]?.total || 0;
    
    inv.currentStock = (inv.initialStock || 0) - txn.issued + txn.returned - assigned;
    
    res.json(inv);
  } catch (err) {
    console.error('Get inventory item error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update (PUT)
router.put('/:id', checkPermission('editInventory'), (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err && err.message !== 'Invalid file type') return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  try {
    const data = req.body;
    console.log('Update inventory - has file:', !!req.file);
    console.log('Update inventory - body keys:', Object.keys(data));
    
    // Parse numeric fields from strings
    if (data.initialStock) data.initialStock = Number(data.initialStock);
    if (data.currentStock) data.currentStock = Number(data.currentStock);
    if (data.unitCost) data.unitCost = Number(data.unitCost);
    if (data.weightKg) data.weightKg = Number(data.weightKg);
    if (data.warrantyMonths) data.warrantyMonths = Number(data.warrantyMonths);
    if (data.expectedLifespanMonths) data.expectedLifespanMonths = Number(data.expectedLifespanMonths);
    if (data.reorderLevel) data.reorderLevel = Number(data.reorderLevel);
    if (data.maxStockLevel) data.maxStockLevel = Number(data.maxStockLevel);
    
    try {
      if (req.file) {
        console.log('Uploading file to Cloudinary...');
        const imageUrl = await uploadBufferToCloudinary(req.file.buffer, req.file.originalname || 'image');
        console.log('Cloudinary URL:', imageUrl);
        data.imageUrl = imageUrl;
      } else if (typeof data.imageUrl === 'string' && data.imageUrl === '') {
        data.imageUrl = '';
      }
    } catch (e) {
      console.error('CDN upload failed:', e.message);
      if (req.file) data.imageUrl = req.file.buffer.toString('base64');
    }
    
    if (data.image) {
      data.imageUrl = data.image;
      delete data.image;
    }
    
    const updateOps = {};
    const shouldClearImage = typeof data.imageUrl === 'string' && data.imageUrl === '';
    if (shouldClearImage) delete data.imageUrl;
    if (Object.keys(data).length) updateOps['$set'] = data;
    if (shouldClearImage) updateOps['$unset'] = { imageUrl: '' };
    
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

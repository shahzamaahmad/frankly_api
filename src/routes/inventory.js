
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
const { createLog } = require('../utils/logger');
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
const { checkPermission, checkAdmin } = require('../middlewares/checkPermission');

// Create inventory (with optional image upload - base64/binary)
router.post('/', checkAdmin(), (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err && err.message !== 'Invalid file type') return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  try {
    const data = req.body;
    
    const itemName = data.itemName || data.name;
    if (!itemName || !data.sku || !data.category) {
      return res.status(400).json({ error: 'Item name, SKU, and category are required' });
    }
    data.name = itemName;
    delete data.itemName;
    
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
    createLog('ADD_INVENTORY', req.user.id, req.user.username, `Added item: ${inv.itemName}`).catch(e => console.error('Log failed:', e));
    if (global.io) {
      global.io.emit('inventory:created', inv);
    }
    res.status(201).json(inv);
  } catch (err) {
    console.error('Create inventory error:', err);
    res.status(400).json({ error: 'Failed to create inventory item' });
  }
});

// Get all (with optional filters and sorting)
router.get('/', checkPermission(), async (req, res) => {
  try {
    const filters = {};
    if (req.query.type && typeof req.query.type === 'string') filters.type = req.query.type;
    if (req.query.origin && typeof req.query.origin === 'string') filters.origin = req.query.origin;
    if (req.query.category && typeof req.query.category === 'string') filters.category = req.query.category;
    if (req.query.search) {
      filters.$or = [
        { itemName: { $regex: req.query.search, $options: 'i' } },
        { sku: { $regex: req.query.search, $options: 'i' } },
      ];
    }
    
    let query = Inventory.find(filters);
    
    if (req.query.sortBy) {
      const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;
      query = query.sort({ [req.query.sortBy]: sortOrder });
    } else {
      query = query.sort({ createdAt: -1 });
    }
    
    const list = await query;
    res.json(list);
  } catch (err) {
    console.error('Get inventory error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search by barcode
router.get('/barcode/:barcode', checkPermission(), async (req, res) => {
  try {
    const inv = await Inventory.findOne({ barcode: req.params.barcode });
    if (!inv) return res.status(404).json({ error: 'Item not found' });
    res.json(inv);
  } catch (err) {
    console.error('Barcode search error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search by SKU
router.get('/sku/:sku', checkPermission(), async (req, res) => {
  try {
    const inv = await Inventory.findOne({ sku: req.params.sku });
    if (!inv) return res.status(404).json({ error: 'Item not found' });
    res.json(inv);
  } catch (err) {
    console.error('SKU search error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single
router.get('/:id', checkPermission(), async (req, res) => {
  try {
    const inv = await Inventory.findById(req.params.id);
    if (!inv) return res.status(404).json({ error: 'Inventory item not found' });
    res.json(inv);
  } catch (err) {
    console.error('Get inventory item error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update (PUT)
router.put('/:id', checkAdmin(), (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err && err.message !== 'Invalid file type') return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  try {
    const data = req.body;
    
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
        const imageUrl = await uploadBufferToCloudinary(req.file.buffer, req.file.originalname || 'image');
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
    createLog('EDIT_INVENTORY', req.user.id, req.user.username, `Updated item: ${updated.itemName}`).catch(e => console.error('Log failed:', e));
    if (global.io) {
      global.io.emit('inventory:updated', updated);
    }
    res.json(updated);
  } catch (err) {
    console.error('Update inventory error:', err);
    res.status(400).json({ error: 'Failed to update inventory item' });
  }
});

// Patch
router.patch('/:id', checkAdmin(), async (req, res) => {
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
router.delete('/:id', checkAdmin(), async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    await Inventory.findByIdAndDelete(req.params.id);
    createLog('DELETE_INVENTORY', req.user.id, req.user.username, `Deleted item: ${item.itemName}`).catch(e => console.error('Log failed:', e));
    if (global.io) {
      global.io.emit('inventory:deleted', { id: req.params.id });
    }
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Delete inventory error:', err);
    res.status(400).json({ error: 'Failed to delete inventory item' });
  }
});

// Recalculate stock
router.post('/:id/recalculate', checkAdmin(), async (req, res) => {
  try {
    const Transaction = require('../models/transaction');
    const Delivery = require('../models/delivery');
    const User = require('../models/user');
    const item = await Inventory.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const [txns, deliveries, users] = await Promise.all([
      Transaction.find({ item: req.params.id }),
      Delivery.find({ 'items.itemName': req.params.id }),
      User.find({ 'assets.item': req.params.id })
    ]);

    let totalIssued = 0;
    let totalReturned = 0;
    let totalDelivered = 0;
    let totalAssigned = 0;

    txns.forEach(txn => {
      if (txn.type === 'ISSUE') totalIssued += txn.quantity;
      else if (txn.type === 'RETURN') totalReturned += txn.quantity;
    });

    deliveries.forEach(delivery => {
      delivery.items.forEach(dItem => {
        if (dItem.itemName.toString() === req.params.id) {
          totalDelivered += dItem.quantity;
        }
      });
    });

    users.forEach(user => {
      user.assets.forEach(asset => {
        if (asset.item.toString() === req.params.id) {
          totalAssigned += asset.quantity || 0;
        }
      });
    });

    const calculatedStock = item.initialStock + totalDelivered - totalIssued + totalReturned - totalAssigned;
    item.currentStock = calculatedStock;
    await item.save();

    res.json({ currentStock: calculatedStock });
  } catch (err) {
    console.error('Recalculate stock error:', err);
    res.status(500).json({ error: 'Failed to recalculate stock' });
  }
});

module.exports = router;

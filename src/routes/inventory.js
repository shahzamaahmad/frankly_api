const express = require('express');
const multer = require('multer');
const { fetchById, fetchMany, deleteRow, insertRow, updateRow } = require('../lib/db');
const { getSupabaseAdmin } = require('../lib/supabase');
const { createLog } = require('../utils/logger');
const { uploadBufferToCloudinary } = require('../utils/cloudinary');
const checkPermission = require('../middlewares/checkPermission');

const router = express.Router();

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

function parseNumber(value) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function normalizeInventoryPayload(body) {
  const payload = { ...body };

  if (payload.itemName && !payload.name) {
    payload.name = payload.itemName;
  }

  delete payload.itemName;
  delete payload.image;
  delete payload.imageBase64;
  delete payload.imageContentType;

  if (payload.barcode && !payload.sku) {
    payload.sku = payload.barcode;
  }

  if (payload.certification?.safetyStandards && !payload.safetyStandards) {
    payload.safetyStandards = payload.certification.safetyStandards;
  }

  delete payload.certification;
  delete payload.barcode;

  const numericFields = [
    'initialStock',
    'currentStock',
  ];

  for (const field of numericFields) {
    const parsed = parseNumber(payload[field]);
    if (parsed !== undefined) {
      payload[field] = parsed;
    } else if (payload[field] === '') {
      delete payload[field];
    }
  }

  return payload;
}

async function uploadInventoryImage(req, body) {
  if (body.image && !body.imageUrl) {
    body.imageUrl = body.image;
  }

  try {
    if (req.file) {
      body.imageUrl = await uploadBufferToCloudinary(req.file.buffer, req.file.originalname || 'image');
    } else if (body.imageBase64) {
      const buffer = Buffer.from(body.imageBase64, 'base64');
      body.imageUrl = await uploadBufferToCloudinary(buffer, 'image');
    }
  } catch (error) {
    console.error('CDN upload failed:', error.message);
    if (req.file) body.imageUrl = req.file.buffer.toString('base64');
    else if (body.imageBase64) body.imageUrl = body.imageBase64;
  }
}

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

router.post('/', checkPermission('addInventory'), (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err && err.message !== 'Invalid file type') return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  try {
    const body = { ...req.body };

    await uploadInventoryImage(req, body);

    const data = normalizeInventoryPayload(body);

    if (!data.name || !data.sku || !data.category) {
      return res.status(400).json({ error: 'Item name, SKU, and category are required' });
    }

    if (data.currentStock !== undefined && data.currentStock < 0) {
      return res.status(400).json({ error: 'Stock cannot be negative' });
    }

    const inventory = await insertRow('inventory', data);

    createLog('ADD_INVENTORY', req.user.id, req.user.username, `Added item: ${inventory.name}`).catch((error) => {
      console.error('Log failed:', error);
    });

    if (global.io) {
      global.io.emit('inventory:created', inventory);
    }

    res.status(201).json(inventory);
  } catch (err) {
    console.error('Create inventory error:', err);
    res.status(400).json({ error: 'Failed to create inventory item' });
  }
});

router.get('/', checkPermission('viewInventory'), async (req, res) => {
  try {
    const filters = [];

    if (req.query.type && typeof req.query.type === 'string') filters.push({ column: 'type', operator: 'eq', value: req.query.type });
    if (req.query.origin && typeof req.query.origin === 'string') filters.push({ column: 'origin', operator: 'eq', value: req.query.origin });
    if (req.query.category && typeof req.query.category === 'string') filters.push({ column: 'category', operator: 'eq', value: req.query.category });
    if (req.query.search && typeof req.query.search === 'string') {
      filters.push({ operator: 'or', value: `name.ilike.%${req.query.search}%,sku.ilike.%${req.query.search}%` });
    }

    const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy : 'createdAt';
    const ascending = req.query.sortOrder === 'asc';
    const list = await fetchMany('inventory', { filters, orderBy: sortBy, ascending });

    res.json(list);
  } catch (err) {
    console.error('Get inventory error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/barcode/:barcode', checkPermission('viewInventory'), async (req, res) => {
  try {
    const inventory = await fetchMany('inventory', {
      filters: [{ column: 'sku', operator: 'eq', value: req.params.barcode }],
      limit: 1,
    });
    const item = inventory[0];
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
  } catch (err) {
    console.error('Barcode search error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/sku/:sku', checkPermission('viewInventory'), async (req, res) => {
  try {
    const inventory = await fetchMany('inventory', {
      filters: [{ column: 'sku', operator: 'eq', value: req.params.sku }],
      limit: 1,
    });
    const item = inventory[0];
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
  } catch (err) {
    console.error('SKU search error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', checkPermission('viewInventory'), async (req, res) => {
  try {
    const inventory = await fetchById('inventory', req.params.id);
    if (!inventory) return res.status(404).json({ error: 'Inventory item not found' });
    res.json(inventory);
  } catch (err) {
    console.error('Get inventory item error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', checkPermission('editInventory'), (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err && err.message !== 'Invalid file type') return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  try {
    const body = { ...req.body };

    await uploadInventoryImage(req, body);

    const shouldClearImage = typeof body.imageUrl === 'string' && body.imageUrl === '';
    const data = normalizeInventoryPayload(body);
    if (shouldClearImage) {
      data.imageUrl = null;
    }

    const updated = await updateRow('inventory', req.params.id, data);
    if (!updated) return res.status(404).json({ error: 'Inventory item not found' });

    createLog('EDIT_INVENTORY', req.user.id, req.user.username, `Updated item: ${updated.name}`).catch((error) => {
      console.error('Log failed:', error);
    });

    if (global.io) {
      global.io.emit('inventory:updated', updated);
    }

    res.json(updated);
  } catch (err) {
    console.error('Update inventory error:', err);
    res.status(400).json({ error: 'Failed to update inventory item' });
  }
});

router.patch('/:id', checkPermission('editInventory'), async (req, res) => {
  try {
    const allowedFields = ['currentStock', 'status', 'remark'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = field === 'currentStock' ? parseNumber(req.body[field]) : req.body[field];
      }
    }

    const updated = await updateRow('inventory', req.params.id, updates);
    if (!updated) return res.status(404).json({ error: 'Inventory item not found' });
    res.json(updated);
  } catch (err) {
    console.error('Patch inventory error:', err);
    res.status(400).json({ error: 'Failed to update inventory item' });
  }
});

router.delete('/:id', checkPermission('deleteInventory'), async (req, res) => {
  try {
    const item = await fetchById('inventory', req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    await deleteRow('inventory', req.params.id);

    createLog('DELETE_INVENTORY', req.user.id, req.user.username, `Deleted item: ${item.name}`).catch((error) => {
      console.error('Log failed:', error);
    });

    if (global.io) {
      global.io.emit('inventory:deleted', { id: req.params.id });
    }

    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Delete inventory error:', err);
    res.status(400).json({ error: 'Failed to delete inventory item' });
  }
});

router.post('/:id/recalculate', checkPermission('editInventory'), async (req, res) => {
  try {
    const item = await fetchById('inventory', req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const [transactions, deliveryItems, users] = await Promise.all([
      fetchMany('transactions', { filters: [{ column: 'inventoryId', operator: 'eq', value: req.params.id }] }),
      (async () => {
        const { data, error } = await getSupabaseAdmin()
          .from('delivery_items')
          .select('inventory_id, quantity')
          .eq('inventory_id', req.params.id);

        if (error) {
          throw error;
        }

        return data || [];
      })(),
      fetchMany('users'),
    ]);

    let totalIssued = 0;
    let totalReturned = 0;
    let totalDelivered = 0;
    let totalAssigned = 0;

    for (const transaction of transactions) {
      if (transaction.type === 'ISSUE') totalIssued += Number(transaction.quantity || 0);
      else if (transaction.type === 'RETURN') totalReturned += Number(transaction.quantity || 0);
    }

    for (const deliveryItem of deliveryItems) {
      totalDelivered += Number(deliveryItem.quantity || 0);
    }

    for (const user of users) {
      for (const asset of user.assets || []) {
        if (String(asset.item) === req.params.id) {
          totalAssigned += Number(asset.quantity || 0);
        }
      }
    }

    const calculatedStock = Number(item.initialStock || 0) + totalDelivered - totalIssued + totalReturned - totalAssigned;
    await updateRow('inventory', req.params.id, { currentStock: calculatedStock });

    res.json({ currentStock: calculatedStock });
  } catch (err) {
    console.error('Recalculate stock error:', err);
    res.status(500).json({ error: 'Failed to recalculate stock' });
  }
});

module.exports = router;

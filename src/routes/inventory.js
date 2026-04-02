const express = require('express');
const multer = require('multer');
const { fetchById, fetchMany, deleteRow, hasColumn, insertRow, updateRow } = require('../lib/db');
const { uploadBufferToCloudinary } = require('../utils/cloudinary');
const checkPermission = require('../middlewares/checkPermission');
const {
  isStockOutTransaction,
  normalizeTransactionType,
} = require('../lib/transactionType');

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

function normalizeLocation(value) {
  const normalized = String(value || '').trim();
  return normalized || 'Warehouse';
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

async function calculateCurrentStock(itemId, initialStockOverride) {
  const [transactions] = await Promise.all([
    fetchMany('transactions', {
      filters: [{ column: 'inventoryId', operator: 'eq', value: itemId }],
    }),
  ]);

  let totalIssued = 0;
  let totalReturned = 0;
  let totalNew = 0;
  let totalDelivered = 0;

  for (const transaction of transactions) {
    const normalizedType = normalizeTransactionType(transaction.type);
    if (normalizedType === 'DELIVERY') {
      totalDelivered += Number(transaction.quantity || 0);
    }
    else if (isStockOutTransaction(normalizedType)) {
      totalIssued += Number(transaction.quantity || 0);
    }
    else if (normalizedType === 'RETURN') totalReturned += Number(transaction.quantity || 0);
    else if (normalizedType === 'NEW') totalNew += Number(transaction.quantity || 0);
  }

  return Number(initialStockOverride || 0) + totalDelivered - totalIssued + totalReturned + totalNew;
}

async function recalculateInventoryStock(itemId, initialStockOverride) {
  const currentStock = await calculateCurrentStock(itemId, initialStockOverride);
  await updateRow('inventory', itemId, { currentStock });
  return currentStock;
}

async function recalculateAllInventoryStock() {
  const [items, transactions] = await Promise.all([
    fetchMany('inventory'),
    fetchMany('transactions'),
  ]);

  const issuedByItem = new Map();
  const returnedByItem = new Map();
  const newByItem = new Map();
  const deliveredByItem = new Map();

  for (const transaction of transactions) {
    const itemId = String(transaction.inventoryId || '');
    if (!itemId) {
      continue;
    }

    const quantity = Number(transaction.quantity || 0);
    const normalizedType = normalizeTransactionType(transaction.type);
    if (normalizedType === 'DELIVERY') {
      deliveredByItem.set(itemId, (deliveredByItem.get(itemId) || 0) + quantity);
    } else if (isStockOutTransaction(normalizedType)) {
      issuedByItem.set(itemId, (issuedByItem.get(itemId) || 0) + quantity);
    } else if (normalizedType === 'RETURN') {
      returnedByItem.set(itemId, (returnedByItem.get(itemId) || 0) + quantity);
    } else if (normalizedType === 'NEW') {
      newByItem.set(itemId, (newByItem.get(itemId) || 0) + quantity);
    }
  }

  const updates = items.map(async (item) => {
    const itemId = String(item.id || item._id || '');
    const currentStock =
      Number(item.initialStock || 0) +
      (deliveredByItem.get(itemId) || 0) -
      (issuedByItem.get(itemId) || 0) +
      (returnedByItem.get(itemId) || 0) +
      (newByItem.get(itemId) || 0);

    await updateRow('inventory', itemId, { currentStock });
    return { id: itemId, currentStock };
  });

  const results = [];
  const chunkSize = 25;
  for (let index = 0; index < updates.length; index += chunkSize) {
    const chunk = updates.slice(index, index + chunkSize);
    results.push(...await Promise.all(chunk));
  }

  return {
    total: items.length,
    updated: results.length,
  };
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
    delete data.currentStock;

    if (!data.name || !data.sku || !data.category) {
      return res.status(400).json({ error: 'Item name, SKU, and category are required' });
    }

    if (await hasColumn('inventory', 'location')) {
      data.location = normalizeLocation(data.location);
    }

    data.currentStock = Number(data.initialStock || 0);

    const inventory = await insertRow('inventory', data);

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
    const existing = await fetchById('inventory', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Inventory item not found' });

    await uploadInventoryImage(req, body);

    const shouldClearImage = typeof body.imageUrl === 'string' && body.imageUrl === '';
    const data = normalizeInventoryPayload(body);
    delete data.currentStock;
    if (shouldClearImage) {
      data.imageUrl = null;
    }

    if (await hasColumn('inventory', 'location')) {
      data.location = normalizeLocation(data.location || existing.location);
    }

    const updated = await updateRow('inventory', req.params.id, data);
    if (!updated) return res.status(404).json({ error: 'Inventory item not found' });

    const currentStock = await recalculateInventoryStock(
      req.params.id,
      updated.initialStock !== undefined ? updated.initialStock : existing.initialStock,
    );
    updated.currentStock = currentStock;

    res.json(updated);
  } catch (err) {
    console.error('Update inventory error:', err);
    res.status(400).json({ error: 'Failed to update inventory item' });
  }
});

router.patch('/:id', checkPermission('editInventory'), async (req, res) => {
  try {
    const allowedFields = ['status', 'remark'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'No valid fields provided' });
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

    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Delete inventory error:', err);
    res.status(400).json({ error: 'Failed to delete inventory item' });
  }
});

router.post('/:id/recalculate', checkPermission('viewInventory'), async (req, res) => {
  try {
    const item = await fetchById('inventory', req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    const currentStock = await recalculateInventoryStock(req.params.id, item.initialStock);

    res.json({ currentStock });
  } catch (err) {
    console.error('Recalculate stock error:', err);
    res.status(500).json({ error: 'Failed to recalculate stock' });
  }
});

router.post('/recalculate-all', checkPermission('viewInventory'), async (req, res) => {
  try {
    const result = await recalculateAllInventoryStock();
    res.json(result);
  } catch (err) {
    console.error('Recalculate all stock error:', err);
    res.status(500).json({ error: 'Failed to recalculate all stock' });
  }
});

module.exports = router;

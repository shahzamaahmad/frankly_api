const express = require('express');
const multer = require('multer');
const { ID_COLUMN, fetchById, fetchMany, deleteRow, indexById, insertRow, uniqueIds, updateRow } = require('../lib/db');
const { uploadBufferToCloudinary } = require('../utils/cloudinary');
const checkPermission = require('../middlewares/checkPermission');
const { createLog } = require('../utils/logger');

const router = express.Router();

const getDubaiTime = () => new Date(new Date().getTime() + (4 * 60 * 60 * 1000));

const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

function normalizeItems(items) {
  const source = typeof items === 'string' ? JSON.parse(items) : items;
  if (!Array.isArray(source)) {
    return [];
  }

  return source
    .filter((item) => item && item.itemName)
    .map((item) => ({
      itemName: typeof item.itemName === 'object' ? (item.itemName._id || item.itemName.id) : item.itemName,
      quantity: Number(item.quantity || 0),
    }))
    .filter((item) => item.quantity > 0);
}

async function uploadInvoice(req, body) {
  try {
    if (req.file) {
      body.invoiceImage = await uploadBufferToCloudinary(req.file.buffer, req.file.originalname || 'invoice');
    } else if (body.invoiceBase64) {
      const buffer = Buffer.from(body.invoiceBase64, 'base64');
      body.invoiceImage = await uploadBufferToCloudinary(buffer, 'invoice');
    }
  } catch (error) {
    console.error('CDN upload failed:', error.message);
    if (req.file) body.invoiceImage = req.file.buffer.toString('base64');
    else if (body.invoiceBase64) body.invoiceImage = body.invoiceBase64;
  }
}

async function generateDeliveryId() {
  const now = getDubaiTime();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const prefix = `DEL-${dd}${mm}${yyyy}-`;

  const latest = await fetchMany('deliveries', {
    filters: [{ column: 'deliveryId', operator: 'like', value: `${prefix}%` }],
    orderBy: 'deliveryId',
    ascending: false,
    limit: 1,
  });

  let nextNum = 1;
  if (latest[0]?.deliveryId) {
    const match = latest[0].deliveryId.match(/-(\d+)$/);
    if (match) {
      nextNum = Number.parseInt(match[1], 10) + 1;
    }
  }

  return `${prefix}${String(nextNum).padStart(4, '0')}`;
}

async function recalculateInventoryStock(itemId) {
  const inventory = await fetchById('inventory', itemId);
  if (!inventory) {
    return;
  }

  const [transactions, deliveries] = await Promise.all([
    fetchMany('transactions', { filters: [{ column: 'item', operator: 'eq', value: itemId }] }),
    fetchMany('deliveries'),
  ]);

  let totalDelivered = 0;
  let totalIssued = 0;
  let totalReturned = 0;

  for (const delivery of deliveries) {
    for (const item of delivery.items || []) {
      const deliveryItemId = typeof item.itemName === 'object' ? (item.itemName._id || item.itemName.id) : item.itemName;
      if (String(deliveryItemId) === String(itemId)) {
        totalDelivered += Number(item.quantity || 0);
      }
    }
  }

  for (const transaction of transactions) {
    if (transaction.type === 'ISSUE') totalIssued += Number(transaction.quantity || 0);
    if (transaction.type === 'RETURN') totalReturned += Number(transaction.quantity || 0);
  }

  const currentStock = Number(inventory.initialStock || 0) + totalDelivered - totalIssued + totalReturned;
  await updateRow('inventory', itemId, { currentStock });
}

async function recalculateInventoryStocks(itemIds) {
  for (const itemId of uniqueIds(itemIds)) {
    await recalculateInventoryStock(itemId);
  }
}

async function populateDeliveries(deliveries) {
  if (!deliveries.length) {
    return [];
  }

  const inventoryIds = uniqueIds(
    deliveries.flatMap((delivery) => (delivery.items || []).map((item) => (
      typeof item.itemName === 'object' ? (item.itemName._id || item.itemName.id) : item.itemName
    )))
  );

  const inventory = inventoryIds.length
    ? await fetchMany('inventory', { filters: [{ column: ID_COLUMN, operator: 'in', value: inventoryIds }] })
    : [];
  const inventoryMap = indexById(inventory.map((item) => ({
    _id: item._id,
    name: item.name,
    sku: item.sku,
  })));

  return deliveries.map((delivery) => ({
    ...delivery,
    items: (delivery.items || []).map((item) => {
      const itemId = typeof item.itemName === 'object' ? (item.itemName._id || item.itemName.id) : item.itemName;
      return {
        ...item,
        itemName: itemId ? (inventoryMap.get(String(itemId)) || item.itemName) : item.itemName,
      };
    }),
  }));
}

async function populateDelivery(delivery) {
  const populated = await populateDeliveries(delivery ? [delivery] : []);
  return populated[0] || null;
}

router.post('/', checkPermission('addDeliveries'), (req, res, next) => {
  upload.single('invoice')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  try {
    const body = { ...req.body };

    if (body.deliveryDate && typeof body.deliveryDate === 'string') {
      body.deliveryDate = new Date(body.deliveryDate).toISOString();
    }

    await uploadInvoice(req, body);

    body.items = normalizeItems(body.items);
    body.amount = body.amount !== undefined && body.amount !== '' ? Number(body.amount) : body.amount;
    body.deliveryId = await generateDeliveryId();

    delete body.invoiceBase64;
    delete body.invoiceContentType;
    delete body.invoiceFilename;

    const delivery = await insertRow('deliveries', body);
    await recalculateInventoryStocks(body.items.map((item) => item.itemName));

    await createLog('ADD_DELIVERY', req.user.id, req.user.username, `Added delivery: ${delivery.deliveryId || delivery._id}`);
    if (global.io) {
      global.io.emit('delivery:created', delivery);
    }
    res.status(201).json(delivery);
  } catch (err) {
    console.error('Create delivery error:', err);
    res.status(400).json({ error: 'Failed to create delivery' });
  }
});

router.get('/', checkPermission('viewDeliveries'), async (req, res) => {
  try {
    const deliveries = await fetchMany('deliveries', { orderBy: 'createdAt', ascending: false });
    res.json(await populateDeliveries(deliveries));
  } catch (err) {
    console.error('Get deliveries error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', checkPermission('viewDeliveries'), async (req, res) => {
  try {
    const delivery = await fetchById('deliveries', req.params.id);
    if (!delivery) return res.status(404).json({ error: 'Delivery not found' });
    res.json(await populateDelivery(delivery));
  } catch (err) {
    console.error('Get delivery error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', checkPermission('editDeliveries'), (req, res, next) => {
  upload.single('invoice')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  try {
    const body = { ...req.body };
    const existingDelivery = await fetchById('deliveries', req.params.id);
    if (!existingDelivery) return res.status(404).json({ error: 'Delivery not found' });

    await uploadInvoice(req, body);

    if (body.deliveryDate && typeof body.deliveryDate === 'string') {
      body.deliveryDate = new Date(body.deliveryDate).toISOString();
    }

    if (body.items !== undefined) {
      body.items = normalizeItems(body.items);
    }

    if (body.amount !== undefined && body.amount !== '') {
      body.amount = Number(body.amount);
    }

    if (typeof body.invoiceImage === 'string' && body.invoiceImage === '') {
      body.invoiceImage = null;
    }

    delete body.invoiceBase64;
    delete body.invoiceContentType;
    delete body.invoiceFilename;

    const updated = await updateRow('deliveries', req.params.id, body);
    const affectedItems = [
      ...(existingDelivery.items || []).map((item) => typeof item.itemName === 'object' ? (item.itemName._id || item.itemName.id) : item.itemName),
      ...((updated?.items || []).map((item) => typeof item.itemName === 'object' ? (item.itemName._id || item.itemName.id) : item.itemName)),
    ];

    await recalculateInventoryStocks(affectedItems);

    await createLog('EDIT_DELIVERY', req.user.id, req.user.username, `Edited delivery: ${req.params.id}`);
    if (global.io) {
      global.io.emit('delivery:updated', updated);
    }
    res.json(updated);
  } catch (err) {
    console.error('Update delivery error:', err);
    res.status(400).json({ error: 'Failed to update delivery' });
  }
});

router.delete('/:id', checkPermission('deleteDeliveries'), async (req, res) => {
  try {
    const delivery = await fetchById('deliveries', req.params.id);
    if (!delivery) {
      return res.status(404).json({ error: 'Delivery not found' });
    }

    const affectedItems = (delivery.items || []).map((item) => typeof item.itemName === 'object' ? (item.itemName._id || item.itemName.id) : item.itemName);

    await deleteRow('deliveries', req.params.id);
    await recalculateInventoryStocks(affectedItems);

    await createLog('DELETE_DELIVERY', req.user.id, req.user.username, `Deleted delivery: ${req.params.id}`);
    if (global.io) {
      global.io.emit('delivery:deleted', { id: req.params.id });
    }
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Delete delivery error:', err);
    res.status(400).json({ error: 'Failed to delete delivery' });
  }
});

module.exports = router;

const express = require('express');
const multer = require('multer');
const { fetchById, fetchMany, deleteRow, hasColumn, indexById, insertRow, uniqueIds, updateRow } = require('../lib/db');
const { getSupabaseAdmin } = require('../lib/supabase');
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

function readItemId(item) {
  if (!item) {
    return null;
  }

  if (typeof item.itemName === 'object') {
    return item.itemName.id || item.itemName._id || null;
  }

  return item.itemName || item.inventoryId || item.itemId || item.id || null;
}

function normalizeItems(items) {
  const source = typeof items === 'string' ? JSON.parse(items) : items;
  if (!Array.isArray(source)) {
    return [];
  }

  return source
    .map((item) => ({
      inventoryId: readItemId(item),
      quantity: Number(item?.quantity || 0),
      siteId: item?.site || item?.siteId || null,
    }))
    .filter((item) => item.inventoryId && item.quantity > 0);
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

async function fetchDeliveryItemsByDeliveryIds(deliveryIds) {
  const ids = uniqueIds(deliveryIds);
  if (!ids.length) {
    return [];
  }

  const { data, error } = await getSupabaseAdmin()
    .from('delivery_items')
    .select('*')
    .in('delivery_id', ids);

  if (error) {
    throw error;
  }

  return data || [];
}

async function syncDeliveryItems(deliveryId, items) {
  const client = getSupabaseAdmin();
  const { error: deleteError } = await client
    .from('delivery_items')
    .delete()
    .eq('delivery_id', deliveryId);

  if (deleteError) {
    throw deleteError;
  }

  if (!items.length) {
    return;
  }

  const supportsSiteId = await hasColumn('deliveryItems', 'siteId');
  if (!supportsSiteId && items.some((item) => item.siteId)) {
    throw new Error('delivery_items.site_id column is required to save site-specific delivery lines');
  }

  const payload = items.map((item) => ({
    delivery_id: deliveryId,
    inventory_id: item.inventoryId,
    quantity: item.quantity,
  }));

  if (supportsSiteId) {
    for (const [index, entry] of payload.entries()) {
      entry.site_id = items[index]?.siteId || null;
    }
  }

  const { error: insertError } = await client.from('delivery_items').insert(payload);
  if (insertError) {
    throw insertError;
  }
}

async function recalculateInventoryStock(itemId) {
  const inventory = await fetchById('inventory', itemId);
  if (!inventory) {
    return;
  }

  const [transactions, deliveryItems] = await Promise.all([
    fetchMany('transactions', { filters: [{ column: 'inventoryId', operator: 'eq', value: itemId }] }),
    (async () => {
      const { data, error } = await getSupabaseAdmin()
        .from('delivery_items')
        .select('quantity')
        .eq('inventory_id', itemId);

      if (error) {
        throw error;
      }

      return data || [];
    })(),
  ]);

  let totalDelivered = 0;
  let totalIssued = 0;
  let totalReturned = 0;

  for (const item of deliveryItems) {
    totalDelivered += Number(item.quantity || 0);
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

  const deliveryItems = await fetchDeliveryItemsByDeliveryIds(deliveries.map((delivery) => delivery.id || delivery._id));
  const itemsByDeliveryId = new Map();

  for (const item of deliveryItems) {
    const deliveryId = String(item.delivery_id);
    const current = itemsByDeliveryId.get(deliveryId) || [];
    current.push(item);
    itemsByDeliveryId.set(deliveryId, current);
  }

  const inventoryIds = uniqueIds(deliveryItems.map((item) => item.inventory_id));
  const siteIds = uniqueIds(deliveryItems.map((item) => item.site_id));
  const inventory = inventoryIds.length
    ? await fetchMany('inventory', { filters: [{ column: 'id', operator: 'in', value: inventoryIds }] })
    : [];
  const sites = siteIds.length
    ? await fetchMany('sites', { filters: [{ column: 'id', operator: 'in', value: siteIds }] })
    : [];
  const inventoryMap = indexById(inventory.map((item) => ({
    id: item.id || item._id,
    name: item.name,
    sku: item.sku,
  })));
  const siteMap = indexById(sites.map((site) => ({
    id: site.id || site._id,
    siteName: site.siteName,
    name: site.siteName || site.name,
  })));

  return deliveries.map((delivery) => {
    const currentItems = itemsByDeliveryId.get(String(delivery.id || delivery._id)) || [];
    return {
      ...delivery,
      items: currentItems.map((item) => ({
        itemName: inventoryMap.get(String(item.inventory_id)) || item.inventory_id,
        quantity: Number(item.quantity || 0),
        site: item.site_id ? (siteMap.get(String(item.site_id)) || item.site_id) : null,
      })),
    };
  });
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

    const items = normalizeItems(body.items);
    body.amount = body.amount !== undefined && body.amount !== '' ? Number(body.amount) : body.amount;
    body.deliveryId = await generateDeliveryId();

    delete body.items;
    delete body.invoiceBase64;
    delete body.invoiceContentType;
    delete body.invoiceFilename;

    const delivery = await insertRow('deliveries', body);
    await syncDeliveryItems(delivery.id || delivery._id, items);
    await recalculateInventoryStocks(items.map((item) => item.inventoryId));

    const populated = await populateDelivery(delivery);
    await createLog('ADD_DELIVERY', req.user.id, req.user.username, `Added delivery: ${delivery.deliveryId || delivery.id}`);
    res.status(201).json(populated);
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
    const existingDelivery = await populateDelivery(await fetchById('deliveries', req.params.id));
    if (!existingDelivery) return res.status(404).json({ error: 'Delivery not found' });

    await uploadInvoice(req, body);

    if (body.deliveryDate && typeof body.deliveryDate === 'string') {
      body.deliveryDate = new Date(body.deliveryDate).toISOString();
    }

    const items = body.items !== undefined ? normalizeItems(body.items) : null;

    if (body.amount !== undefined && body.amount !== '') {
      body.amount = Number(body.amount);
    }

    if (typeof body.invoiceImage === 'string' && body.invoiceImage === '') {
      body.invoiceImage = null;
    }

    delete body.items;
    delete body.invoiceBase64;
    delete body.invoiceContentType;
    delete body.invoiceFilename;

    const updated = await updateRow('deliveries', req.params.id, body);
    if (items) {
      await syncDeliveryItems(req.params.id, items);
    }

    const affectedItems = [
      ...((existingDelivery.items || []).map((item) => readItemId(item))),
      ...((items || []).map((item) => item.inventoryId)),
    ];

    await recalculateInventoryStocks(affectedItems);

    const populated = await populateDelivery(updated);
    await createLog('EDIT_DELIVERY', req.user.id, req.user.username, `Edited delivery: ${req.params.id}`);
    res.json(populated);
  } catch (err) {
    console.error('Update delivery error:', err);
    res.status(400).json({ error: 'Failed to update delivery' });
  }
});

router.delete('/:id', checkPermission('deleteDeliveries'), async (req, res) => {
  try {
    const delivery = await populateDelivery(await fetchById('deliveries', req.params.id));
    if (!delivery) {
      return res.status(404).json({ error: 'Delivery not found' });
    }

    const affectedItems = (delivery.items || []).map((item) => readItemId(item));

    await syncDeliveryItems(req.params.id, []);
    await deleteRow('deliveries', req.params.id);
    await recalculateInventoryStocks(affectedItems);

    await createLog('DELETE_DELIVERY', req.user.id, req.user.username, `Deleted delivery: ${req.params.id}`);
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Delete delivery error:', err);
    res.status(400).json({ error: 'Failed to delete delivery' });
  }
});

module.exports = router;

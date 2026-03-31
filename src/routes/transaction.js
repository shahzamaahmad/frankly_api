const express = require('express');
const { fetchById, fetchMany, deleteRow, indexById, insertRow, uniqueIds, updateRow } = require('../lib/db');
const checkPermission = require('../middlewares/checkPermission');
const { createLog } = require('../utils/logger');

const router = express.Router();

const getDubaiTime = () => new Date(new Date().getTime() + (4 * 60 * 60 * 1000));

async function populateTransactions(transactions) {
  if (!transactions.length) {
    return [];
  }

  const siteIds = uniqueIds(transactions.map((transaction) => transaction.siteId));
  const itemIds = uniqueIds(transactions.map((transaction) => transaction.inventoryId));

  const [sites, items] = await Promise.all([
    siteIds.length ? fetchMany('sites', { filters: [{ column: 'id', operator: 'in', value: siteIds }] }) : [],
    itemIds.length ? fetchMany('inventory', { filters: [{ column: 'id', operator: 'in', value: itemIds }] }) : [],
  ]);

  const siteMap = indexById(sites.map((site) => ({
    id: site.id || site._id,
    siteName: site.siteName,
    siteCode: site.siteCode,
  })));
  const itemMap = indexById(items.map((item) => ({
    id: item.id || item._id,
    name: item.name,
    sku: item.sku,
  })));

  return transactions.map((transaction) => ({
    ...transaction,
    employee: transaction.employee || null,
    site: transaction.siteId ? (siteMap.get(String(transaction.siteId)) || transaction.siteId) : transaction.siteId,
    item: transaction.inventoryId ? (itemMap.get(String(transaction.inventoryId)) || transaction.inventoryId) : transaction.inventoryId,
    timestamp: transaction.eventTimestamp || transaction.timestamp,
    returnDetails: transaction.returnCondition ? { condition: transaction.returnCondition } : null,
  }));
}

async function populateTransaction(transaction) {
  const populated = await populateTransactions(transaction ? [transaction] : []);
  return populated[0] || null;
}

async function generateTransactionId(timestamp) {
  const now = timestamp ? new Date(timestamp) : getDubaiTime();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const prefix = `TXN-${dd}${mm}${yyyy}-`;

  const latest = await fetchMany('transactions', {
    filters: [{ column: 'transactionId', operator: 'like', value: `${prefix}%` }],
    orderBy: 'transactionId',
    ascending: false,
    limit: 1,
  });

  let nextNum = 1;
  if (latest[0]?.transactionId) {
    const match = latest[0].transactionId.match(/-(\d+)$/);
    if (match) {
      nextNum = Number.parseInt(match[1], 10) + 1;
    }
  }

  return {
    transactionId: `${prefix}${String(nextNum).padStart(4, '0')}`,
    timestamp: now.toISOString(),
  };
}

async function applyTransactionStock(itemId, quantity, type, reverse = false) {
  const inventory = await fetchById('inventory', itemId);
  if (!inventory) {
    throw new Error('Item not found');
  }

  const signedQuantity = Number(quantity || 0) * (reverse ? -1 : 1);
  let delta = 0;

  if (type === 'ISSUE') {
    delta = -signedQuantity;
  } else if (type === 'RETURN') {
    delta = signedQuantity;
  }

  return updateRow('inventory', itemId, {
    currentStock: Number(inventory.currentStock || 0) + delta,
  });
}

router.get('/', checkPermission('viewTransactions'), async (req, res) => {
  try {
    const filters = [];
    if (req.query.site && typeof req.query.site === 'string') filters.push({ column: 'siteId', operator: 'eq', value: req.query.site });
    if (req.query.item && typeof req.query.item === 'string') filters.push({ column: 'inventoryId', operator: 'eq', value: req.query.item });

    const transactions = await fetchMany('transactions', {
      filters,
      orderBy: 'eventTimestamp',
      ascending: false,
    });

    res.json(await populateTransactions(transactions));
  } catch (err) {
    console.error('Get transactions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', checkPermission('viewTransactions'), async (req, res) => {
  try {
    const transaction = await fetchById('transactions', req.params.id);
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    res.json(await populateTransaction(transaction));
  } catch (err) {
    console.error('Get transaction error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', checkPermission('addTransactions'), async (req, res) => {
  try {
    const { type, site, item, quantity, returnDetails, timestamp } = req.body;

    if (!type || !site || !item || !quantity || Number(quantity) <= 0) {
      return res.status(400).json({ error: 'Invalid input data' });
    }

    const { transactionId, timestamp: createdTimestamp } = await generateTransactionId(timestamp);
    await applyTransactionStock(item, quantity, type);

    const transaction = await insertRow('transactions', {
      transactionId,
      type,
      siteId: site,
      inventoryId: item,
      quantity: Number(quantity),
      returnCondition: returnDetails?.condition || null,
      eventTimestamp: createdTimestamp,
    });

    const populated = await populateTransaction(transaction);

    await createLog('ADD_TRANSACTION', req.user.id, req.user.username, `Added ${type} transaction: ${transactionId}`);
    res.status(201).json(populated);
  } catch (err) {
    console.error('Create transaction error:', err);
    const status = err.message === 'Item not found' ? 404 : 500;
    res.status(status).json({ error: status === 404 ? 'Item not found' : 'Internal server error' });
  }
});

router.put('/:id', checkPermission('editTransactions'), async (req, res) => {
  try {
    const transaction = await fetchById('transactions', req.params.id);
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

    const { type, site, item, quantity, returnDetails } = req.body;

    if (!type || !site || !item || !quantity || Number(quantity) <= 0) {
      return res.status(400).json({ error: 'Invalid input data' });
    }

    await applyTransactionStock(transaction.inventoryId, transaction.quantity, transaction.type, true);
    await applyTransactionStock(item, quantity, type);

    const updated = await updateRow('transactions', req.params.id, {
      type,
      siteId: site,
      inventoryId: item,
      quantity: Number(quantity),
      returnCondition: returnDetails?.condition || null,
    });

    const populated = await populateTransaction(updated);

    await createLog('EDIT_TRANSACTION', req.user.id, req.user.username, `Edited transaction: ${transaction.transactionId}`);
    res.json(populated);
  } catch (err) {
    console.error('Update transaction error:', err);
    const status = err.message === 'Item not found' ? 404 : 500;
    res.status(status).json({ error: status === 404 ? 'Item not found' : 'Internal server error' });
  }
});

router.delete('/:id', checkPermission('deleteTransactions'), async (req, res) => {
  try {
    const transaction = await fetchById('transactions', req.params.id);
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

    await applyTransactionStock(transaction.inventoryId, transaction.quantity, transaction.type, true);
    await deleteRow('transactions', req.params.id);

    await createLog('DELETE_TRANSACTION', req.user.id, req.user.username, `Deleted transaction: ${transaction.transactionId}`);
    res.json({ message: 'Transaction deleted' });
  } catch (err) {
    console.error('Delete transaction error:', err);
    const status = err.message === 'Item not found' ? 404 : 500;
    res.status(status).json({ error: status === 404 ? 'Item not found' : 'Internal server error' });
  }
});

module.exports = router;

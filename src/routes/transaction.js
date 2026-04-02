const express = require('express');
const { ID_COLUMN, fetchById, fetchMany, deleteRow, hasColumn, indexById, insertRow, uniqueIds } = require('../lib/db');
const checkPermission = require('../middlewares/checkPermission');
const { recalculateInventoryStocks } = require('../lib/stock');

const router = express.Router();
const DIRECT_TRANSACTION_TYPES = [
  'DELIVERY',
  'ISSUE',
  'RETURN',
  'NEW',
  'EMPLOYEE ISSUE',
  'CONSUMED',
];

function normalizeTransactionType(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  const upper = raw.toUpperCase();
  const compact = upper.replace(/[^A-Z]/g, '');

  switch (compact) {
    case 'ISSUE':
      return 'ISSUE';
    case 'RETURN':
      return 'RETURN';
    case 'NEW':
      return 'NEW';
    case 'DELIVERY':
      return 'DELIVERY';
    case 'EMPLOYEEISSUE':
    case 'EMPLOYEE':
      return 'EMPLOYEE ISSUE';
    case 'CONSUMABLE':
    case 'CONSUMED':
      return 'CONSUMED';
    case 'SITETRANSFER':
      return 'SITE TRANSFER';
    default:
      return upper;
  }
}

const getDubaiTime = () => new Date(new Date().getTime() + (4 * 60 * 60 * 1000));

async function fetchUserSummaries(ids) {
  const userIds = uniqueIds(ids);
  if (!userIds.length) {
    return new Map();
  }

  const users = await fetchMany('users', {
    filters: [{ column: ID_COLUMN, operator: 'in', value: userIds }],
  });

  return indexById(users.map((user) => ({
    id: user.id || user._id,
    username: user.username,
    fullName: user.fullName,
  })));
}

function getTransactionEmployeeId(transaction) {
  return transaction.employeeId || transaction.employee_id || transaction.employee || null;
}

async function buildTransactionWritePayload(body) {
  const payload = {
    type: normalizeTransactionType(body.type),
    siteId: body.site || null,
    inventoryId: body.item,
    quantity: Number(body.quantity),
    returnCondition: body.returnDetails?.condition || null,
  };

  if (await hasColumn('transactions', 'notes')) {
    payload.notes = body.returnDetails?.notes || null;
  }

  const employeeId = body.employee || null;
  if (!employeeId) {
    return payload;
  }

  if (await hasColumn('transactions', 'employeeId')) {
    payload.employeeId = employeeId;
  } else if (await hasColumn('transactions', 'employee')) {
    payload.employee = employeeId;
  }

  if (await hasColumn('transactions', 'employeeName')) {
    const employee = await fetchById('users', employeeId);
    payload.employeeName = employee?.fullName || employee?.username || null;
  }

  return payload;
}

async function buildTransactionPayloadConfig() {
  const [
    supportsNotes,
    supportsEmployeeId,
    supportsEmployee,
    supportsEmployeeName,
  ] = await Promise.all([
    hasColumn('transactions', 'notes'),
    hasColumn('transactions', 'employeeId'),
    hasColumn('transactions', 'employee'),
    hasColumn('transactions', 'employeeName'),
  ]);

  return {
    supportsNotes,
    supportsEmployeeId,
    supportsEmployee,
    supportsEmployeeName,
  };
}

function buildTransactionWritePayloadFromConfig(body, config, employeeMap = new Map()) {
  const payload = {
    type: normalizeTransactionType(body.type),
    siteId: body.site || null,
    inventoryId: body.item,
    quantity: Number(body.quantity),
    returnCondition: body.returnDetails?.condition || null,
  };

  if (config.supportsNotes) {
    payload.notes = body.returnDetails?.notes || null;
  }

  const employeeId = body.employee || null;
  if (!employeeId) {
    return payload;
  }

  if (config.supportsEmployeeId) {
    payload.employeeId = employeeId;
  } else if (config.supportsEmployee) {
    payload.employee = employeeId;
  }

  if (config.supportsEmployeeName) {
    const employee = employeeMap.get(String(employeeId));
    payload.employeeName = employee?.fullName || employee?.username || null;
  }

  return payload;
}

async function populateTransactions(transactions) {
  if (!transactions.length) {
    return [];
  }

  const siteIds = uniqueIds(transactions.map((transaction) => transaction.siteId));
  const itemIds = uniqueIds(transactions.map((transaction) => transaction.inventoryId));
  const employeeIds = uniqueIds(transactions.map((transaction) => getTransactionEmployeeId(transaction)));

  const [sites, items, employees] = await Promise.all([
    siteIds.length ? fetchMany('sites', { filters: [{ column: 'id', operator: 'in', value: siteIds }] }) : [],
    itemIds.length ? fetchMany('inventory', { filters: [{ column: 'id', operator: 'in', value: itemIds }] }) : [],
    fetchUserSummaries(employeeIds),
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

  return transactions.map((transaction) => {
    const employeeId = getTransactionEmployeeId(transaction);
    const employee = employeeId ? (employees.get(String(employeeId)) || employeeId) : null;

    return ({
    ...transaction,
    employee,
    site: transaction.siteId ? (siteMap.get(String(transaction.siteId)) || transaction.siteId) : transaction.siteId,
    item: transaction.inventoryId ? (itemMap.get(String(transaction.inventoryId)) || transaction.inventoryId) : transaction.inventoryId,
    timestamp: transaction.eventTimestamp || transaction.timestamp,
    returnDetails: (transaction.returnCondition || transaction.notes)
      ? {
        condition: transaction.returnCondition || '',
        notes: transaction.notes || null,
      }
      : null,
    });
  });
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

function validateTransactionInput(body) {
  const normalizedType = normalizeTransactionType(body?.type);
  const item = body?.item;
  const quantity = Number(body?.quantity);

  if (!normalizedType || !item || !quantity || quantity <= 0) {
    return 'Invalid input data';
  }

  if (!DIRECT_TRANSACTION_TYPES.includes(normalizedType)) {
    return 'Invalid transaction type';
  }

  if (normalizedType === 'ISSUE' && !body?.site) {
    return 'Site is required for issue transactions';
  }

  if (normalizedType === 'CONSUMED' && !body?.site) {
    return 'Site is required for consumed transactions';
  }

  if (normalizedType === 'DELIVERY' && !body?.item) {
    return 'Item is required for delivery transactions';
  }

  if (normalizedType === 'RETURN' && !body?.site && !body?.employee) {
    return 'Site or employee is required for return transactions';
  }

  if (normalizedType === 'EMPLOYEE ISSUE' && !body?.employee) {
    return 'Employee is required for employee issue transactions';
  }

  return null;
}

function transactionTimestampValue(transaction) {
  const value = transaction?.eventTimestamp || transaction?.timestamp || null;
  const parsed = value ? new Date(value).getTime() : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function transactionIdentityValue(transaction) {
  return String(
    transaction?.transactionId ||
      transaction?.id ||
      transaction?._id ||
      '',
  );
}

function isLaterTransaction(candidate, current) {
  const candidateTimestamp = transactionTimestampValue(candidate);
  const currentTimestamp = transactionTimestampValue(current);

  if (candidateTimestamp !== currentTimestamp) {
    return candidateTimestamp > currentTimestamp;
  }

  return transactionIdentityValue(candidate) >
    transactionIdentityValue(current);
}

function isStoredSiteTransferTransaction(transaction) {
  const type = normalizeTransactionType(transaction?.type);
  const notes = String(transaction?.notes || '').trim().toLowerCase();
  return (
    (type === 'RETURN' && notes.includes('site transfer to ')) ||
    (type === 'ISSUE' && notes.includes('site transfer from '))
  );
}

async function getDeleteBlockReason(transaction) {
  if (isStoredSiteTransferTransaction(transaction)) {
    return 'Site transfer transactions cannot be deleted individually.';
  }

  const inventoryId = transaction?.inventoryId || null;
  if (!inventoryId) {
    return null;
  }

  const relatedTransactions = await fetchMany('transactions', {
    filters: [{ column: 'inventoryId', operator: 'eq', value: inventoryId }],
  });
  const currentId = String(transaction.id || transaction._id || '');

  const hasLaterMovement = relatedTransactions.some((entry) => {
    const entryId = String(entry.id || entry._id || '');
    return entryId !== currentId && isLaterTransaction(entry, transaction);
  });

  if (hasLaterMovement) {
    return 'Cannot delete this transaction because newer movement exists for this item. Delete the latest related transaction first, or add a correcting transaction instead.';
  }

  return null;
}

router.get('/', checkPermission('viewTransactions'), async (req, res) => {
  try {
    const filters = [];
    const includeDelivery = String(req.query.includeDelivery || '')
      .trim()
      .toLowerCase() === 'true';
    if (req.query.site && typeof req.query.site === 'string') filters.push({ column: 'siteId', operator: 'eq', value: req.query.site });
    if (req.query.item && typeof req.query.item === 'string') filters.push({ column: 'inventoryId', operator: 'eq', value: req.query.item });
    if (req.query.employee && typeof req.query.employee === 'string') {
      if (await hasColumn('transactions', 'employeeId')) {
        filters.push({ column: 'employeeId', operator: 'eq', value: req.query.employee });
      } else if (await hasColumn('transactions', 'employee')) {
        filters.push({ column: 'employee', operator: 'eq', value: req.query.employee });
      } else {
        return res.json([]);
      }
    }

    const transactions = await fetchMany('transactions', {
      filters,
      orderBy: 'eventTimestamp',
      ascending: false,
    });

    const visibleTransactions = includeDelivery
      ? transactions
      : transactions.filter(
        (transaction) => normalizeTransactionType(transaction.type) !== 'DELIVERY',
      );

    res.json(await populateTransactions(visibleTransactions));
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
    const { item, timestamp } = req.body;

    const validationError = validateTransactionInput(req.body);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const { transactionId, timestamp: createdTimestamp } = await generateTransactionId(timestamp);
    const existingItem = await fetchById('inventory', item);
    if (!existingItem) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const writePayload = await buildTransactionWritePayload(req.body);
    const transaction = await insertRow('transactions', {
      transactionId,
      eventTimestamp: createdTimestamp,
      ...writePayload,
    });
    await recalculateInventoryStocks([item]);

    const populated = await populateTransaction(transaction);

    res.status(201).json(populated);
  } catch (err) {
    console.error('Create transaction error:', err);
    const status = err.message === 'Item not found' ? 404 : 500;
    res.status(status).json({ error: status === 404 ? 'Item not found' : 'Internal server error' });
  }
});

router.post('/bulk', checkPermission('addTransactions'), async (req, res) => {
  try {
    const source = Array.isArray(req.body?.transactions) ? req.body.transactions : [];
    if (!source.length) {
      return res.status(400).json({ error: 'At least one transaction is required' });
    }

    const normalized = source.map((body) => {
      const type = normalizeTransactionType(body?.type);
      const item = body?.item;
      const quantity = Number(body?.quantity);
      return { body, type, item, quantity };
    });

    for (const entry of normalized) {
      const validationError = validateTransactionInput(entry.body);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }
    }

    const itemIds = uniqueIds(normalized.map((entry) => entry.item));
    const existingItems = await fetchMany('inventory', {
      filters: [{ column: 'id', operator: 'in', value: itemIds }],
    });
    const existingItemIds = new Set(existingItems.map((item) => String(item.id || item._id)));
    if (itemIds.some((itemId) => !existingItemIds.has(String(itemId)))) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const payloadConfig = await buildTransactionPayloadConfig();
    const employeeMap = await fetchUserSummaries(normalized.map((entry) => entry.body.employee));
    const now = new Date().toISOString();
    const deliveryTimestamp = normalized[0]?.body?.timestamp;
    const { transactionId: firstTransactionId } = await generateTransactionId(deliveryTimestamp);
    const prefixMatch = firstTransactionId.match(/^(.*-)(\d+)$/);
    const prefix = prefixMatch ? prefixMatch[1] : firstTransactionId;
    const startSequence = prefixMatch ? Number.parseInt(prefixMatch[2], 10) : 1;

    const createdTransactions = [];
    for (const [index, entry] of normalized.entries()) {
      const writePayload = buildTransactionWritePayloadFromConfig(
        entry.body,
        payloadConfig,
        employeeMap,
      );
      const created = await insertRow('transactions', {
        transactionId: `${prefix}${String(startSequence + index).padStart(4, '0')}`,
        eventTimestamp: entry.body.timestamp || now,
        ...writePayload,
      });
      createdTransactions.push(created);
    }

    await recalculateInventoryStocks(itemIds);

    res.status(201).json(await populateTransactions(createdTransactions));
  } catch (err) {
    console.error('Create bulk transactions error:', err);
    const status = err.message === 'Item not found' ? 404 : 500;
    res.status(status).json({ error: status === 404 ? 'Item not found' : 'Internal server error' });
  }
});

router.put('/:id', checkPermission('editTransactions'), async (req, res) => {
  return res.status(403).json({ error: 'Transaction editing is disabled. Transactions cannot be edited.' });
});

router.delete('/:id', checkPermission('deleteTransactions'), async (req, res) => {
  try {
    const transaction = await fetchById('transactions', req.params.id);
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

    const deleteBlockReason = await getDeleteBlockReason(transaction);
    if (deleteBlockReason) {
      return res.status(409).json({ error: deleteBlockReason });
    }

    await deleteRow('transactions', req.params.id);
    await recalculateInventoryStocks([transaction.inventoryId]);

    res.json({ message: 'Transaction deleted' });
  } catch (err) {
    console.error('Delete transaction error:', err);
    const status = err.message === 'Item not found' ? 404 : 500;
    res.status(status).json({ error: status === 404 ? 'Item not found' : 'Internal server error' });
  }
});

module.exports = router;

const { fetchMany, updateRow, uniqueIds } = require('./db');
const {
  isStockOutTransaction,
  normalizeTransactionType,
} = require('./transactionType');

function _toItemId(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value);
}

function _buildStockMap(items, transactions, initialStockOverrides = new Map()) {
  const issuedByItem = new Map();
  const returnedByItem = new Map();
  const newByItem = new Map();
  const deliveredByItem = new Map();

  for (const transaction of transactions) {
    const itemId = _toItemId(transaction.inventoryId);
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

  const result = new Map();
  for (const item of items) {
    const itemId = _toItemId(item.id || item._id);
    if (!itemId) {
      continue;
    }

    const initialStock = initialStockOverrides.has(itemId)
      ? Number(initialStockOverrides.get(itemId) || 0)
      : Number(item.initialStock || 0);

    result.set(
      itemId,
      initialStock +
        (deliveredByItem.get(itemId) || 0) -
        (issuedByItem.get(itemId) || 0) +
        (returnedByItem.get(itemId) || 0) +
        (newByItem.get(itemId) || 0),
    );
  }

  return result;
}

async function calculateInventoryStocks(itemIds, initialStockOverrides = new Map()) {
  const uniqueItemIds = uniqueIds(itemIds).map((value) => String(value));
  if (!uniqueItemIds.length) {
    return new Map();
  }

  const [items, transactions] = await Promise.all([
    fetchMany('inventory', {
      filters: [{ column: 'id', operator: 'in', value: uniqueItemIds }],
    }),
    fetchMany('transactions', {
      filters: [{ column: 'inventoryId', operator: 'in', value: uniqueItemIds }],
    }),
  ]);

  return _buildStockMap(items, transactions, initialStockOverrides);
}

async function recalculateInventoryStocks(itemIds, initialStockOverrides = new Map()) {
  const stockMap = await calculateInventoryStocks(itemIds, initialStockOverrides);
  const entries = Array.from(stockMap.entries());

  for (let index = 0; index < entries.length; index += 25) {
    const chunk = entries.slice(index, index + 25);
    await Promise.all(
      chunk.map(([itemId, currentStock]) =>
        updateRow('inventory', itemId, { currentStock }),
      ),
    );
  }

  return stockMap;
}

async function recalculateInventoryStock(itemId, initialStockOverride) {
  const normalizedId = _toItemId(itemId);
  if (!normalizedId) {
    return 0;
  }

  const stockMap = await recalculateInventoryStocks(
    [normalizedId],
    initialStockOverride === undefined
      ? new Map()
      : new Map([[normalizedId, Number(initialStockOverride || 0)]]),
  );
  return stockMap.get(normalizedId) || 0;
}

async function recalculateAllInventoryStock() {
  const [items, transactions] = await Promise.all([
    fetchMany('inventory'),
    fetchMany('transactions'),
  ]);

  const stockMap = _buildStockMap(items, transactions);
  const entries = Array.from(stockMap.entries());

  for (let index = 0; index < entries.length; index += 25) {
    const chunk = entries.slice(index, index + 25);
    await Promise.all(
      chunk.map(([itemId, currentStock]) =>
        updateRow('inventory', itemId, { currentStock }),
      ),
    );
  }

  return {
    total: items.length,
    updated: entries.length,
  };
}

module.exports = {
  calculateInventoryStocks,
  recalculateInventoryStock,
  recalculateInventoryStocks,
  recalculateAllInventoryStock,
};

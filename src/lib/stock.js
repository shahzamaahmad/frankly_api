const { fetchMany, updateRow, uniqueIds } = require('./db');
const { getSupabaseAdmin } = require('./supabase');

function _toItemId(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value);
}

async function _fetchDeliveryItems(itemIds) {
  let query = getSupabaseAdmin()
    .from('delivery_items')
    .select('inventory_id, quantity');

  if (itemIds.length) {
    query = query.in('inventory_id', itemIds);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data || [];
}

function _buildStockMap(items, transactions, deliveryItems, initialStockOverrides = new Map()) {
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
    if (transaction.type === 'ISSUE') {
      issuedByItem.set(itemId, (issuedByItem.get(itemId) || 0) + quantity);
    } else if (transaction.type === 'RETURN') {
      returnedByItem.set(itemId, (returnedByItem.get(itemId) || 0) + quantity);
    } else if (transaction.type === 'NEW') {
      newByItem.set(itemId, (newByItem.get(itemId) || 0) + quantity);
    }
  }

  for (const deliveryItem of deliveryItems) {
    const itemId = _toItemId(deliveryItem.inventory_id);
    if (!itemId) {
      continue;
    }

    deliveredByItem.set(
      itemId,
      (deliveredByItem.get(itemId) || 0) + Number(deliveryItem.quantity || 0),
    );
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

  const [items, transactions, deliveryItems] = await Promise.all([
    fetchMany('inventory', {
      filters: [{ column: 'id', operator: 'in', value: uniqueItemIds }],
    }),
    fetchMany('transactions', {
      filters: [{ column: 'inventoryId', operator: 'in', value: uniqueItemIds }],
    }),
    _fetchDeliveryItems(uniqueItemIds),
  ]);

  return _buildStockMap(items, transactions, deliveryItems, initialStockOverrides);
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
  const [items, transactions, deliveryItems] = await Promise.all([
    fetchMany('inventory'),
    fetchMany('transactions'),
    _fetchDeliveryItems([]),
  ]);

  const stockMap = _buildStockMap(items, transactions, deliveryItems);
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

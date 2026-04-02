const { fetchMany, hasColumn, updateRow, uniqueIds } = require('./db');
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

function _normalizeSiteLabel(site) {
  const siteCode = String(site?.siteCode || '').trim().toUpperCase();
  const siteName = String(site?.siteName || site?.name || '').trim().toUpperCase();
  return siteCode === 'WAREHOUSE' || siteName === 'WAREHOUSE';
}

function _transactionTimestampValue(transaction) {
  const value =
    transaction?.deliveryDate ||
    transaction?.eventTimestamp ||
    transaction?.timestamp ||
    null;
  const parsed = value ? new Date(value).getTime() : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function _transactionIdentityValue(transaction) {
  return String(
    transaction?.transactionId ||
      transaction?.deliveryId ||
      transaction?.id ||
      transaction?._id ||
      '',
  );
}

function _pickLaterTransaction(candidate, current) {
  if (!current) {
    return candidate;
  }

  const candidateTimestamp = _transactionTimestampValue(candidate);
  const currentTimestamp = _transactionTimestampValue(current);
  if (candidateTimestamp !== currentTimestamp) {
    return candidateTimestamp > currentTimestamp ? candidate : current;
  }

  return _transactionIdentityValue(candidate) > _transactionIdentityValue(current)
    ? candidate
    : current;
}

function _resolveLocationSiteIdFromTransaction(transaction, warehouseSiteId) {
  const normalizedType = normalizeTransactionType(transaction?.type);

  if (transaction?.toSiteId) {
    return String(transaction.toSiteId);
  }

  if (transaction?.siteId) {
    if (
      normalizedType === 'RETURN' ||
      normalizedType === 'NEW' ||
      normalizedType === 'DELIVERY' ||
      normalizedType === 'EMPLOYEE ISSUE'
    ) {
      return warehouseSiteId;
    }
    return String(transaction.siteId);
  }

  if (transaction?.fromSiteId) {
    return String(transaction.fromSiteId);
  }

  if (normalizedType === 'NEW' || normalizedType === 'DELIVERY') {
    return warehouseSiteId;
  }

  return null;
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

async function _resolveInventoryLocationUpdates(items, transactions) {
  const [supportsLocation, supportsLocationSiteId, sites] = await Promise.all([
    hasColumn('inventory', 'location'),
    hasColumn('inventory', 'locationSiteId'),
    fetchMany('sites'),
  ]);

  if (!supportsLocation && !supportsLocationSiteId) {
    return new Map();
  }

  const siteMap = new Map(
    sites.map((site) => [
      String(site.id || site._id || ''),
      site,
    ]),
  );
  const warehouseSite = sites.find(_normalizeSiteLabel) || null;
  const warehouseSiteId = warehouseSite
    ? String(warehouseSite.id || warehouseSite._id || '')
    : null;
  const latestLocationTransactionByItem = new Map();

  for (const transaction of transactions) {
    const itemId = _toItemId(transaction.inventoryId);
    if (!itemId) {
      continue;
    }

    const locationSiteId = _resolveLocationSiteIdFromTransaction(
      transaction,
      warehouseSiteId,
    );
    if (!locationSiteId) {
      continue;
    }

    latestLocationTransactionByItem.set(
      itemId,
      _pickLaterTransaction(
        transaction,
        latestLocationTransactionByItem.get(itemId),
      ),
    );
  }

  const updates = new Map();
  for (const item of items) {
    const itemId = _toItemId(item.id || item._id);
    if (!itemId) {
      continue;
    }

    const latestTransaction = latestLocationTransactionByItem.get(itemId);
    const resolvedSiteId = latestTransaction
      ? _resolveLocationSiteIdFromTransaction(latestTransaction, warehouseSiteId)
      : String(item.locationSiteId || item.location_site_id || '');
    const resolvedSite = resolvedSiteId ? siteMap.get(resolvedSiteId) : null;
    const nextLocation =
      resolvedSite?.siteName ||
      resolvedSite?.name ||
      item.location ||
      'Warehouse';

    updates.set(itemId, {
      ...(supportsLocation ? { location: nextLocation } : {}),
      ...(supportsLocationSiteId
        ? {
            locationSiteId: resolvedSiteId || null,
          }
        : {}),
    });
  }

  return updates;
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
  const uniqueItemIds = uniqueIds(itemIds).map((value) => String(value));
  const [items, transactions] = await Promise.all([
    uniqueItemIds.length
      ? fetchMany('inventory', {
          filters: [{ column: 'id', operator: 'in', value: uniqueItemIds }],
        })
      : [],
    uniqueItemIds.length
      ? fetchMany('transactions', {
          filters: [{ column: 'inventoryId', operator: 'in', value: uniqueItemIds }],
        })
      : [],
  ]);
  const stockMap = _buildStockMap(items, transactions, initialStockOverrides);
  const locationUpdates = await _resolveInventoryLocationUpdates(items, transactions);
  const entries = Array.from(stockMap.entries());

  for (let index = 0; index < entries.length; index += 25) {
    const chunk = entries.slice(index, index + 25);
    await Promise.all(
      chunk.map(([itemId, currentStock]) => {
        const locationUpdate = locationUpdates.get(itemId) || {};
        return updateRow('inventory', itemId, { currentStock, ...locationUpdate });
      }),
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
  const locationUpdates = await _resolveInventoryLocationUpdates(items, transactions);
  const entries = Array.from(stockMap.entries());

  for (let index = 0; index < entries.length; index += 25) {
    const chunk = entries.slice(index, index + 25);
    await Promise.all(
      chunk.map(([itemId, currentStock]) => {
        const locationUpdate = locationUpdates.get(itemId) || {};
        return updateRow('inventory', itemId, { currentStock, ...locationUpdate });
      }),
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

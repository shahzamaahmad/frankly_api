const { getSupabaseAdmin } = require('./supabase');

const CONFIGURED_ID_COLUMN = process.env.SUPABASE_ID_COLUMN;
const ID_COLUMN = CONFIGURED_ID_COLUMN || '_id';
const USE_SNAKE_CASE = process.env.SUPABASE_USE_SNAKE_CASE === 'true';

const tableCandidates = {
  users: [process.env.SUPABASE_TABLE_USERS, 'users', 'user'],
  inventory: [process.env.SUPABASE_TABLE_INVENTORY, 'inventory', 'inventories'],
  sites: [process.env.SUPABASE_TABLE_SITES, 'sites', 'site'],
  transactions: [process.env.SUPABASE_TABLE_TRANSACTIONS, 'transactions', 'transaction'],
  deliveries: [process.env.SUPABASE_TABLE_DELIVERIES, 'deliveries', 'delivery'],
  attendance: [process.env.SUPABASE_TABLE_ATTENDANCE, 'attendance', 'attendances'],
  notifications: [process.env.SUPABASE_TABLE_NOTIFICATIONS, 'notifications', 'notification'],
  favorites: [process.env.SUPABASE_TABLE_FAVORITES, 'favorites', 'favorite'],
  logs: [process.env.SUPABASE_TABLE_LOGS, 'logs', 'log'],
  activities: [process.env.SUPABASE_TABLE_ACTIVITIES, 'activities', 'activity'],
  appConfig: [process.env.SUPABASE_TABLE_APP_CONFIG, 'app_config', 'app_configs', 'appConfig'],
};

const resolvedTables = new Map();
const resolvedIdColumns = new Map();

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function toCamelCase(key) {
  if (key === '_id') {
    return key;
  }
  return key.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
}

function toSnakeCase(key) {
  if (key === '_id') {
    return key;
  }
  return key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
}

function deepTransformKeys(value, transformer) {
  if (Array.isArray(value)) {
    return value.map((item) => deepTransformKeys(item, transformer));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    result[transformer(key)] = deepTransformKeys(entry, transformer);
  }
  return result;
}

function deepSerialize(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => deepSerialize(item));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined) {
      continue;
    }
    result[key] = deepSerialize(entry);
  }
  return result;
}

function normalizeRow(row) {
  if (!row) {
    return row;
  }

  const normalized = deepTransformKeys(row, toCamelCase);
  const recordId = normalized._id ?? normalized.id ?? row._id ?? row.id;

  if (recordId !== undefined && recordId !== null) {
    normalized._id = String(recordId);
    normalized.id = String(recordId);
  }

  return normalized;
}

function preparePayload(payload) {
  const serialized = deepSerialize(payload);
  if (!USE_SNAKE_CASE) {
    return serialized;
  }
  return deepTransformKeys(serialized, toSnakeCase);
}

function applyTimestamps(payload, { forInsert = false } = {}) {
  const now = new Date().toISOString();
  const nextPayload = { ...payload };

  if (forInsert && nextPayload.createdAt === undefined) {
    nextPayload.createdAt = now;
  }

  if (nextPayload.updatedAt === undefined) {
    nextPayload.updatedAt = now;
  }

  return nextPayload;
}

function generateObjectId() {
  const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
  let random = '';
  while (random.length < 16) {
    random += Math.floor(Math.random() * 0xffffffff)
      .toString(16)
      .padStart(8, '0');
  }
  return `${timestamp}${random}`.slice(0, 24);
}

function getIdColumnCandidates() {
  return [...new Set([CONFIGURED_ID_COLUMN, '_id', 'id', 'row_id'].filter(Boolean))];
}

function isIdColumnReference(column) {
  return getIdColumnCandidates().includes(column);
}

function withId(payload, idColumn) {
  const explicitId = payload[idColumn] ?? payload._id ?? payload.id;
  if (explicitId !== undefined && explicitId !== null) {
    const nextPayload = { ...payload, [idColumn]: explicitId };
    if (idColumn !== '_id') delete nextPayload._id;
    if (idColumn !== 'id') delete nextPayload.id;
    return nextPayload;
  }

  if (idColumn === '_id') {
    return { ...payload, _id: generateObjectId() };
  }

  return payload;
}

async function resolveTable(entity) {
  if (resolvedTables.has(entity)) {
    return resolvedTables.get(entity);
  }

  const client = getSupabaseAdmin();
  const candidates = (tableCandidates[entity] || []).filter(Boolean);
  let lastError = null;

  for (const tableName of candidates) {
    const { error } = await client.from(tableName).select('*').limit(1);
    if (!error) {
      resolvedTables.set(entity, tableName);
      return tableName;
    }
    lastError = error;
  }

  throw new Error(`Unable to resolve Supabase table for "${entity}"${lastError ? `: ${lastError.message}` : ''}`);
}

async function resolveIdColumn(entity) {
  if (resolvedIdColumns.has(entity)) {
    return resolvedIdColumns.get(entity);
  }

  const table = await resolveTable(entity);
  const client = getSupabaseAdmin();
  let lastError = null;

  for (const column of getIdColumnCandidates()) {
    const { error } = await client.from(table).select(column).limit(1);
    if (!error) {
      resolvedIdColumns.set(entity, column);
      return column;
    }
    lastError = error;
  }

  throw new Error(`Unable to resolve Supabase id column for "${entity}"${lastError ? `: ${lastError.message}` : ''}`);
}

async function normalizeFilters(entity, filters = []) {
  if (!filters.length) {
    return filters;
  }

  const idColumn = await resolveIdColumn(entity);
  return filters.map((filter) => {
    if (!filter || !filter.column || !isIdColumnReference(filter.column)) {
      return filter;
    }

    return { ...filter, column: idColumn };
  });
}

function applyFilters(query, filters = []) {
  let nextQuery = query;

  for (const filter of filters) {
    if (!filter || filter.value === undefined) {
      continue;
    }

    switch (filter.operator) {
      case 'eq':
        nextQuery = nextQuery.eq(filter.column, filter.value);
        break;
      case 'in':
        nextQuery = nextQuery.in(filter.column, filter.value);
        break;
      case 'is':
        nextQuery = nextQuery.is(filter.column, filter.value);
        break;
      case 'gte':
        nextQuery = nextQuery.gte(filter.column, filter.value);
        break;
      case 'lte':
        nextQuery = nextQuery.lte(filter.column, filter.value);
        break;
      case 'like':
        nextQuery = nextQuery.like(filter.column, filter.value);
        break;
      case 'ilike':
        nextQuery = nextQuery.ilike(filter.column, filter.value);
        break;
      case 'or':
        nextQuery = nextQuery.or(filter.value);
        break;
      default:
        throw new Error(`Unsupported filter operator: ${filter.operator}`);
    }
  }

  return nextQuery;
}

async function fetchMany(entity, options = {}) {
  const {
    select = '*',
    filters = [],
    orderBy,
    ascending = true,
    limit,
  } = options;

  const [table, idColumn, normalizedFilters] = await Promise.all([
    resolveTable(entity),
    resolveIdColumn(entity),
    normalizeFilters(entity, filters),
  ]);
  let query = getSupabaseAdmin().from(table).select(select);
  query = applyFilters(query, normalizedFilters);

  if (orderBy) {
    query = query.order(isIdColumnReference(orderBy) ? idColumn : orderBy, { ascending });
  }

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data || []).map(normalizeRow);
}

async function fetchOne(entity, options = {}) {
  const rows = await fetchMany(entity, { ...options, limit: 1 });
  return rows[0] || null;
}

async function fetchById(entity, id, options = {}) {
  const idColumn = await resolveIdColumn(entity);
  return fetchOne(entity, {
    ...options,
    filters: [...(options.filters || []), { column: idColumn, operator: 'eq', value: id }],
  });
}

async function insertRow(entity, payload, options = {}) {
  const { select = '*', timestamps = true } = options;
  const [table, idColumn] = await Promise.all([resolveTable(entity), resolveIdColumn(entity)]);
  const basePayload = timestamps ? applyTimestamps(payload, { forInsert: true }) : { ...payload };
  const record = preparePayload(withId(basePayload, idColumn));
  const { data, error } = await getSupabaseAdmin()
    .from(table)
    .insert(record)
    .select(select)
    .single();

  if (error) {
    throw error;
  }

  return normalizeRow(data);
}

async function updateRow(entity, id, payload, options = {}) {
  const { select = '*', timestamps = true } = options;
  const [table, idColumn] = await Promise.all([resolveTable(entity), resolveIdColumn(entity)]);
  const nextPayload = timestamps ? applyTimestamps(payload) : { ...payload };
  const record = preparePayload(nextPayload);
  const { data, error } = await getSupabaseAdmin()
    .from(table)
    .update(record)
    .eq(idColumn, id)
    .select(select)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return normalizeRow(data);
}

async function deleteRow(entity, id) {
  const [table, idColumn] = await Promise.all([resolveTable(entity), resolveIdColumn(entity)]);
  const { data, error } = await getSupabaseAdmin()
    .from(table)
    .delete()
    .eq(idColumn, id)
    .select('*')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return normalizeRow(data);
}

async function countRows(entity, filters = []) {
  const [table, normalizedFilters] = await Promise.all([
    resolveTable(entity),
    normalizeFilters(entity, filters),
  ]);
  let query = getSupabaseAdmin().from(table).select('*', { head: true, count: 'exact' });
  query = applyFilters(query, normalizedFilters);
  const { count, error } = await query;

  if (error) {
    throw error;
  }

  return count || 0;
}

function uniqueIds(values) {
  return [...new Set((values || []).filter(Boolean).map((value) => String(value)))];
}

function indexById(rows) {
  const map = new Map();
  for (const row of rows || []) {
    if (!row) {
      continue;
    }
    const rowId = row._id ?? row.id;
    if (rowId) {
      map.set(String(rowId), row);
    }
  }
  return map;
}

module.exports = {
  ID_COLUMN,
  countRows,
  deleteRow,
  fetchById,
  fetchMany,
  fetchOne,
  generateObjectId,
  indexById,
  insertRow,
  normalizeRow,
  preparePayload,
  resolveIdColumn,
  resolveTable,
  uniqueIds,
  updateRow,
};

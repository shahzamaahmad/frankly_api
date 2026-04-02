const VALID_TRANSACTION_TYPES = [
  'DELIVERY',
  'ISSUE',
  'RETURN',
  'NEW',
  'EMPLOYEE ISSUE',
  'CONSUMED',
  'SITE TRANSFER',
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
      return upper.replace(/\s+/g, ' ');
  }
}

function isStockOutTransaction(type) {
  const normalizedType = normalizeTransactionType(type);
  return normalizedType === 'ISSUE' ||
    normalizedType === 'EMPLOYEE ISSUE' ||
    normalizedType === 'CONSUMED';
}

function isStockInTransaction(type) {
  const normalizedType = normalizeTransactionType(type);
  return normalizedType === 'RETURN' ||
    normalizedType === 'NEW' ||
    normalizedType === 'DELIVERY';
}

module.exports = {
  VALID_TRANSACTION_TYPES,
  isStockInTransaction,
  isStockOutTransaction,
  normalizeTransactionType,
};

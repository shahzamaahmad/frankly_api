const DEFAULT_PERMISSIONS = {
  viewInventory: false,
  addInventory: false,
  editInventory: false,
  deleteInventory: false,
  viewTransactions: false,
  addTransactions: false,
  editTransactions: false,
  deleteTransactions: false,
  viewDeliveries: false,
  addDeliveries: false,
  editDeliveries: false,
  deleteDeliveries: false,
  viewEmployees: false,
  addEmployees: false,
  editEmployees: false,
  deleteEmployees: false,
  viewSites: false,
  addSites: false,
  editSites: false,
  deleteSites: false,
  viewContacts: true,
  viewReportAttendance: false,
  editReportAttendance: false,
  deleteReportAttendance: false,
  viewOnesignalCard: false,
  onesignalSendButton: false,
  viewEmployeeTracking: false,
  approveAttendance: false,
};

function generateUsername(firstName, lastName) {
  let baseUsername = '';
  if (lastName) {
    baseUsername = lastName.toLowerCase();
  } else if (firstName) {
    baseUsername = firstName.toLowerCase();
  } else {
    baseUsername = 'user';
  }

  baseUsername = baseUsername.replace(/[^a-z0-9]/g, '');
  const randomNum = Math.floor(Math.random() * 90) + 10;
  return `${baseUsername}${randomNum}`;
}

function buildFullName(user) {
  if (user.fullName) {
    return user.fullName;
  }
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || undefined;
}

function mergePermissions(permissions) {
  return {
    ...DEFAULT_PERMISSIONS,
    ...(permissions || {}),
  };
}

function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  const sanitized = { ...user };
  const recordId = sanitized._id ?? sanitized.id;
  delete sanitized.password;

  return {
    ...sanitized,
    _id: recordId ? String(recordId) : sanitized._id,
    id: recordId ? String(recordId) : sanitized.id,
    fullName: buildFullName(sanitized),
    isActive: sanitized.isActive !== false,
    role: sanitized.role || 'emp',
    permissions: mergePermissions(sanitized.permissions),
    salaryCurrency: sanitized.salaryCurrency || 'AED',
  };
}

module.exports = {
  DEFAULT_PERMISSIONS,
  buildFullName,
  generateUsername,
  mergePermissions,
  sanitizeUser,
};

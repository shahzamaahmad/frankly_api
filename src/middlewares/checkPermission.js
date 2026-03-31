const checkPermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized', requiresPermission: true });
    }

    if (String(req.user.role || '').toLowerCase() === 'admin') {
      return next();
    }

    const normalized = String(permission || '').toLowerCase();

    if (normalized.startsWith('view')) {
      return next();
    }

    if (
      normalized.startsWith('add') ||
      normalized.startsWith('edit') ||
      normalized.startsWith('update') ||
      normalized.startsWith('delete') ||
      normalized.startsWith('approve') ||
      normalized.startsWith('refresh')
    ) {
      return res.status(403).json({ 
        message: 'You do not have permission to access this feature. Please contact your administrator.', 
        requiresPermission: true,
        permission: permission 
      });
    }

    next();
  };
};

module.exports = checkPermission;

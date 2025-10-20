const checkPermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized', requiresPermission: true });
    }

    if (req.user.role === 'admin') {
      return next();
    }

    // Only allow view operations for non-admin users
    if (permission.startsWith('view')) {
      return next();
    }

    return res.status(403).json({ 
      message: 'Only admin can perform this operation', 
      requiresPermission: true,
      permission: permission 
    });
  };
};

module.exports = checkPermission;

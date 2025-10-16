const checkPermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (req.user.role === 'admin') {
      return next();
    }

    if (!req.user.permissions || !req.user.permissions[permission]) {
      return res.status(403).json({ message: `Permission denied: ${permission} required` });
    }

    next();
  };
};

module.exports = checkPermission;

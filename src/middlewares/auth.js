const { verifyAccessToken } = require('../lib/auth');

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'Please login and try again' });
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Please login and try again' });
  try {
    const { user } = await verifyAccessToken(token);
    if (!user) return res.status(401).json({ message: 'Please login and try again' });
    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is deactivated' });
    }
    req.user = {
      ...user,
      id: user.id,
      _id: user.id,
      userId: user.id,
    };
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(401).json({ message: 'Please login and try again' });
  }
};

module.exports = { authMiddleware };

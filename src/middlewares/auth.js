const { verifyAccessToken } = require('../lib/auth');

function isExpiredTokenError(err) {
  const message = err?.message?.toLowerCase?.() || '';
  return err?.code === 'bad_jwt' || message.includes('expired');
}

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
    if (isExpiredTokenError(err)) {
      console.warn('Auth middleware: expired access token');
      return res.status(401).json({
        message: 'Session expired. Please login again',
        code: 'session_expired',
      });
    }

    console.error('Auth middleware error:', err);
    return res.status(401).json({ message: 'Please login and try again' });
  }
};

module.exports = { authMiddleware };

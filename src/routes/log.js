const express = require('express');
const router = express.Router();
const Log = require('../models/log');
const User = require('../models/user');
const { authMiddleware } = require('../middlewares/auth');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const limit = parseInt(req.query.limit) || 500;
    const isAdmin = user.role === 'admin';
    const query = isAdmin ? {} : { userId: req.user.id };
    const logs = await Log.find(query).sort({ timestamp: -1 }).limit(limit).lean();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch logs' });
  }
});

module.exports = router;

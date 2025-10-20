const express = require('express');
const router = express.Router();
const Log = require('../models/log');
const { authMiddleware } = require('../middlewares/auth');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 500;
    const query = req.user.role === 'admin' ? {} : { userId: req.user.id };
    const logs = await Log.find(query).sort({ timestamp: -1 }).limit(limit).lean();
    res.json(logs);
  } catch (err) {
    console.error('Fetch logs error:', err);
    res.status(500).json({ message: 'Failed to fetch logs' });
  }
});

module.exports = router;

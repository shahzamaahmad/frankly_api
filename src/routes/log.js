const express = require('express');
const router = express.Router();
const Log = require('../models/log');
const { authMiddleware } = require('../middlewares/auth');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 500;
    const logs = await Log.find({ userId: req.user.id }).sort({ timestamp: -1 }).limit(limit).lean();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch logs' });
  }
});

module.exports = router;

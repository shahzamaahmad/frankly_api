const express = require('express');
const router = express.Router();
const Activity = require('../models/activity');
const { authenticateToken } = require('../middlewares/auth');

// Get recent activities (last 50)
router.get('/recent', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const activities = await Activity.find()
      .populate('user', 'fullName username')
      .sort({ createdAt: -1 })
      .limit(limit);
    res.json(activities);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get user activities
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const activities = await Activity.find({ user: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(limit);
    res.json(activities);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Log activity (internal use)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { action, itemType, itemId, itemName, details } = req.body;
    const activity = new Activity({
      user: req.user.userId,
      action,
      itemType,
      itemId,
      itemName,
      details,
    });
    await activity.save();
    res.status(201).json(activity);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;

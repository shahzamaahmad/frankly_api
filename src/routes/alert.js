const express = require('express');
const router = express.Router();
const Alert = require('../models/alert');
const checkPermission = require('../middlewares/checkPermission');
const { authMiddleware } = require('../middlewares/auth');

router.get('/', checkPermission('viewOnesignalCard'), async (req, res) => {
  try {
    const now = new Date();
    const alerts = await Alert.find({
      expiryDate: { $gt: now }
    }).populate('sentBy', 'fullName username').sort({ createdAt: -1 });
    res.json(alerts);
  } catch (err) {
    console.error('Get alerts error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/received', authMiddleware, async (req, res) => {
  try {
    const alerts = await Alert.find({
      $or: [
        { sentToAll: true },
        { recipients: req.user._id }
      ],
      dismissedBy: { $ne: req.user._id }
    })
    .populate('sentBy', 'fullName username')
    .sort({ createdAt: -1 })
    .lean();
    res.json(alerts);
  } catch (error) {
    console.error('Fetch received alerts error:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

router.delete('/clear', authMiddleware, async (req, res) => {
  try {
    await Alert.updateMany(
      {
        $or: [
          { sentToAll: true },
          { recipients: req.user._id }
        ]
      },
      {
        $addToSet: { dismissedBy: req.user._id }
      }
    );
    res.json({ message: 'Alerts cleared' });
  } catch (error) {
    console.error('Clear alerts error:', error);
    res.status(500).json({ error: 'Failed to clear alerts' });
  }
});

module.exports = router;

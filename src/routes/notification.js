const express = require('express');
const router = express.Router();
const Notification = require('../models/notification');
const checkPermission = require('../middlewares/checkPermission');

router.get('/', checkPermission('viewNotificationCard'), async (req, res) => {
  try {
    const now = new Date();
    const notifications = await Notification.find({
      expiryDate: { $gt: now }
    }).populate('sentBy', 'fullName username').sort({ createdAt: -1 });
    res.json(notifications);
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

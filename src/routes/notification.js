const express = require('express');
const router = express.Router();
const Notification = require('../models/notification');
const checkPermission = require('../middlewares/checkPermission');

router.post('/', checkPermission('sendNotifications'), async (req, res) => {
  try {
    const notification = new Notification({
      ...req.body,
      sentBy: req.user._id,
    });
    await notification.save();
    res.status(201).json(notification);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/', checkPermission('viewNotifications'), async (req, res) => {
  try {
    const now = new Date();
    const notifications = await Notification.find({
      $or: [
        { expiryDate: null },
        { expiryDate: { $gt: now } }
      ]
    }).populate('sentBy', 'fullName username').sort({ createdAt: -1 });
    res.json(notifications);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;

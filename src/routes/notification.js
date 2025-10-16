const express = require('express');
const router = express.Router();
const Notification = require('../models/notification');
const checkPermission = require('../middlewares/checkPermission');

router.post('/', checkPermission('sendNotifications'), async (req, res) => {
  try {
    if (!req.body.title || !req.body.message || !req.body.sendingDate) {
      return res.status(400).json({ error: 'Title, message, and sending date are required' });
    }
    
    const notification = new Notification({
      ...req.body,
      sentBy: req.user._id,
    });
    await notification.save();
    res.status(201).json(notification);
  } catch (err) {
    console.error('Create notification error:', err);
    res.status(400).json({ error: 'Failed to create notification' });
  }
});

router.get('/', checkPermission('viewNotifications'), async (req, res) => {
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

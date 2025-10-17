const express = require('express');
const router = express.Router();
const { sendNotification } = require('../utils/onesignal');
const { authMiddleware } = require('../middlewares/auth');
const Notification = require('../models/Notification');
const User = require('../models/User');

router.post('/send', authMiddleware, async (req, res) => {
  try {
    const { title, message, userIds, subtitle, imageUrl, actionButtons, launchUrl, data, priority, ttl, sendAfter } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }

    console.log('Notification request:', { title, message, userIds });

    const result = await sendNotification({
      title,
      message,
      userIds,
      subtitle,
      imageUrl,
      actionButtons,
      launchUrl,
      data,
      priority,
      ttl,
      sendAfter,
    });

    const notification = new Notification({
      title,
      message,
      sendingDate: new Date(),
      sentBy: req.user._id,
      sentToAll: !userIds || userIds.length === 0,
      recipients: userIds && userIds.length > 0 ? userIds : await User.find({ isActive: true }).distinct('_id'),
    });
    await notification.save();

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Send notification error:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: 'Failed to send notification', message: error.message });
  }
});

router.get('/received', authMiddleware, async (req, res) => {
  try {
    const notifications = await Notification.find({
      $or: [
        { sentToAll: true },
        { recipients: req.user._id }
      ]
    })
    .populate('sentBy', 'fullName username')
    .sort({ createdAt: -1 })
    .lean();
    res.json(notifications);
  } catch (error) {
    console.error('Fetch received notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.delete('/clear', authMiddleware, async (req, res) => {
  try {
    await Notification.deleteMany({
      $or: [
        { sentToAll: true },
        { recipients: req.user._id }
      ]
    });
    res.json({ message: 'Notifications cleared' });
  } catch (error) {
    console.error('Clear notifications error:', error);
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
});

module.exports = router;

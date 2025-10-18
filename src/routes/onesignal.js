const express = require('express');
const router = express.Router();
const { sendAlert } = require('../utils/onesignal');
const { authMiddleware } = require('../middlewares/auth');
const checkPermission = require('../middlewares/checkPermission');
const Alert = require('../models/alert');
const User = require('../models/user');

router.post('/send', authMiddleware, checkPermission('onesignalSendButton'), async (req, res) => {
  try {
    const { title, message, userIds, subtitle, imageUrl, actionButtons, launchUrl, data, priority, ttl, sendAfter } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }

    console.log('Alert request:', { title, message, userIds });

    const result = await sendAlert({
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

    const alert = new Alert({
      title,
      message,
      sendingDate: new Date(),
      sentBy: req.user._id,
      sentToAll: !userIds || userIds.length === 0,
      recipients: userIds && userIds.length > 0 ? userIds : await User.find({ isActive: true }).distinct('_id'),
    });
    await alert.save();

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Send alert error:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: 'Failed to send alert', message: error.message });
  }
});

module.exports = router;

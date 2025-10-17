const express = require('express');
const router = express.Router();
const { sendNotification } = require('../utils/onesignal');
const { authMiddleware } = require('../middlewares/auth');

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
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Send notification error:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: 'Failed to send notification', message: error.message });
  }
});

module.exports = router;

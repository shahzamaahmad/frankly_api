const express = require('express');
const router = express.Router();
const { sendAlert } = require('../utils/onesignal');
const { authMiddleware } = require('../middlewares/auth');
const checkPermission = require('../middlewares/checkPermission');

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

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Send alert error:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: 'Failed to send alert', message: error.message });
  }
});

module.exports = router;

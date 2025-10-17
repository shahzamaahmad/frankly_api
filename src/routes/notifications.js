const express = require('express');
const router = express.Router();
const { sendNotification } = require('../utils/onesignal');
const { authMiddleware } = require('../middlewares/auth');

router.post('/send', authMiddleware, async (req, res) => {
  try {
    const { title, message, userIds } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }

    const result = await sendNotification(title, message, userIds);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

module.exports = router;

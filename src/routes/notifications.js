const express = require('express');
const router = express.Router();
const Notification = require('../models/notification');
const { authMiddleware } = require('../middlewares/auth');
const { checkPermission, checkAdmin } = require('../middlewares/checkPermission');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const upload = multer({ storage: multer.memoryStorage() });

// Get all notifications
router.get('/', authMiddleware, async (req, res) => {
  try {
    const notifications = await Notification.find().populate('createdBy', 'fullName username').sort({ createdAt: -1 });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create notification
router.post('/', authMiddleware, checkAdmin(), upload.single('image'), async (req, res) => {
  try {
    const { title, subtitle, message, linkType, linkId } = req.body;
    let imageUrl = null;

    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream({ folder: 'notifications' }, (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }).end(req.file.buffer);
      });
      imageUrl = result.secure_url;
    }

    const notification = new Notification({
      title,
      subtitle,
      message,
      imageUrl,
      linkType: linkType || 'none',
      linkId,
      createdBy: req.user.userId,
      status: 'draft'
    });

    await notification.save();
    await notification.populate('createdBy', 'fullName username');
    res.status(201).json(notification);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update notification
router.put('/:id', authMiddleware, checkAdmin(), upload.single('image'), async (req, res) => {
  try {
    const { title, subtitle, message, linkType, linkId } = req.body;
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    if (notification.status === 'sent') return res.status(400).json({ message: 'Cannot edit sent notification' });

    notification.title = title;
    notification.subtitle = subtitle;
    notification.message = message;
    notification.linkType = linkType || 'none';
    notification.linkId = linkId;

    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream({ folder: 'notifications' }, (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }).end(req.file.buffer);
      });
      notification.imageUrl = result.secure_url;
    }

    await notification.save();
    await notification.populate('createdBy', 'fullName username');
    res.json(notification);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete notification
router.delete('/:id', authMiddleware, checkAdmin(), async (req, res) => {
  try {
    const notification = await Notification.findByIdAndDelete(req.params.id);
    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Send notification
router.post('/:id/send', authMiddleware, checkAdmin(), async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    if (notification.status === 'sent') return res.status(400).json({ message: 'Already sent' });

    // TODO: Integrate with OneSignal API here
    // For now, just mark as sent
    notification.status = 'sent';
    notification.sentAt = new Date();
    await notification.save();

    res.json({ message: 'Notification sent', notification });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

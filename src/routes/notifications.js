const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { ID_COLUMN, fetchById, fetchMany, deleteRow, indexById, insertRow, uniqueIds, updateRow } = require('../lib/db');
const checkPermission = require('../middlewares/checkPermission');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

async function populateNotifications(notifications) {
  if (!notifications.length) {
    return [];
  }

  const createdByIds = uniqueIds(notifications.map((notification) => notification.createdBy));
  const users = createdByIds.length
    ? await fetchMany('users', { filters: [{ column: ID_COLUMN, operator: 'in', value: createdByIds }] })
    : [];
  const userMap = indexById(users.map((user) => ({
    _id: user._id,
    fullName: user.fullName,
    username: user.username,
  })));

  return notifications.map((notification) => ({
    ...notification,
    createdBy: notification.createdBy
      ? (userMap.get(String(notification.createdBy)) || notification.createdBy)
      : notification.createdBy,
  }));
}

async function populateNotification(notification) {
  const populated = await populateNotifications(notification ? [notification] : []);
  return populated[0] || null;
}

async function uploadNotificationImage(file) {
  if (!file) {
    return null;
  }

  const result = await new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream({ folder: 'notifications' }, (error, data) => {
      if (error) reject(error);
      else resolve(data);
    }).end(file.buffer);
  });

  return result.secure_url;
}

router.get('/', async (req, res) => {
  try {
    const notifications = await fetchMany('notifications', { orderBy: 'createdAt', ascending: false });
    res.json(await populateNotifications(notifications));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', checkPermission('onesignalSendButton'), upload.single('image'), async (req, res) => {
  try {
    const { title, subtitle, message, linkType, linkId } = req.body;
    const imageUrl = await uploadNotificationImage(req.file);

    const notification = await insertRow('notifications', {
      title,
      subtitle,
      message,
      imageUrl,
      linkType: linkType || 'none',
      linkId,
      createdBy: req.user.id,
      createdAt: new Date().toISOString(),
      status: 'draft'
    }, { timestamps: false });

    res.status(201).json(await populateNotification(notification));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id', checkPermission('onesignalSendButton'), upload.single('image'), async (req, res) => {
  try {
    const { title, subtitle, message, linkType, linkId } = req.body;
    const notification = await fetchById('notifications', req.params.id);

    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    if (notification.status === 'sent') return res.status(400).json({ message: 'Cannot edit sent notification' });

    const updates = {
      title,
      subtitle,
      message,
      linkType: linkType || 'none',
      linkId,
    };

    if (req.file) {
      updates.imageUrl = await uploadNotificationImage(req.file);
    }

    const updated = await updateRow('notifications', req.params.id, updates, { timestamps: false });
    res.json(await populateNotification(updated));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/:id', checkPermission('onesignalSendButton'), async (req, res) => {
  try {
    const notification = await deleteRow('notifications', req.params.id);
    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:id/send', checkPermission('onesignalSendButton'), async (req, res) => {
  try {
    const notification = await fetchById('notifications', req.params.id);
    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    if (notification.status === 'sent') return res.status(400).json({ message: 'Already sent' });

    const updated = await updateRow('notifications', req.params.id, {
      status: 'sent',
      sentAt: new Date().toISOString(),
    }, { timestamps: false });

    res.json({ message: 'Notification sent', notification: updated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

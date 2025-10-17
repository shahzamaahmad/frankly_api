const express = require('express');
const router = express.Router();
const Message = require('../models/message');
const Group = require('../models/group');
const { authMiddleware } = require('../middlewares/auth');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Send message with file
router.post('/', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const group = await Group.findById(req.body.group);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    if (!group.members.some(m => m.toString() === req.user._id.toString())) {
      return res.status(403).json({ error: 'Not a member' });
    }
    
    let fileUrl = req.body.fileUrl;
    let messageType = req.body.type || 'text';

    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          { folder: 'chat_files' },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        ).end(req.file.buffer);
      });
      fileUrl = result.secure_url;
      messageType = req.file.mimetype.startsWith('image/') ? 'image' : 'file';
    }

    const message = new Message({
      group: req.body.group,
      sender: req.user._id,
      content: req.body.content || (fileUrl ? 'Sent a file' : ''),
      type: messageType,
      fileUrl,
    });
    await message.save();
    
    await message.populate('sender', 'fullName username');
    res.status(201).json(message);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get group messages
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { groupId, limit = 50, before } = req.query;
    
    const group = await Group.findById(groupId);
    if (!group || !group.members.some(m => m.toString() === req.user._id.toString())) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const query = { group: groupId, isDeleted: false };
    if (before) query.createdAt = { $lt: new Date(before) };
    
    const messages = await Message.find(query)
      .populate('sender', 'fullName username')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();
    
    res.json(messages.reverse());
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark as read
router.put('/:id/read', authMiddleware, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    if (!message.readBy.includes(req.user._id)) {
      message.readBy.push(req.user._id);
      await message.save();
    }
    res.json(message);
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Delete message
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    message.isDeleted = true;
    await message.save();
    res.json({ message: 'Message deleted' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

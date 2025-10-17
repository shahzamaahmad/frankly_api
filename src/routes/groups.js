const express = require('express');
const router = express.Router();
const Group = require('../models/group');
const Message = require('../models/message');
const { authMiddleware } = require('../middlewares/auth');
const checkPermission = require('../middlewares/checkPermission');

// Get user's groups
router.get('/', authMiddleware, async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user._id, isActive: true })
      .populate('members', 'fullName username')
      .populate('admins', 'fullName username')
      .populate('createdBy', 'fullName username')
      .sort({ updatedAt: -1 })
      .lean();
    res.json(groups);
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all groups (admin only)
router.get('/all', checkPermission('manageGroups'), async (req, res) => {
  try {
    const groups = await Group.find()
      .populate('members', 'fullName username')
      .populate('admins', 'fullName username')
      .populate('createdBy', 'fullName username')
      .sort({ createdAt: -1 })
      .lean();
    res.json(groups);
  } catch (error) {
    console.error('Get all groups error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single group
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('members', 'fullName username')
      .populate('admins', 'fullName username')
      .populate('createdBy', 'fullName username');
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    if (!group.members.some(m => m._id.toString() === req.user._id.toString())) {
      return res.status(403).json({ error: 'Not a member' });
    }
    
    res.json(group);
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create group
router.post('/', checkPermission('manageGroups'), async (req, res) => {
  try {
    const group = new Group({
      name: req.body.name,
      description: req.body.description,
      avatar: req.body.avatar,
      createdBy: req.user._id,
      members: [req.user._id, ...(req.body.members || [])],
      admins: [req.user._id],
    });
    await group.save();
    await group.populate('members', 'fullName username');
    await group.populate('admins', 'fullName username');
    await group.populate('createdBy', 'fullName username');
    res.status(201).json(group);
  } catch (error) {
    console.error('Create group error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Update group
router.put('/:id', checkPermission('manageGroups'), async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    group.name = req.body.name || group.name;
    group.description = req.body.description || group.description;
    group.avatar = req.body.avatar || group.avatar;
    
    await group.save();
    await group.populate('members', 'fullName username');
    await group.populate('admins', 'fullName username');
    res.json(group);
  } catch (error) {
    console.error('Update group error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Delete group
router.delete('/:id', checkPermission('manageGroups'), async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    group.isActive = false;
    await group.save();
    res.json({ message: 'Group deleted' });
  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add member
router.post('/:id/members', checkPermission('manageGroups'), async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    if (!group.members.includes(req.body.userId)) {
      group.members.push(req.body.userId);
      await group.save();
    }
    
    await group.populate('members', 'fullName username');
    res.json(group);
  } catch (error) {
    console.error('Add member error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Remove member
router.delete('/:id/members/:userId', checkPermission('manageGroups'), async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    group.members = group.members.filter(m => m.toString() !== req.params.userId);
    group.admins = group.admins.filter(a => a.toString() !== req.params.userId);
    await group.save();
    
    await group.populate('members', 'fullName username');
    res.json(group);
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;

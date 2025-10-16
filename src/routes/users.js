const express = require('express');
const router = express.Router();
const User = require('../models/user');
const checkPermission = require('../middlewares/checkPermission');

router.get('/', checkPermission('viewEmployees'), async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    res.status(400).json({ message: 'Error', error: err.message });
  }
});

router.get('/:id', checkPermission('viewEmployees'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(400).json({ message: 'Error', error: err.message });
  }
});

router.put('/:id', checkPermission('editEmployees'), async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.firstName && updates.lastName && !updates.fullName) {
      updates.fullName = `${updates.firstName} ${updates.lastName}`;
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    if (updates.password) {
      user.password = updates.password;
      delete updates.password;
    }
    Object.assign(user, updates);
    await user.save();
    
    const userObj = user.toObject();
    delete userObj.password;
    res.json(userObj);
  } catch (err) {
    res.status(400).json({ message: 'Error', error: err.message });
  }
});

router.delete('/:id', checkPermission('deleteEmployees'), async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(400).json({ message: 'Error', error: err.message });
  }
});

module.exports = router;

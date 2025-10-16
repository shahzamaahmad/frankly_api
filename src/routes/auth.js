
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { createLog } = require('../utils/logger');

router.post('/generate-username', async (req, res) => {
  try {
    const { firstName, lastName } = req.body;
    const username = User.generateUsername(firstName, lastName);
    const exists = await User.checkUsernameExists(username);
    res.json({ username, exists });
  } catch (err) {
    res.status(400).json({ message: 'Error', error: err.message });
  }
});

router.post('/signup', async (req, res) => {
  try {
    const userData = { ...req.body };
    if (!userData.username) {
      return res.status(400).json({ message: 'Username is required' });
    }
    const exists = await User.checkUsernameExists(userData.username);
    if (exists) {
      return res.status(400).json({ message: 'Username already exists' });
    }
    const user = new User(userData);
    if (req.body.firstName && req.body.lastName && !req.body.fullName) {
      user.fullName = `${req.body.firstName} ${req.body.lastName}`;
    }
    await user.save();
    res.status(201).json({ message: 'User created', username: user.username });
  } catch (err) {
    res.status(400).json({ message: 'Error', error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    if (!user.isActive) return res.status(403).json({ message: 'Account is deactivated' });
    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });
    
    user.lastLoginAt = new Date();
    await user.save();
    
    await createLog('LOGIN', user._id, user.username, `User logged in`);
    
    const token = jwt.sign({ id: user._id, username: user.username, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    const userObj = user.toObject();
    delete userObj.password;
    res.json({ token, user: { ...userObj, id: user._id } });
  } catch (err) {
    res.status(400).json({ message: 'Error', error: err.message });
  }
});

router.get('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    res.json(user);
  } catch (err) {
    res.status(400).json({ message: 'Error', error: err.message });
  }
});

router.put('/change-password', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required' });
    }
    
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    const match = await user.comparePassword(currentPassword);
    if (!match) return res.status(401).json({ message: 'Current password is incorrect' });
    
    user.password = newPassword;
    await user.save();
    
    await createLog('CHANGE_PASSWORD', user._id, user.username, `Password changed`);
    
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(400).json({ message: 'Error', error: err.message });
  }
});

module.exports = router;

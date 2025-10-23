
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { createLog } = require('../utils/logger');

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication endpoints
 */

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: User login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */

/**
 * @swagger
 * /auth/signup:
 *   post:
 *     summary: Register new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created
 *       400:
 *         description: Invalid input
 */

router.post('/generate-username', async (req, res) => {
  try {
    const { fullName } = req.body;
    const username = User.generateUsername(fullName);
    const exists = await User.checkUsernameExists(username);
    res.json({ username, exists });
  } catch (err) {
    console.error('Generate username error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/signup', async (req, res) => {
  try {
    const userData = { ...req.body };
    if (!userData.username || !userData.password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }
    if (userData.password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    const exists = await User.checkUsernameExists(userData.username);
    if (exists) {
      return res.status(400).json({ message: 'Username already exists' });
    }
    const user = new User(userData);
    await user.save();

    await createLog('ADD', user._id, user.username, `Created employee: ${user.username}`);

    res.status(201).json({ message: 'User created', username: user.username });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }
    
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
    console.error('Login error:', err);
    res.status(500).json({ message: 'Internal server error' });
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
    console.error('Profile error:', err);
    res.status(401).json({ message: 'Unauthorized' });
  }
});

router.post('/refresh-token', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.isActive) return res.status(403).json({ message: 'Account is deactivated' });
    
    const newToken = jwt.sign({ id: user._id, username: user.username, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    const userObj = user.toObject();
    res.json({ token: newToken, user: { ...userObj, id: user._id } });
  } catch (err) {
    console.error('Refresh token error:', err);
    res.status(401).json({ message: 'Unauthorized' });
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
    
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
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
    console.error('Change password error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;

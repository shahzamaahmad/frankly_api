const express = require('express');
const router = express.Router();
const User = require('../models/user');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const users = await User.find({ isActive: true })
      .select('username fullName firstName lastName role phone email profilePictureUrl')
      .sort({ role: 1, fullName: 1 });
    res.json(users);
  } catch (error) {
    console.error('Fetch contacts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

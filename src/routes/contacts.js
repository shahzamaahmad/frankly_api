const express = require('express');
const { fetchMany } = require('../lib/db');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const users = await fetchMany('users', {
      filters: [{ column: 'isActive', operator: 'eq', value: true }],
      orderBy: 'role',
      ascending: true,
    });

    const contacts = users
      .map((user) => ({
        _id: user._id,
        username: user.username,
        fullName: user.fullName,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        phone: user.phone,
        email: user.email,
        profilePictureUrl: user.profilePictureUrl,
      }))
      .sort((left, right) => {
        const roleCompare = String(left.role || '').localeCompare(String(right.role || ''));
        if (roleCompare !== 0) return roleCompare;
        return String(left.fullName || '').localeCompare(String(right.fullName || ''));
      });

    res.json(contacts);
  } catch (error) {
    console.error('Fetch contacts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

const express = require('express');
const { fetchById, fetchMany } = require('../lib/db');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const user = await fetchById('users', req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const limit = Number.parseInt(req.query.limit, 10) || 500;
    const filters = user.role === 'admin'
      ? []
      : [{ column: 'itemId', operator: 'eq', value: req.user.id }];

    const logs = await fetchMany('activities', {
      filters,
      orderBy: 'createdAt',
      ascending: false,
      limit,
    });

    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch logs' });
  }
});

module.exports = router;

const express = require('express');
const { ID_COLUMN, fetchMany, indexById, insertRow, uniqueIds } = require('../lib/db');

const router = express.Router();

async function populateActivities(activities) {
  if (!activities.length) {
    return [];
  }

  const userIds = uniqueIds(activities.map((activity) => activity.user));
  const users = userIds.length
    ? await fetchMany('users', { filters: [{ column: ID_COLUMN, operator: 'in', value: userIds }] })
    : [];
  const userMap = indexById(users.map((user) => ({
    _id: user._id,
    fullName: user.fullName,
    username: user.username,
  })));

  return activities.map((activity) => ({
    ...activity,
    user: activity.user ? (userMap.get(String(activity.user)) || activity.user) : activity.user,
  }));
}

router.get('/', async (req, res) => {
  try {
    const limit = Number.parseInt(req.query.limit, 10) || 100;
    const filters = [];

    if (typeof req.query.itemType === 'string' && req.query.itemType.trim().isNotEmpty) {
      filters.push({ column: 'itemType', operator: 'eq', value: req.query.itemType.trim() });
    }

    if (typeof req.query.itemId === 'string' && req.query.itemId.trim().isNotEmpty) {
      filters.push({ column: 'itemId', operator: 'eq', value: req.query.itemId.trim() });
    }

    const activities = await fetchMany('activities', {
      filters,
      orderBy: 'createdAt',
      ascending: false,
      limit,
    });

    res.json(await populateActivities(activities));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/recent', async (req, res) => {
  try {
    const limit = Number.parseInt(req.query.limit, 10) || 50;
    const activities = await fetchMany('activities', {
      orderBy: 'createdAt',
      ascending: false,
      limit,
    });
    res.json(await populateActivities(activities));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/my', async (req, res) => {
  try {
    const limit = Number.parseInt(req.query.limit, 10) || 50;
    const activities = await fetchMany('activities', {
      filters: [{ column: 'user', operator: 'eq', value: req.user.id }],
      orderBy: 'createdAt',
      ascending: false,
      limit,
    });
    res.json(activities);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { action, itemType, itemId, itemName, details } = req.body;
    const activity = await insertRow('activities', {
      user: req.user.id,
      action,
      itemType,
      itemId,
      itemName,
      details,
    });
    res.status(201).json(activity);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;

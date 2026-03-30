const express = require('express');
const { fetchById, fetchMany, deleteRow, insertRow } = require('../lib/db');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const favorites = await fetchMany('favorites', {
      filters: [{ column: 'user', operator: 'eq', value: req.user.id }],
      orderBy: 'createdAt',
      ascending: false,
    });
    res.json(favorites);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { itemType, itemId, itemName } = req.body;
    const existing = await fetchMany('favorites', {
      filters: [
        { column: 'user', operator: 'eq', value: req.user.id },
        { column: 'itemType', operator: 'eq', value: itemType },
        { column: 'itemId', operator: 'eq', value: itemId },
      ],
      limit: 1,
    });

    if (existing[0]) {
      return res.status(400).json({ message: 'Already in favorites' });
    }

    const favorite = await insertRow('favorites', {
      user: req.user.id,
      itemType,
      itemId,
      itemName,
    });
    res.status(201).json(favorite);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const favorite = await fetchById('favorites', req.params.id);
    if (!favorite || String(favorite.user) !== String(req.user.id)) {
      return res.json({ message: 'Removed from favorites' });
    }

    await deleteRow('favorites', req.params.id);
    res.json({ message: 'Removed from favorites' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/check/:itemType/:itemId', async (req, res) => {
  try {
    const favorites = await fetchMany('favorites', {
      filters: [
        { column: 'user', operator: 'eq', value: req.user.id },
        { column: 'itemType', operator: 'eq', value: req.params.itemType },
        { column: 'itemId', operator: 'eq', value: req.params.itemId },
      ],
      limit: 1,
    });
    const favorite = favorites[0];
    res.json({ isFavorite: !!favorite, favoriteId: favorite?._id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

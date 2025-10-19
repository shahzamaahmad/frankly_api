const express = require('express');
const router = express.Router();
const Favorite = require('../models/favorite');
const { authenticateToken } = require('../middlewares/auth');

// Get user favorites
router.get('/', authenticateToken, async (req, res) => {
  try {
    const favorites = await Favorite.find({ user: req.user.userId }).sort({ createdAt: -1 });
    res.json(favorites);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add favorite
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { itemType, itemId, itemName } = req.body;
    const favorite = new Favorite({
      user: req.user.userId,
      itemType,
      itemId,
      itemName,
    });
    await favorite.save();
    res.status(201).json(favorite);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Already in favorites' });
    }
    res.status(400).json({ message: error.message });
  }
});

// Remove favorite
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await Favorite.findOneAndDelete({ _id: req.params.id, user: req.user.userId });
    res.json({ message: 'Removed from favorites' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Check if item is favorite
router.get('/check/:itemType/:itemId', authenticateToken, async (req, res) => {
  try {
    const favorite = await Favorite.findOne({
      user: req.user.userId,
      itemType: req.params.itemType,
      itemId: req.params.itemId,
    });
    res.json({ isFavorite: !!favorite, favoriteId: favorite?._id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

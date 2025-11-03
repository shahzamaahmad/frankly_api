const express = require('express');
const router = express.Router();
const Favorite = require('../models/favorite');
const { authMiddleware } = require('../middlewares/auth');

// Get user favorites
router.get('/', authMiddleware, async (req, res) => {
  try {
    const favorites = await Favorite.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(favorites);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add favorite
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { itemType, itemId, itemName, image } = req.body;
    const favorite = new Favorite({
      user: req.user._id,
      itemType,
      itemId,
      itemName,
      image,
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
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await Favorite.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    res.json({ message: 'Removed from favorites' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Check if item is favorite
router.get('/check/:itemType/:itemId', authMiddleware, async (req, res) => {
  try {
    const favorite = await Favorite.findOne({
      user: req.user._id,
      itemType: req.params.itemType,
      itemId: req.params.itemId,
    });
    res.json({ isFavorite: !!favorite, favoriteId: favorite?._id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

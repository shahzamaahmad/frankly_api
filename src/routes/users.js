const express = require('express');
const router = express.Router();
const User = require('../models/user');
const checkPermission = require('../middlewares/checkPermission');

router.get('/', checkPermission('viewEmployees'), async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .lean();
    res.json(users);
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/:id', checkPermission('viewEmployees'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', checkPermission('editEmployees'), async (req, res) => {
  try {
    const updates = { ...req.body };
    
    if (updates.username && updates.username.length < 3) {
      return res.status(400).json({ message: 'Username must be at least 3 characters' });
    }
    
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
    console.error('Update user error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/:id', checkPermission('deleteEmployees'), async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }
    
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/:id/assign-asset', checkPermission('editEmployees'), async (req, res) => {
  try {
    const { item, quantity, condition, remarks } = req.body;
    const Inventory = require('../models/inventory');
    const Transaction = require('../models/transaction');
    
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    const inventoryItem = await Inventory.findById(item);
    if (!inventoryItem) return res.status(404).json({ message: 'Item not found' });
    
    if (inventoryItem.currentStock < quantity) {
      return res.status(400).json({ message: 'Insufficient stock' });
    }
    
    inventoryItem.currentStock -= quantity;
    await inventoryItem.save();
    
    const transaction = new Transaction({
      type: 'ISSUE',
      employee: req.params.id,
      item: item,
      quantity: quantity,
      timestamp: new Date(),
    });
    await transaction.save();
    
    const asset = { item, quantity, condition, remarks };
    if (!user.assets) user.assets = [];
    user.assets.push(asset);
    await user.save();
    
    res.json({ message: 'Asset assigned successfully', transaction });
  } catch (err) {
    console.error('Assign asset error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;

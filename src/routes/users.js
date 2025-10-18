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
    console.log('Updating user:', req.params.id, 'with permissions:', updates.permissions);
    
    if (updates.username && updates.username.length < 3) {
      return res.status(400).json({ message: 'Username must be at least 3 characters' });
    }
    
    if (updates.firstName && updates.lastName && !updates.fullName) {
      updates.fullName = `${updates.firstName} ${updates.lastName}`;
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    const permissionsChanged = updates.permissions && JSON.stringify(user.permissions) !== JSON.stringify(updates.permissions);
    console.log('Old permissions:', user.permissions);
    console.log('New permissions:', updates.permissions);
    console.log('Permissions changed:', permissionsChanged);
    
    if (updates.password) {
      user.password = updates.password;
      delete updates.password;
    }
    Object.assign(user, updates);
    await user.save();
    
    if (permissionsChanged && global.io) {
      console.log('Emitting permissionsUpdated to user:', req.params.id);
      global.io.to(`user:${req.params.id}`).emit('permissionsUpdated', { permissions: user.permissions });
    }
    
    if (global.io) {
      global.io.emit('user:updated', { id: req.params.id });
    }
    
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

/**
 * @swagger
 * /users/{id}/assign-asset:
 *   post:
 *     summary: Assign asset to employee
 *     description: Assigns an inventory item to an employee and updates stock
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - item
 *               - quantity
 *               - condition
 *             properties:
 *               item:
 *                 type: string
 *                 description: Inventory item ID
 *               quantity:
 *                 type: integer
 *                 description: Quantity to assign
 *               condition:
 *                 type: string
 *                 enum: [new, used, damaged]
 *                 description: Asset condition
 *               remarks:
 *                 type: string
 *                 description: Optional remarks
 *     responses:
 *       200:
 *         description: Asset assigned successfully
 *       400:
 *         description: Insufficient stock
 *       404:
 *         description: User or item not found
 *       500:
 *         description: Internal server error
 */
router.post('/:id/assign-asset', checkPermission('editEmployees'), async (req, res) => {
  try {
    const { item, quantity, condition, remarks } = req.body;
    const Inventory = require('../models/inventory');
    const Transaction = require('../models/transaction');
    
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    const inventoryItem = await Inventory.findById(item).lean();
    if (!inventoryItem) return res.status(404).json({ message: 'Item not found' });
    
    const transactions = await Transaction.find({ item }).lean();
    const users = await User.find({ 'assets.item': item }).lean();
    
    let issued = 0;
    let returned = 0;
    for (const txn of transactions) {
      if (txn.type === 'ISSUE') issued += txn.quantity || 0;
      if (txn.type === 'RETURN') returned += txn.quantity || 0;
    }
    
    let assignedToEmployees = 0;
    for (const u of users) {
      for (const asset of u.assets || []) {
        if (asset.item && asset.item.toString() === item) {
          assignedToEmployees += asset.quantity || 0;
        }
      }
    }
    
    const currentStock = (inventoryItem.initialStock || 0) - issued + returned - assignedToEmployees;
    
    if (currentStock < quantity) {
      return res.status(400).json({ message: 'Insufficient stock' });
    }
    
    const asset = { item, quantity, condition, remarks };
    if (!user.assets) user.assets = [];
    user.assets.push(asset);
    await user.save();
    
    res.json({ message: 'Asset assigned successfully' });
  } catch (err) {
    console.error('Assign asset error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;

const express = require('express');
const AssetTransaction = require('../models/assetTransaction');
const { authMiddleware } = require('../middlewares/auth');

const router = express.Router();

// GET all asset transactions
router.get('/', authMiddleware, async (req, res) => {
  try {
    const transactions = await AssetTransaction.find()
      .populate('asset', 'name sku')
      .populate('employee', 'fullName')
      .populate('assignedBy', 'fullName')
      .sort({ createdAt: -1 })
      .lean();
    res.json(transactions);
  } catch (err) {
    console.error('Error fetching asset transactions:', err);
    res.status(500).json({ message: 'Failed to fetch asset transactions' });
  }
});

// GET asset transactions by employee
router.get('/employee/:employeeId', authMiddleware, async (req, res) => {
  try {
    const transactions = await AssetTransaction.find({ employee: req.params.employeeId })
      .populate('asset', 'name sku')
      .populate('assignedBy', 'fullName')
      .sort({ createdAt: -1 })
      .lean();
    res.json(transactions);
  } catch (err) {
    console.error('Error fetching employee asset transactions:', err);
    res.status(500).json({ message: 'Failed to fetch employee asset transactions' });
  }
});

// PUT update asset transaction (admin only)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const oldTransaction = await AssetTransaction.findById(req.params.id);
    if (!oldTransaction) {
      return res.status(404).json({ message: 'Asset transaction not found' });
    }

    const OfficeAsset = require('../models/officeAsset');
    const asset = await OfficeAsset.findById(oldTransaction.asset);
    
    if (asset) {
      // Reverse old transaction
      if (oldTransaction.type === 'ASSIGN') {
        asset.quantity += oldTransaction.quantity;
      } else if (oldTransaction.type === 'RETURN') {
        asset.quantity -= oldTransaction.quantity;
      }
      
      // Apply new transaction
      const newType = req.body.type || oldTransaction.type;
      const newQuantity = req.body.quantity || oldTransaction.quantity;
      if (newType === 'ASSIGN') {
        asset.quantity -= newQuantity;
      } else if (newType === 'RETURN') {
        asset.quantity += newQuantity;
      }
      
      await asset.save();
    }

    const transaction = await AssetTransaction.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    const io = req.app.get('io');
    if (io) {
      io.emit('assetTransaction:updated', transaction);
      if (asset) io.emit('officeAsset:updated', asset);
    }

    res.json(transaction);
  } catch (err) {
    console.error('Error updating asset transaction:', err);
    res.status(500).json({ message: 'Failed to update asset transaction' });
  }
});

// PUT return asset
router.put('/:id/return', authMiddleware, async (req, res) => {
  try {
    const { condition, notes } = req.body;
    const transaction = await AssetTransaction.findByIdAndUpdate(
      req.params.id,
      {
        returnDate: new Date(),
        condition,
        notes,
        status: 'RETURNED'
      },
      { new: true }
    );
    
    if (!transaction) {
      return res.status(404).json({ message: 'Asset transaction not found' });
    }

    // Update asset to unassign
    await require('../models/officeAsset').findByIdAndUpdate(
      transaction.asset,
      { assignedTo: null }
    );

    res.json(transaction);
  } catch (err) {
    console.error('Error returning asset:', err);
    res.status(500).json({ message: 'Failed to return asset' });
  }
});

// DELETE asset transaction (admin only)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const transaction = await AssetTransaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ message: 'Asset transaction not found' });
    }

    const OfficeAsset = require('../models/officeAsset');
    const asset = await OfficeAsset.findById(transaction.asset);
    if (asset) {
      if (transaction.type === 'ASSIGN') {
        asset.quantity += transaction.quantity;
      } else if (transaction.type === 'RETURN') {
        asset.quantity = Math.max(0, asset.quantity - transaction.quantity);
      }
      await asset.save();
    }

    await AssetTransaction.findByIdAndDelete(req.params.id);
    
    const Log = require('../models/log');
    await Log.create({
      userId: req.user._id,
      username: req.user.username,
      action: 'DELETE',
      details: `Deleted asset transaction: ${transaction.transactionId}`,
      timestamp: new Date()
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('assetTransaction:deleted', { id: req.params.id });
      if (asset) io.emit('officeAsset:updated', asset);
    }

    res.json({ message: 'Asset transaction deleted successfully' });
  } catch (err) {
    console.error('Error deleting asset transaction:', err);
    res.status(500).json({ message: 'Failed to delete asset transaction' });
  }
});

module.exports = router;
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

    const transaction = await AssetTransaction.findByIdAndDelete(req.params.id);
    if (!transaction) {
      return res.status(404).json({ message: 'Asset transaction not found' });
    }

    res.json({ message: 'Asset transaction deleted successfully' });
  } catch (err) {
    console.error('Error deleting asset transaction:', err);
    res.status(500).json({ message: 'Failed to delete asset transaction' });
  }
});

module.exports = router;
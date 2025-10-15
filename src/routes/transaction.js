const express = require('express');
const router = express.Router();
const Transaction = require('../models/transaction');
const Inventory = require('../models/inventory');
const { authMiddleware } = require('../middlewares/auth');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .populate('employee', 'name email')
      .populate('site', 'name location')
      .populate('item', 'name sku')
      .sort({ timestamp: -1 });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('employee', 'name email')
      .populate('site', 'name location')
      .populate('item');
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    res.json(transaction);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { type, employee, site, item, quantity, returnDetails, relatedTo } = req.body;
    
    const inventory = await Inventory.findById(item);
    if (!inventory) return res.status(404).json({ error: 'Item not found' });

    if (type === 'ISSUE') {
      if (inventory.currentStock < quantity) {
        return res.status(400).json({ error: 'Insufficient stock' });
      }
      inventory.currentStock -= quantity;
    } else if (type === 'RETURN') {
      inventory.currentStock += quantity;
    }

    await inventory.save();

    const lastTransaction = await Transaction.findOne().sort({ transactionId: -1 });
    let nextNum = 1;
    if (lastTransaction) {
      const match = lastTransaction.transactionId.match(/-(\d+)$/);
      if (match) nextNum = parseInt(match[1]) + 1;
    }
    const transactionId = `TXN-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${String(nextNum).padStart(4, '0')}`;

    const transaction = new Transaction({
      transactionId,
      type,
      employee,
      site,
      item,
      quantity,
      returnDetails,
      relatedTo
    });

    await transaction.save();
    const populated = await Transaction.findById(transaction._id)
      .populate('employee', 'name email')
      .populate('site', 'name location')
      .populate('item', 'name sku');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

    const inventory = await Inventory.findById(transaction.item);
    if (inventory) {
      if (transaction.type === 'ISSUE') {
        inventory.currentStock += transaction.quantity;
      } else if (transaction.type === 'RETURN') {
        inventory.currentStock -= transaction.quantity;
      }
      await inventory.save();
    }

    await Transaction.findByIdAndDelete(req.params.id);
    res.json({ message: 'Transaction deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

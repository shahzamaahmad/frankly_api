const express = require('express');
const router = express.Router();
const Transaction = require('../models/transaction');
const Inventory = require('../models/inventory');
const { authMiddleware } = require('../middlewares/auth');
const checkPermission = require('../middlewares/checkPermission');
const { createLog } = require('../utils/logger');

router.get('/', authMiddleware, checkPermission('viewTransactions'), async (req, res) => {
  try {
    const { site, item } = req.query;
    const filter = {};
    if (site && typeof site === 'string') filter.site = site;
    if (item && typeof item === 'string') filter.item = item;
    
    const transactions = await Transaction.find(filter)
      .populate('employee', 'fullName username email')
      .populate('site', 'siteName siteCode')
      .populate('item', 'name sku')
      .sort({ timestamp: -1 });
    res.json(transactions);
  } catch (err) {
    console.error('Get transactions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', authMiddleware, checkPermission('viewTransactions'), async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('employee', 'fullName username email')
      .populate('site', 'siteName siteCode')
      .populate('item');
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    res.json(transaction);
  } catch (err) {
    console.error('Get transaction error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authMiddleware, checkPermission('addTransactions'), async (req, res) => {
  try {
    const { type, employee, site, item, quantity, returnDetails, relatedTo } = req.body;
    
    if (!type || !site || !item || !quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Invalid input data' });
    }
    
    const inventory = await Inventory.findById(item).lean();
    if (!inventory) return res.status(404).json({ error: 'Item not found' });

    if (type === 'ISSUE') {
      const User = require('../models/user');
      const [txnAgg, userAgg] = await Promise.all([
        Transaction.aggregate([
          { $match: { item: inventory._id } },
          { $group: {
            _id: null,
            issued: { $sum: { $cond: [{ $eq: ['$type', 'ISSUE'] }, '$quantity', 0] } },
            returned: { $sum: { $cond: [{ $eq: ['$type', 'RETURN'] }, '$quantity', 0] } }
          }}
        ]),
        User.aggregate([
          { $match: { 'assets.item': inventory._id } },
          { $unwind: '$assets' },
          { $match: { 'assets.item': inventory._id } },
          { $group: { _id: null, total: { $sum: '$assets.quantity' } } }
        ])
      ]);
      
      const txn = txnAgg[0] || { issued: 0, returned: 0 };
      const assigned = userAgg[0]?.total || 0;
      const currentStock = (inventory.initialStock || 0) - txn.issued + txn.returned - assigned;
      
      if (currentStock < quantity) {
        return res.status(400).json({ error: 'Insufficient stock' });
      }
    }

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
      .populate('employee', 'fullName username email')
      .populate('site', 'siteName siteCode')
      .populate('item', 'name sku');
    
    await createLog('ADD_TRANSACTION', req.user.id, req.user.username, `Added ${type} transaction: ${transactionId}`);
    
    res.status(201).json(populated);
  } catch (err) {
    console.error('Create transaction error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authMiddleware, checkPermission('editTransactions'), async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

    const { type, employee, site, item, quantity, returnDetails, relatedTo } = req.body;
    
    if (!type || !site || !item || !quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Invalid input data' });
    }

    const newInventory = await Inventory.findById(item).lean();
    if (!newInventory) return res.status(404).json({ error: 'Item not found' });

    transaction.type = type;
    transaction.employee = employee || null;
    transaction.site = site;
    transaction.item = item;
    transaction.quantity = quantity;
    transaction.returnDetails = returnDetails;
    transaction.relatedTo = relatedTo;

    await transaction.save();
    const populated = await Transaction.findById(transaction._id)
      .populate('employee', 'fullName username email')
      .populate('site', 'siteName siteCode')
      .populate('item', 'name sku');
    
    await createLog('EDIT_TRANSACTION', req.user.id, req.user.username, `Edited transaction: ${transaction.transactionId}`);
    
    res.json(populated);
  } catch (err) {
    console.error('Update transaction error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authMiddleware, checkPermission('deleteTransactions'), async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

    await createLog('DELETE_TRANSACTION', req.user.id, req.user.username, `Deleted transaction: ${transaction.transactionId}`);
    
    await Transaction.findByIdAndDelete(req.params.id);
    res.json({ message: 'Transaction deleted' });
  } catch (err) {
    console.error('Delete transaction error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

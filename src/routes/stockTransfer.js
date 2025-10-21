const express = require('express');
const router = express.Router();
const StockTransfer = require('../models/stockTransfer');
const Inventory = require('../models/inventory');
const Transaction = require('../models/transaction');
const { authMiddleware } = require('../middlewares/auth');

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { item, fromSite, toSite, quantity, notes, employee } = req.body;
    if (!item || !fromSite || !toSite || !quantity || !employee) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    const returnTxn = new Transaction({
      transactionId: `TXN${Date.now()}`,
      type: 'RETURN',
      item,
      site: fromSite,
      employee,
      quantity,
      timestamp: new Date()
    });
    await returnTxn.save();
    
    const issueTxn = new Transaction({
      transactionId: `TXN${Date.now() + 1}`,
      type: 'ISSUE',
      item,
      site: toSite,
      employee,
      quantity,
      timestamp: new Date()
    });
    await issueTxn.save();
    
    global.io?.emit('transaction:created');
    global.io?.emit('inventory:updated');
    res.status(201).json({ message: 'Transfer completed', returnTxn, issueTxn });
  } catch (error) {
    console.error('Create transfer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:siteId/items', authMiddleware, async (req, res) => {
  try {
    const transactions = await Transaction.find({ site: req.params.siteId, type: 'ISSUE' })
      .populate('item', 'name sku currentStock')
      .select('item quantity');
    const itemMap = {};
    transactions.forEach(t => {
      if (t.item) {
        itemMap[t.item._id] = t.item;
      }
    });
    res.json(Object.values(itemMap));
  } catch (error) {
    console.error('Fetch site items error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});











module.exports = router;

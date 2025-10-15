const express = require('express');
const router = express.Router();
const Transaction = require('../models/transaction');
const Inventory = require('../models/inventory');
const { authMiddleware } = require('../middlewares/auth');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { site, item } = req.query;
    const filter = {};
    if (site) filter.site = site;
    if (item) filter.item = item;
    
    const transactions = await Transaction.find(filter)
      .populate('employee', 'fullName username email')
      .populate('site', 'siteName siteCode')
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
      .populate('employee', 'fullName username email')
      .populate('site', 'siteName siteCode')
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
      .populate('employee', 'fullName username email')
      .populate('site', 'siteName siteCode')
      .populate('item', 'name sku');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

    const { type, employee, site, item, quantity, returnDetails, relatedTo } = req.body;

    const oldInventory = await Inventory.findById(transaction.item);
    if (oldInventory) {
      if (transaction.type === 'ISSUE') {
        oldInventory.currentStock += transaction.quantity;
      } else if (transaction.type === 'RETURN') {
        oldInventory.currentStock -= transaction.quantity;
      }
      await oldInventory.save();
    }

    const newInventory = await Inventory.findById(item);
    if (!newInventory) return res.status(404).json({ error: 'Item not found' });

    if (type === 'ISSUE') {
      if (newInventory.currentStock < quantity) {
        return res.status(400).json({ error: 'Insufficient stock' });
      }
      newInventory.currentStock -= quantity;
    } else if (type === 'RETURN') {
      newInventory.currentStock += quantity;
    }
    await newInventory.save();

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
    res.json(populated);
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

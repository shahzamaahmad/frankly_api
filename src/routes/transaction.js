const express = require('express');
const router = express.Router();
const Transaction = require('../models/transaction');
const Inventory = require('../models/inventory');
const { authMiddleware } = require('../middlewares/auth');
const { checkPermission, checkAdmin } = require('../middlewares/checkPermission');
const { createLog } = require('../utils/logger');

const getDubaiTime = () => new Date(new Date().getTime() + (4 * 60 * 60 * 1000));

router.get('/', authMiddleware, checkPermission(), async (req, res) => {
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

router.get('/:id', authMiddleware, checkPermission(), async (req, res) => {
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

router.post('/', authMiddleware, checkAdmin(), async (req, res) => {
  try {
    const { type, employee, site, item, quantity, timestamp } = req.body;

    if (!type || !site || !item || !quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Invalid input data' });
    }

    const inventory = await Inventory.findById(item);
    if (!inventory) return res.status(404).json({ error: 'Item not found' });

    const now = timestamp ? new Date(timestamp) : getDubaiTime();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yy = String(now.getFullYear()).slice(-2);
    const dateStr = `${dd}${mm}${yy}`;
    const randomNum = Math.floor(Math.random() * 90) + 10;
    const transactionId = `TXN-${dateStr}-${randomNum}`;

    if (type === 'ISSUE') {
      if (inventory.currentStock < quantity) {
        return res.status(400).json({ error: `Insufficient stock. Available: ${inventory.currentStock}, Requested: ${quantity}` });
      }
      inventory.currentStock -= quantity;
    } else if (type === 'RETURN') {
      inventory.currentStock += quantity;
    }
    await inventory.save();

    const transaction = new Transaction({
      transactionId,
      type,
      employee,
      site,
      item,
      quantity,
      timestamp: now
    });

    await transaction.save();
    const populated = await Transaction.findById(transaction._id)
      .populate('employee', 'fullName username email')
      .populate('site', 'siteName siteCode')
      .populate('item', 'name sku');

    await createLog('ADD_TRANSACTION', req.user.id, req.user.username, `Added ${type} transaction: ${transactionId}`);
    if (global.io) {
      global.io.emit('transaction:created', populated);
      global.io.emit('inventory:updated');
    }
    res.status(201).json(populated);
  } catch (err) {
    console.error('Create transaction error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authMiddleware, checkPermission('editTransaction'), async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

    const { type, employee, site, item, quantity, remark } = req.body;

    if (type && type !== transaction.type) {
      return res.status(400).json({ error: 'Cannot change transaction type' });
    }

    if (!type || !site || !item || !quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Invalid input data' });
    }

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
        return res.status(400).json({ error: `Insufficient stock. Available: ${newInventory.currentStock}, Requested: ${quantity}` });
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
    transaction.remark = remark;

    await transaction.save();
    const populated = await Transaction.findById(transaction._id)
      .populate('employee', 'fullName username email')
      .populate('site', 'siteName siteCode')
      .populate('item', 'name sku');

    await createLog('EDIT_TRANSACTION', req.user.id, req.user.username, `Edited transaction: ${transaction.transactionId}`);
    if (global.io) {
      global.io.emit('transaction:updated', populated);
      global.io.emit('inventory:updated');
    }
    res.json(populated);
  } catch (err) {
    console.error('Update transaction error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authMiddleware, checkAdmin(), async (req, res) => {
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

    await createLog('DELETE_TRANSACTION', req.user.id, req.user.username, `Deleted transaction: ${transaction.transactionId}`);

    await Transaction.findByIdAndDelete(req.params.id);
    if (global.io) {
      console.log('Emitting socket events: transaction:deleted, inventory:updated');
      global.io.emit('transaction:deleted', { id: req.params.id });
      global.io.emit('inventory:updated');
    } else {
      console.log('WARNING: global.io is not available');
    }
    res.json({ message: 'Transaction deleted' });
  } catch (err) {
    console.error('Delete transaction error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

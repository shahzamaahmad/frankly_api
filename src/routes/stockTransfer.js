const express = require('express');
const router = express.Router();
const StockTransfer = require('../models/stockTransfer');
const Inventory = require('../models/inventory');
const Transaction = require('../models/transaction');
const { authMiddleware } = require('../middlewares/auth');

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { item, fromSite, toSite, quantity, notes, reason } = req.body;
    if (!item || !fromSite || !toSite || !quantity) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    const transferId = `TRF${Date.now()}`;
    const transfer = new StockTransfer({
      transferId,
      item,
      fromSite,
      toSite,
      quantity,
      notes,
      reason,
      requestedBy: req.user.userId,
      status: 'PENDING'
    });
    await transfer.save();
    global.io?.emit('stockTransfer:created', transfer);
    res.status(201).json(transfer);
  } catch (error) {
    console.error('Create transfer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    const transfers = await StockTransfer.find()
      .populate('item', 'name sku')
      .populate('fromSite', 'siteName')
      .populate('toSite', 'siteName')
      .populate('requestedBy', 'fullName')
      .populate('approvedBy', 'fullName')
      .populate('receivedBy', 'fullName')
      .sort({ createdAt: -1 });
    res.json(transfers);
  } catch (error) {
    console.error('Fetch transfers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const transfer = await StockTransfer.findById(req.params.id)
      .populate('item')
      .populate('fromSite')
      .populate('toSite')
      .populate('requestedBy', 'fullName')
      .populate('approvedBy', 'fullName')
      .populate('receivedBy', 'fullName');
    if (!transfer) return res.status(404).json({ message: 'Transfer not found' });
    res.json(transfer);
  } catch (error) {
    console.error('Fetch transfer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id/approve', authMiddleware, async (req, res) => {
  try {
    console.log('Approve - User role:', req.user.role);
    const transfer = await StockTransfer.findById(req.params.id);
    if (!transfer) return res.status(404).json({ message: 'Transfer not found' });
    if (transfer.status !== 'PENDING') return res.status(400).json({ message: 'Transfer already processed' });
    
    const txn = new Transaction({
      transactionId: `TXN${Date.now()}`,
      type: 'ISSUE',
      item: transfer.item,
      site: transfer.fromSite,
      employee: transfer.requestedBy,
      quantity: transfer.quantity,
      timestamp: new Date(),
      taker: 'Transfer to site'
    });
    await txn.save();
    
    transfer.status = 'IN_TRANSIT';
    transfer.approvedBy = req.user.userId;
    transfer.approvalDate = new Date();
    transfer.transferDate = new Date();
    await transfer.save();
    
    global.io?.emit('stockTransfer:updated', transfer);
    res.json(transfer);
  } catch (error) {
    console.error('Approve transfer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id/receive', authMiddleware, async (req, res) => {
  try {
    const transfer = await StockTransfer.findById(req.params.id);
    if (!transfer) return res.status(404).json({ message: 'Transfer not found' });
    if (transfer.status !== 'IN_TRANSIT') return res.status(400).json({ message: 'Transfer not in transit' });
    
    const txn = new Transaction({
      transactionId: `TXN${Date.now()}`,
      type: 'RETURN',
      item: transfer.item,
      site: transfer.toSite,
      employee: req.user.userId,
      quantity: transfer.quantity,
      timestamp: new Date(),
      returnee: req.user.fullName || req.user.username
    });
    await txn.save();
    
    transfer.status = 'RECEIVED';
    transfer.receivedBy = req.user.userId;
    transfer.receiveDate = new Date();
    await transfer.save();
    
    global.io?.emit('stockTransfer:updated', transfer);
    res.json(transfer);
  } catch (error) {
    console.error('Receive transfer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const transfer = await StockTransfer.findById(req.params.id);
    if (!transfer) return res.status(404).json({ message: 'Transfer not found' });
    if (transfer.status === 'RECEIVED') return res.status(400).json({ message: 'Cannot cancel received transfer' });
    
    transfer.status = 'CANCELLED';
    await transfer.save();
    
    global.io?.emit('stockTransfer:updated', transfer);
    res.json(transfer);
  } catch (error) {
    console.error('Cancel transfer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const transfer = await StockTransfer.findByIdAndDelete(req.params.id);
    if (!transfer) return res.status(404).json({ message: 'Transfer not found' });
    global.io?.emit('stockTransfer:deleted', { id: transfer._id });
    res.json({ message: 'Transfer deleted' });
  } catch (error) {
    console.error('Delete transfer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

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
    
    const [fromSiteDoc, toSiteDoc, inventory] = await Promise.all([
      require('../models/site').findById(fromSite).select('siteName siteCode'),
      require('../models/site').findById(toSite).select('siteName siteCode'),
      Inventory.findById(item)
    ]);
    
    if (!inventory) return res.status(404).json({ message: 'Item not found' });
    
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yy = String(now.getFullYear()).slice(-2);
    const dateStr = `${dd}${mm}${yy}`;
    const fromPrefix = `TXN-${dateStr}-`;
    const toPrefix = `TXN-${dateStr}-`;
    
    const lastFromTxn = await Transaction.findOne({ 
      transactionId: { $regex: `^${fromPrefix}.*-${fromSiteDoc?.siteCode || ''}$` } 
    }).sort({ transactionId: -1 });
    let fromNum = 1;
    if (lastFromTxn) {
      const match = lastFromTxn.transactionId.match(/-(\d+)-/);
      if (match) fromNum = parseInt(match[1]) + 1;
    }
    
    const lastToTxn = await Transaction.findOne({ 
      transactionId: { $regex: `^${toPrefix}.*-${toSiteDoc?.siteCode || ''}$` } 
    }).sort({ transactionId: -1 });
    let toNum = 1;
    if (lastToTxn) {
      const match = lastToTxn.transactionId.match(/-(\d+)-/);
      if (match) toNum = parseInt(match[1]) + 1;
    }
    
    const returnTxn = new Transaction({
      transactionId: `${fromPrefix}${String(fromNum).padStart(4, '0')}-${fromSiteDoc?.siteCode || 'UNKNOWN'}`,
      type: 'RETURN',
      item,
      site: fromSite,
      employee,
      quantity,
      timestamp: now,
      remark: `Stock Transfer: ${fromSiteDoc?.siteName || 'Unknown'} → ${toSiteDoc?.siteName || 'Unknown'}`
    });
    await returnTxn.save();
    inventory.currentStock += quantity;
    
    const issueTxn = new Transaction({
      transactionId: `${toPrefix}${String(toNum).padStart(4, '0')}-${toSiteDoc?.siteCode || 'UNKNOWN'}`,
      type: 'ISSUE',
      item,
      site: toSite,
      employee,
      quantity,
      timestamp: now,
      remark: `Stock Transfer: ${fromSiteDoc?.siteName || 'Unknown'} → ${toSiteDoc?.siteName || 'Unknown'}`
    });
    await issueTxn.save();
    inventory.currentStock -= quantity;
    await inventory.save();
    
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
    const transactions = await Transaction.find({ site: req.params.siteId })
      .populate('item', 'name sku')
      .select('item quantity type');
    
    const itemStock = {};
    transactions.forEach(t => {
      if (t.item) {
        const itemId = t.item._id.toString();
        if (!itemStock[itemId]) {
          itemStock[itemId] = { item: t.item, stock: 0 };
        }
        if (t.type === 'ISSUE') {
          itemStock[itemId].stock += t.quantity;
        } else if (t.type === 'RETURN') {
          itemStock[itemId].stock -= t.quantity;
        }
      }
    });
    
    const result = Object.values(itemStock)
      .filter(i => i.stock > 0)
      .map(i => ({
        _id: i.item._id,
        name: i.item.name,
        sku: i.item.sku,
        currentStock: i.stock
      }));
    
    res.json(result);
  } catch (error) {
    console.error('Fetch site items error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});











module.exports = router;

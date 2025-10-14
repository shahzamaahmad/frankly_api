
const mongoose = require('mongoose');

const InventorySchema = new mongoose.Schema({
  sku: { type: String, required: true, unique: true },
  itemName: { type: String, required: true },
  type: { type: String },
  origin: { type: String },
  initialStock: { type: Number, default: 0 },
  currentStock: { type: Number, default: 0 },
  uom: { type: String },
  size: { type: String },
  remark: { type: String },
  // Store image as CDN URL string
  image: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Inventory', InventorySchema);

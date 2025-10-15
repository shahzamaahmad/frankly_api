
const mongoose = require('mongoose');

const InventorySchema = new mongoose.Schema({
  sku: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  initialStock: { type: Number, default: 0 },
  currentStock: { type: Number, default: 0 },
  description: { type: String },
  remark: { type: String },
  category: { type: String },
  subCategory: { type: String },
  unitCost: { type: Number },
  currency: { type: String, default: 'AED' },
  supplier: {
    name: { type: String },
    contact: { type: String },
    supplierId: { type: String }
  },
  unitOfMeasure: { type: String },
  weightKg: { type: Number },
  size: { type: String },
  dimensions: {
    lengthCm: { type: Number },
    widthCm: { type: Number },
    heightCm: { type: Number }
  },
  color: { type: String },
  brand: { type: String },
  modelNumber: { type: String },
  serialNumberRequired: { type: Boolean, default: false },
  warrantyMonths: { type: Number },
  certification: {
    iso: { type: String },
    safetyStandards: [{ type: String }]
  },
  datePurchased: { type: Date },
  expectedLifespanMonths: { type: Number },
  status: { type: String, default: 'active' },
  reorderLevel: { type: Number },
  maxStockLevel: { type: Number },
  imageUrl: { type: String },
  barcode: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Inventory', InventorySchema);


const mongoose = require('mongoose');

const InventorySchema = new mongoose.Schema({
  sku: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  initialStock: { type: Number, default: 0 },
  currentStock: { type: Number, default: 0, min: 0 },
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
  serialNumber: { type: String },
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

InventorySchema.index({ name: 1 });
InventorySchema.index({ category: 1 });
InventorySchema.index({ status: 1 });
InventorySchema.index({ sku: 1 });
InventorySchema.index({ subCategory: 1 });
InventorySchema.index({ brand: 1 });
InventorySchema.index({ barcode: 1 });
InventorySchema.index({ currentStock: 1 });
InventorySchema.index({ reorderLevel: 1 });
InventorySchema.index({ 'supplier.name': 1 });
InventorySchema.index({ category: 1, status: 1 });
InventorySchema.index({ currentStock: 1, reorderLevel: 1 });
InventorySchema.index({ createdAt: -1 });

module.exports = mongoose.model('Inventory', InventorySchema);

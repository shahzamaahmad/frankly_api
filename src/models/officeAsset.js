const mongoose = require('mongoose');

const officeAssetSchema = new mongoose.Schema({
  sku: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  category: { type: String, required: true },
  subCategory: { type: String },
  brand: { type: String },
  model: { type: String },
  serialNumber: { type: String },
  barcode: { type: String },
  purchaseDate: { type: Date },
  initialStock: { type: Number, default: 1 },
  currentStock: { type: Number, default: 1 },
  purchasePrice: { type: Number },
  currentValue: { type: Number },
  condition: { type: String, enum: ['New', 'Good', 'Fair', 'Poor'], default: 'Good' },
  location: { type: String },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['Active', 'Inactive', 'Maintenance', 'Disposed'], default: 'Active' },
  description: { type: String },
  imageUrl: { type: String },
  imageData: { type: Buffer },
  warranty: {
    startDate: { type: Date },
    endDate: { type: Date },
    provider: { type: String }
  },
  maintenance: [{
    date: { type: Date },
    description: { type: String },
    cost: { type: Number },
    performedBy: { type: String }
  }]
}, {
  timestamps: true
});

officeAssetSchema.index({ sku: 1 });
officeAssetSchema.index({ name: 1 });
officeAssetSchema.index({ category: 1 });
officeAssetSchema.index({ status: 1 });
officeAssetSchema.index({ assignedTo: 1 });
officeAssetSchema.index({ condition: 1 });
officeAssetSchema.index({ barcode: 1 });

module.exports = mongoose.model('OfficeAsset', officeAssetSchema);
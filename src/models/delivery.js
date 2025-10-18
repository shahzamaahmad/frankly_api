
const mongoose = require('mongoose');

const DeliverySchema = new mongoose.Schema({
  deliveryDate: { type: Date },
  seller: { type: String },
  amount: { type: Number },
  receivedBy: { type: String },
  remarks: { type: String },
  invoiceImage: { type: String },
  invoiceNumber: { type: String },
  items: [{
    itemName: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', required: true },
    quantity: { type: Number, required: true, min: 1 }
  }]
}, { timestamps: true });

DeliverySchema.index({ deliveryDate: -1 });
DeliverySchema.index({ seller: 1 });
DeliverySchema.index({ invoiceNumber: 1 });
DeliverySchema.index({ createdAt: -1 });

module.exports = mongoose.model('Delivery', DeliverySchema);

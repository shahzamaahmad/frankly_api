
const mongoose = require('mongoose');

const DeliveryItemSchema = new mongoose.Schema({
  deliveryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Delivery', required: true },
  itemName: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', required: true },
  quantity: { type: Number, default: 0, min: 1 },
  receivedQuantity: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

DeliveryItemSchema.index({ deliveryId: 1 });
DeliveryItemSchema.index({ itemName: 1 });
DeliveryItemSchema.index({ deliveryId: 1, itemName: 1 });

module.exports = mongoose.model('DeliveryItem', DeliveryItemSchema);

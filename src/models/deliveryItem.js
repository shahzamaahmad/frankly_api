
const mongoose = require('mongoose');

const DeliveryItemSchema = new mongoose.Schema({
  deliveryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Delivery', required: true },
  itemName: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', required: true },
  quantity: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('DeliveryItem', DeliveryItemSchema);

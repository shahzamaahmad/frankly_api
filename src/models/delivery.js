
const mongoose = require('mongoose');

const DeliverySchema = new mongoose.Schema({
  deliveryDate: { type: Date },
  seller: { type: String },
  amount: { type: Number },
  receivedBy: { type: String },
  remarks: { type: String },
  invoiceImage: { type: String },
  invoiceNumber: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Delivery', DeliverySchema);

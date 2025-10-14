
const mongoose = require('mongoose');

function generateDeliveryID() {
  const date = new Date();
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  const HH = String(date.getHours()).padStart(2, '0');
  const MM = String(date.getMinutes()).padStart(2, '0');
  const SS = String(date.getSeconds()).padStart(2, '0');

  return `del${dd}${mm}${yy}${HH}${MM}${SS}`;
}

const DeliverySchema = new mongoose.Schema({
  deliveryId: { type: String, required: true, unique: true, default: generateDeliveryID },
  deliveryDate: { type: Date },
  seller: { type: String },
  amount: { type: Number },
  receivedBy: { type: String },
  remarks: { type: String },
  // store invoice as CDN URL string (or fallback base64 string)
  invoice: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Delivery', DeliverySchema);

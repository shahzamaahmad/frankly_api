
const mongoose = require('mongoose');

// Helper function for delitemDDMMYYHHMMSS
function generateDeliveryItemID() {
  const date = new Date();
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  const HH = String(date.getHours()).padStart(2, '0');
  const MM = String(date.getMinutes()).padStart(2, '0');
  const SS = String(date.getSeconds()).padStart(2, '0');

  return `delitem${dd}${mm}${yy}${HH}${MM}${SS}`;
}

const DeliveryItemSchema = new mongoose.Schema({
  deliveryItemId: { type: String, required: true, unique: true, default: generateDeliveryItemID },
  deliveryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Delivery', required: true },
  itemName: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', required: true },
  quantity: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('DeliveryItem', DeliveryItemSchema);


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
  invoice: {
    data: Buffer,
    contentType: String,
    filename: String
  }
}, { timestamps: true });

module.exports = mongoose.model('Delivery', DeliverySchema);





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
  image: {
    data: Buffer,
    contentType: String
  }
}, { timestamps: true });

module.exports = mongoose.model('Inventory', InventorySchema);





const mongoose = require('mongoose');

const SiteSchema = new mongoose.Schema({
  site: { type: String, required: true, unique: true },
  sector: { type: String },
  location: { type: String },
  client: { type: String },
  projectDescription: { type: String },
  siteLocation: { type: String },
  value: { type: Number },
  engineer: { type: String },
  remark: { type: String },
  status: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Site', SiteSchema);






const mongoose = require('mongoose');

function generateTransactionID() {
  const date = new Date();
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  const HH = String(date.getHours()).padStart(2, '0');
  const MM = String(date.getMinutes()).padStart(2, '0');
  const SS = String(date.getSeconds()).padStart(2, '0');
  return `txn${dd}${mm}${yy}${HH}${MM}${SS}`;
}


const TransactionSchema = new mongoose.Schema({
  transactionId: { type: String, required: true, unique: true, default: generateTransactionID },
  taker: { type: String },
  site: { type: mongoose.Schema.Types.ObjectId, ref: 'Site' },
  outDate: { type: Date },
  inDate: { type: Date },
  returnee: { type: String },
  remark: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', TransactionSchema);





const mongoose = require('mongoose');

function generateTransactionItemID() {
  const date = new Date();
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  const HH = String(date.getHours()).padStart(2, '0');
  const MM = String(date.getMinutes()).padStart(2, '0');
  const SS = String(date.getSeconds()).padStart(2, '0');
  return `txnitem${dd}${mm}${yy}${HH}${MM}${SS}`;
}

const TransactionItemSchema = new mongoose.Schema({
  transactionItemId: { type: String, required: true, unique: true, default: generateTransactionItemID },
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', required: true },
  itemName: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', required: true },
  outQuantity: { type: Number, default: 0 },
  inQuantity: { type: Number, default: 0 },
  outDate: { type: Date },
  inDate: { type: Date },
  remark: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('TransactionItem', TransactionItemSchema);

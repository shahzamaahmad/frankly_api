const mongoose = require('mongoose');

const FavoriteSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  itemType: { type: String, enum: ['inventory', 'site', 'transaction', 'delivery', 'employee'], required: true },
  itemId: { type: mongoose.Schema.Types.ObjectId, required: true },
  itemName: { type: String, required: true },
  image: { type: String },
}, { timestamps: true });

FavoriteSchema.index({ user: 1, itemType: 1, itemId: 1 }, { unique: true });

module.exports = mongoose.model('Favorite', FavoriteSchema);

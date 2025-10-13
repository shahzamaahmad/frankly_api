
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

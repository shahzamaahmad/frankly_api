
const mongoose = require('mongoose');

const SiteSchema = new mongoose.Schema({
  siteCode: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  siteName: {
    type: String,
    required: true
  },
  city: { type: String, default: "Dubai" },
  emirate: {
    type: String,
    enum: ['Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'],
    default: "Dubai"
  },
  coordinates: {
    type: { type: String, default: 'Point' },
    coordinates: [Number]
  },
  client: {
    name: { type: String, required: true },
    contactPerson: String,
    contactNumber: String,
    clientId: String
  },
  projectDescription: { type: String },
  sector: {
    type: String,
    enum: ['Residential', 'Commercial', 'Infrastructure', 'Industrial', 'Oil & Gas', 'Utilities']
  },
  projectValue: {
    amount: { type: Number, min: 0 },
    currency: { type: String, default: "AED" }
  },
  engineer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  siteManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  safetyOfficer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  startDate: Date,
  endDate: Date,
  expectedDurationDays: Number,
  status: {
    type: String,
    enum: ['planning', 'active', 'on-hold', 'completed', 'cancelled'],
    default: 'planning'
  },
  progressPercentage: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  siteAreaSqM: Number,
  numberOfBuildings: Number,
  numberOfFloors: Number,
  siteAccessInstructions: String,
  workingHours: {
    start: { type: String, default: "07:00" },
    end: { type: String, default: "18:00" }
  },
  safetyPermitNumber: String,
  civilDefenseApproval: Boolean,
  lastSafetyInspectionDate: Date,
  nextSafetyInspectionDue: Date,
  ppeRequired: [String],
  emergencyContact: {
    name: String,
    role: String,
    phone: String
  },
  documents: [{
    name: String,
    url: String,
    type: String,
    uploadedBy: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  remark: { type: String },
  internalNotes: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: false
});

SiteSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

SiteSchema.index({ siteName: 1 });
SiteSchema.index({ status: 1 });
SiteSchema.index({ engineer: 1 });
SiteSchema.index({ siteManager: 1 });
SiteSchema.index({ sector: 1 });
SiteSchema.index({ startDate: -1 });
SiteSchema.index({ endDate: 1 });
SiteSchema.index({ 'client.name': 1 });
SiteSchema.index({ coordinates: '2dsphere' });

module.exports = mongoose.model('Site', SiteSchema);

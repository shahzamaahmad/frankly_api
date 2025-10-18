
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10;

const UserSchema = new mongoose.Schema({
  email: { type: String },
  phone: { type: String },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },

  firstName: { type: String },
  lastName: { type: String },
  fullName: { type: String },
  employeeId: { type: String },
  profilePictureUrl: { type: String },
  emergencyContact: { type: String },
  country: { type: String },
  dateOfBirth: { type: Date },

  role: { type: String, default: 'emp' },
  isActive: { type: Boolean, default: true },

  permissions: {
    viewInventory: { type: Boolean, default: true },
    addInventory: { type: Boolean, default: false },
    editInventory: { type: Boolean, default: false },
    deleteInventory: { type: Boolean, default: false },
    viewTransactions: { type: Boolean, default: true },
    addTransactions: { type: Boolean, default: false },
    editTransactions: { type: Boolean, default: false },
    deleteTransactions: { type: Boolean, default: false },
    viewDeliveries: { type: Boolean, default: true },
    addDeliveries: { type: Boolean, default: false },
    editDeliveries: { type: Boolean, default: false },
    deleteDeliveries: { type: Boolean, default: false },
    viewEmployees: { type: Boolean, default: false },
    addEmployees: { type: Boolean, default: false },
    editEmployees: { type: Boolean, default: false },
    deleteEmployees: { type: Boolean, default: false },
    viewSites: { type: Boolean, default: true },
    addSites: { type: Boolean, default: false },
    editSites: { type: Boolean, default: false },
    deleteSites: { type: Boolean, default: false },
    viewContacts: { type: Boolean, default: true },
    viewDashboard: { type: Boolean, default: true },
    viewAttendance: { type: Boolean, default: true },
    editAttendance: { type: Boolean, default: false },
    deleteAttendance: { type: Boolean, default: false },
    viewNotifications: { type: Boolean, default: false },
    sendNotifications: { type: Boolean, default: false },
  },

  department: { type: String },
  lastLoginAt: { type: Date },

  assets: [{
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem' },
    quantity: { type: Number },
    condition: { type: String, enum: ['new', 'used', 'damaged'], default: 'new' },
    remarks: { type: String }
  }],

  passportNumber: { type: String },
  emiratesIdNumber: { type: String },
  emiratesIdExpiryDate: { type: Date },

  joiningDate: { type: Date },
  salary: { type: Number },
  salaryCurrency: { type: String, default: 'AED' }
}, { timestamps: true });

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const hash = await bcrypt.hash(this.password, SALT_ROUNDS);
    this.password = hash;
    return next();
  } catch (err) {
    console.error('Password hashing error:', err);
    return next(err);
  }
});

UserSchema.statics.generateUsername = function (firstName, lastName) {
  let baseUsername = '';
  if (firstName && lastName) {
    baseUsername = `${firstName}${lastName}`.toLowerCase();
  } else if (firstName) {
    baseUsername = firstName.toLowerCase();
  } else if (lastName) {
    baseUsername = lastName.toLowerCase();
  } else {
    baseUsername = 'user';
  }
  baseUsername = baseUsername.replace(/[^a-z0-9]/g, '');
  const randomNum = Math.floor(Math.random() * 90) + 10;
  return `${baseUsername}${randomNum}`;
};

UserSchema.statics.checkUsernameExists = async function (username) {
  const user = await this.findOne({ username });
  return !!user;
};

UserSchema.methods.comparePassword = async function (candidate) {
  try {
    return await bcrypt.compare(candidate, this.password);
  } catch (err) {
    console.error('Password comparison error:', err);
    return false;
  }
}

UserSchema.index({ username: 1 });
UserSchema.index({ isActive: 1 });
UserSchema.index({ emiratesIdExpiryDate: 1 });
UserSchema.index({ dateOfBirth: 1 });

module.exports = mongoose.model('User', UserSchema);

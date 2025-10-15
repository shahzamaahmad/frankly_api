
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10;

const UserSchema = new mongoose.Schema({
  email: { type: String, unique: true, sparse: true },
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

  role: { type: String, enum: ['admin', 'storekeeper', 'engineer', 'driver', 'emp', 'labor',], default: 'emp' },
  isActive: { type: Boolean, default: true },

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
  const hash = await bcrypt.hash(this.password, SALT_ROUNDS);
  this.password = hash;
  next();
});

UserSchema.statics.generateUsername = function(firstName, lastName) {
  let baseUsername = '';
  if (firstName && lastName) {
    baseUsername = `${firstName.toLowerCase()}${lastName.toLowerCase()}`;
  } else if (lastName) {
    baseUsername = lastName.toLowerCase();
  } else if (firstName) {
    baseUsername = firstName.toLowerCase();
  } else {
    baseUsername = 'user';
  }
  baseUsername = baseUsername.replace(/[^a-z0-9]/g, '');
  if (baseUsername.length > 8) {
    baseUsername = baseUsername.substring(0, 8);
  }
  return baseUsername;
};

UserSchema.statics.checkUsernameExists = async function(username) {
  const user = await this.findOne({ username });
  return !!user;
};

UserSchema.methods.comparePassword = function (candidate) {
  const bcrypt = require('bcrypt');
  return bcrypt.compare(candidate, this.password);
}

module.exports = mongoose.model('User', UserSchema);

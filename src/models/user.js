
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10;

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'emp' },
  email: { type: String },
  mobile: { type: String }
}, { timestamps: true });

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const hash = await bcrypt.hash(this.password, SALT_ROUNDS);
  this.password = hash;
  next();
});

UserSchema.methods.comparePassword = function (candidate) {
  const bcrypt = require('bcrypt');
  return bcrypt.compare(candidate, this.password);
}

module.exports = mongoose.model('User', UserSchema);

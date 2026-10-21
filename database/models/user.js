const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  displayName: { type: String, required: true },
  avatarUrl: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);

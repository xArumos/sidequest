const mongoose = require('mongoose');

// Accounts are created by Google sign-in (server/src/auth.js), matched on googleId only.
const userSchema = new mongoose.Schema({
  googleId: { type: String, required: true, unique: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  displayName: { type: String, required: true, trim: true },
  avatarUrl: { type: String, default: '' },
  username: { type: String, unique: true, sparse: true, trim: true, lowercase: true },
  bio: { type: String, default: '', trim: true, maxlength: 300 },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);

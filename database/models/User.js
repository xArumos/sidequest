const mongoose = require('mongoose');

const VISIBILITIES = ['public', 'followers', 'private'];

const userSchema = new mongoose.Schema({
  googleId: { type: String },
  email: { type: String, required: true, trim: true, lowercase: true },
  displayName: { type: String, required: true, trim: true },
  avatarUrl: { type: String, default: '' },
  username: { type: String, unique: true, sparse: true, trim: true, lowercase: true,
    required() { return Boolean(this.passwordHash); } },
  passwordHash: { type: String, select: false },
  bio: { type: String, default: '', trim: true, maxlength: 300 },
  // Who may see the wishlist and the rest of the profile's activity (PBI-29, PBI-31).
  // `followers` means users who follow this account. Documents saved before
  // activityVisibility existed have no value and are treated as `public`.
  wishlistVisibility: { type: String, enum: VISIBILITIES, default: 'private' },
  activityVisibility: { type: String, enum: VISIBILITIES, default: 'public' },
  // Grants the admin pages and routes. Set only by server/scripts/set-admin.js, never by an API route.
  admin: { type: Boolean, default: false },
}, { timestamps: true, autoIndex: false });

userSchema.index({ googleId: 1 }, {
  name: 'googleId_unique', unique: true, partialFilterExpression: { googleId: { $type: 'string' } },
});
userSchema.index({ email: 1 }, {
  name: 'password_email_unique', unique: true, partialFilterExpression: { passwordHash: { $type: 'string' } },
});
userSchema.pre('validate', function () {
  // Projected existing documents may not contain their hidden password hash.
  if ((this.isNew || this.isModified('googleId') || this.isModified('passwordHash')) &&
      (Boolean(this.googleId) === Boolean(this.passwordHash))) {
    this.invalidate('googleId', 'An account must have exactly one authentication method.');
  }
});

const User = mongoose.model('User', userSchema);
User.VISIBILITIES = VISIBILITIES;

module.exports = User;

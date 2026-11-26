const mongoose = require('mongoose');

// One-way follow (PBI-30, decided in #59): `follower` sees `followee`'s activity
// in their feed. No acceptance step; following someone never needs their approval.
const followSchema = new mongoose.Schema({
  follower: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  followee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

followSchema.pre('validate', function rejectSelfFollow() {
  if (this.follower && this.followee && this.follower.equals(this.followee)) {
    this.invalidate('followee', 'Users cannot follow themselves.');
  }
});

// One follow per pair; also serves "who does this user follow" lookups.
followSchema.index({ follower: 1, followee: 1 }, { unique: true });
// Follower lists, newest first.
followSchema.index({ followee: 1, createdAt: -1 });

module.exports = mongoose.model('Follow', followSchema);

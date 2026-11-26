const mongoose = require('mongoose');

// Cached Steam achievements for one user and Steam app (PBI-24).
const unlockedSchema = new mongoose.Schema({
  apiName: { type: String, required: true, trim: true },
  unlockedAt: Date,
}, { _id: false });

const steamAchievementsSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Steam app IDs are stored as strings to match Game.steamAppIds.
  appId: { type: String, required: true, trim: true },
  unlocked: { type: [unlockedSchema], default: [] },
  // Total achievements the app offers, unlocked or not.
  total: { type: Number, min: 0, default: 0 },
  fetchedAt: { type: Date, required: true, default: Date.now },
});

steamAchievementsSchema.index({ user: 1, appId: 1 }, { unique: true });

module.exports = mongoose.model('SteamAchievements', steamAchievementsSchema);

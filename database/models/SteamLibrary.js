const mongoose = require('mongoose');

// Cached copy of one game in a user's Steam library (PBI-24), so pages don't
// call the Steam Web API on every view. One record per user and Steam app.
const steamLibrarySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Steam app IDs are stored as strings to match Game.steamAppIds.
  appId: { type: String, required: true, trim: true },
  name: { type: String, default: '', trim: true },
  playtimeMinutes: { type: Number, min: 0, default: 0 },
  lastPlayedAt: Date,
  // The matching catalog game, set by the Steam-to-catalog matcher (PBI-25); null until matched.
  gameId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Game',
    default: null,
  },
  fetchedAt: { type: Date, required: true, default: Date.now },
});

steamLibrarySchema.index({ user: 1, appId: 1 }, { unique: true });
steamLibrarySchema.index({ user: 1, gameId: 1 });

module.exports = mongoose.model('SteamLibrary', steamLibrarySchema);

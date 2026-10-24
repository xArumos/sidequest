const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  igdbId: { type: Number, unique: true, sparse: true },
  slug: { type: String, trim: true },
  summary: { type: String, default: '' },
  coverUrl: { type: String, default: '' },
  genres: [String],
  platforms: [String],
  releaseDate: Date,
  // Steam app IDs from IGDB's external games, used to match Steam libraries (PBI-25).
  steamAppIds: [String],
  // Denormalized from Review by recalculateGameRating() in ../ratings.js; never set directly.
  ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
  ratingCount: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

gameSchema.index({ genres: 1 });
gameSchema.index({ platforms: 1 });
gameSchema.index({ ratingAvg: -1, ratingCount: -1 });
gameSchema.index({ title: 'text' });

module.exports = mongoose.model('Game', gameSchema);

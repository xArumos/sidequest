const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  genres: [String],
  platforms: [String],
  releaseDate: Date,
}, { timestamps: true });

module.exports = mongoose.model('Game', gameSchema);

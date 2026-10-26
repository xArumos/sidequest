const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  game: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Game',
    required: true,
  },
  rating: { type: Number, required: true, min: 1, max: 5 },
  text: { type: String, default: '', trim: true, maxlength: 2000 },
}, { timestamps: true });

reviewSchema.index({ user: 1, game: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);

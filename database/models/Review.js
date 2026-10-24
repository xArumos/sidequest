const mongoose = require('mongoose');

const STATUSES = ['playing', 'played', 'backlog', 'wishlist'];

// One record per user and game. It holds the user's rating, review text, and
// play status (wishlist and backlog are statuses), so any of them may be absent.
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
  rating: {
    type: Number,
    min: 1,
    max: 5,
    validate: {
      validator: (value) => value == null || Number.isInteger(value),
      message: 'Rating must be a whole number from 1 to 5.',
    },
  },
  text: { type: String, default: '', trim: true, maxlength: 2000 },
  status: { type: String, enum: STATUSES },
}, { timestamps: true });

reviewSchema.pre('validate', function requireContent() {
  if (this.rating == null && !this.text && !this.status) {
    this.invalidate('rating', 'A review needs a rating, text, or status.');
  }
});

reviewSchema.index({ user: 1, game: 1 }, { unique: true });
reviewSchema.index({ game: 1 });
reviewSchema.index({ user: 1, status: 1 });

const Review = mongoose.model('Review', reviewSchema);
Review.STATUSES = STATUSES;

module.exports = Review;

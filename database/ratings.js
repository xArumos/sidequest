const mongoose = require('mongoose');
const Game = require('./models/Game');
const Review = require('./models/Review');

// Recompute a game's average and count from its reviews and store them on the Game.
// Call after any write that adds, changes, or removes a rating. Recomputing from
// scratch keeps the stored values correct even if an earlier update was missed.
async function recalculateGameRating(gameId) {
  const game = new mongoose.Types.ObjectId(String(gameId));
  const [stats] = await Review.aggregate([
    { $match: { game, rating: { $ne: null } } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  const ratingAvg = stats ? Math.round(stats.avg * 100) / 100 : 0;
  const ratingCount = stats ? stats.count : 0;
  await Game.updateOne({ _id: game }, { $set: { ratingAvg, ratingCount } });
  return { ratingAvg, ratingCount };
}

module.exports = { recalculateGameRating };

const mongoose = require('mongoose');
const Game = require('./models/Game');
const Review = require('./models/Review');

const MAX_ATTEMPTS = 10;

// Recompute a game's average and count from its reviews and store them on the Game.
// Call after any write that adds, changes, or removes a rating. Recomputing from
// scratch keeps the stored values correct even if an earlier update was missed.
//
// Concurrent calls for the same game are made safe with an optimistic version check:
// read ratingVersion, aggregate, then write only if ratingVersion is unchanged. If
// another recalculation wrote first, our aggregate may predate a review change it
// saw, so retry. The last successful write always aggregated after every review
// change whose own recalculation had already written.
async function recalculateGameRating(gameId) {
  const game = new mongoose.Types.ObjectId(String(gameId));
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const current = await Game.findById(game, { ratingVersion: 1 }).lean();
    const stats = await aggregateRatings(game);
    if (!current) return stats;

    const version = current.ratingVersion ?? 0;
    // Games stored before ratingVersion existed have no field; treat that as 0.
    const versionFilter = version === 0 ? { $in: [0, null] } : version;
    const { matchedCount } = await Game.updateOne(
      { _id: game, ratingVersion: versionFilter },
      { $set: { ...stats, ratingVersion: version + 1 } },
    );
    if (matchedCount === 1) return stats;
  }
  throw new Error(`Rating recalculation for game ${game} kept conflicting; try again.`);
}

async function aggregateRatings(game) {
  const [stats] = await Review.aggregate([
    { $match: { game, rating: { $ne: null } } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  return {
    ratingAvg: stats ? Math.round(stats.avg * 100) / 100 : 0,
    ratingCount: stats ? stats.count : 0,
  };
}

module.exports = { recalculateGameRating };

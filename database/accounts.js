const mongoose = require('mongoose');
const Follow = require('./models/Follow');
const GameDeveloper = require('./models/GameDeveloper');
const Review = require('./models/Review');
const User = require('./models/User');
const { recalculateGameRating } = require('./ratings');

// Data owned by an account that is deleted with it (#92), besides the account's
// reviews, which deleteAccount handles itself because game ratings depend on them.
// Each step deletes by user id, so running it again is safe.
//
// Extension point: add a step here for every new collection that stores per-user
// data, for example the Steam library cache once PBI-25 lands:
//   { name: 'steam library cache', run: user => SteamLibrary.deleteMany({ user }) },
//
// References that other accounts' records hold to this user are kept on purpose:
// GameDeveloper.decidedBy (the admin who decided a request) and Review.removedBy
// (the developer who removed a review) stay as audit history and may point to a
// deleted account. Nothing populates them, and a removed review stays removed.
const ACCOUNT_CLEANUP_STEPS = [
  { name: 'follows', run: user => Follow.deleteMany({ $or: [{ follower: user }, { followee: user }] }) },
  { name: 'developer mappings', run: user => GameDeveloper.deleteMany({ user }) },
];

// Deletes a user and everything they own, and recalculates the ratings of the games
// they reviewed. Returns whether the account existed.
//
// MongoDB transactions need a replica set, which local development does not run, so
// the steps are ordered instead to be safe to retry after a failure partway:
// 1. The games the user reviewed are saved on the account before any review is
//    deleted, so a retry still knows which ratings to recalculate.
// 2. Owned data is deleted, then ratings are recalculated.
// 3. The account itself goes last, so nothing is left pointing to a missing user
//    while the account can still be used to retry.
async function deleteAccount(userId, { cleanupSteps = ACCOUNT_CLEANUP_STEPS } = {}) {
  if (!mongoose.isObjectIdOrHexString(userId)) throw new TypeError('userId must be a user id.');
  const user = new mongoose.Types.ObjectId(String(userId));

  const reviewedGames = await Review.distinct('game', { user });
  const account = await User.findOneAndUpdate(
    { _id: user },
    { $addToSet: { pendingRatingGames: { $each: reviewedGames } } },
    { returnDocument: 'after', projection: { pendingRatingGames: 1 } },
  ).lean();
  if (!account) return false;

  for (const step of cleanupSteps) await step.run(user);
  await Review.deleteMany({ user });
  for (const game of account.pendingRatingGames ?? []) await recalculateGameRating(game);

  await User.deleteOne({ _id: user });
  return true;
}

module.exports = { deleteAccount, ACCOUNT_CLEANUP_STEPS };

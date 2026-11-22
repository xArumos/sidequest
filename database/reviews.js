const mongoose = require('mongoose');
const Review = require('./models/Review');

// Text-only reviews (no rating) sort after rated ones for the rating sorts, the same
// way games.js orders unrated games, so "lowest" doesn't open with unrated reviews.
const SORTS = {
  newest: { createdAt: -1, _id: -1 },
  oldest: { createdAt: 1, _id: 1 },
  highest: { rated: -1, rating: -1, createdAt: -1, _id: -1 },
  lowest: { rated: -1, rating: 1, createdAt: -1, _id: -1 },
};

// Reviews of the given games for the developer view (PBI-32, PBI-33). Only reviews
// with a rating or text that have not been removed are included. The caller is
// responsible for validating user input and for passing only games the developer
// may see; this function checks types and ranges as a last line of defense.
//
// Dates: `from` is inclusive and `to` is exclusive, both compared with createdAt.
async function findDeveloperReviews({
  gameIds, minRating, maxRating, from, to, hasText, sort = 'newest', page = 1, limit = 20,
} = {}) {
  if (!Array.isArray(gameIds) || !gameIds.every(id => mongoose.isObjectIdOrHexString(id))) {
    throw new TypeError('gameIds must be a list of game ids.');
  }
  if (!Object.hasOwn(SORTS, sort)) throw new RangeError(`Sort must be one of: ${Object.keys(SORTS).join(', ')}.`);
  for (const rating of [minRating, maxRating]) {
    if (rating !== undefined && !(Number.isInteger(rating) && rating >= 1 && rating <= 5)) {
      throw new RangeError('Ratings must be whole numbers from 1 to 5.');
    }
  }
  for (const date of [from, to]) {
    if (date !== undefined && !(date instanceof Date && !Number.isNaN(date.getTime()))) {
      throw new TypeError('Dates must be valid Date objects.');
    }
  }
  if (hasText !== undefined && typeof hasText !== 'boolean') throw new TypeError('hasText must be a boolean.');
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new RangeError('Use a positive page and a limit from 1 to 50.');
  }
  const skip = (page - 1) * limit;
  if (!Number.isSafeInteger(skip)) throw new RangeError('Page is too large.');

  const filter = {
    game: { $in: gameIds.map(id => new mongoose.Types.ObjectId(String(id))) },
    removedAt: null,
    $or: [{ rating: { $ne: null } }, { text: { $gt: '' } }],
  };
  if (minRating !== undefined || maxRating !== undefined) {
    filter.rating = { $ne: null };
    if (minRating !== undefined) filter.rating.$gte = minRating;
    if (maxRating !== undefined) filter.rating.$lte = maxRating;
  }
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = from;
    if (to) filter.createdAt.$lt = to;
  }
  if (hasText === true) filter.text = { $gt: '' };
  if (hasText === false) filter.text = { $in: ['', null] };

  if (!gameIds.length) return { reviews: [], total: 0, page, pages: 0 };
  const [reviews, total] = await Promise.all([
    Review.aggregate([
      { $match: filter },
      { $addFields: { rated: { $gt: ['$rating', null] } } },
      { $sort: SORTS[sort] },
      { $skip: skip },
      { $limit: limit },
      { $project: { rated: 0 } },
    ]),
    Review.countDocuments(filter),
  ]);
  return { reviews, total, page, pages: Math.ceil(total / limit) };
}

module.exports = { findDeveloperReviews, REVIEW_SORTS: Object.keys(SORTS) };

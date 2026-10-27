const mongoose = require('mongoose');
const Game = require('./models/Game');

// Unrated games (ratingCount 0) sort after rated ones for the rating sorts, so
// "lowest" doesn't open with every game nobody has rated yet.
const SORTS = {
  title: { title: 1, _id: 1 },
  top: { rated: -1, ratingAvg: -1, ratingCount: -1, title: 1, _id: 1 },
  lowest: { rated: -1, ratingAvg: 1, ratingCount: -1, title: 1, _id: 1 },
  popular: { ratingCount: -1, ratingAvg: -1, title: 1, _id: 1 },
  newest: { releaseDate: -1, title: 1, _id: 1 },
};

async function findGames({ search = '', genre = '', platform = '', sort = 'title', page = 1, limit = 20 } = {}) {
  if ([search, genre, platform, sort].some(value => typeof value !== 'string')) {
    throw new TypeError('Game filters must be text.');
  }
  if (!Object.hasOwn(SORTS, sort)) throw new RangeError(`Sort must be one of: ${Object.keys(SORTS).join(', ')}.`);
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new RangeError('Use a positive page and a limit from 1 to 50.');
  }
  const skip = (page - 1) * limit;
  if (!Number.isSafeInteger(skip)) throw new RangeError('Page is too large.');

  const filter = {};
  if (search.trim()) {
    filter.title = { $regex: search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  }
  if (genre.trim()) filter.genres = genre.trim();
  if (platform.trim()) filter.platforms = platform.trim();

  const [games, total] = await Promise.all([
    Game.aggregate([
      { $match: filter },
      { $addFields: { rated: { $gt: ['$ratingCount', 0] } } },
      { $sort: SORTS[sort] },
      { $skip: skip },
      { $limit: limit },
      { $project: { rated: 0 } },
    ]),
    Game.countDocuments(filter),
  ]);
  return { games, total, page, pages: Math.ceil(total / limit) };
}

// Highest-rated games with at least `minCount` ratings (PBI-12, PBI-13).
async function topGames({ minCount = 3, limit = 10 } = {}) {
  if (!Number.isInteger(minCount) || minCount < 1) throw new RangeError('minCount must be a positive whole number.');
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new RangeError('Use a limit from 1 to 50.');
  return Game.find({ ratingCount: { $gte: minCount } })
    .sort({ ratingAvg: -1, ratingCount: -1, title: 1, _id: 1 })
    .limit(limit)
    .lean();
}

async function getGameById(id) {
  if (!mongoose.isObjectIdOrHexString(id)) return null;
  return Game.findById(id).lean();
}

async function getGameFilters() {
  const [genres, platforms] = await Promise.all([
    Game.distinct('genres'), Game.distinct('platforms'),
  ]);
  return { genres: genres.sort(), platforms: platforms.sort() };
}

module.exports = { findGames, topGames, getGameById, getGameFilters, SORTS: Object.keys(SORTS) };

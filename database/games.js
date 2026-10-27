const mongoose = require('mongoose');
const Game = require('./models/Game');

async function findGames({ search = '', genre = '', platform = '', page = 1, limit = 20 } = {}) {
  if ([search, genre, platform].some(value => typeof value !== 'string')) {
    throw new TypeError('Game filters must be text.');
  }
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
    Game.find(filter).sort({ title: 1, _id: 1 }).skip(skip).limit(limit).lean(),
    Game.countDocuments(filter),
  ]);
  return { games, total, page, pages: Math.ceil(total / limit) };
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

module.exports = { findGames, getGameById, getGameFilters };

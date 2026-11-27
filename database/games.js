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

const STEAM_APP_ID = /^[1-9]\d*$/;

function normalizeSteamAppId(value) {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? String(value) : null;
  if (typeof value !== 'string') return null;
  const id = value.trim();
  return STEAM_APP_ID.test(id) ? id : null;
}

/**
 * Match Steam app IDs to local games in one query (PBI-25).
 *
 * @param {Array<number|string>} appIds Steam app IDs as numbers or numeric strings.
 *   Values are trimmed, coerced to strings and deduped; anything that isn't a
 *   positive whole number (empty strings, objects, "0", "12a", 1.5) is ignored.
 * @returns {Promise<Map<string, object>>} Each matched app ID (as a string) mapped
 *   to a lean Game document. App IDs with no game are left out. If several games
 *   list the same app ID, the one with the most ratings wins, ties broken by the
 *   oldest `_id`, so the result is stable. Empty input returns an empty Map
 *   without querying.
 */
async function findGamesBySteamAppIds(appIds) {
  if (!Array.isArray(appIds)) throw new TypeError('appIds must be an array.');
  const ids = [...new Set(appIds.map(normalizeSteamAppId).filter(Boolean))];
  const matches = new Map();
  if (ids.length === 0) return matches;

  const games = await Game.find({ steamAppIds: { $in: ids } })
    .sort({ ratingCount: -1, _id: 1 })
    .lean();
  const wanted = new Set(ids);
  for (const game of games) {
    for (const appId of game.steamAppIds) {
      if (wanted.has(appId) && !matches.has(appId)) matches.set(appId, game);
    }
  }
  return matches;
}

// IGDB platform names (as stored by server/src/igdbImport.js) that count as PC for Steam coverage.
const PC_PLATFORMS = ['PC (Microsoft Windows)'];

/**
 * Count how much of the catalog carries Steam app IDs (PBI-25, #47).
 *
 * @param {object} [options]
 * @param {string[]} [options.pcPlatforms] Platform names that count as PC.
 * @param {number} [options.sampleSize] How many PC titles missing a Steam ID to return (0 to 50).
 * @returns {Promise<{total: number, withSteam: number, pc: {total: number, missing: number,
 *   missingSample: string[]}}>} Counts only; the collection is never loaded whole.
 */
async function computeSteamCoverage({ pcPlatforms = PC_PLATFORMS, sampleSize = 10 } = {}) {
  if (!Array.isArray(pcPlatforms) || pcPlatforms.some(name => typeof name !== 'string')) {
    throw new TypeError('pcPlatforms must be an array of platform names.');
  }
  if (!Number.isInteger(sampleSize) || sampleSize < 0 || sampleSize > 50) {
    throw new RangeError('sampleSize must be a whole number from 0 to 50.');
  }
  const hasSteam = { 'steamAppIds.0': { $exists: true } };
  const isPc = { platforms: { $in: pcPlatforms } };
  const pcMissing = { ...isPc, 'steamAppIds.0': { $exists: false } };

  const [total, withSteam, pcTotal, missing, sample] = await Promise.all([
    Game.countDocuments({}),
    Game.countDocuments(hasSteam),
    Game.countDocuments(isPc),
    Game.countDocuments(pcMissing),
    sampleSize === 0 ? [] : Game.find(pcMissing, { title: 1 }).sort({ title: 1, _id: 1 }).limit(sampleSize).lean(),
  ]);
  return { total, withSteam, pc: { total: pcTotal, missing, missingSample: sample.map(game => game.title) } };
}

module.exports = {
  findGames, topGames, getGameById, getGameFilters, findGamesBySteamAppIds, computeSteamCoverage,
  PC_PLATFORMS, SORTS: Object.keys(SORTS),
};

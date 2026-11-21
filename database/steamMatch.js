const mongoose = require('mongoose');
const Game = require('./models/Game');
const SteamLibrary = require('./models/SteamLibrary');
const { findGamesBySteamAppIds, normalizeSteamAppId } = require('./games');

// Steam-to-catalog matcher (PBI-25). Steam code stays isolated here so it can
// never block the MVP: nothing outside Steam features requires this module.

/**
 * Edition suffixes stripped by normalizeTitle(), longest first. Only purely
 * cosmetic store packaging is listed: these name the same game plus DLC or
 * extras, never a different game. Deliberately NOT stripped, because the
 * catalog (IGDB) usually keeps them as separate games: Definitive, Remastered,
 * Remake, Enhanced, Special, Anniversary, Director's Cut, HD, Redux.
 */
const EDITION_SUFFIXES = [
  'digital deluxe edition',
  'game of the year edition',
  'game of the year',
  'complete edition',
  'deluxe edition',
  'digital edition',
  'standard edition',
  'goty edition',
  'gold edition',
  'goty',
];

/**
 * Normalize a game title for comparison. Pure.
 *
 * Steps: strip ™ ® © ℠, strip diacritics (NFKD), lowercase, turn every run of
 * non-letters/digits (punctuation, apostrophes, dashes, colons, underscores) into
 * one space, trim, then (unless `stripEdition` is false) repeatedly drop a
 * trailing suffix from EDITION_SUFFIXES as long as something is left.
 *
 * @example normalizeTitle('Marvel’s Spider-Man™: GOTY Edition') // 'marvel s spider man'
 * @param {string} title
 * @param {{ stripEdition?: boolean }} [options]
 * @returns {string} The normalized title, or '' for non-strings.
 */
function normalizeTitle(title, { stripEdition = true } = {}) {
  if (typeof title !== 'string') return '';
  let text = title
    .replace(/[™®©℠]/g, ' ')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  if (!stripEdition) return text;
  let stripped = true;
  while (stripped) {
    stripped = false;
    for (const suffix of EDITION_SUFFIXES) {
      if (text.endsWith(` ${suffix}`)) {
        text = text.slice(0, -suffix.length - 1).trimEnd();
        stripped = true;
        break;
      }
    }
  }
  return text;
}

const escapeRegex = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PREFIX_TOKENS = 2;

// A case-insensitive anchored regex matching raw catalog titles that start with
// the first (up to) two tokens of an edition-stripped normalized title, allowing
// any punctuation/symbols around and between them (e.g. "Marvel's", "Portal™ 2").
// It only narrows the candidate set; the exact comparison happens in JS.
function prefixRegex(baseTitle) {
  const tokens = baseTitle.split(' ').slice(0, PREFIX_TOKENS).map(escapeRegex);
  return new RegExp(`^[\\W_]*${tokens.join('[\\W_]+')}`, 'i');
}

// Candidates whose `keyName` equals `key`, or null when none do.
function pick(candidates, keyName, key) {
  const hits = candidates.filter(candidate => candidate[keyName] === key);
  return hits.length ? hits : null;
}

/**
 * Match a user's owned Steam games to catalog games, in at most two batched
 * Game queries regardless of library size.
 *
 * Pass 1 matches on `Game.steamAppIds` via findGamesBySteamAppIds() (one `$in`
 * query on the multikey index). Pass 2 runs only for the leftovers and matches on
 * normalized title, auto-matching only when exactly one catalog game fits.
 *
 * Title fallback approach: ONE `Game.find({ title: { $in: [regex...] } })` with a
 * case-insensitive, anchored regex per distinct leftover title, built from the
 * escaped first two tokens of its normalized title (see prefixRegex). The
 * returned candidates (only `_id` and `title`) are normalized in JS and compared
 * exactly, first on the full normalized title, then on the edition-stripped one,
 * so "X GOTY Edition" matches catalog "X" but prefers a catalog "X GOTY Edition"
 * if one exists. Chosen over the `title` text index (`$text`) because `$text`
 * ORs every word of every leftover title (stemming, stop words) and would pull in
 * most of the catalog for common words, and over a new normalized-title field
 * because the regex prefilter needs no schema change or backfill. Known limit:
 * titles that differ only by diacritics between Steam and the catalog
 * ("Pokemon" vs "Pokémon") fail the prefilter and end up unmatched, which is the
 * safe failure.
 *
 * @param {Array<{ appId: number|string, name?: string }>} ownedGames Normalized
 *   Steam GetOwnedGames entries. Entries with an invalid appId are ignored;
 *   duplicate appIds keep the first entry.
 * @returns {Promise<{
 *   matched: Array<{ appId: string, gameId: import('mongoose').Types.ObjectId, method: 'appId'|'title' }>,
 *   ambiguous: Array<{ appId: string, candidates: import('mongoose').Types.ObjectId[] }>,
 *   unmatched: string[],
 * }>} Each valid appId appears in exactly one list, in input order.
 */
async function matchSteamGames(ownedGames) {
  if (!Array.isArray(ownedGames)) throw new TypeError('ownedGames must be an array.');

  const owned = new Map();
  for (const entry of ownedGames) {
    const appId = normalizeSteamAppId(entry?.appId);
    if (appId && !owned.has(appId)) owned.set(appId, typeof entry.name === 'string' ? entry.name : '');
  }
  const result = { matched: [], ambiguous: [], unmatched: [] };
  if (owned.size === 0) return result;

  const byAppId = await findGamesBySteamAppIds([...owned.keys()]);

  const leftovers = [];
  for (const [appId, name] of owned) {
    if (!byAppId.has(appId)) {
      leftovers.push({ appId, full: normalizeTitle(name, { stripEdition: false }), base: normalizeTitle(name) });
    }
  }
  const regexes = new Map();
  for (const { base } of leftovers) {
    if (base && !regexes.has(base)) regexes.set(base, prefixRegex(base));
  }
  const candidates = regexes.size === 0 ? [] : (await Game.find({ title: { $in: [...regexes.values()] } })
    .select({ _id: 1, title: 1 })
    .sort({ _id: 1 })
    .lean())
    .map(game => ({
      _id: game._id,
      full: normalizeTitle(game.title, { stripEdition: false }),
      base: normalizeTitle(game.title),
    }));

  const titleMatches = new Map();
  for (const { appId, full, base } of leftovers) {
    titleMatches.set(appId, base ? pick(candidates, 'full', full) ?? pick(candidates, 'base', base) : null);
  }

  for (const appId of owned.keys()) {
    const game = byAppId.get(appId);
    if (game) {
      result.matched.push({ appId, gameId: game._id, method: 'appId' });
      continue;
    }
    const hits = titleMatches.get(appId);
    if (!hits) result.unmatched.push(appId);
    else if (hits.length === 1) result.matched.push({ appId, gameId: hits[0]._id, method: 'title' });
    else result.ambiguous.push({ appId, candidates: hits.map(hit => hit._id) });
  }
  return result;
}

/**
 * Persist a matchSteamGames() result onto the user's SteamLibrary entries in one
 * bulkWrite: matched entries get their gameId, ambiguous and unmatched entries
 * get null (clearing any stale match). Only updates existing entries, never
 * creates them. Idempotent: re-applying the same result modifies nothing.
 *
 * @param {import('mongoose').Types.ObjectId|string} userId
 * @param {{ matched?: Array<{ appId: string, gameId: * }>, ambiguous?: Array<{ appId: string }>, unmatched?: string[] }} result
 * @returns {Promise<{ matchedCount: number, modifiedCount: number }>}
 */
async function applySteamMatches(userId, result) {
  if (!mongoose.isObjectIdOrHexString(userId)) throw new TypeError('userId must be an ObjectId.');
  const user = new mongoose.Types.ObjectId(String(userId));
  const gameIds = new Map();
  for (const appId of result?.unmatched ?? []) gameIds.set(normalizeSteamAppId(appId), null);
  for (const { appId } of result?.ambiguous ?? []) gameIds.set(normalizeSteamAppId(appId), null);
  for (const { appId, gameId } of result?.matched ?? []) {
    if (!mongoose.isObjectIdOrHexString(gameId)) throw new TypeError('Each matched gameId must be an ObjectId.');
    gameIds.set(normalizeSteamAppId(appId), new mongoose.Types.ObjectId(String(gameId)));
  }
  gameIds.delete(null);
  if (gameIds.size === 0) return { matchedCount: 0, modifiedCount: 0 };

  const ops = [...gameIds].map(([appId, gameId]) => ({
    updateOne: { filter: { user, appId }, update: { $set: { gameId } } },
  }));
  const { matchedCount, modifiedCount } = await SteamLibrary.bulkWrite(ops, { ordered: false });
  return { matchedCount, modifiedCount };
}

/**
 * Re-match a user's whole cached Steam library and store the results: one
 * SteamLibrary read, at most two Game queries, one bulkWrite. Call after each
 * library sync so games added to the catalog since the last sync get matched.
 *
 * @param {import('mongoose').Types.ObjectId|string} userId
 * @returns {Promise<object>} The matchSteamGames() result that was stored.
 */
async function matchSteamLibrary(userId) {
  if (!mongoose.isObjectIdOrHexString(userId)) throw new TypeError('userId must be an ObjectId.');
  const entries = await SteamLibrary.find({ user: userId }).select({ appId: 1, name: 1 }).lean();
  const result = await matchSteamGames(entries);
  await applySteamMatches(userId, result);
  return result;
}

module.exports = { matchSteamGames, applySteamMatches, matchSteamLibrary, normalizeTitle, EDITION_SUFFIXES };

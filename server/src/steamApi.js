// Thin client for the Steam Web API. Routes (#44/#45) build it with
// `createSteamApi({ apiKey: config.steam.apiKey })`; the key is non-enumerable
// on config.steam, so pass it explicitly rather than spreading the config.
//
// The key travels only as the `key` query parameter. Errors carry the endpoint
// name (never the URL), and any text that came from fetch is scrubbed of the key.
//
// How Steam reports failures (observed responses; Steam does not document them):
// - Bad, revoked or missing key: 401 or 403 with an HTML "Forbidden ... verify
//   your key= parameter" page. Mapped to STEAM_BAD_KEY.
// - GetOwnedGames on a private profile (or private game details): 200 with
//   `{ "response": {} }`, no game_count. Mapped to STEAM_PROFILE_PRIVATE.
//   A public profile with no games returns `{ "response": { "game_count": 0 } }`.
// - GetPlayerAchievements on a private profile: 403 with JSON
//   `{ "playerstats": { "error": "Profile is not public", "success": false } }`.
//   The JSON body is what tells it apart from a bad key. STEAM_PROFILE_PRIVATE.
// - GetPlayerAchievements for an app without stats: 400 with
//   `{ "playerstats": { "error": "Requested app has no stats", "success": false } }`.
//   Mapped to STEAM_NO_DATA, as is a success response with no achievements list.
// - GetSchemaForGame for an app without achievements: 200 with `{ "game": {} }`
//   or a game without availableGameStats.achievements. STEAM_NO_DATA.
// - Throttling: 429 (Steam's documented limit is 100,000 calls per day per key).
//   STEAM_RATE_LIMITED, with retryAfterSeconds when Retry-After is sent.
// - Timeouts, network errors, 5xx, non-JSON 200s and any other 4xx:
//   STEAM_UNAVAILABLE. An unexpected 4xx is most likely a bad request on our
//   side, but callers can only treat it as "Steam did not answer usefully".

const API_URL = 'https://api.steampowered.com';
const ICON_URL = 'https://media.steampowered.com/steamcommunity/public/images/apps';
const DEFAULT_TIMEOUT_MS = 5000;
// GetPlayerSummaries accepts at most 100 comma-separated IDs per call.
const MAX_SUMMARY_IDS = 100;

// `status` is the HTTP status a route should answer with.
const ERROR_STATUS = {
  STEAM_PROFILE_PRIVATE: 403,
  STEAM_NO_DATA: 404,
  STEAM_RATE_LIMITED: 429,
  STEAM_UNAVAILABLE: 503,
  STEAM_BAD_KEY: 503,
};

class SteamApiError extends Error {
  /**
   * @param {keyof ERROR_STATUS} code
   * @param {string} message safe to show; never contains the key
   * @param {{ endpoint?: string, upstreamStatus?: number, retryAfterSeconds?: number, cause?: Error }} [details]
   */
  constructor(code, message, { endpoint, upstreamStatus, retryAfterSeconds, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'SteamApiError';
    this.code = code;
    this.status = ERROR_STATUS[code];
    if (endpoint) this.endpoint = endpoint;
    if (upstreamStatus !== undefined) this.upstreamStatus = upstreamStatus;
    if (retryAfterSeconds !== undefined) this.retryAfterSeconds = retryAfterSeconds;
  }
}

const STEAM_ID = /^\d{17}$/;
const APP_ID = /^\d{1,10}$/;

function steamIdParam(value) {
  const id = String(value ?? '');
  if (!STEAM_ID.test(id)) throw new TypeError('steamId must be a 17-digit SteamID64.');
  return id;
}

function appIdParam(value) {
  const id = String(value ?? '');
  if (!APP_ID.test(id)) throw new TypeError('appId must be a numeric Steam app ID.');
  return id;
}

const fromUnixSeconds = seconds => (Number(seconds) > 0 ? new Date(Number(seconds) * 1000) : null);

/**
 * @typedef {object} OwnedGame
 * @property {string} appId Steam app ID as a string, matching Game.steamAppIds
 * @property {string} name
 * @property {number} playtimeMinutes total playtime (playtime_forever)
 * @property {Date|null} lastPlayedAt null when Steam reports 0 or nothing
 * @property {string} iconUrl '' when Steam has no icon
 *
 * @typedef {object} PlayerAchievements
 * @property {string} appId
 * @property {string} gameName
 * @property {{ apiName: string, unlockedAt: Date|null }[]} unlocked only achieved ones
 * @property {number} total every achievement the game has
 *
 * @typedef {object} AchievementSchema
 * @property {string} appId
 * @property {string} gameName
 * @property {{ apiName: string, displayName: string, description: string, hidden: boolean,
 *   iconUrl: string, iconGrayUrl: string }[]} achievements
 *
 * @typedef {object} PlayerSummary
 * @property {string} steamId
 * @property {string} personaName
 * @property {string} avatarUrl the full-size avatar
 * @property {string} profileUrl
 * @property {'public'|'private'} visibility Steam reports 3 for public and 1 for
 *   anything the key cannot see (private, friends only); only 3 counts as public
 */

/**
 * @param {{ apiKey: string, fetch?: typeof globalThis.fetch, timeoutMs?: number }} options
 */
function createSteamApi({ apiKey, fetch = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (typeof apiKey !== 'string' || apiKey.trim() === '') throw new TypeError('createSteamApi needs a Steam API key.');
  const key = apiKey.trim();

  const scrub = text => String(text).split(key).join('[redacted]').split(encodeURIComponent(key)).join('[redacted]');

  async function call(endpoint, params) {
    const url = `${API_URL}/${endpoint}/?${new URLSearchParams({ ...params, key, format: 'json' })}`;
    const fail = (code, message, details = {}) => new SteamApiError(code, message, { endpoint, ...details });

    let response;
    let text;
    try {
      response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
      text = await response.text();
    } catch (error) {
      const timedOut = error && (error.name === 'TimeoutError' || error.name === 'AbortError');
      // Rebuild the cause so nothing fetch attached (URLs, nested causes) leaks the key.
      const cause = new Error(scrub(error && error.message ? error.message : error));
      cause.name = error && error.name ? error.name : 'Error';
      throw fail('STEAM_UNAVAILABLE',
        timedOut ? `Steam ${endpoint} timed out after ${timeoutMs} ms.` : `Steam ${endpoint} could not be reached.`, { cause });
    }

    let body;
    try { body = JSON.parse(text); } catch { body = undefined; }
    const upstreamStatus = response.status;
    const steamError = body && body.playerstats && body.playerstats.success === false ? String(body.playerstats.error || '') : '';

    if (/not public/i.test(steamError)) {
      throw fail('STEAM_PROFILE_PRIVATE', 'This Steam profile is not public.', { upstreamStatus });
    }
    if (/no stats/i.test(steamError)) {
      throw fail('STEAM_NO_DATA', 'This game has no Steam achievements.', { upstreamStatus });
    }
    if (upstreamStatus === 401 || upstreamStatus === 403) {
      throw fail('STEAM_BAD_KEY', `Steam rejected the API key on ${endpoint}.`, { upstreamStatus });
    }
    if (upstreamStatus === 429) {
      const retryAfter = Number(response.headers.get('retry-after'));
      throw fail('STEAM_RATE_LIMITED', 'Steam is rate limiting requests.', {
        upstreamStatus, ...(retryAfter > 0 ? { retryAfterSeconds: retryAfter } : {}),
      });
    }
    if (!response.ok) {
      throw fail('STEAM_UNAVAILABLE', `Steam ${endpoint} failed with status ${upstreamStatus}.`, { upstreamStatus });
    }
    if (body === undefined || body === null || typeof body !== 'object') {
      throw fail('STEAM_UNAVAILABLE', `Steam ${endpoint} returned a response that is not JSON.`, { upstreamStatus });
    }
    return { body, fail };
  }

  /**
   * Games the player owns, including played free games, with app info.
   * @param {string} steamId SteamID64
   * @returns {Promise<OwnedGame[]>}
   */
  async function getOwnedGames(steamId) {
    const { body, fail } = await call('IPlayerService/GetOwnedGames/v1', {
      steamid: steamIdParam(steamId), include_appinfo: '1', include_played_free_games: '1',
    });
    const data = body.response;
    if (!data || data.game_count === undefined) throw fail('STEAM_PROFILE_PRIVATE', 'This Steam profile\'s game details are not public.');
    return (Array.isArray(data.games) ? data.games : []).map(game => ({
      appId: String(game.appid),
      name: typeof game.name === 'string' ? game.name : '',
      playtimeMinutes: Number(game.playtime_forever) || 0,
      lastPlayedAt: fromUnixSeconds(game.rtime_last_played),
      iconUrl: game.img_icon_url ? `${ICON_URL}/${game.appid}/${game.img_icon_url}.jpg` : '',
    }));
  }

  /**
   * The player's achievement progress for one game.
   * @param {string} steamId SteamID64
   * @param {string|number} appId
   * @returns {Promise<PlayerAchievements>}
   */
  async function getPlayerAchievements(steamId, appId) {
    const id = appIdParam(appId);
    const { body, fail } = await call('ISteamUserStats/GetPlayerAchievements/v1', { steamid: steamIdParam(steamId), appid: id });
    const stats = body.playerstats;
    if (!stats || !Array.isArray(stats.achievements) || stats.achievements.length === 0) {
      throw fail('STEAM_NO_DATA', 'This game has no Steam achievements.');
    }
    return {
      appId: id,
      gameName: typeof stats.gameName === 'string' ? stats.gameName : '',
      unlocked: stats.achievements
        .filter(achievement => Number(achievement.achieved) === 1)
        .map(achievement => ({ apiName: String(achievement.apiname), unlockedAt: fromUnixSeconds(achievement.unlocktime) })),
      total: stats.achievements.length,
    };
  }

  /**
   * Achievement display names, descriptions and icons for one game (English).
   * @param {string|number} appId
   * @returns {Promise<AchievementSchema>}
   */
  async function getSchemaForGame(appId) {
    const id = appIdParam(appId);
    const { body, fail } = await call('ISteamUserStats/GetSchemaForGame/v2', { appid: id, l: 'english' });
    const game = body.game || {};
    const list = game.availableGameStats && game.availableGameStats.achievements;
    if (!Array.isArray(list) || list.length === 0) throw fail('STEAM_NO_DATA', 'This game has no Steam achievements.');
    return {
      appId: id,
      gameName: typeof game.gameName === 'string' ? game.gameName : '',
      achievements: list.map(achievement => ({
        apiName: String(achievement.name),
        displayName: achievement.displayName || String(achievement.name),
        description: achievement.description || '',
        hidden: Number(achievement.hidden) === 1,
        iconUrl: achievement.icon || '',
        iconGrayUrl: achievement.icongray || '',
      })),
    };
  }

  /**
   * Public profile data for up to 100 players. IDs Steam does not know are
   * simply missing from the result.
   * @param {string|string[]} steamIds
   * @returns {Promise<PlayerSummary[]>}
   */
  async function getPlayerSummaries(steamIds) {
    const ids = (Array.isArray(steamIds) ? steamIds : [steamIds]).map(steamIdParam);
    if (ids.length === 0 || ids.length > MAX_SUMMARY_IDS) throw new TypeError(`Pass 1 to ${MAX_SUMMARY_IDS} Steam IDs.`);
    const { body } = await call('ISteamUser/GetPlayerSummaries/v2', { steamids: ids.join(',') });
    const players = body.response && Array.isArray(body.response.players) ? body.response.players : [];
    return players.map(player => ({
      steamId: String(player.steamid),
      personaName: player.personaname || '',
      avatarUrl: player.avatarfull || player.avatarmedium || player.avatar || '',
      profileUrl: player.profileurl || '',
      visibility: Number(player.communityvisibilitystate) === 3 ? 'public' : 'private',
    }));
  }

  return { getOwnedGames, getPlayerAchievements, getSchemaForGame, getPlayerSummaries };
}

module.exports = { createSteamApi, SteamApiError };

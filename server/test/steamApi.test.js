const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readConfig } = require('../src/config');
const { createSteamApi, SteamApiError } = require('../src/steamApi');
const ownedGames = require('./fixtures/steam-owned-games.json');
const ownedGamesPrivate = require('./fixtures/steam-owned-games-private.json');
const ownedGamesEmpty = require('./fixtures/steam-owned-games-empty.json');
const achievements = require('./fixtures/steam-player-achievements.json');
const achievementsPrivate = require('./fixtures/steam-player-achievements-private.json');
const achievementsNoStats = require('./fixtures/steam-player-achievements-no-stats.json');
const schema = require('./fixtures/steam-schema.json');
const schemaEmpty = require('./fixtures/steam-schema-empty.json');
const summaries = require('./fixtures/steam-player-summaries.json');

const KEY = 'ABCDEF0123456789ABCDEF0123456789';
const STEAM_ID = '76561197960435530';
// What Steam sends for a bad key: an HTML page, not JSON.
const FORBIDDEN_HTML = '<html><head><title>Forbidden</title></head><body><h1>Forbidden</h1>'
  + 'Access is denied. Retrying will not help. Please verify your <pre>key=</pre> parameter.</body></html>';

// Fake fetch answering from a queue: { status, body } (JSON), { status, text }, or { throws }.
function fakeSteam(responses = []) {
  const calls = [];
  const fetch = async (url, options) => {
    calls.push({ url: new URL(url), options });
    const next = responses.shift() ?? { status: 200, body: {} };
    if (next.throws) throw next.throws;
    if (next.text !== undefined) return new Response(next.text, { status: next.status ?? 200, headers: next.headers });
    return Response.json(next.body, { status: next.status ?? 200, headers: next.headers });
  };
  return { fetch, calls };
}

const client = (steam, options = {}) => createSteamApi({ apiKey: KEY, fetch: steam.fetch, ...options });

async function rejectsWith(promise, code, status) {
  await assert.rejects(promise, error => {
    assert.ok(error instanceof SteamApiError, `expected SteamApiError, got ${error}`);
    assert.equal(error.code, code);
    assert.equal(error.status, status);
    return true;
  });
}

test('getOwnedGames sends the key and flags as query params and normalizes games', async () => {
  const steam = fakeSteam([{ body: ownedGames }]);
  const games = await client(steam).getOwnedGames(STEAM_ID);

  const [{ url, options }] = steam.calls;
  assert.equal(url.origin + url.pathname, 'https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/');
  assert.equal(url.searchParams.get('key'), KEY);
  assert.equal(url.searchParams.get('steamid'), STEAM_ID);
  assert.equal(url.searchParams.get('include_appinfo'), '1');
  assert.equal(url.searchParams.get('include_played_free_games'), '1');
  assert.ok(options.signal instanceof AbortSignal);
  assert.equal(options.headers.Authorization, undefined);

  assert.deepEqual(games, [
    {
      appId: '1145360', name: 'Hades', playtimeMinutes: 3125, lastPlayedAt: new Date(1700000000 * 1000),
      iconUrl: 'https://media.steampowered.com/steamcommunity/public/images/apps/1145360/5ad4ffde7a5d0c1a0c2c8b6f4f8b2b6e8d3d2a91.jpg',
    },
    {
      appId: '367520', name: 'Hollow Knight', playtimeMinutes: 1250, lastPlayedAt: new Date(1710000000 * 1000),
      iconUrl: 'https://media.steampowered.com/steamcommunity/public/images/apps/367520/4d2b5c0e4b1f3c6f0d6f7c0b3d6a2b9e1d5f3c2a.jpg',
    },
    { appId: '440', name: 'Team Fortress 2', playtimeMinutes: 0, lastPlayedAt: null, iconUrl: '' },
  ]);
});

test('getOwnedGames returns [] for a public library with no games', async () => {
  assert.deepEqual(await client(fakeSteam([{ body: ownedGamesEmpty }])).getOwnedGames(STEAM_ID), []);
});

test('getOwnedGames reports a private profile when Steam omits game_count', async () => {
  await rejectsWith(client(fakeSteam([{ body: ownedGamesPrivate }])).getOwnedGames(STEAM_ID), 'STEAM_PROFILE_PRIVATE', 403);
});

test('getPlayerAchievements returns unlocked achievements and the total', async () => {
  const steam = fakeSteam([{ body: achievements }]);
  const result = await client(steam).getPlayerAchievements(STEAM_ID, 1145360);

  const [{ url }] = steam.calls;
  assert.equal(url.pathname, '/ISteamUserStats/GetPlayerAchievements/v1/');
  assert.equal(url.searchParams.get('appid'), '1145360');
  assert.equal(url.searchParams.get('steamid'), STEAM_ID);
  assert.deepEqual(result, {
    appId: '1145360',
    gameName: 'Hades',
    unlocked: [
      { apiName: 'AchBeatHades', unlockedAt: new Date(1600400000 * 1000) },
      { apiName: 'AchMirror', unlockedAt: new Date(1600500000 * 1000) },
    ],
    total: 3,
  });
});

test('getPlayerAchievements maps "Profile is not public" (403 JSON) to STEAM_PROFILE_PRIVATE, not a bad key', async () => {
  await rejectsWith(client(fakeSteam([{ status: 403, body: achievementsPrivate }])).getPlayerAchievements(STEAM_ID, '1145360'),
    'STEAM_PROFILE_PRIVATE', 403);
  // Steam has also been seen answering success:false with a 200.
  await rejectsWith(client(fakeSteam([{ body: achievementsPrivate }])).getPlayerAchievements(STEAM_ID, '1145360'),
    'STEAM_PROFILE_PRIVATE', 403);
});

test('getPlayerAchievements maps "Requested app has no stats" and an empty list to STEAM_NO_DATA', async () => {
  await rejectsWith(client(fakeSteam([{ status: 400, body: achievementsNoStats }])).getPlayerAchievements(STEAM_ID, '440'),
    'STEAM_NO_DATA', 404);
  const noList = { playerstats: { steamID: STEAM_ID, gameName: 'Tiny Game', success: true } };
  await rejectsWith(client(fakeSteam([{ body: noList }])).getPlayerAchievements(STEAM_ID, '440'), 'STEAM_NO_DATA', 404);
});

test('getSchemaForGame returns English display names and icons', async () => {
  const steam = fakeSteam([{ body: schema }]);
  const result = await client(steam).getSchemaForGame('1145360');

  const [{ url }] = steam.calls;
  assert.equal(url.pathname, '/ISteamUserStats/GetSchemaForGame/v2/');
  assert.equal(url.searchParams.get('appid'), '1145360');
  assert.equal(url.searchParams.get('l'), 'english');
  assert.deepEqual(result, {
    appId: '1145360',
    gameName: 'Hades',
    achievements: [
      {
        apiName: 'AchBeatHades', displayName: 'Is There No Escape?', description: 'Clear an escape attempt.', hidden: false,
        iconUrl: 'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/1145360/ach1.jpg',
        iconGrayUrl: 'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/1145360/ach1_gray.jpg',
      },
      {
        apiName: 'AchFishing', displayName: 'Catch of the Day', description: '', hidden: true,
        iconUrl: 'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/1145360/ach2.jpg',
        iconGrayUrl: 'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/1145360/ach2_gray.jpg',
      },
    ],
  });
});

test('getSchemaForGame maps a game without achievements to STEAM_NO_DATA', async () => {
  await rejectsWith(client(fakeSteam([{ body: schemaEmpty }])).getSchemaForGame('440'), 'STEAM_NO_DATA', 404);
  const statsOnly = { game: { gameName: 'Stats Only', gameVersion: '1', availableGameStats: { stats: [] } } };
  await rejectsWith(client(fakeSteam([{ body: statsOnly }])).getSchemaForGame('440'), 'STEAM_NO_DATA', 404);
});

test('getPlayerSummaries joins IDs and normalizes players and visibility', async () => {
  const steam = fakeSteam([{ body: summaries }]);
  const players = await client(steam).getPlayerSummaries([STEAM_ID, '76561198000000001']);

  const [{ url }] = steam.calls;
  assert.equal(url.pathname, '/ISteamUser/GetPlayerSummaries/v2/');
  assert.equal(url.searchParams.get('steamids'), `${STEAM_ID},76561198000000001`);
  assert.deepEqual(players, [
    {
      steamId: STEAM_ID, personaName: 'Robin', avatarUrl: 'https://avatars.steamstatic.com/abc_full.jpg',
      profileUrl: 'https://steamcommunity.com/id/robinwalker/', visibility: 'public',
    },
    {
      steamId: '76561198000000001', personaName: 'Hidden Player', avatarUrl: 'https://avatars.steamstatic.com/def_full.jpg',
      profileUrl: 'https://steamcommunity.com/profiles/76561198000000001/', visibility: 'private',
    },
  ]);
});

test('getPlayerSummaries accepts a single ID and returns [] for unknown IDs', async () => {
  const steam = fakeSteam([{ body: { response: { players: [] } } }]);
  assert.deepEqual(await client(steam).getPlayerSummaries(STEAM_ID), []);
  assert.equal(steam.calls[0].url.searchParams.get('steamids'), STEAM_ID);
});

test('a bad key (401 or 403 HTML) maps to STEAM_BAD_KEY on every endpoint', async () => {
  for (const status of [401, 403]) {
    const steam = fakeSteam(Array.from({ length: 4 }, () => ({ status, text: FORBIDDEN_HTML })));
    const api = client(steam);
    await rejectsWith(api.getOwnedGames(STEAM_ID), 'STEAM_BAD_KEY', 503);
    await rejectsWith(api.getPlayerAchievements(STEAM_ID, '1'), 'STEAM_BAD_KEY', 503);
    await rejectsWith(api.getSchemaForGame('1'), 'STEAM_BAD_KEY', 503);
    await rejectsWith(api.getPlayerSummaries(STEAM_ID), 'STEAM_BAD_KEY', 503);
  }
});

test('429 maps to STEAM_RATE_LIMITED with Retry-After when given', async () => {
  const steam = fakeSteam([{ status: 429, text: 'Too Many Requests', headers: { 'Retry-After': '30' } }, { status: 429, text: '' }]);
  const api = client(steam);
  await assert.rejects(api.getOwnedGames(STEAM_ID), error => error.code === 'STEAM_RATE_LIMITED'
    && error.status === 429 && error.retryAfterSeconds === 30 && error.upstreamStatus === 429);
  await assert.rejects(api.getOwnedGames(STEAM_ID), error => error.code === 'STEAM_RATE_LIMITED' && !('retryAfterSeconds' in error));
});

test('5xx, other 4xx, non-JSON bodies and network errors map to STEAM_UNAVAILABLE', async () => {
  const steam = fakeSteam([
    { status: 500, text: 'Internal Server Error' },
    { status: 503, body: {} },
    { status: 400, text: '<html>Bad Request</html>' },
    { status: 200, text: '<html>maintenance</html>' },
    { throws: new TypeError('fetch failed') },
  ]);
  const api = client(steam);
  for (let i = 0; i < 4; i += 1) await rejectsWith(api.getOwnedGames(STEAM_ID), 'STEAM_UNAVAILABLE', 503);
  await assert.rejects(api.getOwnedGames(STEAM_ID), error => error.code === 'STEAM_UNAVAILABLE'
    && /could not be reached/.test(error.message) && error.cause.name === 'TypeError');
});

test('requests time out via AbortSignal.timeout and map to STEAM_UNAVAILABLE', async () => {
  // Never answers; rejects only when the signal fires, like real fetch.
  const fetch = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason));
  });
  const api = createSteamApi({ apiKey: KEY, fetch, timeoutMs: 20 });
  // AbortSignal.timeout's timer is unref'd; hold the event loop open until it fires.
  const keepAlive = setTimeout(() => {}, 5000);
  try {
    await assert.rejects(api.getOwnedGames(STEAM_ID), error => error.code === 'STEAM_UNAVAILABLE'
      && /timed out after 20 ms/.test(error.message) && error.cause.name === 'TimeoutError');
  } finally {
    clearTimeout(keepAlive);
  }
});

test('the default timeout is 5 seconds', async () => {
  const original = AbortSignal.timeout;
  const seen = [];
  AbortSignal.timeout = ms => { seen.push(ms); return original.call(AbortSignal, ms); };
  try {
    await client(fakeSteam([{ body: ownedGamesEmpty }])).getOwnedGames(STEAM_ID);
  } finally {
    AbortSignal.timeout = original;
  }
  assert.deepEqual(seen, [5000]);
});

test('the key never appears in errors, causes or returned data', async () => {
  const leakyNetworkError = new TypeError(`fetch failed for https://api.steampowered.com/?key=${KEY}`);
  leakyNetworkError.cause = new Error(`connect ECONNREFUSED key=${KEY}`);
  const steam = fakeSteam([
    { throws: leakyNetworkError },
    { status: 403, text: FORBIDDEN_HTML },
    { status: 429, text: '' },
    { status: 500, text: `error for key ${KEY}` },
    { status: 403, body: achievementsPrivate },
    { status: 400, body: achievementsNoStats },
    { body: ownedGames },
    { body: summaries },
  ]);
  const api = client(steam);
  const errors = [];
  for (const run of [
    () => api.getOwnedGames(STEAM_ID), () => api.getOwnedGames(STEAM_ID), () => api.getOwnedGames(STEAM_ID),
    () => api.getOwnedGames(STEAM_ID), () => api.getPlayerAchievements(STEAM_ID, '1'), () => api.getPlayerAchievements(STEAM_ID, '1'),
  ]) {
    await run().then(() => assert.fail('expected a rejection'), error => errors.push(error));
  }
  const results = [await api.getOwnedGames(STEAM_ID), await api.getPlayerSummaries(STEAM_ID)];

  for (const error of errors) {
    const dump = [error.message, error.stack, JSON.stringify(error), JSON.stringify(Object.entries(error)),
      error.cause && error.cause.message, error.cause && error.cause.stack, error.cause && error.cause.cause].join('\n');
    assert.equal(dump.includes(KEY), false, `key leaked in ${error.code}: ${dump}`);
  }
  assert.equal(JSON.stringify(results).includes(KEY), false);
  assert.match(errors[0].cause.message, /\[redacted\]/);
  assert.equal(errors[0].cause.cause, undefined);
});

test('reads the key from config.steam, where it is non-enumerable', async () => {
  const { steam: steamConfig } = readConfig({ STEAM_API_KEY: KEY });
  const steam = fakeSteam([{ body: ownedGamesEmpty }]);
  await createSteamApi({ apiKey: steamConfig.apiKey, fetch: steam.fetch }).getOwnedGames(STEAM_ID);
  assert.equal(steam.calls[0].url.searchParams.get('key'), KEY);
});

test('rejects a missing key and malformed IDs before calling Steam', async () => {
  assert.throws(() => createSteamApi({ apiKey: '' }), TypeError);
  assert.throws(() => createSteamApi({}), TypeError);

  const steam = fakeSteam();
  const api = client(steam);
  await assert.rejects(api.getOwnedGames('123'), TypeError);
  await assert.rejects(api.getOwnedGames(`${STEAM_ID}&key=x`), TypeError);
  await assert.rejects(api.getPlayerAchievements(STEAM_ID, 'abc'), TypeError);
  await assert.rejects(api.getSchemaForGame(''), TypeError);
  await assert.rejects(api.getPlayerSummaries([]), TypeError);
  await assert.rejects(api.getPlayerSummaries(Array.from({ length: 101 }, () => STEAM_ID)), TypeError);
  assert.equal(steam.calls.length, 0);
});

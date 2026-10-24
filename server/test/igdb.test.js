const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createIgdbClient } = require('../src/igdb');
const { importGames, mapIgdbGame, popularGamesQuery } = require('../src/igdbImport');
const fixture = require('./fixtures/igdb-games.json');

// Fake fetch that records requests and answers token and API calls from queues.
function fakeTwitch({ tokens = [{ access_token: 'token-1', expires_in: 3600 }], api = [] } = {}) {
  const calls = [];
  const fetch = async (url, options) => {
    calls.push({ url, ...options });
    if (url.startsWith('https://id.twitch.tv/')) {
      const body = tokens.shift();
      return body ? Response.json(body) : new Response('', { status: 400 });
    }
    const next = api.shift() ?? { status: 200, body: [] };
    return Response.json(next.body ?? {}, { status: next.status });
  };
  return { fetch, calls, apiCalls: () => calls.filter(call => call.url.startsWith('https://api.igdb.com/')) };
}

function clock(start = 0) {
  let time = start;
  return { now: () => time, advance: ms => { time += ms; }, sleep: async ms => { time += ms; } };
}

test('client requests a client-credentials token and sends Apicalypse queries with it', async () => {
  const twitch = fakeTwitch({ api: [{ status: 200, body: [{ id: 1 }] }] });
  const client = createIgdbClient({ clientId: 'client-id', clientSecret: 'secret', fetch: twitch.fetch, ...clock() });
  assert.deepEqual(await client.query('games', 'fields name;'), [{ id: 1 }]);

  const [tokenCall, apiCall] = twitch.calls;
  assert.equal(tokenCall.method, 'POST');
  assert.equal(String(tokenCall.body), 'client_id=client-id&client_secret=secret&grant_type=client_credentials');
  assert.equal(apiCall.url, 'https://api.igdb.com/v4/games');
  assert.equal(apiCall.headers['Client-ID'], 'client-id');
  assert.equal(apiCall.headers.Authorization, 'Bearer token-1');
  assert.equal(apiCall.body, 'fields name;');
});

test('client reuses the token until shortly before it expires', async () => {
  const time = clock();
  const twitch = fakeTwitch({ tokens: [
    { access_token: 'token-1', expires_in: 3600 }, { access_token: 'token-2', expires_in: 3600 },
  ] });
  const client = createIgdbClient({ clientId: 'id', clientSecret: 'secret', fetch: twitch.fetch, ...time });
  await client.query('games', 'q');
  await client.query('games', 'q');
  time.advance(3600 * 1000 - 60 * 1000);
  await client.query('games', 'q');
  assert.deepEqual(twitch.apiCalls().map(call => call.headers.Authorization),
    ['Bearer token-1', 'Bearer token-1', 'Bearer token-2']);
});

test('client refreshes the token once when IGDB rejects it', async () => {
  const twitch = fakeTwitch({
    tokens: [{ access_token: 'stale', expires_in: 3600 }, { access_token: 'fresh', expires_in: 3600 }],
    api: [{ status: 401 }, { status: 200, body: [] }],
  });
  const client = createIgdbClient({ clientId: 'id', clientSecret: 'secret', fetch: twitch.fetch, ...clock() });
  assert.deepEqual(await client.query('games', 'q'), []);
  assert.deepEqual(twitch.apiCalls().map(call => call.headers.Authorization), ['Bearer stale', 'Bearer fresh']);
});

test('client surfaces token and API failures without leaking the secret', async () => {
  const noToken = createIgdbClient({ clientId: 'id', clientSecret: 'secret', fetch: fakeTwitch({ tokens: [] }).fetch, ...clock() });
  await assert.rejects(noToken.query('games', 'q'), error => /status 400/.test(error.message) && !/secret/.test(error.message));

  const failing = fakeTwitch({ api: [{ status: 500 }] });
  const client = createIgdbClient({ clientId: 'id', clientSecret: 'secret', fetch: failing.fetch, ...clock() });
  await assert.rejects(client.query('games', 'q'), /IGDB games request failed with status 500/);
});

test('client spaces requests to stay under 4 per second', async () => {
  const time = clock(1000);
  const sentAt = [];
  const twitch = fakeTwitch({ tokens: [{ access_token: 't', expires_in: 3600 }] });
  const fetch = async (url, options) => {
    if (url.startsWith('https://api.igdb.com/')) sentAt.push(time.now());
    return twitch.fetch(url, options);
  };
  const client = createIgdbClient({ clientId: 'id', clientSecret: 'secret', fetch, ...time });
  for (let i = 0; i < 4; i += 1) await client.query('games', 'q');
  assert.deepEqual(sentAt, [1000, 1250, 1500, 1750]);
});

test('maps an IGDB game to catalog fields', () => {
  assert.deepEqual(mapIgdbGame(fixture[0]), {
    igdbId: 113112,
    title: 'Hades',
    slug: 'hades--1',
    summary: 'Defy the god of the dead as you hack and slash out of the Underworld.',
    coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co39vc.jpg',
    genres: ['Role-playing (RPG)', 'Adventure'],
    platforms: ['PC (Microsoft Windows)', 'Nintendo Switch'],
    steamAppIds: ['1145360'],
    releaseDate: new Date('2020-09-18T00:00:00Z'),
  });
});

test('mapping reads Steam IDs from the older category field and tolerates missing data', () => {
  assert.deepEqual(mapIgdbGame(fixture[1]).steamAppIds, ['367520']);
  const sparse = mapIgdbGame(fixture[2]);
  assert.equal(sparse.coverUrl, '');
  assert.equal(sparse.summary, '');
  assert.deepEqual([sparse.genres, sparse.platforms, sparse.steamAppIds], [[], [], []]);
  assert.equal('releaseDate' in sparse, false);
});

function fakeGames() {
  const writes = [];
  return { writes, async bulkWrite(ops, options) { writes.push({ ops, options }); } };
}

test('import upserts valid games by igdbId and skips nameless entries', async () => {
  const games = fakeGames();
  const queries = [];
  const client = { async query(endpoint, body) { queries.push({ endpoint, body }); return fixture; } };
  assert.equal(await importGames({ client, games, limit: 10 }), 3);

  assert.deepEqual(queries, [{ endpoint: 'games', body: popularGamesQuery({ limit: 10, offset: 0 }) }]);
  const [{ ops, options }] = games.writes;
  assert.equal(options.ordered, false);
  assert.deepEqual(ops.map(op => op.updateOne.filter), [{ igdbId: 113112 }, { igdbId: 14593 }, { igdbId: 999001 }]);
  assert.equal(ops[0].updateOne.upsert, true);
  assert.equal('ratingAvg' in ops[0].updateOne.update.$set, false);
});

test('import pages through results 500 at a time and stops at a short page', async () => {
  const offsets = [];
  const client = {
    async query(_endpoint, body) {
      const [, limit] = body.match(/limit (\d+);/);
      const [, offset] = body.match(/offset (\d+);/);
      offsets.push([Number(offset), Number(limit)]);
      const size = Number(offset) >= 500 ? 100 : Number(limit);
      return Array.from({ length: size }, (_, i) => ({ id: Number(offset) + i + 1, name: `Game ${i}` }));
    },
  };
  assert.equal(await importGames({ client, games: fakeGames(), limit: 1200 }), 600);
  assert.deepEqual(offsets, [[0, 500], [500, 500]]);
});

test('import rejects an invalid limit', async () => {
  await assert.rejects(importGames({ client: {}, games: fakeGames(), limit: 0 }), /positive integer/);
});

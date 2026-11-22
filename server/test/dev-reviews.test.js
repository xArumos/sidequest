const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const Game = require('sidequest-database/models/Game');
const GameDeveloper = require('sidequest-database/models/GameDeveloper');
const Review = require('sidequest-database/models/Review');
const { requireAuth } = require('../src/auth');
const { createDevelopersRouter } = require('../src/developers');
const { startApi } = require('./helpers/api');

const { ObjectId } = Review.base.Types;

// Developer review filters, sorting, validation, and pagination (PBI-33, TC-DEV-03).
describe('developer review filters (TC-DEV-03)', () => {
  let api;
  let dev;
  let stranger;
  let games;
  const names = new Map();

  before(async () => {
    api = await startApi({ '': [createDevelopersRouter({ requireAuth })] });
    await api.reset();
    games = await Game.create([{ title: 'Alpha' }, { title: 'Beta' }, { title: 'Closed' }]);
    const [a, b, c] = games.map(game => game._id);
    dev = await api.signIn('dev');
    stranger = await api.signIn('stranger');
    await GameDeveloper.create([
      { user: dev.id, game: a, status: 'approved' },
      { user: dev.id, game: b, status: 'approved' },
      { user: dev.id, game: c, status: 'pending' },
    ]);
    const at = day => new Date(`2026-01-0${day}T10:00:00Z`);
    // Raw inserts keep the given createdAt instead of Mongoose's timestamps.
    const seed = [
      ['r1', a, { rating: 5, text: 'Great' }, 1],
      ['r2', a, { rating: 2, text: '' }, 2],
      ['r3', a, { text: 'Text only' }, 3],
      ['r4', a, { rating: 4, text: 'Solid' }, 4],
      ['r5', a, { rating: 1, text: 'Spam', removedAt: at(5), removalReason: 'Spam' }, 5],
      ['r6', b, { rating: 3, text: '' }, 6],
      ['r7', c, { rating: 5, text: 'Not my game' }, 7],
      ['r8', a, { status: 'wishlist', text: '' }, 8],
    ];
    const docs = seed.map(([name, game, fields, day]) => {
      const _id = new ObjectId();
      names.set(String(_id), name);
      return { _id, user: new ObjectId(), game, removedAt: null, ...fields, createdAt: at(day), updatedAt: at(day) };
    });
    await Review.collection.insertMany(docs);
  });
  after(() => api.stop());

  const get = (query, who = dev, path = '/dev/reviews') => api.request(`${path}${query ? `?${query}` : ''}`, { cookie: who.cookie });
  async function list(query, options) {
    const response = await get(query, options?.who, options?.path);
    assert.equal(response.status, 200, JSON.stringify(response.body));
    return response.body.reviews.map(review => names.get(review.id));
  }
  async function invalid(query, fields, path) {
    const response = await get(query, dev, path);
    assert.equal(response.status, 400, query);
    assert.equal(response.body.error.code, 'INVALID_QUERY');
    assert.deepEqual(Object.keys(response.body.error.fields).sort(), fields.sort(), query);
    for (const field of fields) assert.match(response.body.error.message, new RegExp(field), 'the message names the field');
    return response.body.error;
  }

  test('defaults to every active review of the developer’s games, newest first', async () => {
    assert.deepEqual(await list(''), ['r6', 'r4', 'r3', 'r2', 'r1']);
    assert.equal((await get('')).body.total, 5);
    assert.equal((await get('')).status, 200);
  });

  test('filters by game', async () => {
    assert.deepEqual(await list(`gameId=${games[0]._id}`), ['r4', 'r3', 'r2', 'r1']);
    assert.deepEqual(await list(`gameId=${games[1]._id}`), ['r6']);
    assert.equal((await get(`gameId=${games[2]._id}`)).body.error.code, 'NOT_DEVELOPER', 'pending game');
    assert.deepEqual(await list(`gameId=${String(games[1]._id).toUpperCase()}`), ['r6'], 'ids are case-insensitive');
  });

  test('filters by rating range', async () => {
    assert.deepEqual(await list('minRating=4'), ['r4', 'r1']);
    assert.deepEqual(await list('maxRating=2'), ['r2']);
    assert.deepEqual(await list('minRating=2&maxRating=4'), ['r6', 'r4', 'r2']);
    assert.deepEqual(await list('minRating=3&maxRating=3'), ['r6']);
    assert.deepEqual(await list('minRating=1&maxRating=5'), ['r6', 'r4', 'r2', 'r1'], 'a rating filter excludes text-only reviews');
  });

  test('filters by date, with both ends inclusive', async () => {
    assert.deepEqual(await list('from=2026-01-03'), ['r6', 'r4', 'r3']);
    assert.deepEqual(await list('to=2026-01-02'), ['r2', 'r1'], 'a bare date covers the whole day');
    assert.deepEqual(await list('from=2026-01-02&to=2026-01-02'), ['r2']);
    assert.deepEqual(await list('from=2026-01-01T10:00:00Z&to=2026-01-01T10:00:00Z'), ['r1']);
    assert.deepEqual(await list('from=2026-01-01T10:00:01Z&to=2026-01-02T09:59:59.999Z'), []);
    assert.deepEqual(await list('from=2026-01-04T12:00:00%2B02:00'), ['r6', 'r4'], 'time zone offsets are honored');
  });

  test('filters by whether there is written text', async () => {
    assert.deepEqual(await list('hasText=true'), ['r4', 'r3', 'r1']);
    assert.deepEqual(await list('hasText=false'), ['r6', 'r2']);
  });

  test('sorts newest, oldest, highest, and lowest with unrated reviews last', async () => {
    assert.deepEqual(await list('sort=newest'), ['r6', 'r4', 'r3', 'r2', 'r1']);
    assert.deepEqual(await list('sort=oldest'), ['r1', 'r2', 'r3', 'r4', 'r6']);
    assert.deepEqual(await list('sort=highest'), ['r1', 'r4', 'r6', 'r2', 'r3']);
    assert.deepEqual(await list('sort=lowest'), ['r2', 'r6', 'r4', 'r1', 'r3']);
  });

  test('combines filters', async () => {
    assert.deepEqual(await list(`gameId=${games[0]._id}&minRating=2&hasText=true&sort=lowest`), ['r4', 'r1']);
    assert.deepEqual(await list('minRating=2&maxRating=4&from=2026-01-02&to=2026-01-04&sort=oldest'), ['r2', 'r4']);
    assert.deepEqual(await list('hasText=false&maxRating=2&from=2026-01-01'), ['r2']);
  });

  test('returns an empty page when nothing matches', async () => {
    const response = await get('minRating=5&to=2025-12-31');
    assert.deepEqual(response.body, { reviews: [], total: 0, page: 1, pages: 0 });
    assert.deepEqual((await get('', stranger)).body, { reviews: [], total: 0, page: 1, pages: 0 }, 'no games');
    assert.deepEqual(await list(`hasText=true&gameId=${games[1]._id}`), []);
  });

  test('paginates, including past the last page', async () => {
    const first = await get('limit=2');
    assert.deepEqual({ ...first.body, reviews: first.body.reviews.map(review => names.get(review.id)) },
      { reviews: ['r6', 'r4'], total: 5, page: 1, pages: 3 });
    assert.deepEqual(await list('limit=2&page=2'), ['r3', 'r2']);
    assert.deepEqual(await list('limit=2&page=3'), ['r1'], 'a partial last page');
    assert.deepEqual((await get('limit=2&page=4')).body, { reviews: [], total: 5, page: 4, pages: 3 });
    assert.deepEqual(await list('limit=1'), ['r6']);
    assert.deepEqual(await list('limit=50&page=1'), ['r6', 'r4', 'r3', 'r2', 'r1']);
    assert.deepEqual(await list('page=100000'), []);
  });

  test('rejects invalid values with the field that is wrong', async () => {
    for (const value of ['0', '6', '2.5', 'abc', '', '-1']) await invalid(`minRating=${value}`, ['minRating']);
    await invalid('maxRating=1&maxRating=2', ['maxRating']);
    await invalid('gameId=nope', ['gameId']);
    for (const value of ['2026-02-30', 'yesterday', '2026-1-5', '2026-01-01T25:00:00Z', '2026-01-01T10:00', '1767261600000']) {
      await invalid(`from=${value}`, ['from']);
    }
    await invalid('hasText=yes', ['hasText']);
    await invalid('sort=random', ['sort']);
    for (const value of ['0', '51', 'x']) await invalid(`limit=${value}`, ['limit']);
    await invalid('page=0', ['page']);
    await invalid('page=100001', ['page']);
    await invalid('rating=5', ['rating']);
  });

  test('rejects reversed ranges', async () => {
    const error = await invalid('minRating=4&maxRating=2', ['maxRating']);
    assert.equal(error.fields.maxRating, 'maxRating must be at least minRating.');
    await invalid('from=2026-01-05&to=2026-01-01', ['to']);
    await invalid('from=2026-01-01T10:00:01Z&to=2026-01-01T10:00:00Z', ['to']);
  });

  test('reports every invalid field at once', async () => {
    const error = await invalid('minRating=0&sort=x&from=bad&limit=99', ['minRating', 'sort', 'from', 'limit']);
    assert.match(error.message, /^Invalid query parameters: /);
  });

  test('the per-game route takes the same filters but not gameId', async () => {
    const path = `/dev/games/${games[0]._id}/reviews`;
    assert.deepEqual(await list('minRating=4&sort=oldest', { path }), ['r1', 'r4']);
    await invalid(`gameId=${games[1]._id}`, ['gameId'], path);
    await invalid('to=2026-13-01', ['to'], path);
    assert.equal((await get('', dev, `/dev/games/${games[2]._id}/reviews`)).status, 403);
  });

  test('requires sign-in', async () => {
    assert.equal((await api.request('/dev/reviews')).status, 401);
  });
});

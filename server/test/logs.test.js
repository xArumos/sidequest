const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const Game = require('sidequest-database/models/Game');
const Review = require('sidequest-database/models/Review');
const { requireAuth } = require('../src/auth');
const { createGamesRouter } = require('../src/games');
const { createLogsRouter } = require('../src/logs');
const { startApi } = require('./helpers/api');

describe('ratings and reviews API', () => {
  let api;
  let game;
  let alice;
  let bob;

  before(async () => {
    api = await startApi({ '/games': createGamesRouter(), '': createLogsRouter({ requireAuth }) });
  });
  after(() => api.stop());

  beforeEach(async () => {
    await api.reset();
    game = await Game.create({ title: 'Celeste' });
    alice = await api.signIn('alice');
    bob = await api.signIn('bob');
  });

  const logPath = () => `/games/${game._id}/log`;
  const save = (who, body) => api.request(logPath(), { method: 'POST', cookie: who.cookie, body });
  const stats = async () => (await api.request(`/games/${game._id}`)).body.game;

  test('posts a rating and review and updates the game average (TC-RATE-01)', async () => {
    const response = await save(alice, { rating: 4, text: '  Tough but fair.  ' });
    assert.equal(response.status, 201);
    assert.deepEqual({ ...response.body.log, id: undefined, createdAt: undefined, updatedAt: undefined }, {
      id: undefined, game: String(game._id), rating: 4, text: 'Tough but fair.', status: null,
      createdAt: undefined, updatedAt: undefined,
    });
    assert.ok(Date.parse(response.body.log.createdAt));
    await save(bob, { rating: 5 });
    assert.deepEqual(await stats(), { ...await stats(), ratingAvg: 4.5, ratingCount: 2, reviewCount: 1 });
  });

  test('accepts ratings 1 to 5 and rejects everything else (TC-RATE-02)', async () => {
    for (const rating of [1, 5]) assert.equal((await save(alice, { rating })).body.log.rating, rating);
    for (const rating of [0, 6, -1, 3.5, '3', true, [4], { $gt: 0 }]) {
      const response = await save(alice, { rating });
      assert.equal(response.status, 400, JSON.stringify(rating));
      assert.equal(response.body.error.code, 'INVALID_LOG');
    }
    assert.equal((await Review.findOne({ user: alice.id })).rating, 5);
  });

  test('saving again updates the one record instead of duplicating it', async () => {
    assert.equal((await save(alice, { rating: 2 })).status, 201);
    const second = await save(alice, { text: 'Changed my mind.' });
    assert.equal(second.status, 200);
    assert.equal(second.body.log.rating, 2, 'fields not sent are kept');
    assert.equal(await Review.countDocuments({ user: alice.id }), 1);
    const results = await Promise.all([save(bob, { rating: 3 }), save(bob, { rating: 3 })]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 201]);
    assert.equal(await Review.countDocuments({ user: bob.id }), 1);
  });

  test('null clears a field, and a record left empty is deleted', async () => {
    await save(alice, { rating: 4, text: 'Nice.' });
    assert.equal((await save(alice, { rating: null })).body.log.rating, null);
    assert.equal((await stats()).ratingCount, 0);
    assert.deepEqual((await save(alice, { text: null })).body, { log: null });
    assert.equal(await Review.countDocuments(), 0);
  });

  test('validates review text and request shape (TC-RATE-04)', async () => {
    const markup = '<script>alert(1)</script>';
    assert.equal((await save(alice, { text: markup })).body.log.text, markup, 'stored as plain text');
    assert.equal((await save(alice, { text: 'x'.repeat(2000) })).status, 200);
    for (const body of [{ text: 'x'.repeat(2001) }, { text: 5 }, { status: 'owned' }, { rating: 3, user: bob.id },
      {}, [], 'rating=3']) {
      const response = await save(alice, body);
      assert.equal(response.status, 400, JSON.stringify(body));
    }
    const notJson = await api.request(logPath(), { method: 'POST', cookie: alice.cookie });
    assert.equal(notJson.status, 400);
  });

  test('requires sign-in and an existing game', async () => {
    assert.equal((await api.request(logPath(), { method: 'POST', body: { rating: 3 } })).status, 401);
    assert.equal((await api.request(logPath())).status, 401);
    const missing = await api.request('/games/000000000000000000000000/log', {
      method: 'POST', cookie: alice.cookie, body: { rating: 3 },
    });
    assert.equal(missing.status, 404);
    assert.equal((await api.request('/games/nope/log', { method: 'POST', cookie: alice.cookie, body: { rating: 3 } })).status, 400);
  });

  test("returns the caller's own record for a game", async () => {
    assert.deepEqual((await api.request(logPath(), { cookie: alice.cookie })).body, { log: null });
    await save(alice, { rating: 3, status: 'played' });
    const mine = await api.request(logPath(), { cookie: alice.cookie });
    assert.equal(mine.body.log.rating, 3);
    assert.equal(mine.body.log.status, 'played');
    assert.deepEqual((await api.request(logPath(), { cookie: bob.cookie })).body, { log: null });
  });

  test('only the owner can edit or delete a record (TC-RATE-03)', async () => {
    const { id } = (await save(alice, { rating: 5, text: 'Mine.' })).body.log;
    await save(bob, { rating: 1 });

    const forbidden = await api.request(`/logs/${id}`, { method: 'PATCH', cookie: bob.cookie, body: { rating: 1 } });
    assert.equal(forbidden.status, 403);
    assert.equal((await api.request(`/logs/${id}`, { method: 'DELETE', cookie: bob.cookie })).status, 403);
    assert.equal((await api.request(`/logs/${id}`, { method: 'DELETE' })).status, 401);

    const edited = await api.request(`/logs/${id}`, { method: 'PATCH', cookie: alice.cookie, body: { rating: 3 } });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.log.text, 'Mine.');
    assert.equal((await stats()).ratingAvg, 2);

    assert.equal((await api.request(`/logs/${id}`, { method: 'DELETE', cookie: alice.cookie })).status, 204);
    assert.deepEqual(await stats(), { ...await stats(), ratingAvg: 1, ratingCount: 1 });
    assert.equal((await api.request(`/logs/${id}`, { method: 'DELETE', cookie: alice.cookie })).status, 404);
    assert.equal((await api.request('/logs/bad-id', { method: 'PATCH', cookie: alice.cookie, body: { rating: 2 } })).status, 400);
  });

  test('lists public reviews newest first without private fields (PBI-09)', async () => {
    await save(alice, { rating: 4, text: 'First.', status: 'wishlist' });
    await save(bob, { text: 'Second.' });
    await Review.create({ user: game._id, game: game._id, status: 'backlog' });

    const response = await api.request(`/games/${game._id}/reviews`);
    assert.equal(response.status, 200);
    assert.equal(response.body.total, 2, 'status-only records are not reviews');
    assert.deepEqual(response.body.reviews.map(r => r.text), ['Second.', 'First.']);
    const [, first] = response.body.reviews;
    assert.deepEqual(first.user, { id: alice.id, displayName: 'alice', username: null, avatarUrl: '' });
    assert.equal(first.status, undefined);
    assert.doesNotMatch(JSON.stringify(response.body), /example\.com|googleId/);

    const paged = await api.request(`/games/${game._id}/reviews?limit=1&page=2`);
    assert.deepEqual(paged.body.reviews.map(r => r.text), ['First.']);
    assert.equal(paged.body.pages, 2);
    assert.equal((await api.request('/games/000000000000000000000000/reviews')).status, 404);
  });
});

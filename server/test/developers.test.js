const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const path = require('node:path');
const { Router } = require('express');
const Game = require('sidequest-database/models/Game');
const GameDeveloper = require('sidequest-database/models/GameDeveloper');
const Review = require('sidequest-database/models/Review');
const { requireAuth } = require('../src/auth');
const { createDevelopersRouter, requireDeveloper } = require('../src/developers');
const { createGamesRouter } = require('../src/games');
const { createLogsRouter } = require('../src/logs');
const { createUsersRouter } = require('../src/users');
const { startApi } = require('./helpers/api');

// A route that only answers for approved developers, to test the middleware alone.
const probe = Router().get('/probe/:gameId', requireDeveloper('gameId'), (_req, res) => res.json({ ok: true }));

describe('developer access and review moderation (PBI-32)', () => {
  let api;
  let game;
  let other;
  let alice;
  let bob;
  let dev;

  before(async () => {
    api = await startApi({
      '/games': createGamesRouter(),
      '': [createLogsRouter({ requireAuth }), createUsersRouter({ requireAuth }), createDevelopersRouter({ requireAuth }), probe],
    });
  });
  after(() => api.stop());

  beforeEach(async () => {
    await api.reset();
    [game, other] = await Game.create([{ title: 'Celeste' }, { title: 'Hades' }]);
    alice = await api.signIn('alice');
    bob = await api.signIn('bob');
    dev = await api.signIn('dev');
  });

  const approve = (who, target = game) => GameDeveloper.create({ user: who.id, game: target._id, status: 'approved' });
  const ask = (who, body, target = game) => api.request(`/games/${target._id}/developer-requests`, { method: 'POST', cookie: who.cookie, body });
  const save = (who, body, target = game) => api.request(`/games/${target._id}/log`, { method: 'POST', cookie: who.cookie, body });
  const remove = (who, reviewId, body = { reason: 'Spam link.' }) => api.request(`/dev/reviews/${reviewId}`, { method: 'DELETE', cookie: who.cookie, body });

  describe('requireDeveloper', () => {
    test('allows only approved developers of that game', async () => {
      const url = `/probe/${game._id}`;
      assert.equal((await api.request(url)).status, 401);
      assert.equal((await api.request(url, { cookie: dev.cookie })).body.error.code, 'NOT_DEVELOPER');

      await GameDeveloper.create({ user: dev.id, game: game._id, status: 'pending' });
      assert.equal((await api.request(url, { cookie: dev.cookie })).status, 403, 'pending is not enough');
      await GameDeveloper.updateOne({ user: dev.id }, { status: 'rejected' });
      assert.equal((await api.request(url, { cookie: dev.cookie })).status, 403, 'rejected is denied');
      await GameDeveloper.updateOne({ user: dev.id }, { status: 'approved' });
      assert.deepEqual((await api.request(url, { cookie: dev.cookie })).body, { ok: true });

      assert.equal((await api.request(`/probe/${other._id}`, { cookie: dev.cookie })).status, 403, 'other games are denied');
      assert.equal((await api.request(url, { cookie: alice.cookie })).status, 403, 'other users are denied');
      assert.equal((await api.request('/probe/nope', { cookie: dev.cookie })).status, 400);
    });
  });

  describe('access requests (TC-DEV-01)', () => {
    test('a signed-in user requests access once and sees the pending state', async () => {
      assert.deepEqual((await api.request(`/games/${game._id}/developer-requests/me`, { cookie: dev.cookie })).body, { request: null });
      const created = await ask(dev, { justification: '  I built the level editor.  ' });
      assert.equal(created.status, 201);
      assert.deepEqual({ ...created.body.request, id: undefined, requestedAt: undefined }, {
        id: undefined, game: String(game._id), status: 'pending', justification: 'I built the level editor.',
        requestedAt: undefined, decidedAt: null,
      });
      const mine = await api.request(`/games/${game._id}/developer-requests/me`, { cookie: dev.cookie });
      assert.deepEqual(mine.body, created.body);

      const duplicate = await ask(dev, { justification: 'Again.' });
      assert.equal(duplicate.status, 409);
      assert.equal(duplicate.body.error.code, 'DEVELOPER_REQUEST_EXISTS');
      assert.match(duplicate.body.error.message, /pending/);
      assert.equal(await GameDeveloper.countDocuments(), 1);
      assert.equal((await ask(dev, { justification: 'Other game.' }, other)).status, 201, 'one request per game');
    });

    test('validates the request', async () => {
      assert.equal((await api.request(`/games/${game._id}/developer-requests`, { method: 'POST', body: { justification: 'x' } })).status, 401);
      for (const body of [{}, { justification: '   ' }, { justification: 'x'.repeat(501) }, { justification: 5 }]) {
        const response = await ask(dev, body);
        assert.equal(response.status, 400);
        assert.ok(response.body.error.fields.justification);
      }
      assert.equal((await ask(dev, { justification: 'x'.repeat(500) })).status, 201, '500 characters is allowed');
      assert.equal((await ask(dev, { justification: 'Hi' }, { _id: '000000000000000000000000' })).status, 404);
      assert.equal((await api.request('/games/nope/developer-requests', { method: 'POST', cookie: dev.cookie, body: { justification: 'Hi' } })).status, 400);
    });

    test('approve-developer.js approves and rejects requests', async () => {
      const { body } = await ask(dev, { justification: 'Lead designer.' });
      const run = (...args) => new Promise(resolve => {
        execFile(process.execPath, [path.join(__dirname, '../scripts/approve-developer.js'), ...args], {
          env: { ...process.env, MONGODB_URI: api.mongoUri, MONGODB_DB_NAME: api.dbName },
        }, (error, stdout, stderr) => resolve({ code: error ? error.code : 0, stdout, stderr }));
      });

      const listed = await run('--list');
      assert.equal(listed.code, 0);
      assert.match(listed.stdout, new RegExp(`${body.request.id}\\s+Celeste`));
      assert.equal((await run('--id', body.request.id)).code, 0);
      const approved = await GameDeveloper.findById(body.request.id).lean();
      assert.equal(approved.status, 'approved');
      assert.ok(approved.decidedAt);
      assert.equal(approved.decidedBy, null);
      assert.equal((await api.request(`/probe/${game._id}`, { cookie: dev.cookie })).status, 200);

      assert.equal((await run('--id', body.request.id, '--reject')).code, 0);
      assert.equal((await GameDeveloper.findById(body.request.id).lean()).status, 'rejected');
      assert.equal((await run('--id', '000000000000000000000000')).code, 1);
      assert.equal((await run('--id', 'nope')).code, 1);
      assert.equal((await run()).code, 1);
    });
  });

  describe('developer review list (#71)', () => {
    test('lists only the games the user is an approved developer for', async () => {
      await approve(dev, other);
      await GameDeveloper.create({ user: dev.id, game: game._id, status: 'pending' });
      const games = await api.request('/dev/games', { cookie: dev.cookie });
      assert.deepEqual(games.body.games.map(item => item.title), ['Hades']);
      assert.deepEqual((await api.request('/dev/games', { cookie: alice.cookie })).body, { games: [] });
      assert.equal((await api.request('/dev/games')).status, 401);
    });

    test('returns rating, text, date, and the reviewer public fields, paginated', async () => {
      await approve(dev);
      await save(alice, { rating: 4, text: 'Tough but fair.' });
      await save(bob, { rating: 2 });
      await save(dev, { status: 'wishlist' });
      await save(alice, { rating: 5 }, other);

      const url = `/dev/games/${game._id}/reviews`;
      assert.equal((await api.request(url, { cookie: alice.cookie })).status, 403);
      assert.equal((await api.request(url)).status, 401);
      const first = await api.request(`${url}?limit=1`, { cookie: dev.cookie });
      assert.equal(first.status, 200);
      assert.deepEqual({ ...first.body, reviews: undefined }, { reviews: undefined, total: 2, page: 1, pages: 2 });
      const [review] = first.body.reviews;
      assert.deepEqual({ ...review, id: undefined, createdAt: undefined, updatedAt: undefined }, {
        id: undefined, rating: 2, text: '', createdAt: undefined, updatedAt: undefined,
        user: { id: bob.id, displayName: 'bob', username: null, avatarUrl: '' },
        game: { id: String(game._id), title: 'Celeste' },
      });
      assert.ok(Date.parse(review.createdAt));
      assert.doesNotMatch(JSON.stringify(first.body), /example\.com|status/, 'no email or private status');
      const second = await api.request(`${url}?limit=1&page=2`, { cookie: dev.cookie });
      assert.equal(second.body.reviews[0].text, 'Tough but fair.');
    });
  });

  describe('removing reviews (TC-DEV-02)', () => {
    let reviewId;
    beforeEach(async () => {
      await approve(dev);
      reviewId = (await save(alice, { rating: 1, text: 'Buy gold at spam.example', status: 'played' })).body.log.id;
      await save(bob, { rating: 5, text: 'Wonderful.' });
    });

    test('only developers of that game can remove a review, with a reason', async () => {
      assert.equal((await remove(alice, reviewId)).status, 403);
      await approve(bob, other);
      assert.equal((await remove(bob, reviewId)).body.error.code, 'NOT_DEVELOPER', 'a developer of another game');
      assert.equal((await api.request(`/dev/reviews/${reviewId}`, { method: 'DELETE', body: { reason: 'x' } })).status, 401);
      for (const body of [{}, { reason: '  ' }, { reason: 'x'.repeat(501) }, { reason: ['x'] }]) {
        const response = await remove(dev, reviewId, body);
        assert.equal(response.status, 400);
        assert.equal(response.body.error.code, 'INVALID_REASON');
        assert.ok(response.body.error.fields.reason);
      }
      assert.equal((await remove(dev, '000000000000000000000000')).status, 404);
      assert.equal((await remove(dev, 'nope')).status, 400);
      const wishlistOnly = await Review.create({ user: dev.id, game: game._id, status: 'wishlist' });
      assert.equal((await remove(dev, wishlistOnly._id)).status, 404, 'a status-only record is not a review');
      assert.equal((await Review.findById(reviewId).lean()).removedAt, null);
    });

    test('hides the review from public reads and the rating, but not from its author', async () => {
      assert.deepEqual((await api.request(`/games/${game._id}`)).body.game.ratingAvg, 3);
      const removed = await remove(dev, reviewId, { reason: '  Spam link.  ' });
      assert.equal(removed.status, 200);
      assert.equal(removed.body.review.removalReason, 'Spam link.');
      const stored = await Review.findById(reviewId).lean();
      assert.equal(String(stored.removedBy), dev.id);
      assert.ok(stored.removedAt);
      assert.equal((await remove(dev, reviewId)).body.error.code, 'REVIEW_ALREADY_REMOVED');

      const details = (await api.request(`/games/${game._id}`)).body.game;
      assert.deepEqual([details.ratingAvg, details.ratingCount, details.reviewCount], [5, 1, 1]);
      assert.deepEqual((await api.request(`/games/${game._id}/reviews`)).body.reviews.map(review => review.text), ['Wonderful.']);
      assert.equal((await api.request(`/dev/games/${game._id}/reviews`, { cookie: dev.cookie })).body.total, 1);

      // The public profile keeps the played status but not the removed rating or text.
      const history = (await api.request(`/users/${alice.id}/logs`)).body.logs;
      assert.deepEqual(history.map(log => [log.rating, log.text, log.status, log.removed]), [[null, '', 'played', null]]);

      // The author still sees it, marked as removed with the reason.
      const own = (await api.request(`/games/${game._id}/log`, { cookie: alice.cookie })).body.log;
      assert.equal(own.text, 'Buy gold at spam.example');
      assert.equal(own.removed.reason, 'Spam link.');
      assert.ok(Date.parse(own.removed.at));
      const mine = (await api.request('/me/logs', { cookie: alice.cookie })).body.logs;
      assert.equal(mine.find(log => log.id === reviewId).removed.reason, 'Spam link.');
    });

    test('the author cannot edit a removed review back into view, but may change status or delete it', async () => {
      await remove(dev, reviewId);
      for (const body of [{ text: 'Fixed.' }, { rating: 3 }]) {
        const response = await save(alice, body);
        assert.equal(response.status, 409);
        assert.equal(response.body.error.code, 'REVIEW_REMOVED');
        assert.equal((await api.request(`/logs/${reviewId}`, { method: 'PATCH', cookie: alice.cookie, body })).status, 409);
      }
      assert.equal((await save(alice, { status: 'playing' })).body.log.status, 'playing');
      assert.equal((await api.request(`/logs/${reviewId}`, { method: 'DELETE', cookie: alice.cookie })).status, 204);
      assert.equal((await api.request(`/games/${game._id}`)).body.game.ratingCount, 1);
    });

    test('hides a removed rating on a public wishlist from other viewers', async () => {
      await save(alice, { status: 'wishlist' });
      await api.request('/me/wishlist-visibility', { method: 'PATCH', cookie: alice.cookie, body: { wishlistVisibility: 'public' } });
      await remove(dev, reviewId);
      const [publicLog] = (await api.request(`/users/${alice.id}/wishlist`)).body.logs;
      assert.deepEqual([publicLog.rating, publicLog.text, publicLog.removed], [null, '', null]);
      const [ownLog] = (await api.request(`/users/${alice.id}/wishlist`, { cookie: alice.cookie })).body.logs;
      assert.equal(ownLog.removed.reason, 'Spam link.');
    });
  });
});

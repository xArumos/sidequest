const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { MongoStore } = require('connect-mongo');
const Follow = require('sidequest-database/models/Follow');
const Game = require('sidequest-database/models/Game');
const GameDeveloper = require('sidequest-database/models/GameDeveloper');
const Review = require('sidequest-database/models/Review');
const User = require('sidequest-database/models/User');

// The server does not depend on mongoose directly; reach it through a model.
const mongoose = Game.base;
const { requireAuth } = require('../src/auth');
const { createApiRouters } = require('../src/routes');
const { createSessionRevoker } = require('../src/session');
const { startApi } = require('./helpers/api');

const PASSWORD = 'correct horse battery staple';

// Account deletion (#92).
describe('account deletion API', () => {
  let api;
  let games;

  before(async () => {
    api = await startApi(({ store }) => createApiRouters({
      requireAuth, rankingMinCount: 1, revokeUserSessions: createSessionRevoker({ store }),
    }));
  });
  after(() => api.stop());

  beforeEach(async () => {
    await api.reset();
    games = await Game.create([{ title: 'Celeste' }, { title: 'Hades' }]);
  });

  async function register(username) {
    const response = await fetch(`${api.base}/auth/register`, {
      method: 'POST',
      headers: { Origin: api.origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email: `${username}@example.com`, password: PASSWORD }),
    });
    assert.equal(response.status, 201);
    const { user } = await response.json();
    return { cookie: response.headers.get('set-cookie').split(';')[0], id: user.id };
  }

  async function passwordLogin(username) {
    const response = await fetch(`${api.base}/auth/login`, {
      method: 'POST',
      headers: { Origin: api.origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: username, password: PASSWORD }),
    });
    assert.equal(response.status, 200);
    return response.headers.get('set-cookie').split(';')[0];
  }

  const remove = (who, body, options = {}) => api.request('/users/me', { method: 'DELETE', cookie: who.cookie, body, ...options });
  const me = cookie => api.request('/auth/me', { cookie });
  const save = (who, game, body) => api.request(`/games/${game._id}/log`, { method: 'POST', cookie: who.cookie, body });
  const rating = async game => {
    const { ratingAvg, ratingCount } = await Game.findById(game._id).lean();
    return { ratingAvg, ratingCount };
  };

  test('deletes a password account with its data, recalculates ratings, and signs out everywhere', async () => {
    const alice = await register('alice');
    const otherDevice = await passwordLogin('alice');
    const bob = await api.signIn('bob');
    await save(alice, games[0], { rating: 1, text: 'Too hard.' });
    await save(alice, games[1], { status: 'wishlist' });
    await save(bob, games[0], { rating: 5 });
    await api.request(`/users/${bob.id}/follow`, { method: 'POST', cookie: alice.cookie });
    await api.request(`/users/${alice.id}/follow`, { method: 'POST', cookie: bob.cookie });
    await GameDeveloper.create({ user: alice.id, game: games[1]._id, status: 'approved' });
    assert.deepEqual(await rating(games[0]), { ratingAvg: 3, ratingCount: 2 });

    const response = await fetch(`${api.base}/users/me`, {
      method: 'DELETE',
      headers: { Origin: api.origin, Cookie: alice.cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: PASSWORD }),
    });
    assert.equal(response.status, 204);
    assert.match(response.headers.get('set-cookie'), /^sidequest\.sid=;.*Expires=Thu, 01 Jan 1970/);

    assert.equal(await User.exists({ _id: alice.id }), null);
    assert.equal(await Review.countDocuments({ user: alice.id }), 0);
    assert.equal(await Follow.countDocuments({ $or: [{ follower: alice.id }, { followee: alice.id }] }), 0);
    assert.equal(await GameDeveloper.countDocuments({ user: alice.id }), 0);
    assert.deepEqual(await rating(games[0]), { ratingAvg: 5, ratingCount: 1 });
    assert.equal(await Review.countDocuments({ user: bob.id }), 1);

    // Both of Alice's sessions are gone; Bob is still signed in.
    assert.equal((await me(alice.cookie)).status, 401);
    assert.equal((await me(otherDevice)).status, 401);
    assert.equal((await me(bob.cookie)).status, 200);
    // The account can no longer sign in.
    const login = await fetch(`${api.base}/auth/login`, {
      method: 'POST',
      headers: { Origin: api.origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'alice', password: PASSWORD }),
    });
    assert.equal(login.status, 401);
  });

  test('requires the password for a password account', async () => {
    const alice = await register('alice');
    await save(alice, games[0], { rating: 2 });

    for (const body of [undefined, {}, { password: '' }, { password: 42 }, { confirm: 'alice' }]) {
      const response = await remove(alice, body);
      assert.equal(response.status, 400, JSON.stringify(body));
      assert.equal(response.body.error.code, 'PASSWORD_REQUIRED');
    }
    const wrong = await remove(alice, { password: 'not the password at all' });
    assert.equal(wrong.status, 403);
    assert.equal(wrong.body.error.code, 'INVALID_PASSWORD');

    // Nothing was deleted and the session still works.
    assert.notEqual(await User.exists({ _id: alice.id }), null);
    assert.equal(await Review.countDocuments({ user: alice.id }), 1);
    assert.equal((await me(alice.cookie)).status, 200);
  });

  test('asks a Google account to type its email or username', async () => {
    const carol = await api.signIn('carol');
    await save(carol, games[0], { rating: 4 });

    for (const body of [undefined, {}, { confirm: '   ' }, { password: PASSWORD }]) {
      const response = await remove(carol, body);
      assert.equal(response.status, 400, JSON.stringify(body));
      assert.equal(response.body.error.code, 'CONFIRMATION_REQUIRED');
    }
    const wrong = await remove(carol, { confirm: 'someone@example.com' });
    assert.equal(wrong.status, 403);
    assert.equal(wrong.body.error.code, 'CONFIRMATION_MISMATCH');
    assert.notEqual(await User.exists({ _id: carol.id }), null);

    const response = await remove(carol, { confirm: '  Carol@Example.com ' });
    assert.equal(response.status, 204);
    assert.equal(await User.exists({ _id: carol.id }), null);
    assert.deepEqual(await rating(games[0]), { ratingAvg: 0, ratingCount: 0 });
  });

  test('requires sign-in and a same-origin request', async () => {
    const unauthenticated = await api.request('/users/me', { method: 'DELETE', body: { password: PASSWORD } });
    assert.equal(unauthenticated.status, 401);
    assert.equal(unauthenticated.body.error.code, 'UNAUTHENTICATED');

    const alice = await register('alice');
    for (const origin of [null, 'https://evil.example']) {
      const response = await remove(alice, { password: PASSWORD }, { origin });
      assert.equal(response.status, 403);
      assert.equal(response.body.error.code, 'INVALID_ORIGIN');
    }
    assert.notEqual(await User.exists({ _id: alice.id }), null);
  });

  test('is safe to repeat', async () => {
    const alice = await register('alice');
    assert.equal((await remove(alice, { password: PASSWORD })).status, 204);
    const again = await remove(alice, { password: PASSWORD });
    assert.equal(again.status, 401);
    assert.equal(again.body.error.code, 'UNAUTHENTICATED');

    // A session left behind for an account that is already gone is signed out.
    const dave = await api.signIn('dave');
    await User.deleteOne({ _id: dave.id });
    const orphan = await remove(dave, { confirm: 'dave@example.com' });
    assert.equal(orphan.status, 401);
    assert.equal((await me(dave.cookie)).status, 401);
  });
});

// connect-mongo stores sessions as JSON strings; the production revoker matches them.
describe('session revoker for connect-mongo', () => {
  let api;
  let store;

  before(async () => {
    api = await startApi({});
    store = MongoStore.create({ client: mongoose.connection.getClient(), dbName: api.dbName });
  });
  after(async () => {
    await store.close?.().catch(() => {});
    await api.stop();
  });

  test('deletes only the sessions of the given user', async () => {
    const alice = String(new mongoose.Types.ObjectId());
    const bob = String(new mongoose.Types.ObjectId());
    const cookie = { originalMaxAge: 60000, expires: new Date(Date.now() + 60000), httpOnly: true, path: '/' };
    const set = (sid, session) => new Promise((resolve, reject) => {
      store.set(sid, session, error => (error ? reject(error) : resolve()));
    });
    await set('a1', { cookie, userId: alice });
    await set('a2', { cookie, userId: alice });
    await set('b1', { cookie, userId: bob });
    await set('anon', { cookie });

    const collection = mongoose.connection.getClient().db(api.dbName).collection('sessions');
    await createSessionRevoker({ collection })(alice);
    assert.deepEqual((await collection.find({}, { projection: { _id: 1 } }).toArray()).map(doc => doc._id).sort(), ['anon', 'b1']);
    await assert.rejects(createSessionRevoker({ collection })('.*'), TypeError);
  });
});

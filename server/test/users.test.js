const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const Game = require('sidequest-database/models/Game');
const User = require('sidequest-database/models/User');
const { requireAuth } = require('../src/auth');
const { createLogsRouter } = require('../src/logs');
const { createUsersRouter } = require('../src/users');
const { startApi } = require('./helpers/api');

describe('wishlist, backlog, and profile history API', () => {
  let api;
  let games;
  let alice;
  let bob;

  before(async () => {
    api = await startApi({ '': [createLogsRouter({ requireAuth }), createUsersRouter({ requireAuth })] });
  });
  after(() => api.stop());

  beforeEach(async () => {
    await api.reset();
    games = await Game.create([{ title: 'Celeste' }, { title: 'Hades' }, { title: 'Halo' }]);
    alice = await api.signIn('alice');
    bob = await api.signIn('bob');
  });

  const save = (who, game, body) => api.request(`/games/${game._id}/log`, { method: 'POST', cookie: who.cookie, body });
  const titles = response => response.body.logs.map(log => log.game.title);
  const setVisibility = (who, wishlistVisibility) => api.request('/me/wishlist-visibility', {
    method: 'PATCH', cookie: who.cookie, body: { wishlistVisibility },
  });

  test('adds and removes wishlist games (TC-USRDATA-01)', async () => {
    await save(alice, games[0], { status: 'wishlist' });
    await save(alice, games[1], { status: 'wishlist' });
    const list = await api.request('/me/logs?status=wishlist', { cookie: alice.cookie });
    assert.equal(list.status, 200);
    assert.deepEqual(titles(list).sort(), ['Celeste', 'Hades']);
    assert.equal(list.body.logs[0].game.ratingCount, 0, 'items carry game summaries');

    assert.deepEqual((await save(alice, games[0], { status: null })).body, { log: null });
    assert.deepEqual(titles(await api.request('/me/logs?status=wishlist', { cookie: alice.cookie })), ['Hades']);
  });

  test('adds and removes backlog games, keeping any rating (TC-USRDATA-02)', async () => {
    await save(alice, games[2], { rating: 4 });
    await save(alice, games[2], { status: 'backlog' });
    assert.deepEqual(titles(await api.request('/me/logs?status=backlog', { cookie: alice.cookie })), ['Halo']);

    // One status per game: moving to "played" takes it off the backlog.
    await save(alice, games[2], { status: 'played' });
    assert.deepEqual(titles(await api.request('/me/logs?status=backlog', { cookie: alice.cookie })), []);
    const removed = await save(alice, games[2], { status: null });
    assert.equal(removed.body.log.rating, 4, 'removing a status keeps the rating');
  });

  test('lists only the caller’s own records and validates the filter', async () => {
    await save(bob, games[0], { status: 'wishlist' });
    assert.deepEqual((await api.request('/me/logs', { cookie: alice.cookie })).body.logs, []);
    assert.equal((await api.request('/me/logs?status=owned', { cookie: alice.cookie })).status, 400);
    assert.equal((await api.request('/me/logs')).status, 401);
  });

  test('wishlists are private by default and the owner can share them (TC-WISH-01)', async () => {
    await save(alice, games[0], { status: 'wishlist' });
    const path = `/users/${alice.id}/wishlist`;

    for (const viewer of [bob.cookie, undefined]) {
      const denied = await api.request(path, { cookie: viewer });
      assert.equal(denied.status, 403);
      assert.equal(denied.body.error.code, 'WISHLIST_PRIVATE');
    }
    assert.deepEqual(titles(await api.request(path, { cookie: alice.cookie })), ['Celeste'], 'owner sees own');

    assert.deepEqual((await api.request('/me/wishlist-visibility', { cookie: alice.cookie })).body,
      { wishlistVisibility: 'private' });
    assert.deepEqual((await setVisibility(alice, 'public')).body, { wishlistVisibility: 'public' });
    assert.deepEqual(titles(await api.request(path, { cookie: bob.cookie })), ['Celeste']);
    assert.deepEqual(titles(await api.request(path)), ['Celeste'], 'signed-out visitors too');

    await setVisibility(alice, 'private');
    assert.equal((await api.request(path, { cookie: bob.cookie })).status, 403);
  });

  test('validates visibility changes and unknown users', async () => {
    for (const wishlistVisibility of ['friends', '', null, ['public']]) {
      assert.equal((await setVisibility(alice, wishlistVisibility)).status, 400);
    }
    const extra = await api.request('/me/wishlist-visibility', {
      method: 'PATCH', cookie: alice.cookie, body: { wishlistVisibility: 'public', user: bob.id },
    });
    assert.equal(extra.status, 400);
    assert.equal((await api.request('/me/wishlist-visibility', { method: 'PATCH', body: { wishlistVisibility: 'public' } })).status, 401);
    assert.equal((await User.findById(alice.id)).wishlistVisibility, 'private');

    assert.equal((await api.request('/users/000000000000000000000000/wishlist')).status, 404);
    assert.equal((await api.request('/users/nope')).status, 400);
  });

  test('reads the signed-in profile, including defaults for existing accounts', async () => {
    await User.collection.updateOne({ _id: (await User.findById(alice.id))._id }, {
      $unset: { bio: '', avatarUrl: '', wishlistVisibility: '' },
    });
    const response = await api.request('/me/profile', { cookie: alice.cookie });
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.user, {
      id: alice.id, displayName: 'alice', username: null, avatarUrl: '', bio: '', wishlistVisibility: 'private',
    });
    assert.doesNotMatch(JSON.stringify(response.body), /example\.com|googleId|passwordHash/);
  });

  test('saves trimmed profile edits for the current account and its public profile', async () => {
    const before = await User.findById(alice.id).lean();
    const response = await api.request('/me/profile', {
      method: 'PATCH', cookie: alice.cookie, body: { displayName: '  Alice Player  ', bio: '  Puzzle games.  ' },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.user, {
      id: alice.id, displayName: 'Alice Player', username: null, avatarUrl: '', bio: 'Puzzle games.', wishlistVisibility: 'private',
    });
    assert.deepEqual((await api.request(`/users/${alice.id}`)).body, response.body);
    assert.deepEqual((await api.request('/me/profile', { cookie: alice.cookie })).body, response.body);

    const saved = await User.findById(alice.id).lean();
    assert.equal(saved.googleId, before.googleId);
    assert.equal(saved.email, before.email);
    assert.equal(saved.username, before.username);
    assert.equal(saved.wishlistVisibility, before.wishlistVisibility);
    assert.equal((await User.findById(bob.id)).displayName, 'bob');
  });

  test('partial profile edits preserve omitted fields and allow clearing the bio', async () => {
    await api.request('/me/profile', {
      method: 'PATCH', cookie: alice.cookie, body: { displayName: 'Alice Player', bio: 'Puzzle games.' },
    });
    const renamed = await api.request('/me/profile', {
      method: 'PATCH', cookie: alice.cookie, body: { displayName: 'Alice' },
    });
    assert.equal(renamed.body.user.bio, 'Puzzle games.');
    for (const bio of ['', '   ']) {
      const cleared = await api.request('/me/profile', { method: 'PATCH', cookie: alice.cookie, body: { bio } });
      assert.equal(cleared.status, 200);
      assert.equal(cleared.body.user.bio, '');
      assert.equal(cleared.body.user.displayName, 'Alice');
    }
    assert.equal((await User.findById(alice.id)).bio, '');
  });

  test('accepts the display name and bio length boundaries', async () => {
    for (const displayName of ['A', 'A'.repeat(80)]) {
      const response = await api.request('/me/profile', {
        method: 'PATCH', cookie: alice.cookie, body: { displayName, bio: 'B'.repeat(300) },
      });
      assert.equal(response.status, 200);
      assert.equal(response.body.user.displayName, displayName);
      assert.equal(response.body.user.bio.length, 300);
    }
  });

  test('rejects invalid profile fields without changing any fields', async () => {
    const invalid = [
      {}, [], [{ displayName: 'Alice' }],
      { displayName: '' }, { displayName: '   ' }, { displayName: 'A'.repeat(81) },
      { displayName: null }, { displayName: 42 }, { displayName: ['Alice'] },
      { bio: 'B'.repeat(301) }, { bio: null }, { bio: 42 }, { bio: { text: 'Hello' } },
      { displayName: 'Alice', bio: 'B'.repeat(301) },
      { username: 'new_name' }, { email: 'changed@example.com' }, { googleId: 'changed' },
      { passwordHash: 'changed' }, { wishlistVisibility: 'public' }, { user: bob.id },
      { displayName: 'Alice', unknown: true }, { $set: { displayName: 'Alice' } },
    ];
    for (const body of invalid) {
      const response = await api.request('/me/profile', { method: 'PATCH', cookie: alice.cookie, body });
      assert.equal(response.status, 400, JSON.stringify(body));
      assert.equal(response.body.error.code, 'INVALID_PROFILE', JSON.stringify(body));
    }
    const missingBody = await api.request('/me/profile', { method: 'PATCH', cookie: alice.cookie });
    assert.equal(missingBody.status, 400);
    assert.equal(missingBody.body.error.code, 'INVALID_PROFILE');
    const saved = await User.findById(alice.id);
    assert.equal(saved.displayName, 'alice');
    assert.equal(saved.bio, '');
    assert.equal(saved.googleId, 'alice');
    assert.equal(saved.email, 'alice@example.com');
    assert.equal(saved.wishlistVisibility, 'private');
  });

  test('profile routes require a signed-in account that still exists', async () => {
    for (const method of ['GET', 'PATCH']) {
      const response = await api.request('/me/profile', {
        method, ...(method === 'PATCH' && { body: { displayName: 'Alice' } }),
      });
      assert.equal(response.status, 401);
      assert.equal(response.body.error.code, 'UNAUTHENTICATED');
    }
    await User.deleteOne({ _id: alice.id });
    for (const method of ['GET', 'PATCH']) {
      const response = await api.request('/me/profile', {
        method, cookie: alice.cookie, ...(method === 'PATCH' && { body: { displayName: 'Alice' } }),
      });
      assert.equal(response.status, 401);
      assert.equal(response.body.error.code, 'UNAUTHENTICATED');
    }
  });

  test('public profile and history show ratings and played games, not private lists (PBI-03)', async () => {
    await save(alice, games[0], { rating: 5, text: 'Loved it.', status: 'played' });
    await save(alice, games[1], { status: 'playing' });
    await save(alice, games[2], { status: 'backlog' });
    await save(alice, games[2], { rating: 2 });
    await save(bob, games[1], { status: 'wishlist' });

    const profile = await api.request(`/users/${alice.id}`);
    assert.deepEqual(profile.body.user, {
      id: alice.id, displayName: 'alice', username: null, avatarUrl: '', bio: '', wishlistVisibility: 'private',
    });
    assert.doesNotMatch(JSON.stringify(profile.body), /example\.com|googleId/);

    const history = await api.request(`/users/${alice.id}/logs`);
    assert.equal(history.status, 200);
    assert.deepEqual(history.body.logs.map(log => [log.game.title, log.rating, log.status]), [
      ['Halo', 2, null], ['Hades', null, 'playing'], ['Celeste', 5, 'played'],
    ]);
    assert.deepEqual((await api.request(`/users/${bob.id}/logs`)).body.logs, [], 'wishlist-only is not history');
  });
});

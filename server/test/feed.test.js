const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const Game = require('sidequest-database/models/Game');
const { requireAuth } = require('../src/auth');
const { createFeedRouter } = require('../src/feed');
const { createLogsRouter } = require('../src/logs');
const { createUsersRouter } = require('../src/users');
const { startApi } = require('./helpers/api');

// Activity feed from followed users (#91).
describe('activity feed API', () => {
  let api;
  let games;
  let me;
  let bob;
  let carol;
  let dave;

  before(async () => {
    api = await startApi({
      '/feed': createFeedRouter({ requireAuth }),
      '': [createLogsRouter({ requireAuth }), createUsersRouter({ requireAuth })],
    });
    [me, bob, carol, dave] = await Promise.all(['me', 'bob', 'carol', 'dave'].map(name => api.signIn(name)));
  });
  after(() => api.stop());

  beforeEach(async () => {
    await api.resetActivity();
    games = await Game.create([{ title: 'Celeste' }, { title: 'Hades' }, { title: 'Halo' }, { title: 'Tetris' }]);
  });

  const save = (who, game, body) => api.request(`/games/${game._id}/log`, { method: 'POST', cookie: who.cookie, body });
  const follow = (who, target) => api.request(`/users/${target.id}/follow`, { method: 'POST', cookie: who.cookie });
  const setActivity = (who, activityVisibility) => api.request('/me/activity-visibility', {
    method: 'PATCH', cookie: who.cookie, body: { activityVisibility },
  });
  const feed = (query = '') => api.request(`/feed${query}`, { cookie: me.cookie });
  const summary = response => response.body.entries.map(entry => [entry.user.displayName, entry.game.title]);

  test('requires sign-in', async () => {
    const response = await api.request('/feed');
    assert.equal(response.status, 401);
    assert.equal(response.body.error.code, 'UNAUTHENTICATED');
  });

  test('is empty when following nobody', async () => {
    await save(bob, games[0], { rating: 5 });
    assert.deepEqual((await feed()).body, { entries: [], total: 0, page: 1, pages: 0 });
  });

  test('shows recent ratings, reviews, and play updates from followed users only', async () => {
    await follow(me, bob);
    await follow(me, carol);
    await save(bob, games[0], { rating: 5, text: 'Loved it.' });
    await save(carol, games[1], { status: 'playing' });
    await save(dave, games[2], { rating: 1 });
    await save(me, games[3], { rating: 3 });

    const response = await feed();
    assert.equal(response.status, 200);
    assert.deepEqual(summary(response), [['carol', 'Hades'], ['bob', 'Celeste']]);
    const [playing, review] = response.body.entries;
    assert.equal(playing.status, 'playing');
    assert.deepEqual({ rating: review.rating, text: review.text }, { rating: 5, text: 'Loved it.' });
    assert.deepEqual(review.user, { id: bob.id, displayName: 'bob', username: null, avatarUrl: '' });
    assert.equal(review.game.id, String(games[0]._id));
    assert.doesNotMatch(JSON.stringify(response.body), /example\.com|googleId/);
  });

  test('leaves out wishlists and backlogs, and hides those statuses on rated games', async () => {
    await follow(me, bob);
    await save(bob, games[0], { status: 'wishlist' });
    await save(bob, games[1], { status: 'backlog' });
    await save(bob, games[2], { status: 'backlog' });
    await save(bob, games[2], { rating: 2 });

    const response = await feed();
    assert.deepEqual(summary(response), [['bob', 'Halo']]);
    assert.equal(response.body.entries[0].status, null);
  });

  test('respects activity visibility', async () => {
    await follow(me, bob);
    await follow(me, carol);
    await save(bob, games[0], { rating: 4 });
    await save(carol, games[1], { rating: 4 });
    await save(dave, games[2], { rating: 4 });
    await setActivity(bob, 'followers');
    await setActivity(carol, 'private');
    await setActivity(dave, 'public');

    assert.deepEqual(summary(await feed()), [['bob', 'Celeste']], 'followers-only is visible to a follower; private is not');
  });

  test('paginates newest first', async () => {
    await follow(me, bob);
    for (const game of games) await save(bob, game, { rating: 3 });
    const second = await feed('?limit=3&page=2');
    assert.deepEqual(summary(second), [['bob', 'Celeste']]);
    assert.deepEqual({ total: second.body.total, page: second.body.page, pages: second.body.pages }, { total: 4, page: 2, pages: 2 });
    assert.equal((await feed('?limit=100')).status, 400);
  });
});

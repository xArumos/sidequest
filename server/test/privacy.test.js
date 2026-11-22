const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const Game = require('sidequest-database/models/Game');
const User = require('sidequest-database/models/User');
const { requireAuth } = require('../src/auth');
const { createLogsRouter } = require('../src/logs');
const { createUsersRouter } = require('../src/users');
const { canViewActivity } = require('../src/visibility');
const { startApi } = require('./helpers/api');

// PBI-31 privacy matrix (#68, TC-PRIV-01): every viewer against every setting.
describe('activity and wishlist privacy', () => {
  let api;
  let game;
  let owner;
  let follower;
  let stranger;

  before(async () => {
    api = await startApi({ '': [createLogsRouter({ requireAuth }), createUsersRouter({ requireAuth })] });
    owner = await api.signIn('owner');
    follower = await api.signIn('follower');
    stranger = await api.signIn('stranger');
  });
  after(() => api.stop());

  beforeEach(async () => {
    await api.resetActivity();
    [game] = await Game.create([{ title: 'Celeste' }, { title: 'Hades' }]);
    await api.request(`/users/${owner.id}/follow`, { method: 'POST', cookie: follower.cookie });
    // The owner following the stranger must not let the stranger in.
    await api.request(`/users/${stranger.id}/follow`, { method: 'POST', cookie: owner.cookie });
  });

  const setSetting = (field, value) => api.request(`/me/${field === 'activityVisibility' ? 'activity' : 'wishlist'}-visibility`, {
    method: 'PATCH', cookie: owner.cookie, body: { [field]: value },
  });
  const viewers = () => ({ owner: owner.cookie, follower: follower.cookie, stranger: stranger.cookie, anonymous: undefined });
  const allowed = {
    public: ['owner', 'follower', 'stranger', 'anonymous'],
    followers: ['owner', 'follower'],
    private: ['owner'],
  };
  const resources = [
    { name: 'activity', field: 'activityVisibility', path: () => `/users/${owner.id}/logs`, code: 'ACTIVITY_PRIVATE',
      log: { rating: 5, text: 'Great.', status: 'played' } },
    { name: 'wishlist', field: 'wishlistVisibility', path: () => `/users/${owner.id}/wishlist`, code: 'WISHLIST_PRIVATE',
      log: { status: 'wishlist' } },
  ];

  for (const resource of resources) {
    for (const [setting, permitted] of Object.entries(allowed)) {
      test(`${resource.name} set to ${setting}`, async () => {
        await api.request(`/games/${game._id}/log`, { method: 'POST', cookie: owner.cookie, body: resource.log });
        assert.deepEqual((await setSetting(resource.field, setting)).body, { [resource.field]: setting });

        for (const [viewer, cookie] of Object.entries(viewers())) {
          const response = await api.request(resource.path(), { cookie });
          if (permitted.includes(viewer)) {
            assert.equal(response.status, 200, `${viewer} should see it`);
            assert.deepEqual(response.body.logs.map(log => log.game.title), ['Celeste'], viewer);
          } else {
            assert.equal(response.status, 403, `${viewer} should be denied`);
            assert.equal(response.body.error.code, resource.code, viewer);
            assert.deepEqual(Object.keys(response.body), ['error'], 'a denial leaks no records');
          }
        }
      });
    }
  }

  test('a follower loses access on unfollowing', async () => {
    await api.request(`/games/${game._id}/log`, { method: 'POST', cookie: owner.cookie, body: { rating: 4 } });
    await setSetting('activityVisibility', 'followers');
    assert.equal((await api.request(`/users/${owner.id}/logs`, { cookie: follower.cookie })).status, 200);
    await api.request(`/users/${owner.id}/follow`, { method: 'DELETE', cookie: follower.cookie });
    assert.equal((await api.request(`/users/${owner.id}/logs`, { cookie: follower.cookie })).status, 403);
  });

  test('activity and wishlist settings are independent', async () => {
    await api.request(`/games/${game._id}/log`, { method: 'POST', cookie: owner.cookie, body: { status: 'wishlist' } });
    await setSetting('activityVisibility', 'private');
    await setSetting('wishlistVisibility', 'public');
    assert.equal((await api.request(`/users/${owner.id}/logs`)).status, 403);
    assert.equal((await api.request(`/users/${owner.id}/wishlist`)).status, 200);
  });

  test('a private user’s reviews still appear on game pages and in the rating', async () => {
    await api.request(`/games/${game._id}/log`, { method: 'POST', cookie: owner.cookie, body: { rating: 4, text: 'Hard.' } });
    await setSetting('activityVisibility', 'private');
    const reviews = await api.request(`/games/${game._id}/reviews`);
    assert.deepEqual(reviews.body.reviews.map(review => review.text), ['Hard.']);
    assert.equal((await Game.findById(game._id)).ratingCount, 1);
  });

  test('profiles stay visible and report both settings', async () => {
    await setSetting('activityVisibility', 'private');
    await setSetting('wishlistVisibility', 'followers');
    const profile = await api.request(`/users/${owner.id}`);
    assert.equal(profile.status, 200);
    assert.equal(profile.body.user.activityVisibility, 'private');
    assert.equal(profile.body.user.wishlistVisibility, 'followers');
  });

  test('reads and validates the activity visibility setting', async () => {
    const path = '/me/activity-visibility';
    assert.deepEqual((await api.request(path, { cookie: owner.cookie })).body, { activityVisibility: 'public' });
    for (const value of ['friends', '', null, ['public']]) {
      const response = await setSetting('activityVisibility', value);
      assert.equal(response.status, 400);
      assert.equal(response.body.error.code, 'INVALID_VISIBILITY');
    }
    const extra = await api.request(path, {
      method: 'PATCH', cookie: owner.cookie, body: { activityVisibility: 'private', wishlistVisibility: 'public' },
    });
    assert.equal(extra.status, 400);
    assert.equal((await api.request(path)).status, 401);
    assert.equal((await api.request(path, { method: 'PATCH', body: { activityVisibility: 'private' } })).status, 401);
    const crossSite = await api.request(path, {
      method: 'PATCH', cookie: owner.cookie, body: { activityVisibility: 'private' }, origin: 'https://evil.example',
    });
    assert.equal(crossSite.status, 403);
    assert.equal((await User.findById(owner.id)).activityVisibility, 'public');
  });

  test('accounts saved before the setting existed are public', async () => {
    await api.request(`/games/${game._id}/log`, { method: 'POST', cookie: owner.cookie, body: { rating: 3 } });
    await User.collection.updateOne({ _id: new User.base.Types.ObjectId(owner.id) }, { $unset: { activityVisibility: '' } });
    assert.deepEqual((await api.request('/me/activity-visibility', { cookie: owner.cookie })).body, { activityVisibility: 'public' });
    assert.equal((await api.request(`/users/${owner.id}`)).body.user.activityVisibility, 'public');
    assert.equal((await api.request(`/users/${owner.id}/logs`, { cookie: stranger.cookie })).status, 200);
  });

  test('canViewActivity fails closed on unknown settings', async () => {
    const user = { _id: owner.id };
    assert.equal(await canViewActivity(owner.id, user, 'unexpected'), true, 'owner always sees');
    for (const viewer of [follower.id, stranger.id, null, undefined]) {
      assert.equal(await canViewActivity(viewer, user, 'unexpected'), false);
    }
    assert.equal(await canViewActivity(follower.id, user, 'followers'), true);
    assert.equal(await canViewActivity(null, { _id: owner.id }), true, 'defaults to the public activity setting');
  });
});

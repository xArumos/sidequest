const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const Follow = require('sidequest-database/models/Follow');
const { requireAuth } = require('../src/auth');
const { createUsersRouter } = require('../src/users');
const { startApi } = require('./helpers/api');

// PBI-30 follow API (#61), tested per #64. TC-FRIEND-01 reads as follow/unfollow (#59).
describe('follow API', () => {
  let api;
  let alice;
  let bob;
  let carol;
  const unknown = '000000000000000000000000';

  before(async () => {
    api = await startApi({ '': createUsersRouter({ requireAuth }) });
    alice = await api.signIn('alice');
    bob = await api.signIn('bob');
    carol = await api.signIn('carol');
  });
  after(() => api.stop());

  beforeEach(async () => {
    await api.resetActivity();
  });

  const follow = (who, target, options = {}) => api.request(`/users/${target}/follow`, { method: 'POST', cookie: who?.cookie, ...options });
  const unfollow = (who, target, options = {}) => api.request(`/users/${target}/follow`, { method: 'DELETE', cookie: who?.cookie, ...options });
  const profile = (target, who) => api.request(`/users/${target.id}`, { cookie: who?.cookie });
  const counts = response => {
    const { followerCount, followingCount, isFollowing } = response.body.user;
    return { followerCount, followingCount, isFollowing };
  };

  test('follows and unfollows a user (TC-FRIEND-01)', async () => {
    const followed = await follow(alice, bob.id);
    assert.equal(followed.status, 201);
    assert.deepEqual(followed.body, { isFollowing: true, followerCount: 1 });
    assert.deepEqual(counts(await profile(bob, alice)), { followerCount: 1, followingCount: 0, isFollowing: true });
    assert.deepEqual(counts(await profile(alice, alice)), { followerCount: 0, followingCount: 1, isFollowing: false });
    assert.deepEqual(counts(await profile(alice, bob)), { followerCount: 0, followingCount: 1, isFollowing: false },
      'follows are one-way');

    const unfollowed = await unfollow(alice, bob.id);
    assert.equal(unfollowed.status, 200);
    assert.deepEqual(unfollowed.body, { isFollowing: false, followerCount: 0 });
    assert.deepEqual(counts(await profile(bob, alice)), { followerCount: 0, followingCount: 0, isFollowing: false });
  });

  test('a duplicate follow succeeds without a second record', async () => {
    await follow(alice, bob.id);
    const again = await follow(alice, bob.id);
    assert.equal(again.status, 200);
    assert.deepEqual(again.body, { isFollowing: true, followerCount: 1 });

    const racing = await Promise.all([follow(carol, bob.id), follow(carol, bob.id)]);
    assert.deepEqual(racing.map(response => response.status).sort(), [200, 201]);
    assert.equal(await Follow.countDocuments({ followee: bob.id }), 2);
  });

  test('unfollowing someone you do not follow succeeds and changes nothing', async () => {
    await follow(carol, bob.id);
    const response = await unfollow(alice, bob.id);
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { isFollowing: false, followerCount: 1 });
  });

  test('rejects self-follows', async () => {
    for (const request of [follow, unfollow]) {
      const response = await request(alice, alice.id);
      assert.equal(response.status, 400);
      assert.equal(response.body.error.code, 'CANNOT_FOLLOW_SELF');
    }
    assert.equal(await Follow.countDocuments(), 0);
  });

  test('requires sign-in and the frontend origin', async () => {
    for (const request of [follow, unfollow]) {
      const anonymous = await request(null, bob.id);
      assert.equal(anonymous.status, 401);
      assert.equal(anonymous.body.error.code, 'UNAUTHENTICATED');
      for (const origin of [null, 'https://evil.example']) {
        const crossSite = await request(alice, bob.id, { origin });
        assert.equal(crossSite.status, 403);
        assert.equal(crossSite.body.error.code, 'INVALID_ORIGIN');
      }
    }
    assert.equal(await Follow.countDocuments(), 0);
  });

  test('reports unknown and malformed users', async () => {
    for (const path of ['/follow', '/followers', '/following', '']) {
      const method = path === '/follow' ? 'POST' : 'GET';
      const missing = await api.request(`/users/${unknown}${path}`, { method, cookie: alice.cookie });
      assert.equal(missing.status, 404, path);
      assert.equal(missing.body.error.code, 'USER_NOT_FOUND');
      assert.equal((await api.request(`/users/nope${path}`, { method, cookie: alice.cookie })).status, 400, path);
    }
    assert.equal((await unfollow(alice, unknown)).status, 404);
  });

  test('lists followers and following with public fields only, newest first', async () => {
    await follow(alice, bob.id);
    await follow(carol, bob.id);
    await follow(bob, carol.id);

    const followers = await api.request(`/users/${bob.id}/followers`);
    assert.equal(followers.status, 200);
    assert.deepEqual(followers.body, {
      users: [
        { id: carol.id, displayName: 'carol', username: null, avatarUrl: '' },
        { id: alice.id, displayName: 'alice', username: null, avatarUrl: '' },
      ],
      total: 2, page: 1, pages: 1,
    });
    assert.doesNotMatch(JSON.stringify(followers.body), /example\.com|googleId|Visibility/);

    const following = await api.request(`/users/${bob.id}/following`);
    assert.deepEqual(following.body.users.map(user => user.id), [carol.id]);
    assert.deepEqual((await api.request(`/users/${alice.id}/followers`)).body,
      { users: [], total: 0, page: 1, pages: 0 });
  });

  test('paginates follower lists and validates paging', async () => {
    await follow(alice, bob.id);
    await follow(carol, bob.id);
    const second = await api.request(`/users/${bob.id}/followers?limit=1&page=2`);
    assert.deepEqual(second.body.users.map(user => user.id), [alice.id]);
    assert.equal(second.body.pages, 2);
    for (const query of ['limit=0', 'limit=51', 'page=0', 'page=x']) {
      assert.equal((await api.request(`/users/${bob.id}/followers?${query}`)).status, 400, query);
    }
  });
});

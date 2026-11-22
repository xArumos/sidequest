const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const Game = require('sidequest-database/models/Game');
const { requireAuth } = require('../src/auth');
const { createApiRouters } = require('../src/routes');
const { startApi } = require('./helpers/api');

// The router table that src/index.js and the e2e server mount. One route from each
// feature router must answer, so no router is dropped by the wiring.
describe('API router table', () => {
  let api;
  let alice;
  let bob;
  let game;

  before(async () => {
    api = await startApi(createApiRouters({ requireAuth, rankingMinCount: 1 }));
    [alice, bob] = await Promise.all([api.signIn('alice'), api.signIn('bob')]);
    game = await Game.create({ title: 'Celeste' });
  });
  after(() => api.stop());

  test('mounts every feature router', async () => {
    const get = path => api.request(path, { cookie: alice.cookie });
    const routes = [
      ['games', `/games/${game._id}`, 200],
      ['logs', '/me/logs', 200],
      ['users', `/users/${bob.id}`, 200],
      ['follows and privacy', `/users/${bob.id}/followers`, 200],
      ['privacy settings', '/me/activity-visibility', 200],
      ['feed', '/feed', 200],
      ['developers', '/dev/games', 200],
      ['developer requests', `/games/${game._id}/developer-requests/me`, 200],
      // The admin router is mounted and refuses non-admins rather than answering 404.
      ['admin', '/admin/developer-requests', 403],
    ];
    for (const [name, path, status] of routes) {
      const response = await get(path);
      assert.equal(response.status, status, `${name}: GET ${path} -> ${JSON.stringify(response.body)}`);
    }
    const follow = await api.request(`/users/${bob.id}/follow`, { method: 'POST', cookie: alice.cookie });
    assert.equal(follow.status, 201);
  });
});

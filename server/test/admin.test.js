const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const path = require('node:path');
const Game = require('sidequest-database/models/Game');
const User = require('sidequest-database/models/User');
const { requireAuth } = require('../src/auth');
const { createAdminRouter } = require('../src/admin');
const { createDevelopersRouter } = require('../src/developers');
const { createUsersRouter } = require('../src/users');
const { startApi } = require('./helpers/api');

// Minimal admin tooling for approving developers (issue #93).
describe('admin developer requests', () => {
  let api;
  let games;
  let admin;
  let alice;
  let bob;

  before(async () => {
    api = await startApi({
      '': [createDevelopersRouter({ requireAuth }), createUsersRouter({ requireAuth })],
      '/admin': createAdminRouter({ requireAuth }),
    });
  });
  after(() => api.stop());

  beforeEach(async () => {
    await api.reset();
    games = await Game.create([{ title: 'Celeste' }, { title: 'Hades' }]);
    admin = await api.signIn('admin');
    alice = await api.signIn('alice');
    bob = await api.signIn('bob');
    await User.updateOne({ _id: admin.id }, { admin: true });
  });

  const ask = (who, game, justification) => api.request(`/games/${game._id}/developer-requests`, {
    method: 'POST', cookie: who.cookie, body: { justification },
  });
  const decide = (who, id, action) => api.request(`/admin/developer-requests/${id}/${action}`, { method: 'POST', cookie: who.cookie });
  const queue = (query = '', who = admin) => api.request(`/admin/developer-requests${query}`, { cookie: who.cookie });

  test('only admins reach the admin routes', async () => {
    assert.equal((await api.request('/admin/developer-requests')).status, 401);
    const denied = await queue('', alice);
    assert.equal(denied.status, 403);
    assert.equal(denied.body.error.code, 'NOT_ADMIN');
    assert.equal((await decide(alice, '000000000000000000000000', 'approve')).status, 403);
    assert.equal((await queue()).status, 200);

    await User.updateOne({ _id: admin.id }, { admin: false });
    assert.equal((await queue()).status, 403, 'revoking takes effect at once');
  });

  test('lists pending requests oldest first, with the requester and game', async () => {
    await ask(alice, games[0], 'I wrote the music.');
    await ask(bob, games[1], 'Studio lead.');
    const list = await queue();
    assert.equal(list.status, 200);
    assert.deepEqual(list.body.requests.map(request => [request.user.displayName, request.game.title, request.justification]),
      [['alice', 'Celeste', 'I wrote the music.'], ['bob', 'Hades', 'Studio lead.']]);
    assert.deepEqual({ ...list.body, requests: undefined }, { requests: undefined, total: 2, page: 1, pages: 1 });
    assert.doesNotMatch(JSON.stringify(list.body), /example\.com/, 'no email addresses');
    assert.deepEqual((await queue('?limit=1&page=2')).body.requests.map(request => request.user.displayName), ['bob']);
    assert.equal((await queue('?status=owner')).status, 400);
    assert.equal((await queue('?limit=0')).status, 400);
  });

  test('approves and rejects requests, recording who decided', async () => {
    const first = (await ask(alice, games[0], 'Composer.')).body.request.id;
    const second = (await ask(bob, games[0], 'Fan.')).body.request.id;

    const approved = await decide(admin, first, 'approve');
    assert.equal(approved.status, 200);
    assert.equal(approved.body.request.status, 'approved');
    assert.equal(approved.body.request.decidedBy, admin.id);
    assert.ok(Date.parse(approved.body.request.decidedAt));
    assert.equal((await decide(admin, second, 'reject')).body.request.status, 'rejected');

    assert.deepEqual((await queue()).body.requests, [], 'decided requests leave the pending queue');
    assert.deepEqual((await queue('?status=approved')).body.requests.map(request => request.id), [first]);
    assert.equal((await queue('?status=all')).body.total, 2);
    const mine = await api.request(`/games/${games[0]._id}/developer-requests/me`, { cookie: alice.cookie });
    assert.equal(mine.body.request.status, 'approved', 'the requester sees the decision');

    assert.equal((await decide(admin, first, 'reject')).body.request.status, 'rejected', 'an approval can be revoked');
    assert.equal((await decide(admin, '000000000000000000000000', 'approve')).status, 404);
    assert.equal((await decide(admin, 'nope', 'approve')).status, 400);
  });

  test('exposes the admin flag only to the account holder', async () => {
    assert.equal((await api.request('/auth/me', { cookie: admin.cookie })).body.user.admin, true);
    assert.equal((await api.request('/auth/me', { cookie: alice.cookie })).body.user.admin, false);
    assert.equal('admin' in (await api.request(`/users/${admin.id}`)).body.user, false);
  });

  test('set-admin.js grants and revokes the flag', async () => {
    const run = (...args) => new Promise(resolve => {
      execFile(process.execPath, [path.join(__dirname, '../scripts/set-admin.js'), ...args], {
        env: { ...process.env, MONGODB_URI: api.mongoUri, MONGODB_DB_NAME: api.dbName },
      }, (error, stdout) => resolve({ code: error ? error.code : 0, stdout }));
    });
    const granted = await run('--user', 'alice@example.com');
    assert.equal(granted.code, 0);
    assert.match(granted.stdout, /now an admin/);
    assert.equal((await queue('', alice)).status, 200);
    assert.equal((await run('--user', alice.id, '--revoke')).code, 0);
    assert.equal((await User.findById(alice.id).lean()).admin, false);
    assert.equal((await run('--user', 'nobody@example.com')).code, 1);
    assert.equal((await run()).code, 1);
  });
});

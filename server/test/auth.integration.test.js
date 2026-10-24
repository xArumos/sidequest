const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { randomUUID } = require('node:crypto');
const { MongoStore } = require('connect-mongo');
const { connectDatabase, disconnectDatabase } = require('sidequest-database');
const User = require('sidequest-database/models/User');
const { createApp } = require('../src/app');
const { createAuthRouter } = require('../src/auth');

test('accounts and sessions persist in MongoDB across app instances', { timeout: 20000 }, async t => {
  const connection = await connectDatabase({
    uri: process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/sidequest_test',
    dbName: 'sidequest_test',
  });
  const googleId = `test-${randomUUID()}`;
  const collectionName = `sessions_test_${randomUUID().replaceAll('-', '')}`;
  t.after(async () => {
    await User.deleteOne({ googleId });
    await connection.collection(collectionName).drop();
    await disconnectDatabase();
  });
  await User.init();
  const origin = 'http://localhost:5173';
  async function serve() {
    const router = createAuthRouter({
      frontendOrigin: origin, sessionSecret: 'test-secret-with-at-least-32-bytes', secureCookies: false,
      store: MongoStore.create({ client: connection.getClient(), dbName: connection.name, collectionName }),
      users: User,
      // Google verification is tested separately with signed JWTs; no production bypass exists.
      verifyGoogleToken: async () => ({ sub: googleId, email: 'test@example.com', email_verified: true, name: 'Test player' }),
    });
    const server = createApp({ frontendOrigin: origin, isDatabaseReady: async () => true, authRouter: router })
      .listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => new Promise(resolve => server.close(resolve)));
    return `http://127.0.0.1:${server.address().port}/api/auth`;
  }
  const first = await serve();
  const login = await fetch(first + '/google', {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential: 'integration-test-credential' }),
  });
  assert.equal(login.status, 200);
  const user = (await login.json()).user;
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const second = await serve();
  const me = await fetch(second + '/me', { headers: { Cookie: cookie } });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).user.id, user.id);
  assert.equal(await User.countDocuments({ googleId }), 1);
  assert.equal(await connection.collection(collectionName).countDocuments(), 1);
  const logout = await fetch(second + '/logout', { method: 'POST', headers: { Origin: origin, Cookie: cookie } });
  assert.equal(logout.status, 204);
  assert.equal((await fetch(first + '/me', { headers: { Cookie: cookie } })).status, 401);
  assert.equal(await connection.collection(collectionName).countDocuments(), 0);
});

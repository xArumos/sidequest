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
  await User.createIndexes();
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

test('password accounts persist, enforce unique identifiers, and remain separate from Google', { timeout: 20000 }, async t => {
  const connection = await connectDatabase({
    uri: process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/sidequest_test', dbName: 'sidequest_test',
  });
  const suffix = randomUUID().replaceAll('-', '').slice(0, 16);
  const username = `test_${suffix}`;
  const email = `${suffix}@example.com`;
  const googleId = `test-${suffix}`;
  const collectionName = `sessions_test_${suffix}`;
  const ids = [];
  t.after(async () => {
    await User.deleteMany({ _id: { $in: ids } });
    await connection.collection(collectionName).drop();
    await disconnectDatabase();
  });
  await User.createIndexes();
  const origin = 'http://localhost:5173';
  async function serve() {
    const router = createAuthRouter({
      frontendOrigin: origin, sessionSecret: 'test-secret-with-at-least-32-bytes', secureCookies: false,
      store: MongoStore.create({ client: connection.getClient(), dbName: connection.name, collectionName }), users: User,
      verifyGoogleToken: async () => ({ sub: googleId, email, email_verified: true, name: 'Google player' }),
    });
    const server = createApp({ frontendOrigin: origin, isDatabaseReady: async () => true, authRouter: router }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => new Promise(resolve => server.close(resolve)));
    return `http://127.0.0.1:${server.address().port}/api/auth`;
  }
  const first = await serve();
  const second = await serve();
  async function post(base, path, body, cookie) {
    return fetch(base + path, { method: 'POST', headers: {
      Origin: origin, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}),
    }, body: JSON.stringify(body) });
  }
  const password = 'persistent password with spaces';
  const signup = await post(first, '/register', { username: username.toUpperCase(), email: email.toUpperCase(), password });
  assert.equal(signup.status, 201);
  const { user } = await signup.json();
  ids.push(user.id);
  assert.equal(user.passwordHash, undefined);
  assert.equal((await User.findById(user.id)).passwordHash, undefined);
  assert.notEqual((await User.findById(user.id).select('+passwordHash')).passwordHash, password);
  const cookie = signup.headers.get('set-cookie').split(';')[0];
  assert.equal((await fetch(second + '/me', { headers: { Cookie: cookie } })).status, 200);
  for (const change of [{ username: username.toUpperCase(), email: `other-${email}` }, { username: `other_${suffix}`, email: email.toUpperCase() }]) {
    assert.equal((await post(first, '/register', { ...change, password })).status, 409);
  }
  const another = await post(first, '/register', { username: `other_${suffix}`, email: `other-${email}`, password });
  assert.equal(another.status, 201);
  ids.push((await another.json()).user.id);
  for (const identifier of [username.toUpperCase(), email.toUpperCase()]) {
    const login = await post(second, '/login', { identifier, password }, cookie);
    assert.equal(login.status, 200);
    assert.equal((await login.json()).user.id, user.id);
    assert.equal((await fetch(first + '/me', { headers: { Cookie: cookie } })).status, 401);
    const rotated = login.headers.get('set-cookie').split(';')[0];
    await post(first, '/logout', {}, rotated);
    assert.equal((await fetch(second + '/me', { headers: { Cookie: rotated } })).status, 401);
  }
  const google = await post(first, '/google', { credential: 'test-token' });
  assert.equal(google.status, 200);
  const googleUser = (await google.json()).user;
  ids.push(googleUser.id);
  assert.notEqual(googleUser.id, user.id);
  assert.equal(googleUser.username, null);
  assert.equal(googleUser.email, user.email);
  assert.equal((await post(first, '/login', { identifier: email, password })).status, 200);
});

test('legacy Google index migration preserves users and unrelated indexes and is repeatable', { timeout: 20000 }, async t => {
  const { execFile } = require('node:child_process');
  const { promisify } = require('node:util');
  const path = require('node:path');
  const { assertUserIndexes } = require('../src/user-indexes');
  const dbName = `sidequest_migration_test_${randomUUID().replaceAll('-', '')}`;
  const connection = await connectDatabase({ uri: process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017', dbName });
  t.after(async () => {
    await connection.dropDatabase();
    await disconnectDatabase();
  });
  await User.collection.createIndex({ googleId: 1 }, { unique: true, name: 'googleId_1' });
  await User.collection.createIndex({ displayName: 1 }, { name: 'preserve_display_name' });
  const existing = await User.collection.insertOne({ googleId: 'legacy', email: 'old@example.com', displayName: 'Existing player' });
  await assert.rejects(assertUserIndexes(User.collection), /migrate:auth/);
  for (let run = 0; run < 2; run++) {
    await promisify(execFile)(process.execPath, [path.join(__dirname, '../scripts/migrate-auth.js')], {
      env: { ...process.env, MONGODB_URI: process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017', MONGODB_DB_NAME: dbName },
    });
  }
  await assertUserIndexes(User.collection);
  assert.equal((await User.findById(existing.insertedId)).googleId, 'legacy');
  const indexes = await User.collection.indexes();
  assert.ok(indexes.some(index => index.name === 'preserve_display_name'));
  assert.ok(indexes.some(index => index.name === 'googleId_unique' && index.partialFilterExpression));
  assert.ok(indexes.some(index => index.name === 'password_email_unique' && index.unique));
  await User.create({ username: 'first', email: 'first@example.com', displayName: 'First', passwordHash: 'test-hash' });
  await User.create({ username: 'second', email: 'second@example.com', displayName: 'Second', passwordHash: 'test-hash' });
  await assert.rejects(User.create({ email: 'invalid@example.com', displayName: 'No auth' }), /authentication method/);
});

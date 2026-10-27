const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { MemoryStore } = require('express-session');
const { createApp } = require('../src/app');
const { createAuthRouter } = require('../src/auth');

const origin = 'http://localhost:5173';
const profile = { sub: 'google-subject', email: 'player@example.com', email_verified: true, name: 'Player' };

async function fixture(t, options = {}) {
  const records = new Map();
  const users = options.users || {
    async findOneAndUpdate({ googleId }, { $set }) {
      const user = { _id: googleId, ...$set };
      records.set(googleId, user);
      return user;
    },
    async findById(id) { return records.get(id); },
    async create(data) {
      if ([...records.values()].some(user => user.username === data.username || user.passwordHash && user.email === data.email)) {
        throw Object.assign(new Error('Duplicate'), { code: 11000 });
      }
      const user = { _id: data.username, avatarUrl: '', ...data };
      records.set(user._id, user);
      return user;
    },
    findOne(query) {
      return { async select() {
        return [...records.values()].find(user => user.passwordHash &&
          (query.username ? user.username === query.username : user.email === query.email));
      } };
    },
  };
  const store = options.store || new MemoryStore();
  const authRouter = createAuthRouter({
    frontendOrigin: origin, sessionSecret: 'test-secret-with-at-least-32-bytes',
    secureCookies: false, store, users,
    verifyGoogleToken: options.verifyGoogleToken === null ? undefined : options.verifyGoogleToken || (async credential => {
      if (credential !== 'valid-google-token') throw new Error('Invalid token');
      return profile;
    }),
  });
  const server = createApp({ frontendOrigin: origin, isDatabaseReady: async () => true, authRouter, logger: { error() {} } })
    .listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/auth`;
  const request = (path, { method = 'GET', cookie, body, requestOrigin = origin } = {}) => fetch(base + path, {
    method,
    headers: {
      ...(requestOrigin ? { Origin: requestOrigin } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { request, records, store };
}

test('Google login creates an account, persists a cookie session, and logout invalidates it', async t => {
  const { request, records } = await fixture(t);
  assert.equal((await request('/me')).status, 401);
  const login = await request('/google', { method: 'POST', body: { credential: 'valid-google-token' } });
  assert.equal(login.status, 200);
  const user = (await login.json()).user;
  assert.equal(user.displayName, 'Player');
  assert.equal(user.googleId, undefined);
  const header = login.headers.get('set-cookie');
  assert.match(header, /HttpOnly/i);
  assert.match(header, /SameSite=Lax/i);
  const cookie = header.split(';')[0];
  const me = await request('/me', { cookie });
  assert.equal(me.status, 200);
  assert.equal(me.headers.get('cache-control'), 'no-store');
  assert.deepEqual((await me.json()).user, user);
  assert.equal(records.size, 1);
  const second = await request('/google', { method: 'POST', cookie, body: { credential: 'valid-google-token' } });
  assert.equal(second.status, 200);
  const rotated = second.headers.get('set-cookie').split(';')[0];
  assert.notEqual(rotated, cookie);
  assert.equal(records.size, 1);
  assert.equal((await request('/me', { cookie })).status, 401);
  const logout = await request('/logout', { method: 'POST', cookie: rotated });
  assert.equal(logout.status, 204);
  assert.match(logout.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/i);
  assert.equal((await request('/me', { cookie: rotated })).status, 401);
  assert.equal((await request('/logout', { method: 'POST' })).status, 204);
});

test('missing and invalid Google credentials do not create accounts or sessions', async t => {
  const { request, records } = await fixture(t);
  for (const credential of [undefined, '', {}, 'invalid-token']) {
    const response = await request('/google', { method: 'POST', body: { credential } });
    assert.equal(response.status, credential === 'invalid-token' ? 401 : 400);
    assert.equal(response.headers.get('set-cookie'), null);
  }
  assert.equal(records.size, 0);
});

test('unverified Google email is rejected', async t => {
  const { request, records } = await fixture(t, {
    verifyGoogleToken: async () => ({ ...profile, email_verified: false }),
  });
  assert.equal((await request('/google', { method: 'POST', body: { credential: 'token' } })).status, 401);
  assert.equal(records.size, 0);
});

test('cross-origin and missing-origin requests cannot sign in or log out', async t => {
  const { request, records } = await fixture(t);
  for (const requestOrigin of ['https://unrelated.example', null]) {
    for (const path of ['/google', '/register', '/login', '/logout']) {
      assert.equal((await request(path, { method: 'POST', requestOrigin, body: { credential: 'valid-google-token' } })).status, 403);
    }
  }
  assert.equal(records.size, 0);
});

test('tampered session cookies are rejected and deleted accounts lose access', async t => {
  const { request, records } = await fixture(t);
  const login = await request('/google', { method: 'POST', body: { credential: 'valid-google-token' } });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  assert.equal((await request('/me', { cookie: cookie + 'tampered' })).status, 401);
  records.clear();
  assert.equal((await request('/me', { cookie })).status, 401);
});

test('login attempts are rate limited', async t => {
  const { request } = await fixture(t);
  for (let i = 0; i < 30; i++) {
    assert.equal((await request('/google', { method: 'POST', body: { credential: 'invalid-token' } })).status, 401);
  }
  assert.equal((await request('/google', { method: 'POST', body: { credential: 'invalid-token' } })).status, 429);
});

test('database failures return a generic error and never authenticate the request', async t => {
  const { request } = await fixture(t, {
    users: { async findOneAndUpdate() { throw new Error('Private database details'); } },
  });
  const response = await request('/google', { method: 'POST', body: { credential: 'valid-google-token' } });
  assert.equal(response.status, 500);
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal((await response.json()).error.code, 'INTERNAL_ERROR');
});

const registration = { username: 'Player_1', email: 'Player@Example.com', password: 'a long test password' };

test('password registration and login normalize identifiers, rotate sessions, and never expose hashes', async t => {
  const { request, records } = await fixture(t);
  const signup = await request('/register', { method: 'POST', body: registration });
  assert.equal(signup.status, 201);
  const { user } = await signup.json();
  assert.equal(user.username, 'player_1');
  assert.equal(user.email, 'player@example.com');
  assert.equal(user.passwordHash, undefined);
  assert.match(records.get(user.id).passwordHash, /^scrypt\$v1\$/);
  const cookie = signup.headers.get('set-cookie').split(';')[0];
  assert.equal((await request('/me', { cookie })).status, 200);
  for (const identifier of [' PLAYER_1 ', 'PLAYER@EXAMPLE.COM']) {
    const login = await request('/login', { method: 'POST', cookie, body: { identifier, password: registration.password } });
    assert.equal(login.status, 200);
    assert.deepEqual((await login.json()).user, user);
    const rotated = login.headers.get('set-cookie').split(';')[0];
    assert.notEqual(rotated, cookie);
    assert.equal((await request('/me', { cookie })).status, 401);
    assert.equal((await request('/logout', { method: 'POST', cookie: rotated })).status, 204);
    assert.equal((await request('/me', { cookie: rotated })).status, 401);
  }
});

test('invalid registration and duplicate identifiers do not create extra accounts', async t => {
  const { request, records } = await fixture(t);
  for (const change of [{ username: 'ab' }, { username: 'player@one' }, { email: 'invalid' },
    { password: 'short' }, { password: 'x'.repeat(129) }, { password: {} }]) {
    assert.equal((await request('/register', { method: 'POST', body: { ...registration, ...change } })).status, 400);
  }
  assert.equal(records.size, 0);
  assert.equal((await request('/register', { method: 'POST', body: registration })).status, 201);
  for (const change of [{ username: 'PLAYER_1', email: 'other@example.com' },
    { username: 'different', email: 'PLAYER@EXAMPLE.COM' }]) {
    assert.equal((await request('/register', { method: 'POST', body: { ...registration, ...change } })).status, 409);
  }
  assert.equal(records.size, 1);
});

test('unknown users and wrong passwords receive the same generic rejection', async t => {
  const { request } = await fixture(t);
  await request('/register', { method: 'POST', body: registration });
  const responses = [];
  for (const identifier of ['player_1', 'missing', 'missing@example.com']) {
    const response = await request('/login', { method: 'POST', body: { identifier, password: 'incorrect password' } });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('set-cookie'), null);
    responses.push(await response.json());
  }
  assert.deepEqual(responses[0], responses[1]);
  assert.deepEqual(responses[1], responses[2]);
});

test('password login and registration each rate limit attempts', async t => {
  const { request } = await fixture(t);
  for (const path of ['/register', '/login']) {
    for (let i = 0; i < 30; i++) {
      assert.equal((await request(path, { method: 'POST', body: {} })).status, 400);
    }
    assert.equal((await request(path, { method: 'POST', body: {} })).status, 429);
  }
});

test('Google is optional for password authentication', async t => {
  const { request } = await fixture(t, { verifyGoogleToken: null });
  assert.equal((await request('/google', { method: 'POST', body: { credential: 'token' } })).status, 503);
  assert.equal((await request('/register', { method: 'POST', body: registration })).status, 201);
});

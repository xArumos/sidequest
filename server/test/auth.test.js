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
  };
  const store = options.store || new MemoryStore();
  const authRouter = createAuthRouter({
    frontendOrigin: origin, sessionSecret: 'test-secret-with-at-least-32-bytes',
    secureCookies: false, store, users,
    verifyGoogleToken: options.verifyGoogleToken || (async credential => {
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
    for (const path of ['/google', '/logout']) {
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

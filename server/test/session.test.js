const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { Router } = require('express');
const { MemoryStore } = require('express-session');
const { createApp } = require('../src/app');
const { createAuthRouter, requireAuth } = require('../src/auth');
const { createSessionMiddleware, authNotConfigured } = require('../src/session');

const origin = 'http://localhost:5173';
const sessionSecret = 'test-secret-with-at-least-32-bytes';

async function serve(t, { withAuth = true } = {}) {
  const store = new MemoryStore();
  const records = new Map();
  const users = {
    async findOneAndUpdate({ googleId }, { $set }) {
      const user = { _id: googleId, ...$set };
      records.set(googleId, user);
      return user;
    },
    async findById(id) { return records.get(id); },
  };
  const probe = Router();
  probe.get('/', (req, res) => res.json({ userId: req.session?.userId ?? null }));
  probe.post('/', withAuth ? requireAuth : authNotConfigured, (req, res) => res.json({ userId: req.session.userId }));

  const server = createApp({
    frontendOrigin: origin,
    isDatabaseReady: async () => true,
    logger: { error() {} },
    routers: { '/probe': probe },
    ...(withAuth && {
      sessionMiddleware: createSessionMiddleware({ sessionSecret, secureCookies: false, store }),
      authRouter: createAuthRouter({
        frontendOrigin: origin, sessionSecret, secureCookies: false, store, users,
        verifyGoogleToken: async () => ({ sub: 'subject', email: 'p@example.com', email_verified: true, name: 'P' }),
      }),
    }),
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  return (path, { method = 'GET', cookie, requestOrigin = origin, body } = {}) => fetch(base + path, {
    method,
    headers: {
      ...(requestOrigin && { Origin: requestOrigin }),
      ...(cookie && { Cookie: cookie }),
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
}

test('a session created by the auth router is visible to other routers', async t => {
  const request = await serve(t);
  assert.deepEqual(await (await request('/probe')).json(), { userId: null });
  assert.equal((await request('/probe', { method: 'POST' })).status, 401);

  const login = await request('/auth/google', { method: 'POST', body: { credential: 'token' } });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  assert.deepEqual(await (await request('/probe', { cookie })).json(), { userId: 'subject' });
  assert.deepEqual(await (await request('/probe', { method: 'POST', cookie })).json(), { userId: 'subject' });

  assert.equal((await request('/auth/logout', { method: 'POST', cookie })).status, 204);
  assert.equal((await request('/probe', { method: 'POST', cookie })).status, 401);
});

test('writes anywhere under /api require the frontend origin; reads do not', async t => {
  const request = await serve(t);
  for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) {
    for (const requestOrigin of [null, 'https://evil.example', 'http://localhost:5173.evil.example']) {
      const response = await request('/probe', { method, requestOrigin });
      assert.equal(response.status, 403, `${method} from ${requestOrigin}`);
      assert.equal((await response.json()).error.code, 'INVALID_ORIGIN');
    }
  }
  assert.equal((await request('/probe', { requestOrigin: 'https://evil.example' })).status, 200);
  assert.equal((await request('/missing', { method: 'DELETE', requestOrigin: null })).status, 403);
});

test('protected routes report 503 when sign-in is not configured', async t => {
  const request = await serve(t, { withAuth: false });
  assert.deepEqual(await (await request('/probe')).json(), { userId: null });
  const response = await request('/probe', { method: 'POST' });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'AUTH_NOT_CONFIGURED');
});

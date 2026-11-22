const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { Router } = require('express');
const { MemoryStore } = require('express-session');
const { createApp } = require('../src/app');
const { createAuthRouter, requireAuth } = require('../src/auth');
const { createSessionMiddleware } = require('../src/session');
const { createGamesRouter } = require('../src/games');
const { createLogsRouter } = require('../src/logs');
const { createUsersRouter } = require('../src/users');

const origin = 'http://localhost:5173';
const sessionSecret = 'test-secret-with-at-least-32-bytes';
const forbidden = { error: { code: 'INVALID_ORIGIN', message: 'Request origin is not allowed.' } };

// Builds the app the way index.js does, with an in-memory session store and user list.
// No database is needed: every request here is answered before a handler queries MongoDB.
async function start({ routers = {}, ...options } = {}) {
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
  const authRouter = createAuthRouter({
    frontendOrigin: origin, sessionSecret, secureCookies: false, store, users,
    verifyGoogleToken: async sub => ({ sub, email: `${sub}@example.com`, email_verified: true, name: sub }),
  });
  const server = createApp({
    frontendOrigin: origin,
    isDatabaseReady: async () => true,
    logger: { error() {} },
    sessionMiddleware: createSessionMiddleware({ sessionSecret, secureCookies: false, store }),
    authRouter,
    routers,
    // Off unless a test opts in; `undefined` exercises the production default.
    writeRateLimit: 'writeRateLimit' in options ? options.writeRateLimit : false,
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api`;
  return { base, authRouter, close: () => new Promise(resolve => server.close(resolve)) };
}

async function serve(t, options) {
  const served = await start(options);
  t.after(served.close);
  return served;
}

function send(base, path, { method = 'POST', headers = {}, body = {} } = {}) {
  return fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    ...(method !== 'GET' && { body: JSON.stringify(body) }),
  });
}

async function signIn(base, name) {
  const response = await send(base, '/auth/google', { headers: { Origin: origin }, body: { credential: name } });
  assert.equal(response.status, 200);
  return response.headers.get('set-cookie').split(';')[0];
}

// Lists [METHOD, path] for every state-changing route registered on a router.
function writeRoutes(prefix, router) {
  return router.stack.flatMap(layer => {
    if (layer.route) {
      return Object.keys(layer.route.methods)
        .filter(method => !['get', 'head', 'options', '_all'].includes(method))
        .map(method => [method.toUpperCase(), prefix + layer.route.path]);
    }
    return layer.handle?.stack ? writeRoutes(prefix, layer.handle) : [];
  });
}

test('API responses carry restrictive security headers', async t => {
  const { base } = await serve(t);
  for (const response of [await fetch(`${base}/health`), await fetch(`${base}/missing`)]) {
    const csp = response.headers.get('content-security-policy');
    assert.match(csp, /default-src 'none'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.match(response.headers.get('strict-transport-security'), /max-age=\d+/);
    assert.equal(response.headers.get('x-powered-by'), null);
  }
  const preflight = await fetch(`${base}/auth/login`, {
    method: 'OPTIONS',
    headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
});

describe('Origin check', () => {
  const objectId = 'a'.repeat(24);
  let base;
  let routes;
  let close;

  before(async () => {
    const routers = {
      '/games': createGamesRouter(),
      '': [createLogsRouter({ requireAuth }), createUsersRouter({ requireAuth })],
    };
    const served = await start({ routers });
    ({ base, close } = served);
    routes = [
      ...writeRoutes('/auth', served.authRouter),
      ...Object.entries(routers).flatMap(([prefix, list]) => [list].flat().flatMap(r => writeRoutes(prefix, r))),
    ].map(([method, path]) => [method, path.replace(/:\w+/g, objectId)]);
  });
  after(() => close());

  test('discovers every mounted state-changing route', () => {
    const names = routes.map(route => route.join(' '));
    for (const expected of ['POST /auth/login', 'POST /auth/register', 'POST /auth/google', 'POST /auth/logout',
      `POST /games/${objectId}/log`, `PATCH /logs/${objectId}`, `DELETE /logs/${objectId}`, 'PATCH /me/wishlist-visibility']) {
      assert.ok(names.includes(expected), `${expected} is missing from ${names.join(', ')}`);
    }
  });

  test('rejects every state-changing route without or with a foreign Origin', async () => {
    for (const [method, path] of routes) {
      for (const headers of [{}, { Origin: 'https://evil.example' }, { Origin: `${origin}.evil.example` }]) {
        const response = await send(base, path, { method, headers });
        assert.equal(response.status, 403, `${method} ${path} ${JSON.stringify(headers)}`);
        assert.deepEqual(await response.json(), forbidden);
      }
    }
  });

  test('lets the same routes through to their handlers with the frontend Origin', async () => {
    for (const [method, path] of routes) {
      const response = await send(base, path, { method, headers: { Origin: origin } });
      assert.notEqual(response.status, 403, `${method} ${path}`);
    }
  });

  test('also guards non-GET requests to paths with no route yet', async () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const response = await send(base, '/steam/sync', { method });
      assert.equal(response.status, 403, method);
    }
  });
});

describe('write rate limit', () => {
  test('limits writes per signed-in user with the standard error shape and ignores reads', async t => {
    const probe = Router();
    probe.get('/', (_req, res) => res.json({ ok: true }));
    probe.post('/', (_req, res) => res.json({ ok: true }));
    const { base } = await serve(t, { routers: { '/probe': probe }, writeRateLimit: { windowMs: 60000, limit: 3 } });
    // Each sign-in is an anonymous write, counted against the IP.
    const alice = await signIn(base, 'alice');
    const bob = await signIn(base, 'bob');

    for (let i = 0; i < 3; i++) {
      assert.equal((await send(base, '/probe', { headers: { Origin: origin, Cookie: alice } })).status, 200);
    }
    const limited = await send(base, '/probe', { headers: { Origin: origin, Cookie: alice } });
    assert.equal(limited.status, 429);
    assert.deepEqual(await limited.json(), { error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again later.' } });
    assert.match(limited.headers.get('ratelimit-policy'), /q=3/);

    for (let i = 0; i < 5; i++) {
      assert.equal((await send(base, '/probe', { method: 'GET', headers: { Cookie: alice } })).status, 200);
    }
    // Bob and anonymous visitors keep their own budgets.
    assert.equal((await send(base, '/probe', { headers: { Origin: origin, Cookie: bob } })).status, 200);
    assert.equal((await send(base, '/probe', { headers: { Origin: origin } })).status, 200);
    assert.equal((await send(base, '/probe', { headers: { Origin: origin } })).status, 429);
  });

  test('is on by default and can be disabled', async t => {
    const probe = Router();
    probe.post('/', (_req, res) => res.json({ ok: true }));
    const enabled = await serve(t, { routers: { '/probe': probe }, writeRateLimit: undefined });
    const response = await send(enabled.base, '/probe', { headers: { Origin: origin } });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('ratelimit-policy'), /q=300/);
    const disabled = await serve(t, { routers: { '/probe': probe }, writeRateLimit: false });
    assert.equal((await send(disabled.base, '/probe', { headers: { Origin: origin } })).headers.get('ratelimit-policy'), null);
  });

  test('fills omitted settings from the defaults', async t => {
    const probe = Router();
    probe.post('/', (_req, res) => res.json({ ok: true }));
    const { base } = await serve(t, { routers: { '/probe': probe }, writeRateLimit: { limit: 1 } });
    const first = await send(base, '/probe', { headers: { Origin: origin } });
    assert.equal(first.status, 200);
    assert.match(first.headers.get('ratelimit-policy'), /q=1; w=900/);
    assert.equal((await send(base, '/probe', { headers: { Origin: origin } })).status, 429);
  });
});

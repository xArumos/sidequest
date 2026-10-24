const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createApp } = require('../src/app');

async function serve(t, isDatabaseReady = async () => true) {
  const server = createApp({
    frontendOrigin: 'http://localhost:5173',
    isDatabaseReady,
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  return `http://127.0.0.1:${server.address().port}`;
}

test('health stays available when the database is down', async (t) => {
  const base = await serve(t, async () => false);
  const response = await fetch(`${base}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('readiness succeeds and cannot be cached', async (t) => {
  const base = await serve(t);
  const response = await fetch(`${base}/api/ready`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { status: 'ready' });
});

for (const [name, check] of [
  ['disconnected', async () => false],
  ['ping fails', async () => { throw new Error('private connection details'); }],
]) {
  test(`readiness returns 503 when ${name}`, async (t) => {
    const base = await serve(t, check);
    const response = await fetch(`${base}/api/ready`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: 'unavailable' });
  });
}

test('unknown routes return a JSON 404', async (t) => {
  const base = await serve(t);
  const response = await fetch(`${base}/api/missing`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    error: { code: 'NOT_FOUND', message: 'Route not found.' },
  });
});

for (const [name, body, status, code] of [
  ['malformed JSON', '{', 400, 'INVALID_JSON'],
  ['oversized JSON', JSON.stringify({ text: 'a'.repeat(102401) }), 413, 'BODY_TOO_LARGE'],
]) {
  test(`${name} produces a JSON client error`, async (t) => {
    const base = await serve(t);
    const response = await fetch(`${base}/api/missing`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
    });
    assert.equal(response.status, status);
    assert.equal((await response.json()).error.code, code);
  });
}

test('CORS permits the configured frontend including preflight', async (t) => {
  const base = await serve(t);
  const response = await fetch(`${base}/api/health`, {
    headers: { Origin: 'http://localhost:5173' },
  });
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
  const preflight = await fetch(`${base}/api/health`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:5173',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
    },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  assert.match(preflight.headers.get('access-control-allow-headers'), /content-type/i);
});

test('CORS does not grant access to a different origin', async (t) => {
  const base = await serve(t);
  const response = await fetch(`${base}/api/health`, {
    headers: { Origin: 'https://unrelated.example' },
  });
  const allowedOrigin = response.headers.get('access-control-allow-origin');
  assert.notEqual(allowedOrigin, 'https://unrelated.example');
  assert.notEqual(allowedOrigin, '*');
});

test('unconfigured authentication returns a clear 503 without creating a cookie', async t => {
  const base = await serve(t);
  const response = await fetch(`${base}/api/auth/me`);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'AUTH_NOT_CONFIGURED');
  assert.equal(response.headers.get('set-cookie'), null);
});

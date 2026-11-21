const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readConfig } = require('../src/config');

test('configuration supplies local defaults and accepts environment overrides', () => {
  assert.deepEqual(readConfig({}), {
    host: '127.0.0.1', port: 5000, frontendOrigin: 'http://localhost:5173', auth: null, rankingMinCount: 3, steam: { enabled: false },
  });
  assert.deepEqual(readConfig({ HOST: '0.0.0.0', PORT: '5001', FRONTEND_ORIGIN: 'https://sidequest.example' }), {
    host: '0.0.0.0', port: 5001, frontendOrigin: 'https://sidequest.example', auth: null, rankingMinCount: 3, steam: { enabled: false },
  });
});

test('configuration reads and validates the ranking minimum count', () => {
  assert.equal(readConfig({ RANKING_MIN_COUNT: '5' }).rankingMinCount, 5);
  for (const RANKING_MIN_COUNT of ['', '0', '-1', '1.5', 'abc']) {
    assert.throws(() => readConfig({ RANKING_MIN_COUNT }), /RANKING_MIN_COUNT/);
  }
});

test('configuration rejects invalid ports and origins before startup', () => {
  for (const PORT of ['', '0', '-1', '65536', '1.5', 'abc', '5e3']) {
    assert.throws(() => readConfig({ PORT }), /PORT/);
  }
  for (const FRONTEND_ORIGIN of ['', '*', 'invalid', 'file:///tmp', 'https://example.com/path', 'http://localhost:5173/']) {
    assert.throws(() => readConfig({ FRONTEND_ORIGIN }), /FRONTEND_ORIGIN/);
  }
  assert.throws(() => readConfig({ HOST: '' }), /HOST/);
});

test('authentication requires a strong session secret with an optional Google client ID', () => {
  const googleClientId = '123-example.apps.googleusercontent.com';
  const sessionSecret = 'x'.repeat(32);
  assert.throws(() => readConfig({ GOOGLE_CLIENT_ID: googleClientId }), /SESSION_SECRET/);
  assert.deepEqual(readConfig({ SESSION_SECRET: sessionSecret }).auth, {
    googleClientId: '', sessionSecret, secureCookies: false,
  });
  assert.throws(() => readConfig({ SESSION_SECRET: sessionSecret, GOOGLE_CLIENT_ID: 'invalid' }), /GOOGLE_CLIENT_ID/);
  assert.throws(() => readConfig({ SESSION_SECRET: 'short' }), /SESSION_SECRET/);
  assert.deepEqual(readConfig({ GOOGLE_CLIENT_ID: googleClientId, SESSION_SECRET: sessionSecret, NODE_ENV: 'production' }).auth, {
    googleClientId, sessionSecret, secureCookies: true,
  });
});

test('Steam is disabled without STEAM_API_KEY', () => {
  for (const STEAM_API_KEY of [undefined, '', '   ']) {
    const { steam } = readConfig({ STEAM_API_KEY });
    assert.equal(steam.enabled, false);
    assert.equal(steam.apiKey, '');
  }
});

test('Steam is enabled with STEAM_API_KEY and the key never appears when the config is printed', () => {
  const key = 'ABCDEF0123456789ABCDEF0123456789';
  const config = readConfig({ STEAM_API_KEY: ` ${key} ` });
  assert.equal(config.steam.enabled, true);
  assert.equal(config.steam.apiKey, key);
  assert.ok(!JSON.stringify(config).includes(key));
  assert.ok(!require('node:util').inspect(config, { depth: null }).includes(key));
});

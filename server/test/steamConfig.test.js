const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readConfig } = require('../src/config');
const { requireSteamApiKey } = require('../src/steamConfig');

function run(middleware) {
  const res = {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  let nextCalled = false;
  middleware({}, res, () => { nextCalled = true; });
  return { res, nextCalled };
}

test('requireSteamApiKey answers 503 STEAM_UNAVAILABLE when the key is missing', () => {
  for (const steam of [readConfig({}).steam, readConfig({ STEAM_API_KEY: ' ' }).steam, undefined]) {
    const { res, nextCalled } = run(requireSteamApiKey(steam));
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 503);
    assert.deepEqual(res.body, { error: { code: 'STEAM_UNAVAILABLE', message: 'Steam features are not configured.' } });
  }
});

test('requireSteamApiKey passes through when the key is set and sends nothing itself', () => {
  const { res, nextCalled } = run(requireSteamApiKey(readConfig({ STEAM_API_KEY: 'ABCDEF0123456789ABCDEF0123456789' }).steam));
  assert.equal(nextCalled, true);
  assert.equal(res.body, undefined);
  assert.equal(res.statusCode, 200);
});

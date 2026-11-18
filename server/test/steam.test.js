const assert = require('node:assert/strict');
const { after, before, beforeEach, test } = require('node:test');
const User = require('sidequest-database/models/User');
const { requireAuth } = require('../src/auth');
const { createSteamRouter } = require('../src/steam');
const { startApi } = require('./helpers/api');

const origin = 'http://localhost:5173';
const endpoint = 'https://steamcommunity.com/openid/login';
const steamId = '76561198000000001';
let api;
let alice;
let checks;
let steamReply;

before(async () => {
  api = await startApi({
    '/steam': createSteamRouter({
      frontendOrigin: origin,
      requireAuth,
      fetchSteam: async (url, options) => {
        checks.push({ url, ...options });
        return new Response(steamReply);
      },
    }),
  });
  await User.createIndexes();
});

after(async () => api?.stop());

beforeEach(async () => {
  await api.reset();
  alice = await api.signIn('alice');
  checks = [];
  steamReply = 'ns:http://specs.openid.net/auth/2.0\nis_valid:true\n';
});

async function begin(cookie = alice.cookie) {
  const result = await api.request('/steam/connect', { method: 'POST', cookie });
  assert.equal(result.status, 200);
  const url = new URL(result.body.url);
  assert.equal(url.origin + url.pathname, endpoint);
  assert.equal(url.searchParams.get('openid.mode'), 'checkid_setup');
  assert.equal(url.searchParams.get('openid.realm'), origin + '/');
  return new URL(url.searchParams.get('openid.return_to'));
}

function assertion(returnTo) {
  const claimed = 'https://steamcommunity.com/openid/id/' + steamId;
  return {
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'id_res',
    'openid.return_to': returnTo.href,
    'openid.op_endpoint': endpoint,
    'openid.claimed_id': claimed,
    'openid.identity': claimed,
    'openid.response_nonce': new Date().toISOString().slice(0, 19) + 'Zsample',
    'openid.signed': 'op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle',
    'openid.assoc_handle': 'steam-test-handle',
    'openid.sig': 'steam-test-signature',
  };
}

async function callback(returnTo, fields, cookie = alice.cookie) {
  const url = new URL(api.base + '/steam/callback');
  url.searchParams.set('state', returnTo.searchParams.get('state'));
  for (const [key, value] of Object.entries(fields)) url.searchParams.append(key, value);
  const result = await fetch(url, { redirect: 'manual', headers: { Cookie: cookie } });
  assert.equal(result.status, 303);
  return result.headers.get('location');
}

async function connection(cookie = alice.cookie) {
  const result = await api.request('/steam', { cookie });
  assert.equal(result.status, 200);
  return result.body;
}

test('links a verified Steam ID once and allows disconnecting', async () => {
  const returnTo = await begin();
  const proof = assertion(returnTo);
  assert.equal(await callback(returnTo, proof), origin + '/profile?steam=linked');
  assert.equal(checks.length, 1);
  assert.equal(checks[0].url, endpoint);
  assert.equal(checks[0].method, 'POST');
  assert.equal(checks[0].body.get('openid.mode'), 'check_authentication');
  assert.deepEqual(await connection(), { steamId });
  assert.equal((await api.request('/steam/connect', { method: 'POST', cookie: alice.cookie })).status, 409);
  assert.equal((await api.request('/steam', { method: 'DELETE', cookie: alice.cookie })).status, 204);
  assert.deepEqual(await connection(), { steamId: null });
  assert.equal(await callback(returnTo, proof), origin + '/profile?steam=expired');
  assert.equal(checks.length, 1);
});

test('only the originating SideQuest session can use a pending link', async () => {
  const returnTo = await begin();
  const proof = assertion(returnTo);
  const otherSession = await api.signIn('alice');
  assert.equal(await callback(returnTo, proof, otherSession.cookie), origin + '/profile?steam=expired');
  assert.equal(checks.length, 0);
  assert.equal(await callback(returnTo, proof), origin + '/profile?steam=linked');
});

test('does not link when Steam declines verification or a signed field is missing', async () => {
  const returnTo = await begin();
  const proof = assertion(returnTo);
  steamReply = 'ns:http://specs.openid.net/auth/2.0\nis_valid:false\n';
  assert.equal(await callback(returnTo, proof), origin + '/profile?steam=failed');
  assert.equal(await callback(returnTo, { ...proof, 'openid.signed': 'claimed_id' }), origin + '/profile?steam=failed');
  assert.equal(checks.length, 1);
  assert.deepEqual(await connection(), { steamId: null });
});

test('only one SideQuest account can link a Steam ID', async () => {
  const first = await begin();
  assert.equal(await callback(first, assertion(first)), origin + '/profile?steam=linked');
  const bob = await api.signIn('bob');
  const second = await begin(bob.cookie);
  assert.equal(await callback(second, assertion(second), bob.cookie), origin + '/profile?steam=in-use');
  assert.deepEqual(await connection(bob.cookie), { steamId: null });
});

test('new attempts replace old ones and cancelling clears the pending link', async () => {
  const first = await begin();
  const second = await begin();
  assert.equal(await callback(first, assertion(first)), origin + '/profile?steam=expired');
  assert.equal(await callback(second, { 'openid.mode': 'cancel' }), origin + '/profile?steam=cancelled');
  assert.equal(await callback(second, assertion(second)), origin + '/profile?steam=expired');
  assert.equal(checks.length, 0);
});

test('unsigned-in users cannot start, read, or disconnect a Steam link', async () => {
  for (const [method, path] of [['GET', '/steam'], ['POST', '/steam/connect'], ['DELETE', '/steam']]) {
    assert.equal((await api.request(path, { method })).status, 401);
  }
});

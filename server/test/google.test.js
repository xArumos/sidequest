const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync, sign } = require('node:crypto');
const { OAuth2Client } = require('google-auth-library');
const { createGoogleVerifier } = require('../src/google');

test('Google verification checks signature, audience, issuer, and expiration through the SDK', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const client = new OAuth2Client();
  // Supply test public keys locally; production uses Google's rotating certificates.
  client.getFederatedSignonCertsAsync = async () => ({
    certs: { 'test-key': publicKey.export({ type: 'spki', format: 'pem' }) }, format: 'PEM',
  });
  const clientId = '123-example.apps.googleusercontent.com';
  const verify = createGoogleVerifier(clientId, client);
  const now = Math.floor(Date.now() / 1000);
  function token(overrides = {}) {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test-key' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      sub: 'google-user', aud: clientId, iss: 'https://accounts.google.com', iat: now, exp: now + 3600,
      ...overrides,
    })).toString('base64url');
    const data = `${header}.${payload}`;
    return `${data}.${sign('RSA-SHA256', Buffer.from(data), privateKey).toString('base64url')}`;
  }
  assert.equal((await verify(token())).sub, 'google-user');
  await assert.rejects(verify(token({ aud: 'another-client' })));
  await assert.rejects(verify(token({ iss: 'https://untrusted.example' })));
  await assert.rejects(verify(token({ iat: now - 7200, exp: now - 3600 })));
  const valid = token();
  const parts = valid.split('.');
  parts[1] = Buffer.from(JSON.stringify({ sub: 'attacker' })).toString('base64url');
  await assert.rejects(verify(parts.join('.')));
});

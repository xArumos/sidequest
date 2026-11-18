const { createHash, randomBytes } = require('node:crypto');
const { Router } = require('express');
const User = require('sidequest-database/models/User');
const { HttpError } = require('./http');

const endpoint = 'https://steamcommunity.com/openid/login';
const namespace = 'http://specs.openid.net/auth/2.0';
const callbackPath = '/api/steam/callback';
const linkLifetime = 10 * 60 * 1000;
const signedFields = ['op_endpoint', 'claimed_id', 'identity', 'return_to', 'response_nonce', 'assoc_handle'];
const clearPending = { steamLinkHash: '', steamLinkExpiresAt: '' };

function linkHash(state, sessionId) {
  return createHash('sha256').update(state).update(sessionId).digest('hex');
}

function signInUrl(frontendOrigin, returnTo) {
  const identifier = namespace + '/identifier_select';
  const url = new URL(endpoint);
  url.search = new URLSearchParams({
    'openid.ns': namespace,
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnTo,
    'openid.realm': frontendOrigin + '/',
    'openid.claimed_id': identifier,
    'openid.identity': identifier,
  });
  return url.href;
}

// Steam is the only provider we trust for IDs in the Steam Community namespace.
// Verify directly with its fixed endpoint and never follow callback-supplied URLs.
async function verifyAssertion(query, returnTo, fetchSteam) {
  const fields = Object.entries(query).filter(([key]) => key.startsWith('openid.'));
  if (fields.some(([, value]) => typeof value !== 'string' || value.length > 2048)) return null;
  const assertion = new URLSearchParams(fields);
  const claimedId = assertion.get('openid.claimed_id');
  const steamId = /^https?:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/.exec(claimedId)?.[1];
  const nonce = assertion.get('openid.response_nonce') || '';
  const timestamp = Date.parse(nonce.slice(0, 20));
  const signed = (assertion.get('openid.signed') || '').split(',');
  if (!steamId || assertion.get('openid.identity') !== claimedId ||
      assertion.get('openid.ns') !== namespace || assertion.get('openid.mode') !== 'id_res' ||
      assertion.get('openid.op_endpoint') !== endpoint || assertion.get('openid.return_to') !== returnTo ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z[!-~]{0,235}$/.test(nonce) ||
      !Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > linkLifetime ||
      !assertion.get('openid.sig') ||
      !signedFields.every(field => signed.includes(field) && assertion.get('openid.' + field))) return null;

  // Steam checks the signature and nonce. The signed return URL binds the
  // assertion to one pending link, which MongoDB consumes when the link is saved.
  assertion.set('openid.mode', 'check_authentication');
  try {
    const response = await fetchSteam(endpoint, {
      method: 'POST',
      body: assertion,
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok && (await response.text()).split(/\r?\n/).includes('is_valid:true')) return steamId;
  } catch {
    // The user can start a fresh attempt if Steam is unavailable.
  }
  return null;
}

function createSteamRouter({ requireAuth, frontendOrigin, fetchSteam = fetch }) {
  const router = Router();
  const returnTo = state => `${frontendOrigin}${callbackPath}?state=${state}`;
  router.use((_req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    next();
  });

  router.get('/', requireAuth, async (req, res) => {
    const user = await User.findById(req.session.userId).select('+steamId').lean();
    if (!user) throw new HttpError(401, 'UNAUTHENTICATED', 'Please sign in.');
    res.json({ steamId: user.steamId ?? null });
  });

  router.post('/connect', requireAuth, async (req, res) => {
    const state = randomBytes(32).toString('hex');
    const result = await User.updateOne({ _id: req.session.userId, steamId: null }, {
      $set: {
        steamLinkHash: linkHash(state, req.sessionID),
        steamLinkExpiresAt: new Date(Date.now() + linkLifetime),
      },
    });
    if (!result.matchedCount) {
      throw new HttpError(409, 'STEAM_ALREADY_LINKED', 'Disconnect your current Steam account before connecting another one.');
    }
    res.json({ url: signInUrl(frontendOrigin, returnTo(state)) });
  });

  router.get('/callback', async (req, res) => {
    if (!req.session?.userId) return res.redirect(303, frontendOrigin + '/login');
    const finish = result => res.redirect(303, `${frontendOrigin}/profile?steam=${result}`);
    const { state } = req.query;
    if (typeof state !== 'string' || !/^[a-f0-9]{64}$/.test(state) ||
        req.originalUrl.split('?')[0] !== callbackPath) return finish('expired');

    const pending = {
      _id: req.session.userId,
      steamId: null,
      steamLinkHash: linkHash(state, req.sessionID),
      steamLinkExpiresAt: { $gt: new Date() },
    };
    if (!await User.exists(pending)) return finish('expired');
    if (req.query['openid.mode'] === 'cancel') {
      await User.updateOne(pending, { $unset: clearPending });
      return finish('cancelled');
    }
    const steamId = await verifyAssertion(req.query, returnTo(state), fetchSteam);
    if (!steamId) return finish('failed');
    pending.steamLinkExpiresAt.$gt = new Date();
    try {
      const result = await User.updateOne(pending, {
        $set: { steamId },
        $unset: clearPending,
      });
      return finish(result.matchedCount ? 'linked' : 'expired');
    } catch (error) {
      if (error.code === 11000 && error.keyPattern?.steamId) return finish('in-use');
      throw error;
    }
  });

  router.delete('/', requireAuth, async (req, res) => {
    await User.updateOne({ _id: req.session.userId }, { $unset: { steamId: '', ...clearPending } });
    res.sendStatus(204);
  });

  return router;
}

module.exports = { createSteamRouter };

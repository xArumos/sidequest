const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const API_URL = 'https://api.igdb.com/v4';
// IGDB allows 4 requests per second per client.
const MIN_REQUEST_INTERVAL_MS = 250;
// Refresh the app token a minute early so a request never races its expiry.
const TOKEN_EXPIRY_MARGIN_MS = 60 * 1000;

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// IGDB uses Twitch app access tokens (OAuth client credentials). Requests are
// made one at a time by callers, so a simple spacing throttle is enough.
function createIgdbClient({ clientId, clientSecret, fetch = globalThis.fetch, now = Date.now, sleep = wait }) {
  let token = null;
  let lastRequestAt = -Infinity;

  async function getToken({ refresh = false } = {}) {
    if (!refresh && token && now() < token.expiresAt) return token.value;
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' }),
    });
    if (!response.ok) throw new Error(`Twitch token request failed with status ${response.status}.`);
    const body = await response.json();
    token = { value: body.access_token, expiresAt: now() + body.expires_in * 1000 - TOKEN_EXPIRY_MARGIN_MS };
    return token.value;
  }

  async function send(endpoint, query, accessToken) {
    const delay = lastRequestAt + MIN_REQUEST_INTERVAL_MS - now();
    if (delay > 0) await sleep(delay);
    lastRequestAt = now();
    return fetch(`${API_URL}/${endpoint}`, {
      method: 'POST',
      headers: { 'Client-ID': clientId, Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      body: query,
    });
  }

  async function query(endpoint, apicalypse) {
    let response = await send(endpoint, apicalypse, await getToken());
    // A revoked or expired token gets one retry with a fresh token.
    if (response.status === 401) response = await send(endpoint, apicalypse, await getToken({ refresh: true }));
    if (!response.ok) throw new Error(`IGDB ${endpoint} request failed with status ${response.status}.`);
    return response.json();
  }

  return { query };
}

module.exports = { createIgdbClient };

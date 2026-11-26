// Guards Steam data routes. Mount it on the Steam router so that, without a
// STEAM_API_KEY, those routes answer 503 while the rest of the API keeps working.
// The response never mentions the key itself.
function requireSteamApiKey(steamConfig) {
  const enabled = Boolean(steamConfig && steamConfig.enabled && steamConfig.apiKey);
  return function steamApiKeyGuard(req, res, next) {
    if (enabled) return next();
    res.status(503).json({ error: { code: 'STEAM_UNAVAILABLE', message: 'Steam features are not configured.' } });
  };
}

module.exports = { requireSteamApiKey };

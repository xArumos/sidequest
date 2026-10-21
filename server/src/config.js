function readConfig(env = process.env) {
  const portText = env.PORT ?? '5000';
  const port = Number(portText);
  if (!/^\d+$/.test(portText) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  const frontendOrigin = env.FRONTEND_ORIGIN ?? 'http://localhost:5173';
  let origin;
  try {
    origin = new URL(frontendOrigin);
  } catch {
    throw new Error('FRONTEND_ORIGIN must be an HTTP or HTTPS origin.');
  }
  if (!['http:', 'https:'].includes(origin.protocol) || origin.origin !== frontendOrigin) {
    throw new Error('FRONTEND_ORIGIN must be an HTTP or HTTPS origin without a path.');
  }

  const host = env.HOST ?? '127.0.0.1';
  if (!host.trim()) throw new Error('HOST must not be empty.');
  const googleClientId = env.GOOGLE_CLIENT_ID || '';
  const sessionSecret = env.SESSION_SECRET || '';
  let auth = null;
  if (googleClientId || sessionSecret) {
    if (!/^[a-zA-Z0-9-]+\.apps\.googleusercontent\.com$/.test(googleClientId)) {
      throw new Error('GOOGLE_CLIENT_ID must be a Google OAuth web client ID.');
    }
    if (Buffer.byteLength(sessionSecret) < 32) {
      throw new Error('SESSION_SECRET must contain at least 32 bytes of random data.');
    }
    auth = { googleClientId, sessionSecret, secureCookies: env.NODE_ENV === 'production' };
  }
  return { port, host, frontendOrigin, auth };
}

module.exports = { readConfig };

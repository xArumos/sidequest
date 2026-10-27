const session = require('express-session');

// Must match the cookie settings in auth.js, which clears this cookie on logout.
const COOKIE_NAME = 'sidequest.sid';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

// One session middleware for the whole API, so every router can read req.session.
// The auth router still mounts its own copy; express-session skips it when
// req.session already exists.
function createSessionMiddleware({ sessionSecret, secureCookies, store }) {
  return session({
    name: COOKIE_NAME,
    secret: sessionSecret,
    store,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: secureCookies, path: '/', maxAge: SESSION_MAX_AGE },
  });
}

// Reject cross-site writes. Browsers always send Origin on non-GET fetches, so an
// exact match protects cookie-authenticated POST/PATCH/DELETE routes from CSRF.
function requireSameOrigin(frontendOrigin) {
  return (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || req.get('Origin') === frontendOrigin) return next();
    return res.status(403).json({ error: { code: 'INVALID_ORIGIN', message: 'Request origin is not allowed.' } });
  };
}

function authNotConfigured(_req, res) {
  res.status(503).json({ error: { code: 'AUTH_NOT_CONFIGURED', message: 'Sign-in is not configured.' } });
}

module.exports = { createSessionMiddleware, requireSameOrigin, authNotConfigured };

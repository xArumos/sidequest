const session = require('express-session');

// Shared with auth.js and account.js, which clear this cookie on logout and account deletion.
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
    cookie: { ...sessionCookieOptions({ secureCookies }), maxAge: SESSION_MAX_AGE },
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

// Cookie attributes for clearing the session cookie; they must match the ones it was set with.
function sessionCookieOptions({ secureCookies }) {
  return { httpOnly: true, sameSite: 'lax', secure: secureCookies, path: '/' };
}

// Returns `revoke(userId)`, which deletes every stored session signed in as that user,
// so a deleted account is signed out on all devices (#92). express-session's Store API
// has no lookup by session content, so each store needs its own query:
// - `collection`: the connect-mongo sessions collection. connect-mongo stores each
//   session as a JSON string by default, so this matches the serialized userId. It
//   scans the collection, which is acceptable for a rare action like account deletion.
// - `store`: any store whose all() returns sessions keyed by id, such as MemoryStore.
function createSessionRevoker({ collection, store }) {
  if (collection) {
    return async (userId) => {
      if (!/^[a-f0-9]{24}$/.test(userId)) throw new TypeError('userId must be a user id.');
      await collection.deleteMany({ session: { $regex: `"userId":"${userId}"` } });
    };
  }
  if (store?.all) {
    return async (userId) => {
      const sessions = await new Promise((resolve, reject) => {
        store.all((error, result) => (error ? reject(error) : resolve(result ?? {})));
      });
      if (Array.isArray(sessions)) throw new TypeError('The session store does not report session ids.');
      const owned = Object.keys(sessions).filter(sid => sessions[sid]?.userId === userId);
      await Promise.all(owned.map(sid => new Promise((resolve, reject) => {
        store.destroy(sid, error => (error ? reject(error) : resolve()));
      })));
    };
  }
  // Without a store, only the current session can be signed out; see the account router.
  return async () => {};
}

function authNotConfigured(_req, res) {
  res.status(503).json({ error: { code: 'AUTH_NOT_CONFIGURED', message: 'Sign-in is not configured.' } });
}

module.exports = {
  COOKIE_NAME, createSessionMiddleware, createSessionRevoker, sessionCookieOptions, requireSameOrigin, authNotConfigured,
};

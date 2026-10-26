const { Router } = require('express');
const session = require('express-session');
const { rateLimit } = require('express-rate-limit');

const COOKIE_NAME = 'sidequest.sid';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function publicUser(user) {
  return {
    id: String(user._id),
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
  };
}

function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Please sign in.' } });
  }
  return next();
}

function createAuthRouter({ frontendOrigin, sessionSecret, secureCookies, store, users, verifyGoogleToken }) {
  const router = Router();
  const cookieOptions = { httpOnly: true, sameSite: 'lax', secure: secureCookies, path: '/' };

  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  // The frontend uses a GIS JavaScript callback, not Google's direct form POST.
  // Exact Origin validation protects login and logout against cross-site requests.
  router.use((req, res, next) => {
    if (req.method === 'POST' && req.get('Origin') !== frontendOrigin) {
      return res.status(403).json({ error: { code: 'INVALID_ORIGIN', message: 'Request origin is not allowed.' } });
    }
    return next();
  });
  router.use(session({
    name: COOKIE_NAME,
    secret: sessionSecret,
    store,
    resave: false,
    saveUninitialized: false,
    cookie: { ...cookieOptions, maxAge: SESSION_MAX_AGE },
  }));

  router.post('/google', rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many sign-in attempts. Try again later.' } },
  }), async (req, res) => {
    const credential = req.body?.credential;
    if (!req.is('application/json') || typeof credential !== 'string' || !credential.trim() || credential.length > 10000) {
      return res.status(400).json({ error: { code: 'INVALID_CREDENTIAL', message: 'A Google ID token is required as a JSON credential.' } });
    }

    let profile;
    try {
      profile = await verifyGoogleToken(credential);
    } catch {
      return res.status(401).json({ error: { code: 'INVALID_GOOGLE_TOKEN', message: 'Google sign-in could not be verified.' } });
    }
    if (!profile?.sub || !profile.email || profile.email_verified !== true) {
      return res.status(401).json({ error: { code: 'INVALID_GOOGLE_TOKEN', message: 'A verified Google account is required.' } });
    }

    // Match only Google's stable subject, never link accounts by email address.
    const user = await users.findOneAndUpdate({ googleId: profile.sub }, {
      $set: {
        email: profile.email,
        displayName: profile.name || 'SideQuest player',
        avatarUrl: profile.picture || '',
      },
    }, { upsert: true, returnDocument: 'after', runValidators: true });

    // Rotate the session ID after authentication to prevent session fixation.
    await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
    req.session.userId = String(user._id);
    await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
    return res.json({ user: publicUser(user) });
  });

  router.get('/me', requireAuth, async (req, res) => {
    const user = await users.findById(req.session.userId);
    if (!user) {
      await new Promise((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
      res.clearCookie(COOKIE_NAME, cookieOptions);
      return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Please sign in.' } });
    }
    return res.json({ user: publicUser(user) });
  });

  router.post('/logout', async (req, res) => {
    await new Promise((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
    res.clearCookie(COOKIE_NAME, cookieOptions);
    return res.sendStatus(204);
  });

  return router;
}

module.exports = { createAuthRouter, requireAuth };

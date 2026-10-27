const { Router } = require('express');
const session = require('express-session');
const { rateLimit } = require('express-rate-limit');
const { hashPassword, verifyPassword, validPassword } = require('./password');

const COOKIE_NAME = 'sidequest.sid';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function publicUser(user) {
  return {
    id: String(user._id),
    email: user.email,
    username: user.username ?? null,
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

  const attempts = () => rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many authentication attempts. Try again later.' } },
  });
  async function signIn(req, res, user, status = 200) {
    await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
    req.session.userId = String(user._id);
    await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
    return res.status(status).json({ user: publicUser(user) });
  }
  router.post('/register', attempts(), async (req, res) => {
    const { username, email, password } = req.body || {};
    const normalizedUsername = typeof username === 'string' ? username.trim().toLowerCase() : '';
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!req.is('application/json') || !/^[a-z0-9_]{3,30}$/.test(normalizedUsername) ||
        normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(normalizedEmail) || !validPassword(password)) {
      return res.status(400).json({ error: { code: 'INVALID_REGISTRATION', message: 'Use a username of 3-30 letters, numbers, or underscores, a valid email, and a password of 15-128 characters.' } });
    }
    let user;
    try {
      user = await users.create({ username: normalizedUsername, email: normalizedEmail,
        displayName: normalizedUsername, passwordHash: await hashPassword(password) });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ error: { code: 'ACCOUNT_EXISTS', message: 'That username or email is already registered.' } });
      }
      throw error;
    }
    return signIn(req, res, user, 201);
  });

  router.post('/login', attempts(), async (req, res) => {
    const { identifier, password } = req.body || {};
    if (!req.is('application/json') || typeof identifier !== 'string' || !identifier.trim() ||
        identifier.length > 254 || typeof password !== 'string' || !password || [...password].length > 128) {
      return res.status(400).json({ error: { code: 'INVALID_LOGIN', message: 'A username or email and password are required.' } });
    }
    const normalized = identifier.trim().toLowerCase();
    const user = await users.findOne({
      ...(normalized.includes('@') ? { email: normalized } : { username: normalized }),
      passwordHash: { $type: 'string' },
    }).select('+passwordHash');
    const matches = await verifyPassword(password, user?.passwordHash);
    if (!user || !matches) {
      return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Username, email, or password is incorrect.' } });
    }
    return signIn(req, res, user);
  });

  router.post('/google', attempts(), async (req, res) => {
    if (!verifyGoogleToken) {
      return res.status(503).json({ error: { code: 'GOOGLE_NOT_CONFIGURED', message: 'Google sign-in is not configured.' } });
    }
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
    return signIn(req, res, user);
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

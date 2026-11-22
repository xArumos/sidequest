const { Router } = require('express');
const { deleteAccount } = require('sidequest-database/accounts');
const User = require('sidequest-database/models/User');
const { HttpError } = require('./http');
const { verifyPassword } = require('./password');
const { createRateLimiter, writeKey } = require('./security');
const { COOKIE_NAME, sessionCookieOptions } = require('./session');

const destroySession = req => new Promise((resolve, reject) => {
  req.session.destroy(error => (error ? reject(error) : resolve()));
});

// Re-authentication for account deletion: password accounts send their password,
// Google accounts (which have none) type their username or email to confirm.
async function confirmIdentity(user, body) {
  if (user.passwordHash) {
    const { password } = body;
    if (typeof password !== 'string' || !password || [...password].length > 128) {
      throw new HttpError(400, 'PASSWORD_REQUIRED', 'Enter your password to delete your account.');
    }
    if (!await verifyPassword(password, user.passwordHash)) {
      throw new HttpError(403, 'INVALID_PASSWORD', 'That password is incorrect.');
    }
    return;
  }
  const confirm = typeof body.confirm === 'string' ? body.confirm.trim().toLowerCase() : '';
  if (!confirm || confirm.length > 254) {
    throw new HttpError(400, 'CONFIRMATION_REQUIRED', 'Type your username or email to delete your account.');
  }
  if (![user.username, user.email].filter(Boolean).includes(confirm)) {
    throw new HttpError(403, 'CONFIRMATION_MISMATCH', 'That does not match your username or email.');
  }
}

// Account deletion (#92). `revokeUserSessions(userId)` deletes the user's sessions on
// every device (see createSessionRevoker); the current session is always destroyed.
function createAccountRouter({ requireAuth, revokeUserSessions = async () => {}, secureCookies = false }) {
  const router = Router();
  // Stacked on the global write limiter to slow password guessing from a stolen session.
  const attempts = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    keyGenerator: writeKey,
    message: 'Too many account deletion attempts. Try again later.',
  });

  router.delete('/users/me', requireAuth, attempts, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const userId = req.session.userId;
    const user = await User.findById(userId).select('+passwordHash');
    if (!user) {
      await destroySession(req);
      res.clearCookie(COOKIE_NAME, sessionCookieOptions({ secureCookies }));
      throw new HttpError(401, 'UNAUTHENTICATED', 'Please sign in.');
    }
    await confirmIdentity(user, req.is('application/json') && req.body ? req.body : {});

    // Sign the account out everywhere first, so no other session can write new data
    // for it while it is being deleted. If deletion then fails, signing in again and
    // retrying finishes it (deleteAccount is safe to retry).
    await revokeUserSessions(userId);
    await destroySession(req);
    res.clearCookie(COOKIE_NAME, sessionCookieOptions({ secureCookies }));
    await deleteAccount(userId);
    res.sendStatus(204);
  });

  return router;
}

module.exports = { createAccountRouter };

const { once } = require('node:events');
const { MemoryStore } = require('express-session');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { connectDatabase, disconnectDatabase } = require('sidequest-database');
const Follow = require('sidequest-database/models/Follow');
const Game = require('sidequest-database/models/Game');
const GameDeveloper = require('sidequest-database/models/GameDeveloper');
const Review = require('sidequest-database/models/Review');
const User = require('sidequest-database/models/User');
const { createApp } = require('../../src/app');
const { createAuthRouter } = require('../../src/auth');
const { createSessionMiddleware } = require('../../src/session');

const origin = 'http://localhost:5173';
const sessionSecret = 'test-secret-with-at-least-32-bytes';

// Starts an in-memory MongoDB and the real app with the given feature routers.
// Call stop() in an after() hook.
// Sign-in goes through the real /api/auth/google route; the "Google token" is
// just the subject, so signIn('alice') always returns the same user.
// The shared write limiter is off by default so suites can write freely; pass
// `{ writeRateLimit: { windowMs, limit } }` to exercise it.
async function startApi(routers, { writeRateLimit = false } = {}) {
  const mongod = await MongoMemoryServer.create();
  await connectDatabase({ uri: mongod.getUri(), dbName: 'sidequest_api_test' });
  await Promise.all([Follow.init(), Game.init(), Review.init(), User.init(), GameDeveloper.init()]);

  const store = new MemoryStore();
  const server = createApp({
    frontendOrigin: origin,
    isDatabaseReady: async () => true,
    logger: { error() {} },
    sessionMiddleware: createSessionMiddleware({ sessionSecret, secureCookies: false, store }),
    authRouter: createAuthRouter({
      frontendOrigin: origin, sessionSecret, secureCookies: false, store, users: User,
      verifyGoogleToken: async sub => ({ sub, email: `${sub}@example.com`, email_verified: true, name: sub }),
    }),
    routers,
    writeRateLimit,
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  async function stop() {
    await new Promise(resolve => server.close(resolve));
    await disconnectDatabase();
    await mongod.stop();
  }

  const base = `http://127.0.0.1:${server.address().port}/api`;
  // Pass `origin: null` to leave out the Origin header, or another origin to spoof one.
  async function request(path, { method = 'GET', cookie, body, origin: requestOrigin = origin } = {}) {
    const response = await fetch(base + path, {
      method,
      headers: {
        ...(requestOrigin && { Origin: requestOrigin }),
        ...(cookie && { Cookie: cookie }),
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
      },
      ...(body !== undefined && { body: typeof body === 'string' ? body : JSON.stringify(body) }),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  }

  async function signIn(name) {
    const response = await fetch(`${base}/auth/google`, {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: name }),
    });
    const { user } = await response.json();
    return { cookie: response.headers.get('set-cookie').split(';')[0], id: user.id };
  }

  async function reset() {
    await Promise.all([
      Follow.deleteMany({}), Game.deleteMany({}), Review.deleteMany({}), User.deleteMany({}), GameDeveloper.deleteMany({}),
    ]);
  }

  // Clears everything except accounts and their sessions, and restores default
  // settings, so a suite can sign in once in before() (sign-in is rate limited).
  async function resetActivity() {
    await Promise.all([Follow.deleteMany({}), Game.deleteMany({}), Review.deleteMany({}), GameDeveloper.deleteMany({})]);
    await User.updateMany({}, { $set: { activityVisibility: 'public', wishlistVisibility: 'private' } });
  }

  // The database URI lets tests run the server scripts against the same database.
  return { request, signIn, reset, resetActivity, stop, mongoUri: mongod.getUri(), dbName: 'sidequest_api_test' };
}

module.exports = { startApi };

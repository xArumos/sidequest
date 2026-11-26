// Test-only API entrypoint for the Playwright end-to-end suite
// (frontend/playwright.e2e.config.js). It runs the real app and routers against a
// throwaway mongodb-memory-server seeded from ./seed.js. Only third-party
// boundaries are stubbed (see `boundaries` below). Never point this at real data.
//
//   npm run e2e:server --prefix server
//
// Environment (all optional):
//   E2E_API_PORT         port to listen on (default 5055)
//   E2E_FRONTEND_ORIGIN  exact browser origin allowed by CORS and the Origin check
//                        (default http://127.0.0.1:4175, the e2e Vite server)

const { MemoryStore } = require('express-session');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { connectDatabase, disconnectDatabase } = require('sidequest-database');
const Follow = require('sidequest-database/models/Follow');
const Game = require('sidequest-database/models/Game');
const GameDeveloper = require('sidequest-database/models/GameDeveloper');
const Review = require('sidequest-database/models/Review');
const User = require('sidequest-database/models/User');
const { createApp } = require('../../src/app');
const { createAuthRouter, requireAuth } = require('../../src/auth');
const { createSessionMiddleware, createSessionRevoker } = require('../../src/session');
const { createApiRouters } = require('../../src/routes');
const { seedDatabase } = require('./seed');

const HOST = '127.0.0.1';
const port = Number(process.env.E2E_API_PORT || 5055);
const frontendOrigin = process.env.E2E_FRONTEND_ORIGIN || 'http://127.0.0.1:4175';
const sessionSecret = 'e2e-only-session-secret-with-32-plus-bytes';

// Stub for Google's ID token check. The "credential" is `google:<subject>`, so a
// spec can sign in as a Google user without contacting Google. Anything else is
// rejected the same way the real verifier rejects a bad token.
function createStubGoogleVerifier() {
  return async (credential) => {
    const match = /^google:([a-z0-9_-]{1,64})$/.exec(String(credential));
    if (!match) throw new Error('Invalid Google credential.');
    const subject = match[1];
    return { sub: `e2e-${subject}`, email: `${subject}@google.e2e.sidequest.test`, email_verified: true, name: subject };
  };
}

// Every external service the server talks to is replaced here. Add new stubs to
// this object, for example a Steam Web API client once the Steam integration
// (PBI-25) lands, and pass them to the router that consumes them below.
const boundaries = {
  verifyGoogleToken: createStubGoogleVerifier(),
};

async function main() {
  const mongod = await MongoMemoryServer.create();
  const connection = await connectDatabase({ uri: mongod.getUri(), dbName: 'sidequest_e2e' });
  // User sets autoIndex: false; build the indexes the real startup builds.
  await Promise.all([Follow.init(), Game.init(), GameDeveloper.init(), Review.init(), User.createIndexes()]);
  await seedDatabase();

  const store = new MemoryStore();
  const auth = { sessionSecret, secureCookies: false };
  // Mirrors the wiring in src/index.js, with the boundaries above swapped in.
  const app = createApp({
    frontendOrigin,
    sessionMiddleware: createSessionMiddleware({ ...auth, store }),
    authRouter: createAuthRouter({
      ...auth, frontendOrigin, users: User, store, verifyGoogleToken: boundaries.verifyGoogleToken,
    }),
    routers: createApiRouters({ requireAuth, rankingMinCount: 1, revokeUserSessions: createSessionRevoker({ store }) }),
    isDatabaseReady: async () => connection.readyState === 1,
  });

  const server = await new Promise((resolve, reject) => {
    const listener = app.listen(port, HOST, () => resolve(listener));
    listener.once('error', reject);
  });
  console.log(`SideQuest e2e API listening on http://${HOST}:${port} for ${frontendOrigin}`);

  let stopping = false;
  async function stop() {
    if (stopping) return;
    stopping = true;
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await disconnectDatabase();
    await mongod.stop();
    process.exit(0);
  }
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((error) => {
  console.error('E2E server startup failed:', error);
  process.exit(1);
});

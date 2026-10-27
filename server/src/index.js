const { connectDatabase, disconnectDatabase } = require('sidequest-database');
const { createApp } = require('./app');
const { readConfig } = require('./config');
const { createAuthRouter, requireAuth } = require('./auth');
const { createSessionMiddleware, authNotConfigured } = require('./session');
const { createGamesRouter } = require('./games');
const { createLogsRouter } = require('./logs');
const { createUsersRouter } = require('./users');
const { createGoogleVerifier } = require('./google');
const { MongoStore } = require('connect-mongo');
const { assertUserIndexes } = require('./user-indexes');
const User = require('sidequest-database/models/User');

async function main() {
  const config = readConfig();
  const connection = await connectDatabase();
  let authRouter;
  let sessionMiddleware;
  if (config.auth) {
    await assertUserIndexes(User.collection);
    await User.createIndexes();
    const store = MongoStore.create({ client: connection.getClient(), dbName: connection.name });
    sessionMiddleware = createSessionMiddleware({ ...config.auth, store });
    authRouter = createAuthRouter({
      ...config.auth,
      frontendOrigin: config.frontendOrigin,
      users: User,
      store,
      verifyGoogleToken: config.auth.googleClientId ? createGoogleVerifier(config.auth.googleClientId) : undefined,
    });
  } else {
    console.log('Authentication is disabled. Set SESSION_SECRET to enable password login; GOOGLE_CLIENT_ID additionally enables Google sign-in.');
  }
  const requireUser = config.auth ? requireAuth : authNotConfigured;
  const app = createApp({
    frontendOrigin: config.frontendOrigin,
    authRouter,
    sessionMiddleware,
    routers: {
      '/games': createGamesRouter({ rankingMinCount: config.rankingMinCount }),
      // These span /games/:id/log, /logs, /me, and /users, so they mount at /api itself.
      '': [createLogsRouter({ requireAuth: requireUser }), createUsersRouter({ requireAuth: requireUser })],
    },
    isDatabaseReady: async () => {
      if (connection.readyState !== 1) return false;
      await connection.db.command({ ping: 1 }, { timeoutMS: 1500 });
      return true;
    },
  });

  const server = await new Promise((resolve, reject) => {
    const listener = app.listen(config.port, config.host, () => resolve(listener));
    listener.once('error', reject);
  });
  console.log(`SideQuest API listening on http://${config.host}:${config.port}`);

  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal}: shutting down.`);
    const deadline = setTimeout(() => {
      console.error('Shutdown exceeded 10 seconds.');
      process.exit(1);
    }, 10000);
    deadline.unref();
    try {
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
      await disconnectDatabase();
      console.log('Shutdown complete.');
    } catch (error) {
      console.error('Shutdown failed:', error.message);
      process.exitCode = 1;
    } finally {
      clearTimeout(deadline);
    }
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(async (error) => {
  console.error('Server startup failed:', error.message);
  process.exitCode = 1;
  await disconnectDatabase();
});

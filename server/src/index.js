const { connectDatabase, disconnectDatabase } = require('sidequest-database');
const { createApp } = require('./app');
const { readConfig } = require('./config');
const { createAuthRouter } = require('./auth');
const { createSessionMiddleware } = require('./session');
const { createGoogleVerifier } = require('./google');
const { MongoStore } = require('connect-mongo');
const User = require('sidequest-database/models/User');

async function main() {
  const config = readConfig();
  const connection = await connectDatabase();
  let authRouter;
  let sessionMiddleware;
  if (config.auth) {
    await User.init();
    const store = MongoStore.create({ client: connection.getClient(), dbName: connection.name });
    sessionMiddleware = createSessionMiddleware({ ...config.auth, store });
    authRouter = createAuthRouter({
      ...config.auth,
      frontendOrigin: config.frontendOrigin,
      users: User,
      store,
      verifyGoogleToken: createGoogleVerifier(config.auth.googleClientId),
    });
  } else {
    console.log('Google sign-in is disabled. Set GOOGLE_CLIENT_ID and SESSION_SECRET to enable it.');
  }
  const app = createApp({
    frontendOrigin: config.frontendOrigin,
    authRouter,
    sessionMiddleware,
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

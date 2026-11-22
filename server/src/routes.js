const { createGamesRouter } = require('./games');
const { createLogsRouter } = require('./logs');
const { createUsersRouter } = require('./users');
const { createFeedRouter } = require('./feed');
const { createDevelopersRouter } = require('./developers');
const { createAdminRouter } = require('./admin');

// Every feature router, keyed by its mount path under /api. src/index.js and the e2e
// server (test/e2e/server.js) both mount this one table, so a router added here is
// served by both. Routers that span several top-level paths share the '' key as one
// list: an object literal with two '' keys would silently keep only the last.
function createApiRouters({ requireAuth, rankingMinCount }) {
  return {
    '/games': createGamesRouter({ rankingMinCount }),
    '/feed': createFeedRouter({ requireAuth }),
    // These span /games/:id/..., /logs, /me, /users, and /dev, so they mount at /api itself.
    '': [
      createLogsRouter({ requireAuth }),
      createUsersRouter({ requireAuth }),
      createDevelopersRouter({ requireAuth }),
    ],
    '/admin': createAdminRouter({ requireAuth }),
  };
}

module.exports = { createApiRouters };

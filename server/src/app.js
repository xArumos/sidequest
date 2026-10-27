const express = require('express');
const cors = require('cors');
const { requireSameOrigin } = require('./session');

// `sessionMiddleware` is mounted on all of /api so feature routers can use
// req.session. `routers` maps a path under /api to a router, e.g. { '/games': gamesRouter }.
function createApp({ frontendOrigin, isDatabaseReady, authRouter, sessionMiddleware, routers = {}, logger = console }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: frontendOrigin, credentials: true }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/ready', async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      if (await isDatabaseReady()) return res.json({ status: 'ready' });
    } catch {
      // Readiness failures are expected during database outages.
    }
    return res.status(503).json({ status: 'unavailable' });
  });

  app.use('/api', requireSameOrigin(frontendOrigin));
  if (sessionMiddleware) app.use('/api', sessionMiddleware);
  for (const [path, router] of Object.entries(routers)) app.use(`/api${path}`, router);

  app.use('/api/auth', authRouter || ((_req, res) => {
    res.status(503).json({ error: { code: 'AUTH_NOT_CONFIGURED', message: 'Authentication is not configured.' } });
  }));

  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } });
  });

  app.use((error, _req, res, next) => {
    if (res.headersSent) return next(error);
    const clientErrors = {
      'entity.parse.failed': [400, 'INVALID_JSON', 'Request body must be valid JSON.'],
      'entity.too.large': [413, 'BODY_TOO_LARGE', 'Request body exceeds the 100 KB limit.'],
      'charset.unsupported': [415, 'UNSUPPORTED_CHARSET', 'Unsupported JSON charset.'],
      'encoding.unsupported': [415, 'UNSUPPORTED_ENCODING', 'Unsupported content encoding.'],
    };
    const [status, code, message] = clientErrors[error.type] ?? [
      500, 'INTERNAL_ERROR', 'An unexpected error occurred.',
    ];
    if (status === 500) logger.error('Request failed:', error);
    return res.status(status).json({ error: { code, message } });
  });

  return app;
}

module.exports = { createApp };

const helmet = require('helmet');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];
const DEFAULT_WRITE_LIMIT = { windowMs: 15 * 60 * 1000, limit: 300 };

// The API only returns JSON, so its responses never need to load or embed anything.
// The frontend is served separately and needs its own CSP; see server/README.md.
function securityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    frameguard: { action: 'deny' },
  });
}

// Shared limiter builder so every limited route returns the standard error shape.
// Each call creates an independent in-memory counter, so a route can stack a tighter
// limiter on top of the global write limiter, for example:
//   router.post('/steam/sync', createRateLimiter({ windowMs: 60 * 60 * 1000, limit: 5,
//     keyGenerator: writeKey, message: 'Too many sync requests. Try again later.' }), handler);
function createRateLimiter({ windowMs, limit, message, keyGenerator, skip }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ...(keyGenerator && { keyGenerator }),
    ...(skip && { skip }),
    message: { error: { code: 'RATE_LIMITED', message } },
  });
}

// Signed-in writes are counted per account so users behind one NAT do not share a
// budget; anonymous writes fall back to the client IP (IPv6 grouped by /56).
function writeKey(req) {
  return req.session?.userId ? `user:${req.session.userId}` : `ip:${ipKeyGenerator(req.ip)}`;
}

// Limits every non-GET /api request. Pass `false` to disable (tests) or
// `{ windowMs, limit }` to tune it.
function writeLimiter(options = DEFAULT_WRITE_LIMIT) {
  if (options === false) return (_req, _res, next) => next();
  return createRateLimiter({
    ...DEFAULT_WRITE_LIMIT,
    ...options,
    keyGenerator: writeKey,
    skip: req => SAFE_METHODS.includes(req.method),
    message: 'Too many requests. Try again later.',
  });
}

module.exports = { securityHeaders, createRateLimiter, writeLimiter, writeKey, DEFAULT_WRITE_LIMIT };

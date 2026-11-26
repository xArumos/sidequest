const { Router } = require('express');
const GameDeveloper = require('sidequest-database/models/GameDeveloper');
const User = require('sidequest-database/models/User');
const { decideDeveloperRequest } = require('./developers');
const { HttpError, textParam, objectIdParam } = require('./http');
const { pageParams } = require('./users');

// Allows only signed-in users whose account has the admin flag. The flag is read
// from the database on every request, so revoking it takes effect immediately.
async function requireAdmin(req, _res, next) {
  if (!req.session?.userId) throw new HttpError(401, 'UNAUTHENTICATED', 'Please sign in.');
  const user = await User.findById(req.session.userId, 'admin').lean();
  if (user?.admin !== true) throw new HttpError(403, 'NOT_ADMIN', 'Only admins can do that.');
  return next();
}

function adminRequest(request) {
  const { user, game } = request;
  return {
    id: String(request._id),
    status: request.status,
    justification: request.justification ?? '',
    requestedAt: request.requestedAt,
    decidedAt: request.decidedAt ?? null,
    decidedBy: request.decidedBy ? String(request.decidedBy) : null,
    user: user && {
      id: String(user._id), displayName: user.displayName, username: user.username ?? null, avatarUrl: user.avatarUrl ?? '',
    },
    game: game && { id: String(game._id), title: game.title },
  };
}

const populated = query => query
  .populate('user', 'displayName username avatarUrl')
  .populate('game', 'title')
  .lean();

// Admin tooling for developer access (issue #93). Mounted at /api/admin.
function createAdminRouter({ requireAuth }) {
  const router = Router();
  router.use(requireAuth, requireAdmin);

  // Requests with the given status (pending by default, or "all"), oldest first.
  router.get('/developer-requests', async (req, res) => {
    const status = textParam(req.query, 'status') || 'pending';
    if (status !== 'all' && !GameDeveloper.STATUSES.includes(status)) {
      throw new HttpError(400, 'INVALID_QUERY', `status must be one of: ${[...GameDeveloper.STATUSES, 'all'].join(', ')}.`);
    }
    const { page, limit } = pageParams(req.query);
    const filter = status === 'all' ? {} : { status };
    const [requests, total] = await Promise.all([
      populated(GameDeveloper.find(filter).sort({ requestedAt: 1, _id: 1 }).skip((page - 1) * limit).limit(limit)),
      GameDeveloper.countDocuments(filter),
    ]);
    res.json({ requests: requests.map(adminRequest), total, page, pages: Math.ceil(total / limit) });
  });

  // A decision can be changed later, e.g. to revoke an approval.
  for (const [action, status] of [['approve', 'approved'], ['reject', 'rejected']]) {
    router.post(`/developer-requests/:id/${action}`, async (req, res) => {
      const id = objectIdParam(req.params.id, 'request id');
      if (!await decideDeveloperRequest(id, status, req.session.userId)) {
        throw new HttpError(404, 'DEVELOPER_REQUEST_NOT_FOUND', 'Developer request not found.');
      }
      res.json({ request: adminRequest(await populated(GameDeveloper.findById(id))) });
    });
  }

  return router;
}

module.exports = { createAdminRouter, requireAdmin };

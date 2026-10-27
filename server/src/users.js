const { Router } = require('express');
const Review = require('sidequest-database/models/Review');
const User = require('sidequest-database/models/User');
const { gameSummary } = require('./games');
const { ownLog } = require('./logs');
const { HttpError, textParam, intParam, objectIdParam } = require('./http');

// Statuses anyone may see on a profile's history. Wishlists have their own
// visibility setting (PBI-29); backlogs stay private to their owner for now.
const PUBLIC_STATUSES = ['playing', 'played'];
const HISTORY_FILTER = {
  $or: [{ rating: { $ne: null } }, { text: { $gt: '' } }, { status: { $in: PUBLIC_STATUSES } }],
};

function pageParams(query) {
  return {
    page: intParam(query, 'page', { fallback: 1, min: 1, max: 100000 }),
    limit: intParam(query, 'limit', { fallback: 20, min: 1, max: 50 }),
  };
}

// A user's records with game summaries, most recently updated first. Exported so
// profile pages (PBI-03, PBI-19, PBI-22) can reuse it.
async function listUserLogs(userId, { filter = {}, page = 1, limit = 20 } = {}) {
  const query = { ...filter, user: userId };
  const [logs, total] = await Promise.all([
    Review.find(query)
      .sort({ updatedAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('game')
      .lean(),
    Review.countDocuments(query),
  ]);
  return {
    // A record whose game was deleted has nothing to show, so it is skipped.
    logs: logs.filter(log => log.game).map(log => ({ ...ownLog(log), game: gameSummary(log.game) })),
    total,
    page,
    pages: Math.ceil(total / limit),
  };
}

function publicProfile(user) {
  return {
    id: String(user._id),
    displayName: user.displayName,
    username: user.username ?? null,
    avatarUrl: user.avatarUrl ?? '',
    bio: user.bio ?? '',
    wishlistVisibility: user.wishlistVisibility ?? 'private',
  };
}

async function findUser(id) {
  const user = await User.findById(objectIdParam(id, 'user id')).lean();
  if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found.');
  return user;
}

function createUsersRouter({ requireAuth }) {
  const router = Router();

  // The caller's own lists and history: wishlist, backlog, playing, played, or all.
  router.get('/me/logs', requireAuth, async (req, res) => {
    const status = textParam(req.query, 'status');
    if (status && !Review.STATUSES.includes(status)) {
      throw new HttpError(400, 'INVALID_QUERY', `status must be one of: ${Review.STATUSES.join(', ')}.`);
    }
    res.json(await listUserLogs(req.session.userId, { filter: status ? { status } : {}, ...pageParams(req.query) }));
  });

  router.get('/me/wishlist-visibility', requireAuth, async (req, res) => {
    const user = await User.findById(req.session.userId, 'wishlistVisibility').lean();
    if (!user) throw new HttpError(401, 'UNAUTHENTICATED', 'Please sign in.');
    res.json({ wishlistVisibility: user.wishlistVisibility ?? 'private' });
  });

  // PBI-29: the owner chooses who can see their wishlist.
  router.patch('/me/wishlist-visibility', requireAuth, async (req, res) => {
    const visibility = req.is('application/json') ? req.body?.wishlistVisibility : undefined;
    if (!['public', 'private'].includes(visibility) || Object.keys(req.body).length !== 1) {
      throw new HttpError(400, 'INVALID_VISIBILITY', 'Send { "wishlistVisibility": "public" } or "private".');
    }
    const user = await User.findByIdAndUpdate(req.session.userId, { wishlistVisibility: visibility }, {
      returnDocument: 'after', runValidators: true, projection: 'wishlistVisibility',
    }).lean();
    if (!user) throw new HttpError(401, 'UNAUTHENTICATED', 'Please sign in.');
    res.json({ wishlistVisibility: user.wishlistVisibility });
  });

  router.get('/users/:id', async (req, res) => {
    res.json({ user: publicProfile(await findUser(req.params.id)) });
  });

  // Public game history for a profile (PBI-03): ratings, reviews, playing, and played.
  router.get('/users/:id/logs', async (req, res) => {
    const user = await findUser(req.params.id);
    const result = await listUserLogs(user._id, { filter: HISTORY_FILTER, ...pageParams(req.query) });
    const logs = result.logs.map(log => (PUBLIC_STATUSES.includes(log.status) ? log : { ...log, status: null }));
    res.json({ ...result, logs });
  });

  // PBI-28: anyone may view a public wishlist; a private one only its owner.
  router.get('/users/:id/wishlist', async (req, res) => {
    const user = await findUser(req.params.id);
    const isOwner = req.session?.userId === String(user._id);
    if (user.wishlistVisibility !== 'public' && !isOwner) {
      throw new HttpError(403, 'WISHLIST_PRIVATE', "This user's wishlist is private.");
    }
    res.json(await listUserLogs(user._id, { filter: { status: 'wishlist' }, ...pageParams(req.query) }));
  });

  return router;
}

module.exports = { createUsersRouter, listUserLogs };

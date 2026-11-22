const { Router } = require('express');
const Follow = require('sidequest-database/models/Follow');
const Review = require('sidequest-database/models/Review');
const User = require('sidequest-database/models/User');
const { gameSummary } = require('./games');
const { ownLog } = require('./logs');
const { HttpError, textParam, intParam, objectIdParam } = require('./http');
const {
  activityVisibilityOf, wishlistVisibilityOf, canViewActivity, assertCanViewActivity,
} = require('./visibility');

// Statuses shown in a profile's history to anyone allowed to see its activity.
// Wishlists have their own visibility setting (PBI-29); backlogs stay private
// to their owner for now.
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

// The fields anyone may see in a list of users (followers, feed entries).
function userSummary(user) {
  return {
    id: String(user._id),
    displayName: user.displayName,
    username: user.username ?? null,
    avatarUrl: user.avatarUrl ?? '',
  };
}
const SUMMARY_FIELDS = 'displayName username avatarUrl';

function publicProfile(user) {
  return {
    ...userSummary(user),
    bio: user.bio ?? '',
    wishlistVisibility: wishlistVisibilityOf(user),
    activityVisibility: activityVisibilityOf(user),
  };
}

async function findUser(id) {
  const user = await User.findById(objectIdParam(id, 'user id')).lean();
  if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found.');
  return user;
}

// One page of a follower or following list. `side` is the populated end of each
// follow: 'follower' lists who follows someone, 'followee' whom they follow.
async function listFollows(filter, side, { page, limit }) {
  const [follows, total] = await Promise.all([
    Follow.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate(side, SUMMARY_FIELDS)
      .lean(),
    Follow.countDocuments(filter),
  ]);
  return {
    users: follows.map(follow => follow[side]).filter(Boolean).map(userSummary),
    total,
    page,
    pages: Math.ceil(total / limit),
  };
}

// The caller's privacy settings (PBI-29, PBI-31), read and changed the same way.
const VISIBILITY_SETTINGS = [
  ['wishlist-visibility', 'wishlistVisibility', wishlistVisibilityOf],
  ['activity-visibility', 'activityVisibility', activityVisibilityOf],
];

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

  for (const [path, field, valueOf] of VISIBILITY_SETTINGS) {
    router.get(`/me/${path}`, requireAuth, async (req, res) => {
      const user = await User.findById(req.session.userId, field).lean();
      if (!user) throw new HttpError(401, 'UNAUTHENTICATED', 'Please sign in.');
      res.json({ [field]: valueOf(user) });
    });

    router.patch(`/me/${path}`, requireAuth, async (req, res) => {
      const visibility = req.is('application/json') ? req.body?.[field] : undefined;
      if (!User.VISIBILITIES.includes(visibility) || Object.keys(req.body).length !== 1) {
        throw new HttpError(400, 'INVALID_VISIBILITY', `Send { "${field}": "public" }, "followers", or "private".`);
      }
      const user = await User.findByIdAndUpdate(req.session.userId, { [field]: visibility }, {
        returnDocument: 'after', runValidators: true, projection: field,
      }).lean();
      if (!user) throw new HttpError(401, 'UNAUTHENTICATED', 'Please sign in.');
      res.json({ [field]: user[field] });
    });
  }

  // Follow counts are public; isFollowing is false for signed-out viewers and on one's own profile.
  router.get('/users/:id', async (req, res) => {
    const user = await findUser(req.params.id);
    const viewerId = req.session?.userId;
    const [followerCount, followingCount, isFollowing] = await Promise.all([
      Follow.countDocuments({ followee: user._id }),
      Follow.countDocuments({ follower: user._id }),
      viewerId ? Follow.exists({ follower: viewerId, followee: user._id }).then(Boolean) : false,
    ]);
    res.json({ user: { ...publicProfile(user), followerCount, followingCount, isFollowing } });
  });

  // PBI-30: one-way follows. Both routes are idempotent and return the new state.
  async function followTarget(req) {
    const user = await findUser(req.params.id);
    if (String(user._id) === req.session.userId) {
      throw new HttpError(400, 'CANNOT_FOLLOW_SELF', 'You cannot follow yourself.');
    }
    return user;
  }
  const followState = async (user, isFollowing) => ({
    isFollowing, followerCount: await Follow.countDocuments({ followee: user._id }),
  });

  router.post('/users/:id/follow', requireAuth, async (req, res) => {
    const user = await followTarget(req);
    let created = true;
    try {
      await Follow.create({ follower: req.session.userId, followee: user._id });
    } catch (error) {
      // Already following (or a concurrent request just followed): nothing to do.
      if (error.code !== 11000) throw error;
      created = false;
    }
    res.status(created ? 201 : 200).json(await followState(user, true));
  });

  router.delete('/users/:id/follow', requireAuth, async (req, res) => {
    const user = await followTarget(req);
    await Follow.deleteOne({ follower: req.session.userId, followee: user._id });
    res.json(await followState(user, false));
  });

  // Who follows a user and whom they follow, newest first. Lists are public.
  router.get('/users/:id/followers', async (req, res) => {
    const user = await findUser(req.params.id);
    res.json(await listFollows({ followee: user._id }, 'follower', pageParams(req.query)));
  });

  router.get('/users/:id/following', async (req, res) => {
    const user = await findUser(req.params.id);
    res.json(await listFollows({ follower: user._id }, 'followee', pageParams(req.query)));
  });

  // Game history for a profile (PBI-03): ratings, reviews, playing, and played.
  // Hidden by the owner's activity visibility (PBI-31).
  router.get('/users/:id/logs', async (req, res) => {
    const user = await findUser(req.params.id);
    await assertCanViewActivity(req.session?.userId, user);
    const result = await listUserLogs(user._id, { filter: HISTORY_FILTER, ...pageParams(req.query) });
    const logs = result.logs.map(log => (PUBLIC_STATUSES.includes(log.status) ? log : { ...log, status: null }));
    res.json({ ...result, logs });
  });

  // PBI-28: the wishlist follows its own visibility setting, independent of activity.
  router.get('/users/:id/wishlist', async (req, res) => {
    const user = await findUser(req.params.id);
    const setting = wishlistVisibilityOf(user);
    if (!await canViewActivity(req.session?.userId, user, setting)) {
      throw new HttpError(403, 'WISHLIST_PRIVATE', setting === 'followers'
        ? "Only this user's followers can see their wishlist."
        : "This user's wishlist is private.");
    }
    res.json(await listUserLogs(user._id, { filter: { status: 'wishlist' }, ...pageParams(req.query) }));
  });

  return router;
}

module.exports = {
  createUsersRouter, listUserLogs, pageParams, publicProfile, userSummary, findUser, PUBLIC_STATUSES, HISTORY_FILTER,
};

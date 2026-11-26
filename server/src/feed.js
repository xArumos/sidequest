const { Router } = require('express');
const Follow = require('sidequest-database/models/Follow');
const Review = require('sidequest-database/models/Review');
const User = require('sidequest-database/models/User');
const { gameSummary } = require('./games');
const { ownLog } = require('./logs');
const { HISTORY_FILTER, PUBLIC_STATUSES, pageParams, userSummary } = require('./users');
const { FOLLOWER_VISIBLE, activityVisibilityOf } = require('./visibility');

// Users whose activity the caller sees in their feed: everyone they follow,
// except those whose activity is private. A `followers` setting lets the caller
// in because they follow that user. Also returns how many users the caller
// follows, so an empty feed can say whether to follow someone or just wait.
async function visibleFollowees(userId) {
  const follows = await Follow.find({ follower: userId }, 'followee').lean();
  if (!follows.length) return { followingCount: 0, users: [] };
  const users = await User.find({ _id: { $in: follows.map(follow => follow.followee) } },
    'activityVisibility').lean();
  return {
    followingCount: follows.length,
    users: users.filter(user => FOLLOWER_VISIBLE.includes(activityVisibilityOf(user))).map(user => user._id),
  };
}

function feedEntry(log) {
  return {
    ...ownLog(log),
    // Same rule as profile history: wishlist and backlog statuses stay hidden.
    status: PUBLIC_STATUSES.includes(log.status) ? log.status : null,
    game: gameSummary(log.game),
    user: userSummary(log.user),
  };
}

function createFeedRouter({ requireAuth }) {
  const router = Router();

  // Recent ratings, reviews, and playing/played updates from followed users (#91),
  // most recently updated first.
  router.get('/', requireAuth, async (req, res) => {
    const { page, limit } = pageParams(req.query);
    const { followingCount, users } = await visibleFollowees(req.session.userId);
    if (!users.length) return res.json({ entries: [], total: 0, page, pages: 0, followingCount });
    const query = { ...HISTORY_FILTER, user: { $in: users } };
    const [logs, total] = await Promise.all([
      Review.find(query)
        .sort({ updatedAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('game')
        .populate('user', 'displayName username avatarUrl')
        .lean(),
      Review.countDocuments(query),
    ]);
    // A record whose game or user was deleted has nothing to show, so it is skipped.
    res.json({
      entries: logs.filter(log => log.game && log.user).map(feedEntry),
      total,
      page,
      pages: Math.ceil(total / limit),
      followingCount,
    });
  });

  return router;
}

module.exports = { createFeedRouter };

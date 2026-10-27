const { Router } = require('express');
const Game = require('sidequest-database/models/Game');
const Review = require('sidequest-database/models/Review');
const { recalculateGameRating } = require('sidequest-database/ratings');
const { HttpError, intParam, objectIdParam } = require('./http');

const FIELDS = ['rating', 'text', 'status'];

// The signed-in user's own record: rating, review text, and play status.
function ownLog(log) {
  return {
    id: String(log._id),
    game: String(log.game),
    rating: log.rating ?? null,
    text: log.text ?? '',
    status: log.status ?? null,
    createdAt: log.createdAt,
    updatedAt: log.updatedAt,
  };
}

// What anyone may see of someone else's review. Status is left out because a
// wishlist entry is private unless its owner shares it.
function publicReview(log) {
  const { user } = log;
  return {
    id: String(log._id),
    rating: log.rating ?? null,
    text: log.text ?? '',
    createdAt: log.createdAt,
    updatedAt: log.updatedAt,
    user: user && {
      id: String(user._id), displayName: user.displayName, username: user.username ?? null, avatarUrl: user.avatarUrl ?? '',
    },
  };
}

const invalid = message => new HttpError(400, 'INVALID_LOG', message);

// Turn a request body into a Mongo update. A missing key leaves the field alone;
// null clears it. Review text is stored as plain text and never rendered as HTML.
function parseLogBody(req) {
  const body = req.body;
  if (!req.is('application/json') || !body || typeof body !== 'object' || Array.isArray(body)) {
    throw invalid('Send a JSON object with rating, text, or status.');
  }
  const keys = Object.keys(body);
  const unknown = keys.filter(key => !FIELDS.includes(key));
  if (unknown.length) throw invalid(`Unknown field: ${unknown.join(', ')}.`);
  if (!keys.length) throw invalid('Send at least one of rating, text, or status.');

  const $set = {};
  const $unset = {};
  if ('rating' in body) {
    if (body.rating === null) $unset.rating = '';
    else if (Number.isInteger(body.rating) && body.rating >= 1 && body.rating <= 5) $set.rating = body.rating;
    else throw invalid('Rating must be a whole number from 1 to 5, or null.');
  }
  if ('text' in body) {
    if (body.text === null) $set.text = '';
    else if (typeof body.text === 'string' && body.text.trim().length <= 2000) $set.text = body.text.trim();
    else throw invalid('Review text must be at most 2000 characters, or null.');
  }
  if ('status' in body) {
    if (body.status === null) $unset.status = '';
    else if (Review.STATUSES.includes(body.status)) $set.status = body.status;
    else throw invalid(`Status must be one of: ${Review.STATUSES.join(', ')}, or null.`);
  }
  return { update: { $set, $unset }, ratingChanged: 'rating' in body };
}

const isEmpty = log => log.rating == null && !log.text && !log.status;

// Delete a record that no longer holds anything. The filter re-checks emptiness so
// a concurrent write that just added content isn't lost.
async function deleteIfEmpty(log) {
  if (!isEmpty(log)) return false;
  await Review.deleteOne({
    _id: log._id, rating: null, text: { $in: ['', null] }, status: null,
  });
  return true;
}

function createLogsRouter({ requireAuth }) {
  const router = Router();

  // Create or update the caller's record for a game (PBI-05 to PBI-07; also adds
  // and removes wishlist/backlog via status, PBI-17/18/20/21).
  router.post('/games/:id/log', requireAuth, async (req, res) => {
    const gameId = objectIdParam(req.params.id, 'game id');
    const { update, ratingChanged } = parseLogBody(req);
    if (!await Game.exists({ _id: gameId })) throw new HttpError(404, 'GAME_NOT_FOUND', 'Game not found.');

    const filter = { user: req.session.userId, game: gameId };
    let result;
    for (let attempt = 0; ; attempt += 1) {
      try {
        result = await Review.findOneAndUpdate(filter, update, {
          upsert: true, returnDocument: 'after', runValidators: true, includeResultMetadata: true, lean: true,
        });
        break;
      } catch (error) {
        // Two first-time saves for the same game raced on the unique index; the retry updates.
        if (error.code !== 11000 || attempt > 0) throw error;
      }
    }
    const log = result.value;
    const created = !result.lastErrorObject?.updatedExisting;
    const deleted = await deleteIfEmpty(log);
    if (ratingChanged || deleted) await recalculateGameRating(gameId);
    if (deleted) return res.json({ log: null });
    return res.status(created ? 201 : 200).json({ log: ownLog(log) });
  });

  router.get('/games/:id/log', requireAuth, async (req, res) => {
    const gameId = objectIdParam(req.params.id, 'game id');
    const log = await Review.findOne({ user: req.session.userId, game: gameId }).lean();
    res.json({ log: log ? ownLog(log) : null });
  });

  // Public reviews for a game page (PBI-09): anything with a rating or text, newest first.
  router.get('/games/:id/reviews', async (req, res) => {
    const gameId = objectIdParam(req.params.id, 'game id');
    const page = intParam(req.query, 'page', { fallback: 1, min: 1, max: 100000 });
    const limit = intParam(req.query, 'limit', { fallback: 20, min: 1, max: 50 });
    if (!await Game.exists({ _id: gameId })) throw new HttpError(404, 'GAME_NOT_FOUND', 'Game not found.');
    const filter = { game: gameId, $or: [{ rating: { $ne: null } }, { text: { $gt: '' } }] };
    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('user', 'displayName username avatarUrl')
        .lean(),
      Review.countDocuments(filter),
    ]);
    res.json({ reviews: reviews.map(publicReview), total, page, pages: Math.ceil(total / limit) });
  });

  async function findOwnLog(req) {
    const log = await Review.findById(objectIdParam(req.params.id, 'log id'));
    if (!log) throw new HttpError(404, 'LOG_NOT_FOUND', 'Log not found.');
    if (String(log.user) !== req.session.userId) {
      throw new HttpError(403, 'FORBIDDEN', 'You can only change your own ratings and reviews.');
    }
    return log;
  }

  // Edit or delete one's own record (PBI-08).
  router.patch('/logs/:id', requireAuth, async (req, res) => {
    const log = await findOwnLog(req);
    const { update, ratingChanged } = parseLogBody(req);
    const updated = await Review.findOneAndUpdate({ _id: log._id }, update, {
      returnDocument: 'after', runValidators: true, lean: true,
    });
    if (!updated) throw new HttpError(404, 'LOG_NOT_FOUND', 'Log not found.');
    const deleted = await deleteIfEmpty(updated);
    if (ratingChanged || deleted) await recalculateGameRating(log.game);
    res.json({ log: deleted ? null : ownLog(updated) });
  });

  router.delete('/logs/:id', requireAuth, async (req, res) => {
    const log = await findOwnLog(req);
    await log.deleteOne();
    await recalculateGameRating(log.game);
    res.sendStatus(204);
  });

  return router;
}

module.exports = { createLogsRouter, ownLog, publicReview };

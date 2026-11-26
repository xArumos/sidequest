const { Router } = require('express');
const Game = require('sidequest-database/models/Game');
const GameDeveloper = require('sidequest-database/models/GameDeveloper');
const Review = require('sidequest-database/models/Review');
const { recalculateGameRating } = require('sidequest-database/ratings');
const { findDeveloperReviews, REVIEW_SORTS } = require('sidequest-database/reviews');
const { gameSummary } = require('./games');
const { publicReview } = require('./logs');
const { HttpError, textParam, intParam, objectIdParam } = require('./http');

const MAX_TEXT = 500;
const notDeveloper = () => new HttpError(403, 'NOT_DEVELOPER', 'Only approved developers of this game can do that.');

async function isApprovedDeveloper(userId, gameId) {
  return Boolean(await GameDeveloper.exists({ user: userId, game: gameId, status: 'approved' }));
}

async function approvedGameIds(userId) {
  return GameDeveloper.find({ user: userId, status: 'approved' }).distinct('game');
}

// Allows the request only for a signed-in, approved developer of the game named by
// req.params[gameIdParam]. Mount it after requireAuth; it also answers 401 on its own.
function requireDeveloper(gameIdParam = 'id') {
  return async (req, res, next) => {
    if (!req.session?.userId) throw new HttpError(401, 'UNAUTHENTICATED', 'Please sign in.');
    const gameId = objectIdParam(req.params[gameIdParam], 'game id');
    if (!await isApprovedDeveloper(req.session.userId, gameId)) throw notDeveloper();
    return next();
  };
}

// What the requester sees of their own request.
function ownRequest(request) {
  return {
    id: String(request._id),
    game: String(request.game._id ?? request.game),
    status: request.status,
    justification: request.justification ?? '',
    requestedAt: request.requestedAt,
    decidedAt: request.decidedAt ?? null,
  };
}

// Approve or reject a request. Used by the admin routes and approve-developer.js.
// A decision can be changed later, e.g. to revoke access. Returns null if not found.
async function decideDeveloperRequest(requestId, status, decidedBy = null) {
  if (!['approved', 'rejected'].includes(status)) throw new RangeError('Status must be approved or rejected.');
  return GameDeveloper.findByIdAndUpdate(requestId, { status, decidedAt: new Date(), decidedBy }, {
    returnDocument: 'after', runValidators: true,
  }).lean();
}

// Strict date input: YYYY-MM-DD, or an ISO 8601 date and time with a time zone.
const DATE = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))?$/;
const DAY = 24 * 60 * 60 * 1000;

function dateParam(query, name, { endOfDay = false } = {}) {
  const value = query[name];
  if (value === undefined) return undefined;
  const message = `${name} must be a date like 2026-01-31 or an ISO 8601 date and time.`;
  if (typeof value !== 'string' || !DATE.test(value)) throw new HttpError(400, 'INVALID_QUERY', message);
  const day = value.slice(0, 10);
  // new Date() rolls 2026-02-30 over to March; reject days that don't exist.
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day) {
    throw new HttpError(400, 'INVALID_QUERY', message);
  }
  // `to` is inclusive for the caller but exclusive for the query: a bare date covers
  // that whole UTC day, and a date and time covers that exact millisecond.
  if (!endOfDay) return date;
  return new Date(date.getTime() + (value.length === 10 ? DAY : 1));
}

const REVIEW_QUERY = ['gameId', 'minRating', 'maxRating', 'from', 'to', 'hasText', 'sort', 'page', 'limit'];

// Parse and validate the developer review filters (PBI-33). Every problem is reported
// at once in `error.fields`, keyed by query parameter.
function parseReviewQuery(query, { allowGameId }) {
  const fields = {};
  const allowed = allowGameId ? REVIEW_QUERY : REVIEW_QUERY.filter(name => name !== 'gameId');
  const read = (name, parse) => {
    try {
      return parse();
    } catch (error) {
      if (!(error instanceof HttpError)) throw error;
      fields[name] = error.message;
      return undefined;
    }
  };
  for (const name of Object.keys(query)) {
    if (!allowed.includes(name)) fields[name] = `Unknown query parameter. Use: ${allowed.join(', ')}.`;
  }
  const rating = name => read(name, () => intParam(query, name, { min: 1, max: 5 }));
  const filters = {
    gameId: allowGameId ? read('gameId', () => (query.gameId === undefined
      ? undefined : objectIdParam(query.gameId, 'gameId'))) : undefined,
    minRating: rating('minRating'),
    maxRating: rating('maxRating'),
    from: read('from', () => dateParam(query, 'from')),
    to: read('to', () => dateParam(query, 'to', { endOfDay: true })),
    hasText: read('hasText', () => {
      const value = textParam(query, 'hasText');
      if (!['', 'true', 'false'].includes(value)) throw new HttpError(400, 'INVALID_QUERY', 'hasText must be true or false.');
      return value === '' ? undefined : value === 'true';
    }),
    sort: read('sort', () => {
      const value = textParam(query, 'sort') || 'newest';
      if (!REVIEW_SORTS.includes(value)) throw new HttpError(400, 'INVALID_QUERY', `sort must be one of: ${REVIEW_SORTS.join(', ')}.`);
      return value;
    }),
    page: read('page', () => intParam(query, 'page', { fallback: 1, min: 1, max: 100000 })),
    limit: read('limit', () => intParam(query, 'limit', { fallback: 20, min: 1, max: 50 })),
  };
  if (filters.minRating !== undefined && filters.maxRating !== undefined && filters.minRating > filters.maxRating) {
    fields.maxRating = 'maxRating must be at least minRating.';
  }
  if (filters.from && filters.to && filters.from >= filters.to) fields.to = 'to must not be before from.';
  const invalid = Object.keys(fields);
  if (invalid.length) {
    throw new HttpError(400, 'INVALID_QUERY', `Invalid query parameters: ${invalid.join(', ')}.`, fields);
  }
  return filters;
}

async function listReviews(gameIds, filters) {
  const options = { ...filters };
  delete options.gameId;
  const result = await findDeveloperReviews({ gameIds, ...options });
  await Review.populate(result.reviews, [
    { path: 'user', select: 'displayName username avatarUrl' },
    { path: 'game', select: 'title' },
  ]);
  return {
    ...result,
    reviews: result.reviews.map(review => ({
      ...publicReview(review),
      game: review.game && { id: String(review.game._id), title: review.game.title },
    })),
  };
}

function reasonParam(req) {
  const reason = req.is('application/json') ? req.body?.reason : undefined;
  if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > MAX_TEXT) {
    const message = `reason must be 1-${MAX_TEXT} characters.`;
    throw new HttpError(400, 'INVALID_REASON', message, { reason: message });
  }
  return reason.trim();
}

function createDevelopersRouter({ requireAuth }) {
  const router = Router();

  // Ask to be recognized as a developer of a game (PBI-32, TC-DEV-01).
  router.post('/games/:id/developer-requests', requireAuth, async (req, res) => {
    const gameId = objectIdParam(req.params.id, 'game id');
    const justification = req.is('application/json') ? req.body?.justification : undefined;
    if (typeof justification !== 'string' || !justification.trim() || justification.trim().length > MAX_TEXT) {
      const message = `justification must be 1-${MAX_TEXT} characters.`;
      throw new HttpError(400, 'INVALID_DEVELOPER_REQUEST', message, { justification: message });
    }
    if (!await Game.exists({ _id: gameId })) throw new HttpError(404, 'GAME_NOT_FOUND', 'Game not found.');
    let request;
    try {
      request = await GameDeveloper.create({ user: req.session.userId, game: gameId, justification: justification.trim() });
    } catch (error) {
      if (error.code !== 11000) throw error;
      const existing = await GameDeveloper.findOne({ user: req.session.userId, game: gameId }).lean();
      throw new HttpError(409, 'DEVELOPER_REQUEST_EXISTS',
        `You already have a${existing?.status === 'approved' ? 'n' : ''} ${existing?.status ?? 'pending'} developer request for this game.`);
    }
    res.status(201).json({ request: ownRequest(request) });
  });

  // The caller's own request for a game, or null.
  router.get('/games/:id/developer-requests/me', requireAuth, async (req, res) => {
    const gameId = objectIdParam(req.params.id, 'game id');
    const request = await GameDeveloper.findOne({ user: req.session.userId, game: gameId }).lean();
    res.json({ request: request ? ownRequest(request) : null });
  });

  // Games the caller is an approved developer of, by title.
  router.get('/dev/games', requireAuth, async (req, res) => {
    const games = await Game.find({ _id: { $in: await approvedGameIds(req.session.userId) } })
      .sort({ title: 1, _id: 1 }).lean();
    res.json({ games: games.map(gameSummary) });
  });

  // Reviews across all of the caller's games, optionally narrowed with gameId.
  router.get('/dev/reviews', requireAuth, async (req, res) => {
    const filters = parseReviewQuery(req.query, { allowGameId: true });
    const gameIds = await approvedGameIds(req.session.userId);
    if (filters.gameId && !gameIds.some(id => String(id) === filters.gameId.toLowerCase())) throw notDeveloper();
    res.json(await listReviews(filters.gameId ? [filters.gameId] : gameIds, filters));
  });

  router.get('/dev/games/:id/reviews', requireAuth, requireDeveloper('id'), async (req, res) => {
    const filters = parseReviewQuery(req.query, { allowGameId: false });
    if (!await Game.exists({ _id: req.params.id })) throw new HttpError(404, 'GAME_NOT_FOUND', 'Game not found.');
    res.json(await listReviews([req.params.id], filters));
  });

  // Soft-delete a review that breaks the guidelines (PBI-32, TC-DEV-02).
  router.delete('/dev/reviews/:reviewId', requireAuth, async (req, res) => {
    const reviewId = objectIdParam(req.params.reviewId, 'review id');
    const reason = reasonParam(req);
    const review = await Review.findById(reviewId).lean();
    if (!review || (review.rating == null && !review.text)) throw new HttpError(404, 'REVIEW_NOT_FOUND', 'Review not found.');
    if (!await isApprovedDeveloper(req.session.userId, review.game)) throw notDeveloper();
    const removedAt = new Date();
    // Moderation does not count as new activity by the author.
    const { modifiedCount } = await Review.updateOne({ _id: review._id, removedAt: null }, {
      $set: { removedAt, removedBy: req.session.userId, removalReason: reason },
    }, { runValidators: true, timestamps: false });
    if (!modifiedCount) throw new HttpError(409, 'REVIEW_ALREADY_REMOVED', 'This review was already removed.');
    await recalculateGameRating(review.game);
    res.json({ review: { id: String(review._id), removedAt, removalReason: reason } });
  });

  return router;
}

module.exports = { createDevelopersRouter, requireDeveloper, decideDeveloperRequest, isApprovedDeveloper, ownRequest };

const { Router } = require('express');
const Review = require('sidequest-database/models/Review');
const { findGames, topGames, getGameById, getGameFilters, SORTS } = require('sidequest-database/games');
const { HttpError, textParam, intParam, objectIdParam } = require('./http');

function gameSummary(game) {
  return {
    id: String(game._id),
    title: game.title,
    slug: game.slug ?? '',
    coverUrl: game.coverUrl ?? '',
    genres: game.genres ?? [],
    platforms: game.platforms ?? [],
    releaseDate: game.releaseDate ?? null,
    ratingAvg: game.ratingAvg ?? 0,
    ratingCount: game.ratingCount ?? 0,
  };
}

// Public, read-only catalog routes (PBI-11 to PBI-16 and the catalog gap).
function createGamesRouter({ rankingMinCount = 3 } = {}) {
  const router = Router();

  router.get('/', async (req, res) => {
    const sort = textParam(req.query, 'sort') || 'title';
    if (!SORTS.includes(sort)) throw new HttpError(400, 'INVALID_QUERY', `sort must be one of: ${SORTS.join(', ')}.`);
    const result = await findGames({
      search: textParam(req.query, 'q'),
      genre: textParam(req.query, 'genre'),
      platform: textParam(req.query, 'platform'),
      sort,
      page: intParam(req.query, 'page', { fallback: 1, min: 1, max: 100000 }),
      limit: intParam(req.query, 'limit', { fallback: 20, min: 1, max: 50 }),
    });
    res.json({ ...result, games: result.games.map(gameSummary) });
  });

  router.get('/filters', async (_req, res) => {
    res.json(await getGameFilters());
  });

  router.get('/top', async (req, res) => {
    const limit = intParam(req.query, 'limit', { fallback: 10, min: 1, max: 50 });
    const games = await topGames({ minCount: rankingMinCount, limit });
    res.json({ games: games.map(gameSummary), minCount: rankingMinCount });
  });

  router.get('/:id', async (req, res) => {
    const game = await getGameById(objectIdParam(req.params.id, 'game id'));
    if (!game) throw new HttpError(404, 'GAME_NOT_FOUND', 'Game not found.');
    // ratingCount counts star ratings; reviewCount counts records with written text.
    const reviewCount = await Review.countDocuments({ game: game._id, text: { $gt: '' } });
    res.json({ game: { ...gameSummary(game), summary: game.summary ?? '', reviewCount } });
  });

  return router;
}

module.exports = { createGamesRouter, gameSummary };

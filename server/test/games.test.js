const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const Game = require('sidequest-database/models/Game');
const Review = require('sidequest-database/models/Review');
const { createGamesRouter } = require('../src/games');
const { startApi } = require('./helpers/api');

describe('games API', () => {
  let api;
  let games;

  before(async () => {
    api = await startApi({ '/games': createGamesRouter({ rankingMinCount: 3 }) });
  });
  after(() => api.stop());

  beforeEach(async () => {
    await api.reset();
    games = await Game.create([
      { title: 'Celeste', genres: ['Platform', 'Indie'], platforms: ['PC', 'Switch'], ratingAvg: 4.8, ratingCount: 5,
        coverUrl: 'https://images.igdb.com/c.jpg', summary: 'Climb a mountain.', releaseDate: new Date('2018-01-25') },
      { title: 'Hades', genres: ['Roguelike', 'Indie'], platforms: ['PC'], ratingAvg: 4.9, ratingCount: 2 },
      { title: 'Halo', genres: ['Shooter'], platforms: ['Xbox'], ratingAvg: 3, ratingCount: 4 },
      { title: 'Untitled', genres: ['Shooter'], platforms: ['PC'] },
    ]);
  });

  const titles = response => response.body.games.map(game => game.title);

  test('lists games with summaries, totals, and title order by default', async () => {
    const response = await api.request('/games');
    assert.equal(response.status, 200);
    assert.deepEqual(titles(response), ['Celeste', 'Hades', 'Halo', 'Untitled']);
    assert.deepEqual(response.body.games[0], {
      id: String(games[0]._id), title: 'Celeste', slug: '', coverUrl: 'https://images.igdb.com/c.jpg',
      genres: ['Platform', 'Indie'], platforms: ['PC', 'Switch'], releaseDate: '2018-01-25T00:00:00.000Z',
      ratingAvg: 4.8, ratingCount: 5,
    });
    assert.deepEqual({ ...response.body, games: undefined }, { games: undefined, total: 4, page: 1, pages: 1 });
  });

  test('searches, filters, and sorts together (TC-SORT-01, TC-SORT-03)', async () => {
    assert.deepEqual(titles(await api.request('/games?q=ha')), ['Hades', 'Halo']);
    assert.deepEqual(titles(await api.request('/games?genre=Indie&platform=PC&sort=top')), ['Hades', 'Celeste']);
    assert.deepEqual(titles(await api.request('/games?sort=lowest')), ['Halo', 'Celeste', 'Hades', 'Untitled']);
    assert.deepEqual(titles(await api.request('/games?sort=popular&limit=1&page=2')), ['Halo']);
  });

  test('returns an empty page, not an error, when nothing matches', async () => {
    for (const query of ['q=zzz', 'genre=Indie&platform=Xbox', 'genre=Nope', 'page=9']) {
      const response = await api.request(`/games?${query}`);
      assert.equal(response.status, 200, query);
      assert.deepEqual(response.body.games, [], query);
    }
  });

  test('rejects bad query parameters with 400', async () => {
    for (const query of ['sort=rating', 'page=0', 'page=-1', 'page=1.5', 'limit=51', 'limit=abc',
      'genre=a&genre=b', `q=${'x'.repeat(101)}`]) {
      const response = await api.request(`/games?${query}`);
      assert.equal(response.status, 400, query);
      assert.equal(response.body.error.code, 'INVALID_QUERY', query);
    }
  });

  test('ignores bracketed keys instead of building query objects', async () => {
    // Express 5's simple parser keeps "q[$ne]" as a literal key, so it never reaches Mongo.
    const response = await api.request('/games?q[$ne]=x&genre[$gt]=');
    assert.equal(response.status, 200);
    assert.equal(response.body.total, 4);
  });

  test('lists distinct genres and platforms for the filter controls', async () => {
    const response = await api.request('/games/filters');
    assert.deepEqual(response.body, {
      genres: ['Indie', 'Platform', 'Roguelike', 'Shooter'], platforms: ['PC', 'Switch', 'Xbox'],
    });
  });

  test('ranks only games at or above the minimum rating count (TC-SORT-02)', async () => {
    const response = await api.request('/games/top');
    assert.equal(response.status, 200);
    assert.deepEqual(titles(response), ['Celeste', 'Halo']);
    assert.equal(response.body.minCount, 3);
    // Hades has the best average but only 2 ratings; one more puts it on top.
    await Game.updateOne({ _id: games[1]._id }, { ratingCount: 3 });
    assert.deepEqual(titles(await api.request('/games/top?limit=1')), ['Hades']);
    assert.equal((await api.request('/games/top?limit=0')).status, 400);
  });

  test('returns game detail with separate rating and written-review counts', async () => {
    const reviewer = () => ({ user: games[0]._id.constructor.createFromTime(Date.now() / 1000 + Math.random() * 1e6) });
    await Review.create([
      { ...reviewer(), game: games[0]._id, rating: 5, text: 'Great.' },
      { ...reviewer(), game: games[0]._id, rating: 4 },
      { ...reviewer(), game: games[0]._id, status: 'wishlist' },
    ]);
    const response = await api.request(`/games/${games[0]._id}`);
    assert.equal(response.status, 200);
    assert.equal(response.body.game.title, 'Celeste');
    assert.equal(response.body.game.summary, 'Climb a mountain.');
    assert.equal(response.body.game.ratingCount, 5);
    assert.equal(response.body.game.reviewCount, 1);
  });

  test('distinguishes an invalid game id from a missing game (TC-CAT-01)', async () => {
    const invalid = await api.request('/games/not-an-id');
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.error.code, 'INVALID_ID');
    const missing = await api.request('/games/000000000000000000000000');
    assert.equal(missing.status, 404);
    assert.equal(missing.body.error.code, 'GAME_NOT_FOUND');
  });
});

// Deterministic seed data for the end-to-end harness (server/test/e2e/server.js).
// This is the single source of truth for e2e fixtures: Playwright specs import it
// to look up titles, usernames, and test passwords, so extend it here rather than
// hard-coding values in specs. Every value is synthetic test data for an
// in-memory database and must never be reused anywhere else.
//
// `key` on users and games is a stable handle that reviews use to refer to them
// before they have database ids.

const users = [
  {
    key: 'ada',
    username: 'ada_e2e',
    email: 'ada@e2e.sidequest.test',
    displayName: 'Ada E2E',
    password: 'ada-e2e-password-not-secret',
    bio: 'Seeded e2e player who has not rated anything yet.',
    wishlistVisibility: 'private',
  },
  {
    key: 'grace',
    username: 'grace_e2e',
    email: 'grace@e2e.sidequest.test',
    displayName: 'Grace E2E',
    password: 'grace-e2e-password-not-secret',
    bio: 'Seeded e2e player with existing ratings and reviews.',
    wishlistVisibility: 'public',
  },
  {
    key: 'lin',
    username: 'lin_e2e',
    email: 'lin@e2e.sidequest.test',
    displayName: 'Lin E2E',
    password: 'lin-e2e-password-not-secret',
    bio: 'Seeded e2e player who deletes their account (TC-E2E-05).',
    wishlistVisibility: 'private',
  },
];

// Google users are not seeded: the stubbed verifier in server.js creates them on
// first sign-in from the credential string.

const games = [
  {
    key: 'starfall',
    title: 'Starfall Odyssey',
    slug: 'starfall-odyssey',
    summary: 'A seeded space exploration game for end-to-end tests.',
    genres: ['Adventure', 'Role-playing (RPG)'],
    platforms: ['PC (Microsoft Windows)', 'PlayStation 5'],
    releaseDate: '2021-03-14',
  },
  {
    key: 'harbor',
    title: 'Harbor Lights',
    slug: 'harbor-lights',
    summary: 'A seeded cozy fishing game for end-to-end tests.',
    genres: ['Simulator'],
    platforms: ['Nintendo Switch', 'PC (Microsoft Windows)'],
    releaseDate: '2019-08-02',
  },
  {
    key: 'circuit',
    title: 'Circuit Breakers',
    slug: 'circuit-breakers',
    summary: 'A seeded puzzle game for end-to-end tests. Nobody has rated it yet.',
    genres: ['Puzzle'],
    platforms: ['PC (Microsoft Windows)'],
    releaseDate: '2023-11-20',
  },
  {
    key: 'ember',
    title: 'Ember Knights Saga',
    slug: 'ember-knights-saga',
    summary: 'A seeded action game for end-to-end tests.',
    genres: ['Adventure', 'Hack and slash/Beat \'em up'],
    platforms: ['PlayStation 5', 'Xbox Series X|S'],
    releaseDate: '2022-05-30',
  },
];

const reviews = [
  { user: 'grace', game: 'starfall', rating: 5, text: 'Seeded review: a stellar journey.', status: 'played' },
  { user: 'grace', game: 'harbor', rating: 4, status: 'played' },
  { user: 'grace', game: 'ember', rating: 3, text: 'Seeded review: fun but repetitive.', status: 'playing' },
  { user: 'grace', game: 'circuit', status: 'wishlist' },
  { user: 'lin', game: 'ember', rating: 5, text: 'Seeded review: deleted with its account.', status: 'played' },
];

// Writes the dataset into the connected database and returns maps from key to
// document id. Models are required lazily so specs can import the plain data
// above without loading Mongoose.
async function seedDatabase() {
  const Game = require('sidequest-database/models/Game');
  const Review = require('sidequest-database/models/Review');
  const User = require('sidequest-database/models/User');
  const { recalculateGameRating } = require('sidequest-database/ratings');
  const { hashPassword } = require('../../src/password');

  const userIds = {};
  for (const { key, password, ...fields } of users) {
    const user = await User.create({ ...fields, passwordHash: await hashPassword(password) });
    userIds[key] = user._id;
  }
  const gameIds = {};
  for (const { key, releaseDate, ...fields } of games) {
    const game = await Game.create({ ...fields, releaseDate: new Date(`${releaseDate}T00:00:00Z`) });
    gameIds[key] = game._id;
  }
  for (const { user, game, ...fields } of reviews) {
    await Review.create({ ...fields, user: userIds[user], game: gameIds[game] });
  }
  for (const id of Object.values(gameIds)) await recalculateGameRating(id);
  return { userIds, gameIds };
}

module.exports = { users, games, reviews, seedDatabase };

import { createRequire } from 'node:module';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { connectDatabase, disconnectDatabase } = require('../connection.js');
const Game = require('../models/Game.js');
const { findGames, getGameById, getGameFilters } = require('../games.js');

describe('game queries', () => {
  let mongod;
  let games;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await connectDatabase({ uri: mongod.getUri(), dbName: 'sidequest_games_test' });
    games = await Game.create([
      { title: 'A Game (Deluxe)', genres: ['Adventure'], platforms: ['PC'] },
      { title: 'Halo', genres: ['Shooter'], platforms: ['PC', 'Xbox'] },
      { title: 'Halo', genres: ['Shooter'], platforms: ['Xbox'] },
      { title: 'Portal 2', genres: ['Puzzle'], platforms: ['PC'] },
      { title: 'Zelda', genres: ['Adventure'], platforms: ['Switch'] },
    ]);
  });

  afterAll(async () => {
    await disconnectDatabase();
    await mongod?.stop();
  });

  it('finds titles without needing exact case', async () => {
    const result = await findGames({ search: ' haLO ' });
    expect(result.games.map(game => game.title)).toEqual(['Halo', 'Halo']);
    expect(result.total).toBe(2);
  });

  it('treats search text as text instead of a regular expression', async () => {
    expect((await findGames({ search: 'game (deluxe)' })).total).toBe(1);
    expect((await findGames({ search: '.*' })).total).toBe(0);
  });

  it('combines genre and platform filters', async () => {
    const result = await findGames({ genre: ' Adventure ', platform: 'PC' });
    expect(result.games.map(game => game.title)).toEqual(['A Game (Deluxe)']);
    expect((await findGames({ platform: 'PC' })).total).toBe(3);
  });

  it('keeps page order consistent for games with the same title', async () => {
    const first = await findGames({ page: 2, limit: 1 });
    const second = await findGames({ page: 3, limit: 1 });
    expect(first.total).toBe(5);
    expect(first.pages).toBe(5);
    expect(first.games[0]._id.toString()).toBe(games[1]._id.toString());
    expect(second.games[0]._id.toString()).toBe(games[2]._id.toString());
  });

  it('returns empty results for missing titles or pages', async () => {
    expect(await findGames({ search: 'missing' })).toMatchObject({ games: [], total: 0, pages: 0 });
    expect(await findGames({ page: 99, limit: 2 })).toMatchObject({ games: [], total: 5, pages: 3 });
  });

  it('rejects filter objects and invalid page sizes', async () => {
    for (const key of ['search', 'genre', 'platform']) {
      await expect(findGames({ [key]: { $ne: '' } })).rejects.toThrow(TypeError);
    }
    for (const options of [{ page: 0 }, { page: 1.5 }, { limit: 0 }, { limit: 51 },
      { page: Number.MAX_SAFE_INTEGER, limit: 50 }]) {
      await expect(findGames(options)).rejects.toThrow(RangeError);
    }
  });

  it('looks up a game and handles missing or invalid IDs', async () => {
    expect((await getGameById(games[0]._id)).title).toBe('A Game (Deluxe)');
    expect(await getGameById('not-an-id')).toBeNull();
    expect(await getGameById('000000000000000000000000')).toBeNull();
  });

  it('lists each genre and platform once in alphabetical order', async () => {
    expect(await getGameFilters()).toEqual({
      genres: ['Adventure', 'Puzzle', 'Shooter'], platforms: ['PC', 'Switch', 'Xbox'],
    });
  });
});

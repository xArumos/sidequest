import { createRequire } from 'node:module';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { connectDatabase, disconnectDatabase } = require('../connection.js');
const Game = require('../models/Game.js');
const {
  findGames, topGames, getGameById, getGameFilters, findGamesBySteamAppIds, computeSteamCoverage,
} = require('../games.js');

describe('game queries', () => {
  let mongod;
  let games;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await connectDatabase({ uri: mongod.getUri(), dbName: 'sidequest_games_test' });
    games = await Game.create([
      { title: 'A Game (Deluxe)', genres: ['Adventure'], platforms: ['PC'], ratingAvg: 2, ratingCount: 3 },
      { title: 'Halo', genres: ['Shooter'], platforms: ['PC', 'Xbox'], ratingAvg: 4.5, ratingCount: 2,
        releaseDate: new Date('2001-11-15') },
      { title: 'Halo', genres: ['Shooter'], platforms: ['Xbox'] },
      { title: 'Portal 2', genres: ['Puzzle'], platforms: ['PC'], ratingAvg: 4.5, ratingCount: 10,
        releaseDate: new Date('2011-04-19') },
      { title: 'Zelda', genres: ['Adventure'], platforms: ['Switch'], ratingAvg: 3, ratingCount: 3 },
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

  const titles = result => result.games.map(game => game.title);

  it('sorts by rating, with unrated games last either way', async () => {
    expect(titles(await findGames({ sort: 'top' }))).toEqual(['Portal 2', 'Halo', 'Zelda', 'A Game (Deluxe)', 'Halo']);
    expect(titles(await findGames({ sort: 'lowest' }))).toEqual(['A Game (Deluxe)', 'Zelda', 'Portal 2', 'Halo', 'Halo']);
  });

  it('sorts by rating count and by newest release', async () => {
    expect(titles(await findGames({ sort: 'popular' }))[0]).toBe('Portal 2');
    expect(titles(await findGames({ sort: 'newest' })).slice(0, 2)).toEqual(['Portal 2', 'Halo']);
  });

  it('combines a sort with filters and pagination', async () => {
    const result = await findGames({ platform: 'PC', sort: 'top', page: 2, limit: 1 });
    expect(titles(result)).toEqual(['Halo']);
    expect(result).toMatchObject({ total: 3, pages: 3 });
  });

  it('rejects unknown sorts', async () => {
    for (const sort of ['rating', '', 'constructor', ['top']]) {
      await expect(findGames({ sort })).rejects.toThrow();
    }
  });

  it('ranks top games that meet the minimum rating count', async () => {
    expect((await topGames({ minCount: 3 })).map(game => game.title)).toEqual(['Portal 2', 'Zelda', 'A Game (Deluxe)']);
    expect((await topGames({ minCount: 2, limit: 2 })).map(game => game.title)).toEqual(['Portal 2', 'Halo']);
    expect(await topGames({ minCount: 11 })).toEqual([]);
    for (const options of [{ minCount: 0 }, { minCount: 1.5 }, { limit: 0 }, { limit: 51 }]) {
      await expect(topGames(options)).rejects.toThrow(RangeError);
    }
  });
});

describe('findGamesBySteamAppIds', () => {
  let mongod;
  let portal;
  let tf2;
  let tf2Classic;
  let tf2Beta;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await connectDatabase({ uri: mongod.getUri(), dbName: 'sidequest_steam_test' });
    await Game.init();
    [portal, tf2Beta, tf2, tf2Classic] = await Game.create([
      { title: 'Portal 2', steamAppIds: ['620', '323180'], ratingCount: 5 },
      { title: 'TF2 Beta', steamAppIds: ['440'], ratingCount: 1 },
      { title: 'Team Fortress 2', steamAppIds: ['440'], ratingCount: 9 },
      { title: 'TF2 Classic', steamAppIds: ['440'], ratingCount: 9 },
      { title: 'Zelda' },
    ]);
  });

  afterAll(async () => {
    await disconnectDatabase();
    await mongod?.stop();
  });

  const titlesById = map => Object.fromEntries([...map].map(([id, game]) => [id, game.title]));

  it('maps each matched app ID to its game and leaves misses out', async () => {
    const result = await findGamesBySteamAppIds(['620', '323180', '999999']);
    expect(result).toBeInstanceOf(Map);
    expect(titlesById(result)).toEqual({ 620: 'Portal 2', 323180: 'Portal 2' });
    expect(result.get('620')._id.toString()).toBe(portal._id.toString());
  });

  it('accepts numbers and strings and dedupes them', async () => {
    const result = await findGamesBySteamAppIds([620, '620', ' 620 ', 440]);
    expect([...result.keys()].sort()).toEqual(['440', '620']);
  });

  it('ignores empty or invalid IDs', async () => {
    const result = await findGamesBySteamAppIds(['', '  ', null, undefined, 0, -5, 1.5, NaN, '12a',
      { $ne: '' }, ['620'], '620']);
    expect([...result.keys()]).toEqual(['620']);
  });

  it('returns an empty Map without querying for empty input', async () => {
    const find = vi.spyOn(Game, 'find');
    try {
      expect((await findGamesBySteamAppIds([])).size).toBe(0);
      expect((await findGamesBySteamAppIds(['', null])).size).toBe(0);
      expect(find).not.toHaveBeenCalled();
    } finally {
      find.mockRestore();
    }
  });

  it('rejects input that is not an array', async () => {
    for (const input of [undefined, '620', 620, { 0: '620' }]) {
      await expect(findGamesBySteamAppIds(input)).rejects.toThrow(TypeError);
    }
  });

  it('picks the most-rated game, then the oldest, when games share an app ID', async () => {
    const winner = tf2._id.toString() < tf2Classic._id.toString() ? tf2 : tf2Classic;
    const game = (await findGamesBySteamAppIds(['440'])).get('440');
    expect(game._id.toString()).toBe(winner._id.toString());
    expect(game._id.toString()).not.toBe(tf2Beta._id.toString());
  });

  it('indexes steamAppIds without making it unique', async () => {
    const index = (await Game.collection.indexes()).find(i => i.key.steamAppIds === 1);
    expect(index).toBeDefined();
    expect(index.unique).toBeFalsy();
    const plan = await Game.find({ steamAppIds: { $in: ['440'] } }).explain('queryPlanner');
    expect(JSON.stringify(plan.queryPlanner.winningPlan)).toContain('IXSCAN');
  });
});

describe('computeSteamCoverage', () => {
  let mongod;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await connectDatabase({ uri: mongod.getUri(), dbName: 'sidequest_coverage_test' });
  });

  afterAll(async () => {
    await disconnectDatabase();
    await mongod?.stop();
  });

  it('reports zeros for an empty catalog', async () => {
    expect(await computeSteamCoverage()).toEqual({
      total: 0, withSteam: 0, pc: { total: 0, missing: 0, missingSample: [] },
    });
  });

  it('counts Steam IDs overall and PC games missing one', async () => {
    const pc = 'PC (Microsoft Windows)';
    await Game.create([
      { title: 'Portal 2', platforms: [pc, 'Xbox 360'], steamAppIds: ['620'] },
      { title: 'Halo Infinite', platforms: [pc, 'Xbox Series X|S'], steamAppIds: [] },
      { title: 'Celeste', platforms: [pc] },
      { title: 'Bloodborne', platforms: ['PlayStation 4'] },
      { title: 'Stardew Valley', platforms: ['Nintendo Switch'], steamAppIds: ['413150'] },
    ]);

    expect(await computeSteamCoverage()).toEqual({
      total: 5,
      withSteam: 2,
      pc: { total: 3, missing: 2, missingSample: ['Celeste', 'Halo Infinite'] },
    });
  });

  it('limits the sample and accepts other PC platform names', async () => {
    const result = await computeSteamCoverage({ pcPlatforms: ['Xbox 360', 'PlayStation 4'], sampleSize: 1 });
    expect(result.pc).toEqual({ total: 2, missing: 1, missingSample: ['Bloodborne'] });
    expect((await computeSteamCoverage({ sampleSize: 0 })).pc.missingSample).toEqual([]);
  });

  it('rejects bad options', async () => {
    for (const options of [{ pcPlatforms: 'PC' }, { pcPlatforms: [{ $ne: '' }] }]) {
      await expect(computeSteamCoverage(options)).rejects.toThrow(TypeError);
    }
    for (const sampleSize of [-1, 1.5, 51, '10']) {
      await expect(computeSteamCoverage({ sampleSize })).rejects.toThrow(RangeError);
    }
  });
});

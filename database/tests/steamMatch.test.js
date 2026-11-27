import { createRequire } from 'node:module';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const mongoose = require('mongoose');
const { connectDatabase, disconnectDatabase } = require('../connection.js');
const Game = require('../models/Game.js');
const SteamLibrary = require('../models/SteamLibrary.js');
const { matchSteamGames, applySteamMatches, matchSteamLibrary, normalizeTitle } = require('../steamMatch.js');

describe('normalizeTitle', () => {
  it.each([
    ['Portal 2', 'portal 2'],
    ['  PORTAL   2 ', 'portal 2'],
    ['Portal™ 2', 'portal 2'],
    ['Tom Clancy’s Rainbow Six® Siege', 'tom clancy s rainbow six siege'],
    ["Tom Clancy's Rainbow Six Siege", 'tom clancy s rainbow six siege'],
    ['Half-Life: Alyx', 'half life alyx'],
    ['STAR WARS™ Jedi: Fallen Order™', 'star wars jedi fallen order'],
    ['Copyright© Game', 'copyright game'],
    ['Pokémon', 'pokemon'],
    ['The Witcher 3: Wild Hunt - Game of the Year Edition', 'the witcher 3 wild hunt'],
    ['Fallout 4: Game of the Year', 'fallout 4'],
    ['Borderlands GOTY', 'borderlands'],
    ['Borderlands: GOTY Edition', 'borderlands'],
    ['Hades - Digital Deluxe Edition', 'hades'],
    ['Control Complete Edition', 'control'],
    ['Sid Meier’s Civilization® V: Gold Edition', 'sid meier s civilization v'],
    ['Game Deluxe Edition GOTY', 'game'],
  ])('%j → %j', (input, expected) => {
    expect(normalizeTitle(input)).toBe(expected);
  });

  it('keeps editions that are usually separate catalog games', () => {
    for (const title of ['Age of Empires II: Definitive Edition', 'Dark Souls Remastered',
      'Resident Evil 2 Remake', 'Skyrim Special Edition', "Death Stranding Director's Cut"]) {
      expect(normalizeTitle(title)).toBe(normalizeTitle(title, { stripEdition: false }));
    }
  });

  it('never strips a title down to nothing', () => {
    expect(normalizeTitle('GOTY')).toBe('goty');
    expect(normalizeTitle('Deluxe Edition')).toBe('deluxe edition');
  });

  it('can keep edition suffixes', () => {
    expect(normalizeTitle('Borderlands GOTY', { stripEdition: false })).toBe('borderlands goty');
  });

  it('returns an empty string for non-strings and punctuation-only input', () => {
    for (const input of [undefined, null, 42, {}, '', ' ™ - : ']) expect(normalizeTitle(input)).toBe('');
  });
});

describe('Steam matcher', () => {
  let mongod;
  let g;
  const id = game => game._id.toString();
  const ids = list => list.map(item => item.toString());
  const plain = result => ({
    matched: result.matched.map(m => ({ ...m, gameId: m.gameId.toString() })),
    ambiguous: result.ambiguous.map(a => ({ ...a, candidates: ids(a.candidates) })),
    unmatched: result.unmatched,
  });

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await connectDatabase({ uri: mongod.getUri(), dbName: 'sidequest_steam_match_test' });
    await Promise.all([Game.init(), SteamLibrary.init()]);
  });

  afterAll(async () => {
    await disconnectDatabase();
    await mongod?.stop();
  });

  beforeEach(async () => {
    await Promise.all([Game.deleteMany({}), SteamLibrary.deleteMany({})]);
    const [portal, witcher, siege, halo1, halo2, hades, hadesGoty, aoe2, dsr, borderlands] = await Game.create([
      { title: 'Portal 2', steamAppIds: ['620'] },
      { title: 'The Witcher 3: Wild Hunt' },
      { title: "Tom Clancy's Rainbow Six Siege" },
      { title: 'Halo' },
      { title: 'HALO' },
      { title: 'Hades' },
      { title: 'Hades GOTY Edition' },
      { title: 'Age of Empires II' },
      { title: 'Dark Souls' },
      { title: 'Borderlands', steamAppIds: ['8980', '729040'] },
    ]);
    g = { portal, witcher, siege, halo1, halo2, hades, hadesGoty, aoe2, dsr, borderlands };
  });

  it('matches on Steam app ID first', async () => {
    const result = await matchSteamGames([{ appId: 620, name: 'Portal 2' }]);
    expect(plain(result)).toEqual({
      matched: [{ appId: '620', gameId: id(g.portal), method: 'appId' }], ambiguous: [], unmatched: [],
    });
  });

  it('matches a game with several app IDs on each of them', async () => {
    const result = await matchSteamGames([{ appId: '8980', name: 'Borderlands GOTY' }, { appId: '729040', name: 'x' }]);
    expect(plain(result).matched).toEqual([
      { appId: '8980', gameId: id(g.borderlands), method: 'appId' },
      { appId: '729040', gameId: id(g.borderlands), method: 'appId' },
    ]);
  });

  it('prefers the app ID match over a different title match', async () => {
    const result = await matchSteamGames([{ appId: '620', name: 'Dark Souls' }]);
    expect(plain(result).matched).toEqual([{ appId: '620', gameId: id(g.portal), method: 'appId' }]);
  });

  it('falls back to normalized title', async () => {
    const result = await matchSteamGames([
      { appId: '292030', name: 'The Witcher® 3: Wild Hunt - Game of the Year Edition' },
      { appId: '359550', name: 'Tom Clancy’s Rainbow Six® Siege' },
    ]);
    expect(plain(result)).toEqual({
      matched: [
        { appId: '292030', gameId: id(g.witcher), method: 'title' },
        { appId: '359550', gameId: id(g.siege), method: 'title' },
      ],
      ambiguous: [],
      unmatched: [],
    });
  });

  it('prefers an exact edition title before stripping the edition', async () => {
    const result = await matchSteamGames([{ appId: '1', name: 'Hades: GOTY Edition' }, { appId: '2', name: 'HADES' }]);
    expect(plain(result).matched).toEqual([
      { appId: '1', gameId: id(g.hadesGoty), method: 'title' },
      { appId: '2', gameId: id(g.hades), method: 'title' },
    ]);
  });

  it('reports ambiguous titles without auto-matching', async () => {
    const result = await matchSteamGames([{ appId: '1', name: 'Halo™' }]);
    expect(plain(result)).toEqual({
      matched: [], ambiguous: [{ appId: '1', candidates: [id(g.halo1), id(g.halo2)] }], unmatched: [],
    });
  });

  it('leaves unknown games and non-cosmetic editions unmatched', async () => {
    const result = await matchSteamGames([
      { appId: '1', name: 'Unknown Game' },
      { appId: '2', name: 'Age of Empires II: Definitive Edition' },
      { appId: '3', name: 'DARK SOULS™: REMASTERED' },
      { appId: '4', name: 'Portal' },
      { appId: '5', name: '' },
      { appId: '6' },
    ]);
    expect(plain(result)).toEqual({ matched: [], ambiguous: [], unmatched: ['1', '2', '3', '4', '5', '6'] });
  });

  it('treats regex characters in names literally', async () => {
    await Game.create({ title: 'Game (Beta)' });
    const result = await matchSteamGames([{ appId: '1', name: '.*' }, { appId: '2', name: 'Game (Beta)' }]);
    expect(result.unmatched).toEqual(['1']);
    expect(result.matched.map(m => m.appId)).toEqual(['2']);
  });

  it('handles empty input without querying', async () => {
    const find = vi.spyOn(Game, 'find');
    try {
      expect(await matchSteamGames([])).toEqual({ matched: [], ambiguous: [], unmatched: [] });
      expect(await matchSteamGames([{ appId: 'abc' }, null, { appId: 0 }])).toEqual({ matched: [], ambiguous: [], unmatched: [] });
      expect(find).not.toHaveBeenCalled();
    } finally {
      find.mockRestore();
    }
  });

  it('skips the title query when every game matches by app ID', async () => {
    const find = vi.spyOn(Game, 'find');
    try {
      await matchSteamGames([{ appId: '620', name: 'Portal 2' }]);
      expect(find).toHaveBeenCalledTimes(1);
    } finally {
      find.mockRestore();
    }
  });

  it('dedupes app IDs and rejects non-array input', async () => {
    const result = await matchSteamGames([{ appId: '620' }, { appId: 620 }, { appId: ' 620 ' }]);
    expect(result.matched).toHaveLength(1);
    for (const input of [undefined, 'x', { appId: '620' }]) await expect(matchSteamGames(input)).rejects.toThrow(TypeError);
  });

  it('uses at most two Game queries for a large library', async () => {
    const catalog = Array.from({ length: 300 }, (_, i) => ({
      title: `Catalog Game ${i}`, steamAppIds: i % 2 ? [String(10000 + i)] : [],
    }));
    await Game.insertMany(catalog);
    const owned = Array.from({ length: 1000 }, (_, i) => ({ appId: String(10000 + i), name: `Catalog Game ${i}` }));
    const find = vi.spyOn(Game, 'find');
    const aggregate = vi.spyOn(Game, 'aggregate');
    const findOne = vi.spyOn(Game, 'findOne');
    try {
      const result = await matchSteamGames(owned);
      expect(find.mock.calls.length + aggregate.mock.calls.length + findOne.mock.calls.length).toBeLessThanOrEqual(2);
      expect(result.matched.filter(m => m.method === 'appId')).toHaveLength(150);
      expect(result.matched.filter(m => m.method === 'title')).toHaveLength(150);
      expect(result.unmatched).toHaveLength(700);
    } finally {
      find.mockRestore();
      aggregate.mockRestore();
      findOne.mockRestore();
    }
  });

  describe('persistence', () => {
    const user = new mongoose.Types.ObjectId();
    const other = new mongoose.Types.ObjectId();

    beforeEach(async () => {
      await SteamLibrary.create([
        { user, appId: '620', name: 'Portal 2' },
        { user, appId: '292030', name: 'The Witcher 3: Wild Hunt GOTY' },
        { user, appId: '1', name: 'Halo' },
        { user, appId: '2', name: 'Unknown Game', gameId: new mongoose.Types.ObjectId() },
        { user: other, appId: '620', name: 'Portal 2' },
      ]);
    });

    const stored = async owner => Object.fromEntries(
      (await SteamLibrary.find({ user: owner }).lean()).map(e => [e.appId, e.gameId && e.gameId.toString()]),
    );

    it('stores gameId on matched entries and clears the rest in one bulkWrite', async () => {
      const result = await matchSteamGames(await SteamLibrary.find({ user }).lean());
      const bulkWrite = vi.spyOn(SteamLibrary, 'bulkWrite');
      try {
        await applySteamMatches(user, result);
        expect(bulkWrite).toHaveBeenCalledTimes(1);
      } finally {
        bulkWrite.mockRestore();
      }
      expect(await stored(user)).toEqual({ 620: id(g.portal), 292030: id(g.witcher), 1: null, 2: null });
      expect(await stored(other)).toEqual({ 620: null });
    });

    it('is idempotent and keeps a stable gameId', async () => {
      const first = await matchSteamLibrary(user.toString());
      const before = await stored(user);
      const second = await matchSteamLibrary(user);
      expect(plain(second)).toEqual(plain(first));
      expect(await applySteamMatches(user, second)).toEqual({ matchedCount: 4, modifiedCount: 0 });
      expect(await stored(user)).toEqual(before);
      expect(await SteamLibrary.countDocuments({ user })).toBe(4);
    });

    it('matches a game added to the catalog on the next sync', async () => {
      await matchSteamLibrary(user);
      expect((await stored(user))[2]).toBeNull();
      const added = await Game.create({ title: 'Unknown Game' });
      await matchSteamLibrary(user);
      expect((await stored(user))[2]).toBe(id(added));
    });

    it('never creates entries and validates input', async () => {
      await applySteamMatches(user, { matched: [{ appId: '999', gameId: g.portal._id }] });
      expect(await SteamLibrary.countDocuments({ user })).toBe(4);
      expect(await applySteamMatches(user, { matched: [], ambiguous: [], unmatched: [] }))
        .toEqual({ matchedCount: 0, modifiedCount: 0 });
      await expect(applySteamMatches('nope', { unmatched: ['1'] })).rejects.toThrow(TypeError);
      await expect(applySteamMatches(user, { matched: [{ appId: '1', gameId: 'x' }] })).rejects.toThrow(TypeError);
      await expect(matchSteamLibrary({ $ne: null })).rejects.toThrow(TypeError);
    });
  });
});

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { connectDatabase, disconnectDatabase } from '../connection.js';
import SteamAchievements from '../models/SteamAchievements.js';
import SteamLibrary from '../models/SteamLibrary.js';

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDatabase({ uri: mongod.getUri(), dbName: 'sidequest_test' });
  await Promise.all([SteamLibrary.init(), SteamAchievements.init()]);
});

afterAll(async () => {
  await disconnectDatabase();
  await mongod?.stop();
});

beforeEach(async () => {
  await Promise.all([SteamLibrary.deleteMany({}), SteamAchievements.deleteMany({})]);
});

const userId = () => new mongoose.Types.ObjectId();

describe('SteamLibrary', () => {
  it('requires user and appId', async () => {
    const err = await new SteamLibrary({}).validate().catch((e) => e);
    expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
    expect(Object.keys(err.errors).sort()).toEqual(['appId', 'user']);
  });

  it('applies defaults', async () => {
    const before = Date.now();
    const entry = await SteamLibrary.create({ user: userId(), appId: '1145360' });
    expect(entry.playtimeMinutes).toBe(0);
    expect(entry.name).toBe('');
    expect(entry.gameId).toBeNull();
    expect(entry.lastPlayedAt).toBeUndefined();
    expect(entry.fetchedAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('stores appId as a string', async () => {
    const entry = await SteamLibrary.create({ user: userId(), appId: 1145360 });
    expect(entry.appId).toBe('1145360');
  });

  it('rejects negative playtime', async () => {
    const entry = new SteamLibrary({ user: userId(), appId: '1', playtimeMinutes: -1 });
    await expect(entry.validate()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('allows one record per user and app', async () => {
    const user = userId();
    await SteamLibrary.create({ user, appId: '1145360' });
    await expect(SteamLibrary.create({ user, appId: '1145360' })).rejects.toMatchObject({ code: 11000 });
    await expect(SteamLibrary.create({ user, appId: '504230' })).resolves.toBeTruthy();
    await expect(SteamLibrary.create({ user: userId(), appId: '1145360' })).resolves.toBeTruthy();
  });

  it('indexes user and gameId for matcher lookups', async () => {
    const indexes = await SteamLibrary.collection.indexes();
    expect(indexes.map((i) => i.key)).toContainEqual({ user: 1, gameId: 1 });
  });
});

describe('SteamAchievements', () => {
  it('requires user and appId', async () => {
    const err = await new SteamAchievements({}).validate().catch((e) => e);
    expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
    expect(Object.keys(err.errors).sort()).toEqual(['appId', 'user']);
  });

  it('applies defaults', async () => {
    const before = Date.now();
    const doc = await SteamAchievements.create({ user: userId(), appId: '1145360' });
    expect(doc.unlocked).toHaveLength(0);
    expect(doc.total).toBe(0);
    expect(doc.fetchedAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('stores unlocked achievements', async () => {
    const unlockedAt = new Date('2025-01-02T03:04:05Z');
    const doc = await SteamAchievements.create({
      user: userId(), appId: '1145360', total: 49,
      unlocked: [{ apiName: 'ACH_ESCAPE', unlockedAt }],
    });
    const found = await SteamAchievements.findById(doc._id).lean();
    expect(found.unlocked).toEqual([{ apiName: 'ACH_ESCAPE', unlockedAt }]);
  });

  it('requires an apiName on each unlocked achievement', async () => {
    const doc = new SteamAchievements({ user: userId(), appId: '1', unlocked: [{ unlockedAt: new Date() }] });
    await expect(doc.validate()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('rejects a negative total', async () => {
    const doc = new SteamAchievements({ user: userId(), appId: '1', total: -1 });
    await expect(doc.validate()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('allows one record per user and app', async () => {
    const user = userId();
    await SteamAchievements.create({ user, appId: '1145360' });
    await expect(SteamAchievements.create({ user, appId: '1145360' })).rejects.toMatchObject({ code: 11000 });
  });
});

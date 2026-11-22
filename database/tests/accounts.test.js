import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { connectDatabase, disconnectDatabase } from '../connection.js';

// accounts.js requires the models itself, so load everything through Node's require.
const require = createRequire(import.meta.url);
const Follow = require('../models/Follow');
const Game = require('../models/Game');
const GameDeveloper = require('../models/GameDeveloper');
const Review = require('../models/Review');
const User = require('../models/User');
const { deleteAccount, ACCOUNT_CLEANUP_STEPS } = require('../accounts');

let mongod;
let alice;
let bob;
let games;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDatabase({ uri: mongod.getUri(), dbName: 'sidequest_accounts_test' });
  await Promise.all([Follow.init(), GameDeveloper.init(), Review.init()]);
});

afterAll(async () => {
  await disconnectDatabase();
  await mongod?.stop();
});

beforeEach(async () => {
  await Promise.all([Follow, Game, GameDeveloper, Review, User].map(model => model.deleteMany({})));
  [alice, bob] = await User.create([
    { googleId: 'alice', email: 'alice@example.com', displayName: 'Alice' },
    { googleId: 'bob', email: 'bob@example.com', displayName: 'Bob' },
  ]);
  games = await Game.create([{ title: 'Celeste' }, { title: 'Hades' }, { title: 'Tetris' }]);
  await Review.create([
    { user: alice._id, game: games[0]._id, rating: 1, text: 'Too hard.' },
    { user: alice._id, game: games[1]._id, status: 'wishlist' },
    { user: bob._id, game: games[0]._id, rating: 5 },
    // Alice, as a developer, removed Bob's review of Tetris.
    { user: bob._id, game: games[2]._id, rating: 1, removedAt: new Date(), removedBy: alice._id },
  ]);
  await Game.updateOne({ _id: games[0]._id }, { ratingAvg: 3, ratingCount: 2 });
  await Follow.create([{ follower: alice._id, followee: bob._id }, { follower: bob._id, followee: alice._id }]);
  await GameDeveloper.create([
    { user: alice._id, game: games[2]._id, status: 'approved' },
    { user: bob._id, game: games[1]._id, status: 'approved', decidedBy: alice._id, decidedAt: new Date() },
  ]);
});

async function expectAliceGone() {
  expect(await User.exists({ _id: alice._id })).toBeNull();
  expect(await Review.countDocuments({ user: alice._id })).toBe(0);
  expect(await Follow.countDocuments({ $or: [{ follower: alice._id }, { followee: alice._id }] })).toBe(0);
  expect(await GameDeveloper.countDocuments({ user: alice._id })).toBe(0);
  const celeste = await Game.findById(games[0]._id).lean();
  expect({ ratingAvg: celeste.ratingAvg, ratingCount: celeste.ratingCount }).toEqual({ ratingAvg: 5, ratingCount: 1 });
}

describe('deleteAccount', () => {
  it('deletes the account and its data, and recalculates affected ratings', async () => {
    expect(await deleteAccount(alice._id)).toBe(true);
    await expectAliceGone();

    // Other accounts keep their data. References to Alice as a decider or remover stay.
    expect(await User.exists({ _id: bob._id })).not.toBeNull();
    expect(await Review.countDocuments({ user: bob._id })).toBe(2);
    const removed = await Review.findOne({ user: bob._id, game: games[2]._id }).lean();
    expect(removed.removedAt).toBeInstanceOf(Date);
    expect(String(removed.removedBy)).toBe(String(alice._id));
    const mapping = await GameDeveloper.findOne({ user: bob._id }).lean();
    expect(String(mapping.decidedBy)).toBe(String(alice._id));
  });

  it('accepts a string id and reports a missing account', async () => {
    expect(await deleteAccount(String(alice._id))).toBe(true);
    expect(await deleteAccount(String(alice._id))).toBe(false);
    expect(await deleteAccount(new mongoose.Types.ObjectId())).toBe(false);
  });

  it('rejects anything that is not an id', async () => {
    await expect(deleteAccount('not-an-id')).rejects.toThrow(TypeError);
    await expect(deleteAccount({ $ne: null })).rejects.toThrow(TypeError);
  });

  it('finishes the deletion and the rating updates when retried after a failure', async () => {
    const failing = [...ACCOUNT_CLEANUP_STEPS, { name: 'failing', run: async () => { throw new Error('boom'); } }];
    await expect(deleteAccount(alice._id, { cleanupSteps: failing })).rejects.toThrow('boom');

    // The account is still there to retry with, and it remembers which games to recalculate.
    const pending = await User.findById(alice._id).select('+pendingRatingGames').lean();
    expect(pending.pendingRatingGames.map(String).sort()).toEqual([games[0]._id, games[1]._id].map(String).sort());

    // Fail again after the reviews are gone: the retry must still recalculate Celeste.
    const afterReviews = [{ name: 'reviews first', run: user => Review.deleteMany({ user }) }, ...failing];
    await expect(deleteAccount(alice._id, { cleanupSteps: afterReviews })).rejects.toThrow('boom');
    expect(await Review.countDocuments({ user: alice._id })).toBe(0);

    expect(await deleteAccount(alice._id)).toBe(true);
    await expectAliceGone();
  });
});

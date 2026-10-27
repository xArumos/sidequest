import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createRequire } from 'node:module';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectDatabase, disconnectDatabase } from '../connection.js';

// ratings.js requires the models itself. Load everything through Node's require so
// each model is compiled once; mixing in Vitest imports would register them twice.
const require = createRequire(import.meta.url);
const Game = require('../models/Game');
const Review = require('../models/Review');
const { recalculateGameRating } = require('../ratings');

let mongod;
let game;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDatabase({ uri: mongod.getUri(), dbName: 'sidequest_test' });
  await Review.init();
});

afterAll(async () => {
  await disconnectDatabase();
  await mongod?.stop();
});

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(async () => {
  await Promise.all([Game.deleteMany({}), Review.deleteMany({})]);
  game = await Game.create({ title: 'Stardew Valley' });
});

async function rate(...ratings) {
  return Review.create(ratings.map((rating) => ({
    user: new mongoose.Types.ObjectId(),
    game: game._id,
    rating,
  })));
}

async function stored() {
  const { ratingAvg, ratingCount } = await Game.findById(game._id).lean();
  return { ratingAvg, ratingCount };
}

describe('recalculateGameRating', () => {
  it('is zero when there are no ratings', async () => {
    expect(await recalculateGameRating(game._id)).toEqual({ ratingAvg: 0, ratingCount: 0 });
    expect(await stored()).toEqual({ ratingAvg: 0, ratingCount: 0 });
  });

  it('handles a single rating', async () => {
    await rate(5);
    await recalculateGameRating(game._id);
    expect(await stored()).toEqual({ ratingAvg: 5, ratingCount: 1 });
  });

  it('averages many ratings, rounded to two decimals', async () => {
    await rate(5, 5, 4);
    await recalculateGameRating(String(game._id));
    expect(await stored()).toEqual({ ratingAvg: 4.67, ratingCount: 3 });
  });

  it('ignores wishlist/backlog records without a rating', async () => {
    await rate(4);
    await Review.create({ user: new mongoose.Types.ObjectId(), game: game._id, status: 'wishlist' });
    await recalculateGameRating(game._id);
    expect(await stored()).toEqual({ ratingAvg: 4, ratingCount: 1 });
  });

  it('updates after a rating is deleted', async () => {
    const [low] = await rate(1, 5);
    await recalculateGameRating(game._id);
    expect(await stored()).toEqual({ ratingAvg: 3, ratingCount: 2 });
    await low.deleteOne();
    await recalculateGameRating(game._id);
    expect(await stored()).toEqual({ ratingAvg: 5, ratingCount: 1 });
  });

  it('does not touch other games', async () => {
    const other = await Game.create({ title: 'Celeste' });
    await rate(2);
    await recalculateGameRating(game._id);
    expect((await Game.findById(other._id).lean()).ratingCount).toBe(0);
  });

  it('ignores games stored before ratingVersion existed', async () => {
    const { insertedId } = await Game.collection.insertOne({ title: 'Old import' });
    await Review.create({ user: new mongoose.Types.ObjectId(), game: insertedId, rating: 4 });
    expect(await recalculateGameRating(insertedId)).toEqual({ ratingAvg: 4, ratingCount: 1 });
    expect(await Game.findById(insertedId).lean()).toMatchObject({ ratingAvg: 4, ratingCount: 1 });
  });
});

describe('recalculateGameRating with overlapping calls', () => {
  // Pause the first Game.updateOne (recalculation A) after its aggregate has run,
  // so a second recalculation (B) can finish in between.
  function pauseFirstUpdate() {
    const original = Game.updateOne.bind(Game);
    let reached;
    let release;
    const atUpdate = new Promise((resolve) => { reached = resolve; });
    const released = new Promise((resolve) => { release = resolve; });
    let calls = 0;
    vi.spyOn(Game, 'updateOne').mockImplementation(async (...args) => {
      calls += 1;
      if (calls === 1) {
        reached();
        await released;
      }
      return original(...args);
    });
    return { atUpdate, release };
  }

  it('keeps a newer rating when an older recalculation finishes last', async () => {
    await rate(5);
    const { atUpdate, release } = pauseFirstUpdate();
    const first = recalculateGameRating(game._id);
    await atUpdate;

    await rate(1);
    expect(await recalculateGameRating(game._id)).toEqual({ ratingAvg: 3, ratingCount: 2 });
    release();
    expect(await first).toEqual({ ratingAvg: 3, ratingCount: 2 });
    expect(await stored()).toEqual({ ratingAvg: 3, ratingCount: 2 });
  });

  it('keeps a deletion when an older recalculation finishes last', async () => {
    const [low] = await rate(1, 5);
    await recalculateGameRating(game._id);
    const { atUpdate, release } = pauseFirstUpdate();
    const first = recalculateGameRating(game._id);
    await atUpdate;

    await low.deleteOne();
    await recalculateGameRating(game._id);
    release();
    await first;
    expect(await stored()).toEqual({ ratingAvg: 5, ratingCount: 1 });
  });

  it('settles on the right totals when many run at once', async () => {
    const reviews = await rate(1, 2, 3, 4, 5);
    await Promise.all([
      ...reviews.map(() => recalculateGameRating(game._id)),
      reviews[0].deleteOne().then(() => recalculateGameRating(game._id)),
    ]);
    expect(await stored()).toEqual({ ratingAvg: 3.5, ratingCount: 4 });
  });
});

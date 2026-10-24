import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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
});

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { connectDatabase, disconnectDatabase } from '../connection.js';

// reviews.js requires the models itself, so load everything through Node's require.
const require = createRequire(import.meta.url);
const GameDeveloper = require('../models/GameDeveloper');
const Review = require('../models/Review');
const { findDeveloperReviews, REVIEW_SORTS } = require('../reviews');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDatabase({ uri: mongod.getUri(), dbName: 'sidequest_test' });
  await Promise.all([GameDeveloper.init(), Review.init()]);
});

afterAll(async () => {
  await disconnectDatabase();
  await mongod?.stop();
});

beforeEach(async () => {
  await Promise.all([GameDeveloper.deleteMany({}), Review.deleteMany({})]);
});

const id = () => new mongoose.Types.ObjectId();

describe('GameDeveloper', () => {
  it('defaults to a pending request with a request time', async () => {
    const request = await GameDeveloper.create({ user: id(), game: id(), justification: '  I made it.  ' });
    expect(request).toMatchObject({ status: 'pending', justification: 'I made it.', decidedAt: null, decidedBy: null });
    expect(request.requestedAt).toBeInstanceOf(Date);
  });

  it('accepts only known statuses', async () => {
    for (const status of GameDeveloper.STATUSES) {
      await expect(new GameDeveloper({ user: id(), game: id(), status }).validate()).resolves.toBeUndefined();
    }
    expect(GameDeveloper.STATUSES).toEqual(['pending', 'approved', 'rejected']);
    await expect(new GameDeveloper({ user: id(), game: id(), status: 'owner' }).validate())
      .rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('requires a user and a game and limits the justification', async () => {
    await expect(new GameDeveloper({ game: id() }).validate()).rejects.toThrow(/user/);
    await expect(new GameDeveloper({ user: id() }).validate()).rejects.toThrow(/game/);
    await expect(new GameDeveloper({ user: id(), game: id(), justification: 'x'.repeat(501) }).validate())
      .rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('allows one request per user and game', async () => {
    const user = id();
    const game = id();
    await GameDeveloper.create({ user, game });
    await expect(GameDeveloper.create({ user, game })).rejects.toMatchObject({ code: 11000 });
    await expect(GameDeveloper.create({ user, game: id() })).resolves.toBeTruthy();
    await expect(GameDeveloper.create({ user: id(), game })).resolves.toBeTruthy();
  });
});

describe('Review soft delete fields', () => {
  it('defaults to not removed', async () => {
    const review = await Review.create({ user: id(), game: id(), rating: 3 });
    expect(review).toMatchObject({ removedAt: null, removedBy: null, removalReason: '' });
  });
});

describe('findDeveloperReviews', () => {
  const game = id();
  async function seed() {
    const day = n => new Date(Date.UTC(2026, 0, n));
    await Review.insertMany([
      { user: id(), game, rating: 5, text: 'Great', createdAt: day(1) },
      { user: id(), game, rating: 2, text: '', createdAt: day(2) },
      { user: id(), game, text: 'No stars', createdAt: day(3) },
      { user: id(), game, status: 'wishlist', createdAt: day(4) },
      { user: id(), game, rating: 1, text: 'Spam', removedAt: day(5), createdAt: day(5) },
      { user: id(), game: id(), rating: 4, createdAt: day(6) },
    ]);
  }
  const texts = result => result.reviews.map(review => review.rating ?? review.text);

  it('lists active reviews of the given games, newest first', async () => {
    await seed();
    const result = await findDeveloperReviews({ gameIds: [game] });
    expect(texts(result)).toEqual(['No stars', 2, 5]);
    expect(result).toMatchObject({ total: 3, page: 1, pages: 1 });
  });

  it('puts text-only reviews last for both rating sorts', async () => {
    await seed();
    expect(texts(await findDeveloperReviews({ gameIds: [game], sort: 'highest' }))).toEqual([5, 2, 'No stars']);
    expect(texts(await findDeveloperReviews({ gameIds: [game], sort: 'lowest' }))).toEqual([2, 5, 'No stars']);
    expect(REVIEW_SORTS).toEqual(['newest', 'oldest', 'highest', 'lowest']);
  });

  it('returns nothing for an empty game list and rejects bad input', async () => {
    await seed();
    expect(await findDeveloperReviews({ gameIds: [] })).toEqual({ reviews: [], total: 0, page: 1, pages: 0 });
    await expect(findDeveloperReviews({ gameIds: ['nope'] })).rejects.toThrow(TypeError);
    await expect(findDeveloperReviews({ gameIds: [game], sort: 'random' })).rejects.toThrow(RangeError);
    await expect(findDeveloperReviews({ gameIds: [game], minRating: 0 })).rejects.toThrow(RangeError);
    await expect(findDeveloperReviews({ gameIds: [game], from: new Date('nope') })).rejects.toThrow(TypeError);
    await expect(findDeveloperReviews({ gameIds: [game], hasText: 'yes' })).rejects.toThrow(TypeError);
    await expect(findDeveloperReviews({ gameIds: [game], limit: 51 })).rejects.toThrow(RangeError);
  });
});

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { connectDatabase, disconnectDatabase } from '../connection.js';
import Game from '../models/Game.js';
import Review from '../models/Review.js';
import User from '../models/User.js';

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDatabase({ uri: mongod.getUri(), dbName: 'sidequest_test' });
  await Promise.all([Game.init(), Review.init(), User.init()]);
});

afterAll(async () => {
  await disconnectDatabase();
  await mongod?.stop();
});

beforeEach(async () => {
  await Promise.all([Game.deleteMany({}), Review.deleteMany({}), User.deleteMany({})]);
});

function review(fields) {
  return new Review({
    user: new mongoose.Types.ObjectId(),
    game: new mongoose.Types.ObjectId(),
    ...fields,
  });
}

describe('Review rating', () => {
  it.each([1, 2, 3, 4, 5])('accepts %d', async (rating) => {
    await expect(review({ rating }).validate()).resolves.toBeUndefined();
  });

  it.each([0, -1, 6, 5.4])('rejects %d', async (rating) => {
    await expect(review({ rating }).validate()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('rejects non-numeric input', async () => {
    await expect(review({ rating: 'five' }).validate()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('is optional when there is a status or text', async () => {
    await expect(review({ status: 'wishlist' }).validate()).resolves.toBeUndefined();
    await expect(review({ text: 'Loved it' }).validate()).resolves.toBeUndefined();
  });
});

describe('Review content and status', () => {
  it('rejects a record with no rating, text, or status', async () => {
    await expect(review({}).validate()).rejects.toThrow(/rating, text, or status/);
    await expect(review({ text: '   ' }).validate()).rejects.toThrow(/rating, text, or status/);
  });

  it('accepts every known status and rejects others', async () => {
    for (const status of Review.STATUSES) {
      await expect(review({ status }).validate()).resolves.toBeUndefined();
    }
    await expect(review({ status: 'abandoned' }).validate()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('allows only one record per user and game', async () => {
    const user = new mongoose.Types.ObjectId();
    const game = new mongoose.Types.ObjectId();
    await Review.create({ user, game, rating: 4 });
    await expect(Review.create({ user, game, status: 'played' })).rejects.toMatchObject({ code: 11000 });
  });
});

describe('User wishlist visibility', () => {
  it('defaults to private and rejects unknown values', async () => {
    const user = new User({ googleId: 'g-1', email: 'a@example.com', displayName: 'A' });
    expect(user.wishlistVisibility).toBe('private');
    user.wishlistVisibility = 'friends';
    await expect(user.validate()).rejects.toThrow(mongoose.Error.ValidationError);
  });
});

describe('Game', () => {
  it('starts with no rating and allows several games without an IGDB id', async () => {
    const [a] = await Game.create([{ title: 'Hades' }, { title: 'Celeste' }]);
    expect(a.ratingAvg).toBe(0);
    expect(a.ratingCount).toBe(0);
  });

  it('rejects a duplicate IGDB id', async () => {
    await Game.create({ title: 'Hades', igdbId: 113112 });
    await expect(Game.create({ title: 'Hades copy', igdbId: 113112 })).rejects.toMatchObject({ code: 11000 });
  });
});

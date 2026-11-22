import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { connectDatabase, disconnectDatabase } from '../connection.js';
import Follow from '../models/Follow.js';
import User from '../models/User.js';

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDatabase({ uri: mongod.getUri(), dbName: 'sidequest_follow_test' });
  await Follow.init();
});

afterAll(async () => {
  await disconnectDatabase();
  await mongod?.stop();
});

beforeEach(async () => {
  await Follow.deleteMany({});
});

const id = () => new mongoose.Types.ObjectId();

describe('Follow', () => {
  it('records a one-way follow with a creation time', async () => {
    const [follower, followee] = [id(), id()];
    const follow = await Follow.create({ follower, followee });
    expect(follow.createdAt).toBeInstanceOf(Date);
    expect(follow.updatedAt).toBeUndefined();
    expect(await Follow.exists({ follower: followee, followee: follower })).toBeNull();
  });

  it('requires both users', async () => {
    await expect(new Follow({ follower: id() }).validate()).rejects.toThrow(mongoose.Error.ValidationError);
    await expect(new Follow({ followee: id() }).validate()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('rejects self-follows', async () => {
    const user = id();
    await expect(Follow.create({ follower: user, followee: user })).rejects.toThrow(/cannot follow themselves/);
  });

  it('allows only one follow per pair', async () => {
    const [follower, followee] = [id(), id()];
    await Follow.create({ follower, followee });
    await expect(Follow.create({ follower, followee })).rejects.toMatchObject({ code: 11000 });
    await expect(Follow.create({ follower: followee, followee: follower })).resolves.toBeTruthy();
  });

  it('indexes the pair and the followee', async () => {
    const keys = (await Follow.collection.indexes()).map(index => index.key);
    expect(keys).toContainEqual({ follower: 1, followee: 1 });
    expect(keys).toContainEqual({ followee: 1, createdAt: -1 });
  });
});

describe('User visibility settings', () => {
  const user = fields => new User({ googleId: 'g-1', email: 'a@example.com', displayName: 'A', ...fields });

  it('defaults activity to public and wishlist to private', () => {
    expect(user().activityVisibility).toBe('public');
    expect(user().wishlistVisibility).toBe('private');
  });

  it.each(['public', 'followers', 'private'])('accepts %s for both settings', async (value) => {
    await expect(user({ activityVisibility: value, wishlistVisibility: value }).validate()).resolves.toBeUndefined();
  });

  it('rejects unknown values', async () => {
    await expect(user({ activityVisibility: 'friends' }).validate()).rejects.toThrow(mongoose.Error.ValidationError);
  });
});

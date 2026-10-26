import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connectDatabase, disconnectDatabase } from '../connection.js';

describe('connectDatabase', () => {
  let mongod;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
  });

  afterAll(async () => {
    await disconnectDatabase();
    await mongod?.stop();
  });

  it('connects to the given database and responds to ping', async () => {
    const connection = await connectDatabase({ uri: mongod.getUri(), dbName: 'sidequest_test' });

    expect(connection.name).toBe('sidequest_test');
    const result = await connection.db.command({ ping: 1 });
    expect(result.ok).toBe(1);
  });
});

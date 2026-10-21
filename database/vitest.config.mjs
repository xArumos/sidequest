import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // mongodb-memory-server downloads a mongod binary on first run
    hookTimeout: 120000,
  },
});

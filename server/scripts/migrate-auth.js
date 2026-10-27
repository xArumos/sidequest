const { connectDatabase, disconnectDatabase } = require('sidequest-database');
const User = require('sidequest-database/models/User');
const { legacyGoogleIndexes } = require('../src/user-indexes');

async function main() {
  await connectDatabase();
  // Only replace the legacy Google index. Never drop unrelated indexes or user data.
  for (const index of await legacyGoogleIndexes(User.collection)) {
    await User.collection.dropIndex(index.name);
  }
  await User.createIndexes();
  console.log('Authentication indexes are ready. Existing accounts were preserved.');
}

main().catch(error => {
  console.error('Authentication migration failed:', error.message);
  process.exitCode = 1;
}).finally(disconnectDatabase);

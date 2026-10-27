const { parseArgs } = require('node:util');
const { connectDatabase, disconnectDatabase } = require('sidequest-database');
const Game = require('sidequest-database/models/Game');
const { createIgdbClient } = require('../src/igdb');
const { importGames } = require('../src/igdbImport');

// Usage: npm run import:games -- --limit 500
async function main() {
  const { values } = parseArgs({ options: { limit: { type: 'string', default: '500' } } });
  const limit = Number(values.limit);
  if (!Number.isInteger(limit) || limit < 1) throw new Error('--limit must be a positive integer.');
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET in .env.');

  await connectDatabase();
  await Game.init();
  const total = await importGames({
    client: createIgdbClient({ clientId, clientSecret }),
    games: Game,
    limit,
    log: message => console.log(message),
  });
  console.log(`Done: ${total} games imported or updated.`);
}

main()
  .catch(error => {
    console.error('Game import failed:', error.message);
    process.exitCode = 1;
  })
  .finally(disconnectDatabase);

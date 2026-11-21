const { parseArgs } = require('node:util');
const { connectDatabase, disconnectDatabase } = require('sidequest-database');
const { computeSteamCoverage } = require('sidequest-database/games');

const percent = (part, whole) => (whole === 0 ? '0.0%' : `${((part / whole) * 100).toFixed(1)}%`);

// Usage: npm run steam-coverage -- --sample 10
async function main() {
  const { values } = parseArgs({ options: { sample: { type: 'string', default: '10' } } });
  const sampleSize = Number(values.sample);
  if (!Number.isInteger(sampleSize) || sampleSize < 0 || sampleSize > 50) {
    throw new Error('--sample must be a whole number from 0 to 50.');
  }

  await connectDatabase();
  const { total, withSteam, pc } = await computeSteamCoverage({ sampleSize });
  console.log(`Total games: ${total}`);
  console.log(`Games with a Steam app ID: ${withSteam} (${percent(withSteam, total)})`);
  console.log(`PC games: ${pc.total}`);
  console.log(`PC games missing a Steam app ID: ${pc.missing} (${percent(pc.missing, pc.total)})`);
  if (pc.missingSample.length > 0) {
    console.log('Sample of PC games missing one:');
    for (const title of pc.missingSample) console.log(`  - ${title}`);
  }
}

main()
  .catch(error => {
    console.error('Steam coverage report failed:', error.message);
    process.exitCode = 1;
  })
  .finally(disconnectDatabase);

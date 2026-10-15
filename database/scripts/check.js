const { connectDatabase, disconnectDatabase } = require('..');

async function main() {
  try {
    const connection = await connectDatabase();
    await connection.db.command({ ping: 1 });
    console.log(`Connected to ${connection.name}.`);
  } catch (error) {
    console.error('Database connection failed:', error.message);
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}

main();

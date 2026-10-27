async function legacyGoogleIndexes(collection) {
  let indexes;
  try {
    indexes = await collection.indexes();
  } catch (error) {
    if (error.code === 26) return [];
    throw error;
  }
  return indexes.filter(index => Object.keys(index.key).length === 1 && index.key.googleId === 1 &&
    index.unique && !index.partialFilterExpression);
}

async function assertUserIndexes(collection) {
  if ((await legacyGoogleIndexes(collection)).length) {
    throw new Error('Legacy User index found. Stop the API and run npm run migrate:auth --prefix server before restarting.');
  }
}

module.exports = { legacyGoogleIndexes, assertUserIndexes };

const COVER_URL = 'https://images.igdb.com/igdb/image/upload/t_cover_big';
const MAX_PAGE_SIZE = 500;
// Steam's id in IGDB's external game sources. IGDB is replacing `category` with
// `external_game_source`, so accept either field.
const STEAM_SOURCE = 1;

const FIELDS = [
  'name', 'slug', 'summary', 'first_release_date', 'cover.image_id', 'genres.name', 'platforms.name',
  'external_games.uid', 'external_games.category', 'external_games.external_game_source',
];

function popularGamesQuery({ limit, offset }) {
  // Popular, rated main releases only; version_parent excludes editions like "GOTY".
  return `fields ${FIELDS.join(',')}; where total_rating_count > 20 & version_parent = null; `
    + `sort total_rating_count desc; limit ${limit}; offset ${offset};`;
}

function mapIgdbGame(raw) {
  const isSteam = external => external.external_game_source === STEAM_SOURCE || external.category === STEAM_SOURCE;
  const game = {
    igdbId: raw.id,
    title: raw.name,
    slug: raw.slug,
    summary: raw.summary || '',
    coverUrl: raw.cover?.image_id ? `${COVER_URL}/${raw.cover.image_id}.jpg` : '',
    genres: (raw.genres || []).map(genre => genre.name),
    platforms: (raw.platforms || []).map(platform => platform.name),
    steamAppIds: [...new Set((raw.external_games || []).filter(isSteam).map(external => external.uid).filter(Boolean))],
  };
  if (raw.first_release_date) game.releaseDate = new Date(raw.first_release_date * 1000);
  return game;
}

// Upsert up to `limit` of IGDB's most-rated games, keyed by igdbId. Re-running
// refreshes metadata and never touches stored ratings.
async function importGames({ client, games, limit, log = () => {} }) {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('limit must be a positive integer.');
  let imported = 0;
  for (let offset = 0; offset < limit; offset += MAX_PAGE_SIZE) {
    const page = await client.query('games', popularGamesQuery({ limit: Math.min(MAX_PAGE_SIZE, limit - offset), offset }));
    const valid = page.filter(raw => Number.isInteger(raw.id) && typeof raw.name === 'string' && raw.name.trim());
    if (valid.length) {
      await games.bulkWrite(valid.map(raw => {
        const game = mapIgdbGame(raw);
        return { updateOne: { filter: { igdbId: game.igdbId }, update: { $set: game }, upsert: true } };
      }), { ordered: false });
    }
    imported += valid.length;
    log(`Imported ${imported} games.`);
    if (page.length < MAX_PAGE_SIZE) break;
  }
  return imported;
}

module.exports = { importGames, mapIgdbGame, popularGamesQuery };

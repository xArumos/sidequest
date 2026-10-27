// Display helpers for GameSummary objects from the catalog API (see PR #28).
export function ratingLabel(game) {
  const count = Number.isInteger(game.ratingCount) ? game.ratingCount : 0
  if (!count || !Number.isFinite(game.ratingAvg)) return 'Not rated yet'
  return `★ ${game.ratingAvg.toFixed(1)} · ${count} ${count === 1 ? 'rating' : 'ratings'}`
}

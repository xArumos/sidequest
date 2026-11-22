// Display helpers for GameSummary objects from the catalog API (see PR #28).
export function ratingLabel(game) {
  const count = Number.isInteger(game.ratingCount) ? game.ratingCount : 0
  if (!count || !Number.isFinite(game.ratingAvg)) return 'Not rated yet'
  return `★ ${game.ratingAvg.toFixed(1)} · ${count} ${count === 1 ? 'rating' : 'ratings'}`
}

export function stars(rating) {
  return Number.isInteger(rating) ? `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}` : ''
}

export function formatDate(value) {
  return value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : ''
}

// Existing client-side discovery rules; callers must supply real catalog data in the app.
// Tests supply synthetic arrays, never pretend a catalog endpoint exists.
export function filterAndSortGames(games, { search = '', genre = 'All', sort = 'title' } = {}) {
  const query = search.trim().toLowerCase()
  const score = (game) => {
    const value = sort === 'reviews' ? game.reviewCount : game.rating
    return Number.isFinite(value) && value >= 0 ? value : -Infinity
  }
  return games.filter(game => typeof game?.title === 'string'
    && game.title.toLowerCase().includes(query)
    && (genre === 'All' || game.genre === genre))
    .sort((a, b) => {
      if (sort === 'rating' || sort === 'reviews') {
        // Equal missing values must compare as a tie, rather than NaN.
        return score(a) === score(b) ? 0 : score(a) > score(b) ? -1 : 1
      }
      return a.title.localeCompare(b.title)
    })
}

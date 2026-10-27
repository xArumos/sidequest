import { expect, it } from 'vitest'
import { filterAndSortGames } from './games'
const games = [
  { id: 'c', title: 'Cobalt Quest', genre: 'RPG', rating: 3, reviewCount: 40 },
  { id: 'a', title: 'Amber Quest', genre: 'RPG', rating: 5, reviewCount: 2 },
  { id: 'b', title: 'Blue Puzzle', genre: 'Puzzle', rating: 4, reviewCount: 20 },
  { id: 'd', title: 'Dusk Quest', genre: 'RPG', rating: 4, reviewCount: 12 },
]
const ids = result => result.map(game => game.id)
it('[TC-SORT-01] combines title search genre filtering and highest-rating sorting', () => {
  expect(ids(filterAndSortGames(games, { search: 'quest', genre: 'RPG', sort: 'rating' }))).toEqual(['a', 'd', 'c'])
  expect(ids(filterAndSortGames(games, { genre: 'Puzzle', sort: 'rating' }))).toEqual(['b'])
})
it('[TC-FE-SORT-01] orders top rated games without mutating the source dataset', () => {
  const input = Object.freeze(games.map(game => Object.freeze({ ...game })))
  expect(ids(filterAndSortGames(input, { sort: 'rating' }))).toEqual(['a', 'b', 'd', 'c'])
  expect(ids(input)).toEqual(['c', 'a', 'b', 'd'])
})
it('[TC-FE-SORT-02] orders most-reviewed games by counts rather than ratings', () => {
  expect(ids(filterAndSortGames(games, { sort: 'reviews' }))).toEqual(['c', 'b', 'd', 'a'])
})
it('[TC-FE-SORT-03] defaults to alphabetical titles and returns all genres', () => {
  expect(ids(filterAndSortGames(games))).toEqual(['a', 'b', 'c', 'd'])
})
it('[TC-FE-SORT-04] trims search whitespace and ignores title case', () => {
  expect(ids(filterAndSortGames(games, { search: '  AMBER  ' }))).toEqual(['a'])
})
it('[TC-FE-SORT-05] returns empty results for unmatched filters and empty datasets', () => {
  expect(filterAndSortGames(games, { search: 'missing' })).toEqual([])
  expect(filterAndSortGames(games, { genre: 'Strategy' })).toEqual([])
  expect(filterAndSortGames([])).toEqual([])
})
it('[TC-FE-SORT-06] places missing scores last and ignores records without usable titles', () => {
  const incomplete = [{ id: 'missing', title: 'Missing metadata' }, null, {}, ...games]
  expect(ids(filterAndSortGames(incomplete, { sort: 'rating' }))).toEqual(['a', 'b', 'd', 'c', 'missing'])
  expect(ids(filterAndSortGames(incomplete, { sort: 'reviews' }))).toEqual(['c', 'b', 'd', 'a', 'missing'])
})

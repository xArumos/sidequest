import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'
import GameCard from './GameCard'

const game = {
  id: 'synthetic-game-1', title: 'Synthetic Adventure', genres: ['Puzzle', 'Adventure', 'Indie'], platforms: ['PC'],
  ratingAvg: 4.5, ratingCount: 12, coverUrl: '/synthetic-cover.svg', releaseDate: '2018-01-25T00:00:00.000Z',
}
function card(overrides = {}, props = {}) {
  return render(<MemoryRouter><GameCard game={{ ...game, ...overrides }} {...props} /></MemoryRouter>)
}
it('[TC-FE-CARD-01] displays title, first genres, artwork, rating summary, and release year', () => {
  card()
  expect(screen.getByRole('heading', { name: game.title })).toBeInTheDocument()
  expect(screen.getByText('Puzzle · Adventure')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: game.title })).toHaveAttribute('src', game.coverUrl)
  expect(screen.getByText('★ 4.5 · 12 ratings · 2018')).toBeInTheDocument()
})
it('[TC-FE-CARD-02] retains a complete long title as text rather than HTML', () => {
  const title = 'Synthetic <img onerror=alert(1)> ' + 'Long title '.repeat(30)
  card({ title })
  expect(screen.getByRole('heading')).toHaveTextContent(title.trim())
  expect(screen.getAllByRole('img')).toHaveLength(1)
})
it('[TC-FE-CARD-03] labels unrated games and tolerates missing metadata', () => {
  card({ ratingAvg: 0, ratingCount: 0, genres: undefined, releaseDate: null })
  expect(screen.getByText('Not rated yet')).toBeInTheDocument()
  expect(screen.queryByText(/undefined|NaN/)).not.toBeInTheDocument()
})
it('[TC-FE-CARD-04] replaces a failed image with an accessible fallback', () => {
  card()
  fireEvent.error(screen.getByRole('img'))
  expect(screen.getByRole('img', { name: /artwork unavailable.*synthetic adventure/i })).toBeInTheDocument()
  expect(screen.queryByRole('img', { name: game.title })).not.toBeInTheDocument()
})
it('[TC-FE-CARD-05] handles an absent cover with a named fallback', () => {
  card({ coverUrl: '' })
  expect(screen.getByRole('img', { name: /artwork unavailable/i })).toBeInTheDocument()
})
it('[TC-FE-WISHLIST-01] toggles the wishlist through the supplied handler and blocks repeat clicks while saving', async () => {
  const toggle = vi.fn()
  const { rerender } = card({}, { onToggleWishlist: toggle })
  await userEvent.click(screen.getByRole('button', { name: '+ Wishlist' }))
  expect(toggle).toHaveBeenCalledWith(game.id)
  rerender(<MemoryRouter><GameCard game={game} onToggleWishlist={toggle} busy isWishlisted /></MemoryRouter>)
  expect(screen.getByRole('button', { name: 'Wishlisted' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Wishlisted' })).toHaveAttribute('aria-pressed', 'true')
})
it('[TC-FE-WISHLIST-02] hides the wishlist button when no handler is supplied', () => {
  card()
  expect(screen.queryByRole('button', { name: /wishlist/i })).not.toBeInTheDocument()
})
it('[TC-FE-CARD-06] follows the game detail link using its actual identifier', async () => {
  render(<MemoryRouter><Routes>
    <Route path="/" element={<GameCard game={game} />} />
    <Route path={`/games/${game.id}`} element={<h1>Synthetic detail destination</h1>} />
  </Routes></MemoryRouter>)
  await userEvent.click(screen.getByRole('link', { name: 'View details' }))
  expect(screen.getByRole('heading', { name: 'Synthetic detail destination' })).toBeInTheDocument()
})

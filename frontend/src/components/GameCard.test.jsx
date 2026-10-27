import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'
import GameCard from './GameCard'

const game = { id: 'synthetic-game-1', title: 'Synthetic Adventure', genre: 'Puzzle', rating: 4.5, reviewCount: 12, cover: '/synthetic-cover.svg', description: 'A synthetic puzzle adventure.' }
function card(overrides = {}, props = {}) {
  return render(<MemoryRouter><GameCard game={{ ...game, ...overrides }} onToggleWishlist={vi.fn()} {...props} /></MemoryRouter>)
}
it('[TC-FE-CARD-01] displays title genre description artwork and community metadata', () => {
  card()
  expect(screen.getByRole('heading', { name: game.title })).toBeInTheDocument()
  expect(screen.getByText(game.genre)).toBeInTheDocument()
  expect(screen.getByText(game.description)).toBeInTheDocument()
  expect(screen.getByRole('img', { name: game.title })).toHaveAttribute('src', game.cover)
  expect(screen.getByText(/4.5.*12 reviews/)).toBeInTheDocument()
})
it('[TC-FE-CARD-02] retains a complete long title as text rather than HTML', () => {
  const title = 'Synthetic <img onerror=alert(1)> ' + 'Long title '.repeat(30)
  card({ title })
  expect(screen.getByRole('heading')).toHaveTextContent(title.trim())
  expect(screen.getAllByRole('img')).toHaveLength(1)
})
it('[TC-FE-CARD-03] handles missing rating and review-count data without crashing', () => {
  card({ rating: undefined, reviewCount: undefined })
  expect(screen.getByText(/not rated/i)).toBeInTheDocument()
  expect(screen.queryByText(/undefined|NaN/)).not.toBeInTheDocument()
})
it('[TC-FE-CARD-04] replaces a failed image with an accessible fallback', () => {
  card()
  fireEvent.error(screen.getByRole('img'))
  expect(screen.getByRole('img', { name: /artwork unavailable.*synthetic adventure/i })).toBeInTheDocument()
  expect(screen.queryByRole('img', { name: game.title })).not.toBeInTheDocument()
})
it('[TC-FE-CARD-05] handles an absent cover with a named fallback', () => {
  card({ cover: '' })
  expect(screen.getByRole('img', { name: /artwork unavailable/i })).toBeInTheDocument()
})
it('[TC-FE-WISHLIST-01] never invokes unavailable wishlist persistence on repeated clicks', async () => {
  const toggle = vi.fn()
  card({}, { onToggleWishlist: toggle })
  const button = screen.getByRole('button', { name: /wishlist/i })
  await userEvent.dblClick(button)
  expect(button).toBeDisabled()
  expect(toggle).not.toHaveBeenCalled()
})
it('[TC-FE-WISHLIST-02] displays supplied wishlist membership without claiming it was saved', () => {
  card({}, { isWishlisted: true })
  expect(screen.getByRole('button', { name: 'Wishlisted' })).toBeDisabled()
  expect(screen.queryByText(/saved successfully/i)).not.toBeInTheDocument()
})
it('[TC-FE-CARD-06] follows the game detail link using its actual identifier', async () => {
  render(<MemoryRouter><Routes>
    <Route path="/" element={<GameCard game={game} />} />
    <Route path={`/games/${game.id}`} element={<h1>Synthetic detail destination</h1>} />
  </Routes></MemoryRouter>)
  await userEvent.click(screen.getByRole('link', { name: 'View details' }))
  expect(screen.getByRole('heading', { name: 'Synthetic detail destination' })).toBeInTheDocument()
})

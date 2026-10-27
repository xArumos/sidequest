// Browser test harness only: renders the real card and production CSS with synthetic data.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import GameCard from '../../src/components/GameCard'
import '../../src/index.css'
import '../../src/App.css'

const game = {
  id: 'synthetic-layout-game', genres: ['Puzzle'], platforms: ['PC'], ratingAvg: 4, ratingCount: 8, releaseDate: null,
  title: 'Synthetic unusually long game title ' + 'UnbrokenSyntheticTitle'.repeat(6),
  coverUrl: '/intentionally-missing-synthetic-artwork.svg',
}
createRoot(document.getElementById('root')).render(<MemoryRouter><main className="page-shell"><div className="game-grid">
  <GameCard game={game} />
  <GameCard game={{ ...game, id: 'synthetic-unrated', title: 'Synthetic Unrated Game', ratingAvg: 0, ratingCount: 0, coverUrl: '' }} />
</div></main></MemoryRouter>)

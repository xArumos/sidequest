// Browser test harness only: renders the real card and production CSS with synthetic data.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import GameCard from '../../src/components/GameCard'
import '../../src/index.css'
import '../../src/App.css'

const game = {
  id: 'synthetic-layout-game', genre: 'Puzzle', rating: 4, reviewCount: 8,
  title: 'Synthetic unusually long game title ' + 'UnbrokenSyntheticTitle'.repeat(6),
  description: 'Synthetic description below the title and rating metadata.',
  cover: '/intentionally-missing-synthetic-artwork.svg',
}
createRoot(document.getElementById('root')).render(<MemoryRouter><main className="page-shell"><div className="game-grid">
  <GameCard game={game} />
  <GameCard game={{ ...game, id: 'synthetic-unrated', title: 'Synthetic Unrated Game', rating: undefined, cover: '' }} />
</div></main></MemoryRouter>)

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ratingLabel } from '../utils/games'

// `game` is a GameSummary from the catalog API (see PR #28).
export default function GameCard({ game, isWishlisted = false, onToggleWishlist, busy = false }) {
  const [failedCover, setFailedCover] = useState(null)
  const title = game.title?.trim() || 'Untitled game'
  const genres = Array.isArray(game.genres) ? game.genres.slice(0, 2).join(' · ') : ''
  const year = game.releaseDate ? new Date(game.releaseDate).getUTCFullYear() : null
  return (
    <article className="game-card">
      {game.coverUrl && failedCover !== game.coverUrl
        ? <img src={game.coverUrl} alt={title} className="game-cover" loading="lazy" onError={() => setFailedCover(game.coverUrl)} />
        : <div role="img" aria-label={`Artwork unavailable for ${title}`} className="game-cover cover-fallback">Artwork unavailable</div>}
      <div className="game-card-body">
        <div className="game-card-header">
          <div>
            <p className="eyebrow">{genres}</p>
            <h3>{title}</h3>
          </div>
          {onToggleWishlist && (
            <button
              type="button"
              disabled={busy}
              aria-pressed={isWishlisted}
              className={`mini-button ${isWishlisted ? 'active' : ''}`}
              onClick={() => onToggleWishlist(game.id)}
            >
              {isWishlisted ? 'Wishlisted' : '+ Wishlist'}
            </button>
          )}
        </div>
        <p className="star-row">{ratingLabel(game)}{year ? ` · ${year}` : ''}</p>
        <Link to={`/games/${game.id}`} className="text-link">
          View details
        </Link>
      </div>
    </article>
  )
}

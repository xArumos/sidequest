import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function GameCard({ game, isWishlisted, onToggleWishlist }) {
  const [failedCover, setFailedCover] = useState(null)
  const title = game.title?.trim() || 'Untitled game'
  const hasRating = Number.isFinite(game.rating) && game.rating >= 1 && game.rating <= 5
  const hasReviewCount = Number.isInteger(game.reviewCount) && game.reviewCount >= 0
  return (
    <article className="game-card">
      {game.cover && failedCover !== game.cover
        ? <img src={game.cover} alt={title} className="game-cover" onError={() => setFailedCover(game.cover)} />
        : <div role="img" aria-label={`Artwork unavailable for ${title}`} className="game-cover cover-fallback">Artwork unavailable</div>}
      <div className="game-card-body">
        <div className="game-card-header">
          <div>
            <p className="eyebrow">{game.genre}</p>
            <h3>{title}</h3>
          </div>
          <button
            type="button"
            disabled
            title="Wishlist saving is awaiting the server API"
            className={`mini-button ${isWishlisted ? 'active' : ''}`}
            onClick={() => onToggleWishlist(game.id)}
          >
            {isWishlisted ? 'Wishlisted' : '+ Wishlist'}
          </button>
        </div>
        <p className="star-row">{hasRating ? `★ ${game.rating.toFixed(1)}` : 'Not rated'} · {hasReviewCount ? `${game.reviewCount} reviews` : 'Review count unavailable'}</p>
        <p>{game.description}</p>
        <Link to={`/games/${game.id}`} className="text-link">
          View details
        </Link>
      </div>
    </article>
  )
}

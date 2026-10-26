import { Link } from 'react-router-dom'

export default function GameCard({ game, isWishlisted, onToggleWishlist }) {
  return (
    <article className="game-card">
      <img src={game.cover} alt={game.title} className="game-cover" />
      <div className="game-card-body">
        <div className="game-card-header">
          <div>
            <p className="eyebrow">{game.genre}</p>
            <h3>{game.title}</h3>
          </div>
          <button
            type="button"
            className={`mini-button ${isWishlisted ? 'active' : ''}`}
            onClick={() => onToggleWishlist(game.id)}
          >
            {isWishlisted ? 'Wishlisted' : '+ Wishlist'}
          </button>
        </div>
        <p className="star-row">★ {game.rating.toFixed(1)} · {game.reviewCount} reviews</p>
        <p>{game.description}</p>
        <Link to={`/games/${game.id}`} className="text-link">
          View details
        </Link>
      </div>
    </article>
  )
}

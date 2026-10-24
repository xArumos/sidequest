import { useMemo, useState } from 'react'
import { Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import './App.css'
import Layout from './components/Layout'
import GameCard from './components/GameCard'
import RatingInput from './components/RatingInput'
import { communityHighlights, currentUser, games, reviewEntries, users } from './data/mockData'

function ProtectedRoute({ isAuthenticated, children }) {
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}

function UserProfileRoute() {
  const { userId } = useParams()
  return <UserProfilePage userId={userId} />
}

function LandingPage({ wishlist, onToggleWishlist }) {
  const featured = games.slice(0, 3)

  return (
    <>
      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow hero-eyebrow">A way to discover and share games with friends</p>
          <h1>Rate, review, and track every game you play.</h1>
          <p className="lead">
            SideQuest brings your ratings, reviews, wishlists, and backlog together in one place.
          </p>
          <div className="cta-row auth-actions">
            <Link to="/register" className="primary-button">Join now</Link>
            <Link to="/login" className="secondary-button">Log in</Link>
          </div>
        </div>

        <div className="hero-spotlight">
          <div className="mini-panel">
            <span className="status-dot" />
            Active community
          </div>
          <div className="stat-block">
            <strong>4.9</strong>
            <span>Average rating</span>
          </div>
          <div className="stat-block accent">
            <strong>1.7k</strong>
            <span>Recent reviews</span>
          </div>
        </div>
      </section>

      <section className="feature-grid">
        <div className="feature-card">
          <h3>Rate &amp; Review</h3>
          <p>Share feedback and read the community perspective before you dive into a new title.</p>
        </div>
        <div className="feature-card">
          <h3>Track Your Games</h3>
          <p>Keep a personal record of everything you have played, plus your wishlist and backlog.</p>
        </div>
        <div className="feature-card">
          <h3>Share with Friends</h3>
          <p>Follow friends and browse public wishlists so you always know what to play next.</p>
        </div>
      </section>

      <section className="community-grid">
        {communityHighlights.map((item) => (
          <div className="community-panel card-panel" key={item.label}>
            <p className="eyebrow">{item.label}</p>
            <strong>{item.value}</strong>
            <span>{item.meta}</span>
          </div>
        ))}
      </section>

      <section className="content-section">
        <div className="section-header-inline">
          <h2>Top Rated Games</h2>
          <Link to="/games" className="text-link">See all rankings</Link>
        </div>

        <div className="game-grid compact-grid">
          {featured.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              isWishlisted={wishlist.includes(game.id)}
              onToggleWishlist={onToggleWishlist}
            />
          ))}
        </div>
      </section>
    </>
  )
}

function LoginPage({ isAuthenticated, onLogin }) {
  if (isAuthenticated) {
    return <Navigate to="/profile" replace />
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const username = form.get('username')?.toString().trim() || ''
    const password = form.get('password')?.toString() || ''

    if (username && password) {
      onLogin()
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-card">
        <p className="eyebrow">Welcome back</p>
        <h1>Sign in to continue</h1>
        <p className="subtle-text">Demo mode enabled: this frontend is wired for the expected auth flow until the backend is ready.</p>

        <form className="stack-form" onSubmit={handleSubmit}>
          <label>
            Username or email
            <input type="text" name="username" placeholder="alexm" required />
          </label>
          <label>
            Password
            <input type="password" name="password" placeholder="••••••••" required />
          </label>
          <button type="submit" className="primary-button wide">Log in</button>
        </form>

        <p className="auth-switch">
          Need an account? <Link to="/register">Sign up now</Link>
        </p>
      </div>
    </section>
  )
}

function RegisterPage({ isAuthenticated, onLogin }) {
  if (isAuthenticated) {
    return <Navigate to="/profile" replace />
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const firstName = form.get('firstName')?.toString().trim() || ''
    const lastName = form.get('lastName')?.toString().trim() || ''
    const email = form.get('email')?.toString().trim() || ''
    const username = form.get('username')?.toString().trim() || ''
    const password = form.get('password')?.toString() || ''
    const confirmPassword = form.get('confirmPassword')?.toString() || ''

    if (firstName && lastName && email && username && password && password === confirmPassword) {
      onLogin()
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-card">
        <p className="eyebrow">Create account</p>
        <h1>Welcome to SideQuest</h1>
        <p className="subtle-text">Connect, share, and discover your next obsession.</p>

        <form className="stack-form" onSubmit={handleSubmit}>
          <div className="two-field-row">
            <label>
              First name
              <input type="text" name="firstName" required />
            </label>
            <label>
              Last name
              <input type="text" name="lastName" required />
            </label>
          </div>
          <label>
            Email
            <input type="email" name="email" required />
          </label>
          <label>
            Username
            <input type="text" name="username" required />
          </label>
          <label>
            Password
            <input type="password" name="password" required />
          </label>
          <label>
            Confirm password
            <input type="password" name="confirmPassword" required />
          </label>
          <button type="submit" className="primary-button wide">Register</button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in here</Link>
        </p>
      </div>
    </section>
  )
}

function GameDiscoveryPage({ wishlist, onToggleWishlist }) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('rating')
  const [genre, setGenre] = useState('All')

  const genres = ['All', ...new Set(games.map((game) => game.genre))]

  const filteredGames = useMemo(() => {
    const next = games.filter((game) => {
      const matchesSearch = game.title.toLowerCase().includes(search.toLowerCase())
      const matchesGenre = genre === 'All' || game.genre === genre
      return matchesSearch && matchesGenre
    })

    return next.sort((a, b) => {
      if (sort === 'rating') return b.rating - a.rating
      if (sort === 'reviews') return b.reviewCount - a.reviewCount
      if (sort === 'title') return a.title.localeCompare(b.title)
      return 0
    })
  }, [genre, search, sort])

  return (
    <section className="content-section">
      <div className="section-header-inline">
        <h1>Game Discovery</h1>
        <p className="subtle-text">Search, sort, and discover your next favorite.</p>
      </div>

      <div className="filter-panel">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search games"
          aria-label="Search games"
        />

        <select value={genre} onChange={(event) => setGenre(event.target.value)} aria-label="Filter by genre">
          {genres.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </select>

        <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort games">
          <option value="rating">Highest rated</option>
          <option value="reviews">Most reviewed</option>
          <option value="title">Title</option>
        </select>
      </div>

      <div className="game-grid">
        {filteredGames.length > 0 ? (
          filteredGames.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              isWishlisted={wishlist.includes(game.id)}
              onToggleWishlist={onToggleWishlist}
            />
          ))
        ) : (
          <div className="empty-state card-panel">
            <h3>No games match those filters.</h3>
            <p>Reset your search and try another combination.</p>
          </div>
        )}
      </div>
    </section>
  )
}

function GameDetailsPage({ wishlist, backlog, onToggleWishlist, onToggleBacklog, reviews, onReviewSubmit }) {
  const { gameId } = useParams()
  const [selectedRating, setSelectedRating] = useState(0)
  const game = games.find((entry) => entry.id === gameId)

  if (!game) {
    return <Navigate to="/games" replace />
  }

  const relevantReviews = reviews.filter((review) => review.gameId === gameId)

  const submitReview = (event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const title = form.get('title')?.toString().trim() || ''
    const text = form.get('text')?.toString().trim() || ''

    if (!title || !text || selectedRating === 0) {
      return
    }

    onReviewSubmit(game.id, selectedRating, title, text)
    event.currentTarget.reset()
    setSelectedRating(0)
  }

  return (
    <section className="content-section">
      <div className="game-detail-hero card-panel">
        <img src={game.cover} alt={game.title} className="detail-cover" />
        <div className="detail-copy">
          <p className="eyebrow">{game.genre}</p>
          <h1>{game.title}</h1>
          <p className="detail-meta">{game.developer} · {game.reviewCount} reviews</p>
          <p className="lead small">{game.description}</p>
          <div className="inline-actions">
            <button type="button" className="primary-button" onClick={() => onToggleWishlist(game.id)}>
              {wishlist.includes(game.id) ? 'Remove from wishlist' : 'Add to wishlist'}
            </button>
            <button type="button" className="secondary-button" onClick={() => onToggleBacklog(game.id)}>
              {backlog.includes(game.id) ? 'Remove from backlog' : 'Add to backlog'}
            </button>
          </div>
        </div>
      </div>

      <div className="two-column-layout">
        <div className="card-panel">
          <h2>Community rating</h2>
          <div className="rating-summary">
            <strong>{game.rating.toFixed(1)}</strong>
            <span>Based on {game.reviewCount} community ratings</span>
          </div>
          <div className="tag-list">
            {game.tags.map((tag) => (
              <span key={tag} className="tag">{tag}</span>
            ))}
          </div>
        </div>

        <div className="card-panel">
          <h2>Your rating</h2>
          <RatingInput value={selectedRating} onChange={setSelectedRating} />
          <p className="subtle-text">Rate this title before submitting your review.</p>
        </div>
      </div>

      <div className="card-panel review-panel">
        <h2>Write a review</h2>
        <form className="stack-form" onSubmit={submitReview}>
          <label>
            Review title
            <input type="text" name="title" placeholder="What stood out?" required />
          </label>
          <label>
            Your review
            <textarea name="text" rows="5" placeholder="Tell the community what you loved or disliked." required />
          </label>
          <button type="submit" className="primary-button">Submit review</button>
        </form>
      </div>

      <div className="card-panel">
        <h2>Recent reviews</h2>
        <div className="review-list">
          {relevantReviews.length > 0 ? (
            relevantReviews.map((review) => (
              <article key={review.id} className="review-item">
                <div className="review-header">
                  <div>
                    <strong>{review.userName}</strong>
                    <p>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</p>
                  </div>
                  <span className="review-title">{review.title}</span>
                </div>
                <p>{review.text}</p>
              </article>
            ))
          ) : (
            <p className="subtle-text">No reviews yet — be the first to share your thoughts.</p>
          )}
        </div>
      </div>
    </section>
  )
}

function RankingsPage() {
  const rankedGames = [...games].sort((a, b) => b.rating - a.rating)

  return (
    <section className="content-section">
      <div className="section-header-inline">
        <h1>Rankings</h1>
        <p className="subtle-text">Top-rated games across the community.</p>
      </div>

      <div className="rankings-list">
        {rankedGames.map((game, index) => (
          <div className="ranking-row card-panel" key={game.id}>
            <div className="rank-number">#{index + 1}</div>
            <img src={game.cover} alt={game.title} className="ranking-cover" />
            <div className="ranking-copy">
              <h3>{game.title}</h3>
              <p>{game.genre} · {game.developer}</p>
            </div>
            <div className="ranking-score">
              <strong>{game.rating.toFixed(1)}</strong>
              <span>{game.reviewCount} ratings</span>
            </div>
            <Link to={`/games/${game.id}`} className="text-link">Open</Link>
          </div>
        ))}
      </div>
    </section>
  )
}

function ProfilePage({ user, wishlist, backlog, reviews }) {
  const wishlistGames = games.filter((game) => wishlist.includes(game.id))
  const backlogGames = games.filter((game) => backlog.includes(game.id))
  const recentReviews = reviews.filter((review) => review.userId === user.id).slice(0, 3)

  return (
    <section className="content-section">
      <div className="profile-header card-panel">
        <div>
          <p className="eyebrow">Profile</p>
          <h1>{user.name}</h1>
          <p className="profile-handle">@{user.username}</p>
        </div>
        <Link to="/profile/edit" className="secondary-button">Edit profile</Link>
      </div>

      <div className="profile-meta card-panel">
        <p>{user.bio}</p>
        <div className="tag-list">
          {user.favoriteGenres.map((genre) => (
            <span className="tag" key={genre}>{genre}</span>
          ))}
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-box card-panel">
          <strong>{wishlistGames.length}</strong>
          <span>Wishlist</span>
        </div>
        <div className="stat-box card-panel">
          <strong>{backlogGames.length}</strong>
          <span>Backlog</span>
        </div>
        <div className="stat-box card-panel">
          <strong>{recentReviews.length}</strong>
          <span>Reviews</span>
        </div>
      </div>

      <div className="list-grid">
        <div className="card-panel">
          <div className="section-header-inline small-header">
            <h2>Wishlist</h2>
            <Link to="/wishlist" className="text-link">See all</Link>
          </div>
          {wishlistGames.length > 0 ? (
            <ul className="mini-list">
              {wishlistGames.map((game) => (
                <li key={game.id}><Link to={`/games/${game.id}`}>{game.title}</Link></li>
              ))}
            </ul>
          ) : (
            <p className="subtle-text">No games saved yet.</p>
          )}
        </div>

        <div className="card-panel">
          <div className="section-header-inline small-header">
            <h2>Backlog</h2>
            <Link to="/backlog" className="text-link">See all</Link>
          </div>
          {backlogGames.length > 0 ? (
            <ul className="mini-list">
              {backlogGames.map((game) => (
                <li key={game.id}><Link to={`/games/${game.id}`}>{game.title}</Link></li>
              ))}
            </ul>
          ) : (
            <p className="subtle-text">No games in the backlog.</p>
          )}
        </div>
      </div>

      <div className="card-panel">
        <div className="section-header-inline small-header">
          <h2>Recent reviews</h2>
        </div>
        {recentReviews.length > 0 ? (
          recentReviews.map((review) => (
            <article key={review.id} className="review-item compact-review">
              <strong>{review.title}</strong>
              <p>{review.text}</p>
            </article>
          ))
        ) : (
          <p className="subtle-text">No published reviews yet.</p>
        )}
      </div>
    </section>
  )
}

function EditProfilePage({ user, onSave }) {
  const navigate = useNavigate()
  const [draft, setDraft] = useState(user)

  const handleSubmit = (event) => {
    event.preventDefault()
    onSave(draft)
    navigate('/profile')
  }

  return (
    <section className="content-section">
      <div className="card-panel form-panel">
        <h1>Edit profile</h1>
        <form className="stack-form" onSubmit={handleSubmit}>
          <label>
            Display name
            <input
              type="text"
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </label>
          <label>
            Username
            <input
              type="text"
              value={draft.username}
              onChange={(event) => setDraft({ ...draft, username: event.target.value })}
            />
          </label>
          <label>
            Bio
            <textarea
              rows="4"
              value={draft.bio}
              onChange={(event) => setDraft({ ...draft, bio: event.target.value })}
            />
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={draft.wishlistPublic}
              onChange={(event) => setDraft({ ...draft, wishlistPublic: event.target.checked })}
            />
            Make my wishlist public
          </label>
          <div className="inline-actions">
            <button type="submit" className="primary-button">Save changes</button>
            <Link to="/profile" className="secondary-button">Cancel</Link>
          </div>
        </form>
      </div>
    </section>
  )
}

function WishlistPage({ wishlist, onToggleWishlist }) {
  const items = games.filter((game) => wishlist.includes(game.id))

  return (
    <section className="content-section">
      <div className="section-header-inline">
        <h1>My Wishlist</h1>
        <p className="subtle-text">Saved for later.</p>
      </div>

      {items.length > 0 ? (
        <div className="game-grid">
          {items.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              isWishlisted={true}
              onToggleWishlist={onToggleWishlist}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state card-panel">
          <h3>Your wishlist is empty.</h3>
          <p>Browse the catalog and save a few games you want to revisit.</p>
        </div>
      )}
    </section>
  )
}

function BacklogPage({ backlog, onToggleBacklog }) {
  const items = games.filter((game) => backlog.includes(game.id))

  return (
    <section className="content-section">
      <div className="section-header-inline">
        <h1>My Backlog</h1>
        <p className="subtle-text">Games planned for future play.</p>
      </div>

      {items.length > 0 ? (
        <div className="game-grid">
          {items.map((game) => (
            <article key={game.id} className="game-card backlog-card">
              <img src={game.cover} alt={game.title} className="game-cover" />
              <div className="game-card-body">
                <h3>{game.title}</h3>
                <p>{game.genre}</p>
                <button type="button" className="secondary-button" onClick={() => onToggleBacklog(game.id)}>
                  Remove from backlog
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state card-panel">
          <h3>Your backlog is empty.</h3>
          <p>Add games you plan to revisit later and keep track of your next sessions.</p>
        </div>
      )}
    </section>
  )
}

function UserProfilePage({ userId }) {
  const targetUser = users[userId] ?? currentUser
  const publicWishlistGames = games.filter((game) => targetUser.publicWishlist?.includes(game.id))
  const publicBacklogGames = games.filter((game) => targetUser.backlog?.includes(game.id))

  return (
    <section className="content-section">
      <div className="profile-header card-panel">
        <div>
          <p className="eyebrow">Public profile</p>
          <h1>{targetUser.name}</h1>
          <p className="profile-handle">@{targetUser.username}</p>
        </div>
      </div>

      <div className="profile-meta card-panel">
        <p>{targetUser.bio}</p>
        <div className="tag-list">
          {targetUser.favoriteGenres.map((genre) => (
            <span className="tag" key={genre}>{genre}</span>
          ))}
        </div>
      </div>

      <div className="list-grid">
        <div className="card-panel">
          <h2>Wishlist</h2>
          {targetUser.wishlistPublic && publicWishlistGames.length > 0 ? (
            <ul className="mini-list">
              {publicWishlistGames.map((game) => (
                <li key={game.id}><Link to={`/games/${game.id}`}>{game.title}</Link></li>
              ))}
            </ul>
          ) : (
            <p className="subtle-text">This wishlist is private.</p>
          )}
        </div>

        <div className="card-panel">
          <h2>Backlog</h2>
          {publicBacklogGames.length > 0 ? (
            <ul className="mini-list">
              {publicBacklogGames.map((game) => (
                <li key={game.id}><Link to={`/games/${game.id}`}>{game.title}</Link></li>
              ))}
            </ul>
          ) : (
            <p className="subtle-text">No public backlog items.</p>
          )}
        </div>
      </div>
    </section>
  )
}

function NotFoundPage() {
  return (
    <section className="content-section">
      <div className="empty-state card-panel">
        <h1>Page not found</h1>
        <p>The page you were looking for does not exist or has moved.</p>
        <Link to="/" className="primary-button">Back to home</Link>
      </div>
    </section>
  )
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userProfile, setUserProfile] = useState(currentUser)
  const [wishlist, setWishlist] = useState(['g2', 'g4'])
  const [backlog, setBacklog] = useState(['g1', 'g6'])
  const [reviews, setReviews] = useState(reviewEntries)

  const handleToggleWishlist = (gameId) => {
    setWishlist((current) =>
      current.includes(gameId) ? current.filter((id) => id !== gameId) : [...current, gameId],
    )
  }

  const handleToggleBacklog = (gameId) => {
    setBacklog((current) =>
      current.includes(gameId) ? current.filter((id) => id !== gameId) : [...current, gameId],
    )
  }

  const handleReviewSubmit = (gameId, rating, title, text) => {
    const newReview = {
      id: `review-${Date.now()}`,
      gameId,
      userId: userProfile.id,
      userName: userProfile.name,
      rating,
      title,
      text,
    }

    setReviews((current) => [newReview, ...current])
  }

  return (
    <Layout isAuthenticated={isAuthenticated} onLogout={() => setIsAuthenticated(false)}>
      <Routes>
        <Route path="/" element={<LandingPage wishlist={wishlist} onToggleWishlist={handleToggleWishlist} />} />
        <Route path="/login" element={<LoginPage isAuthenticated={isAuthenticated} onLogin={() => setIsAuthenticated(true)} />} />
        <Route path="/register" element={<RegisterPage isAuthenticated={isAuthenticated} onLogin={() => setIsAuthenticated(true)} />} />
        <Route path="/games" element={<GameDiscoveryPage wishlist={wishlist} onToggleWishlist={handleToggleWishlist} />} />
        <Route
          path="/games/:gameId"
          element={
            <GameDetailsPage
              wishlist={wishlist}
              backlog={backlog}
              onToggleWishlist={handleToggleWishlist}
              onToggleBacklog={handleToggleBacklog}
              reviews={reviews}
              onReviewSubmit={handleReviewSubmit}
            />
          }
        />
        <Route path="/rankings" element={<RankingsPage />} />
        <Route path="/users/:userId" element={<UserProfileRoute />} />
        <Route
          path="/profile"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <ProfilePage user={userProfile} wishlist={wishlist} backlog={backlog} reviews={reviews} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile/edit"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <EditProfilePage user={userProfile} onSave={setUserProfile} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/wishlist"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <WishlistPage wishlist={wishlist} onToggleWishlist={handleToggleWishlist} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/backlog"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <BacklogPage backlog={backlog} onToggleBacklog={handleToggleBacklog} />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Layout>
  )
}

export default App

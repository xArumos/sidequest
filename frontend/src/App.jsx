import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, Route, Routes, useParams } from 'react-router-dom'
import './App.css'
import Layout from './components/Layout'
import GameCard from './components/GameCard'
import ReviewForm from './components/ReviewForm'
import GoogleSignIn from './components/GoogleSignIn'
import { auth } from './services/auth'
import { filterAndSortGames } from './utils/games'

// No catalog HTTP contract exists yet. Never substitute fixture rankings.
const games = []
const communityHighlights = [
  { label: 'Top Rated', value: 'Coming soon', meta: 'Waiting for community rating data' },
  { label: 'Most Reviewed', value: 'Coming soon', meta: 'Waiting for review counts' },
  { label: 'Community Mood', value: 'Unavailable', meta: 'No published community statistics yet' },
]
function Unavailable({ title, children }) {
  return <section className="content-section card-panel"><h1>{title}</h1><p role="status">{children}</p><Link className="text-link" to="/games">Browse games</Link></section>
}

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
          <Link to="/games" className="primary-button">Discover games</Link>
        </div>

        <div className="hero-spotlight">
          <div className="mini-panel">
            <span className="status-dot" />
            Your next adventure
          </div>
          <div className="stat-block">
            <strong>Discover</strong>
            <span>Find your next favorite</span>
          </div>
          <div className="stat-block accent">
            <strong>Keep track</strong>
            <span>Your gaming journey, together</span>
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
          <Link to="/rankings" className="text-link">See all rankings</Link>
        </div>

        <div className="game-grid compact-grid">
          {!featured.length && <p role="status">Game rankings are unavailable until the catalog and community APIs are published.</p>}
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

function LoginPage({ isAuthenticated, onLogin, onPasswordLogin, onRegister, busy, registering = false }) {
  const [error, setError] = useState('')
  const googleConfigured = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID || import.meta.env.SIDEQUEST_GOOGLE_CLIENT_ID)
  if (isAuthenticated) return <Navigate to="/profile" replace />
  async function signIn(credential) {
    setError('')
    try { await onLogin(credential) } catch (error) { setError(error.message) }
  }
  async function submit(event) {
    event.preventDefault()
    setError('')
    const data = Object.fromEntries(new FormData(event.currentTarget))
    if (registering) {
      if (!/^[A-Za-z0-9_]{3,30}$/.test(data.username.trim())) {
        setError('Use a username of 3–30 letters, numbers, or underscores.'); return
      }
      if (data.email.trim().length > 254 || !/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(data.email.trim())) {
        setError('Enter a valid email address.'); return
      }
      if ([...data.password].length < 15 || [...data.password].length > 128) {
        setError('Use a password of 15–128 characters.'); return
      }
      if (data.password !== data.confirmPassword) {
        setError('Passwords do not match.'); return
      }
    } else if (!data.identifier.trim() || !data.password) {
      setError('Enter your username or email and password.'); return
    }
    try {
      if (registering) await onRegister({ username: data.username.trim(), email: data.email.trim(), password: data.password })
      else await onPasswordLogin({ identifier: data.identifier.trim(), password: data.password })
    } catch (error) { setError(error.message) }
  }
  return <section className="auth-page"><div className="auth-card">
    <p className="eyebrow">{registering ? 'Create account' : 'Welcome back'}</p>
    <h1>{registering ? 'Welcome to SideQuest' : 'Sign in to continue'}</h1>
    <p className="subtle-text">{registering ? (googleConfigured ? 'Create your account with a username, email, and password, or continue with Google.' : 'Create your SideQuest account.') : (googleConfigured ? 'Use your username or email and password, or continue with Google.' : 'Sign in with your SideQuest username or email and password.')}</p>
    <GoogleSignIn onCredential={signIn} busy={busy} />
    {googleConfigured && <p className="auth-divider">Or use your SideQuest account</p>}
    <form key={registering ? 'register' : 'login'} className="stack-form" onSubmit={submit} noValidate>
      <fieldset disabled={busy}>
        {registering ? <>
          <label>Username<input name="username" autoComplete="username" required maxLength={30} /></label>
          <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
        </> : <label>Username or email<input name="identifier" autoComplete="username" required maxLength={254} /></label>}
        <label>Password<input name="password" type="password" autoComplete={registering ? 'new-password' : 'current-password'} required aria-describedby={registering ? 'password-help' : undefined} /></label>
        {registering && <>
          <p id="password-help" className="subtle-text">Use 15–128 characters. Spaces and Unicode are supported.</p>
          <label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" required /></label>
        </>}
        <button className="primary-button" type="submit">{busy ? 'Please wait…' : registering ? 'Create account' : 'Log in'}</button>
      </fieldset>
    </form>
    {googleConfigured && <p className="subtle-text">Your first successful Google sign-in creates a separate SideQuest account.</p>}
    {error && <p role="alert">{error}</p>}
    <p className="auth-switch">{registering ? <>Already have an account? <Link to="/login">Log in here</Link></> : <>Need an account? <Link to="/register">Sign up now</Link></>}</p>
  </div></section>
}

function GameDiscoveryPage({ wishlist, onToggleWishlist }) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('title')
  const [genre, setGenre] = useState('All')

  const genres = ['All', ...new Set(games.map((game) => game.genre))]

  const filteredGames = useMemo(() => filterAndSortGames(games, { search, genre, sort }), [genre, search, sort])

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

      <p role="status">The game catalog API is not available yet. Search and filters will apply to published catalog data.</p>
      <button type="button" className="secondary-button" onClick={() => { setSearch(''); setGenre('All'); setSort('title') }}>Reset filters</button>
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
            <h3>{games.length ? 'No games match those filters.' : 'Catalog unavailable'}</h3>
            <p>Search and filtering will be available when catalog data can be loaded.</p>
          </div>
        )}
      </div>
    </section>
  )
}

function GameDetailsPage({ wishlist, backlog, onToggleWishlist, onToggleBacklog, reviews }) {
  const { gameId } = useParams()
  const game = games.find((entry) => entry.id === gameId)

  if (!game) {
    return <Unavailable title="Game unavailable">Game details and reviews cannot be loaded until the catalog API is published.</Unavailable>
  }

  const relevantReviews = reviews.filter((review) => review.gameId === gameId)

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
            <button type="button" className="primary-button" disabled onClick={() => onToggleWishlist(game.id)}>
              {wishlist.includes(game.id) ? 'Remove from wishlist' : 'Add to wishlist'}
            </button>
            <button type="button" className="secondary-button" disabled onClick={() => onToggleBacklog(game.id)}>
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

      </div>
      <div className="card-panel review-panel">
        <h2>Rate and review</h2>
        <ReviewForm />
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
  const [sort, setSort] = useState('rating')
  const rankedGames = filterAndSortGames(games, { sort })

  return (
    <section className="content-section">
      <div className="section-header-inline">
        <h1>Rankings</h1>
        <p className="subtle-text">Top-rated games across the community.</p>
      </div>

      <label>Rank games by <select aria-label="Rank games by" value={sort} onChange={event => setSort(event.target.value)}><option value="rating">Top rated</option><option value="reviews">Most reviewed</option></select></label>
      <p role="status">Rankings are unavailable until the API provides real community ratings and review counts.</p>
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

function ProfilePage({ user }) {
  return <section className="content-section">
    <div className="profile-header card-panel"><div><p className="eyebrow">Profile</p>
      <h1>{user.displayName}</h1><p>{user.email}</p></div>
      <Link to="/profile/edit" className="secondary-button">Edit profile</Link>
    </div>
    <div className="list-grid">
      <Unavailable title="Played games and rating history">Your history is unavailable until the profile and review APIs are published.</Unavailable>
      <Unavailable title="Your library"><Link to="/wishlist">Wishlist</Link> and <Link to="/backlog">Backlog</Link> are awaiting persistence APIs.</Unavailable>
    </div>
  </section>
}

function EditProfilePage() {
  return <section className="content-section card-panel form-panel"><h1>Edit profile</h1>
    <p role="status">Profile editing and wishlist privacy updates are unavailable until the server supports saving and enforcing them.</p>
    <form className="stack-form" onSubmit={event => event.preventDefault()}><fieldset disabled>
      <label>Bio<textarea maxLength={300} rows={4} /></label>
      <label>Wishlist visibility<select defaultValue="private"><option value="private">Private</option><option value="public">Public</option></select></label>
      <button className="primary-button" type="submit">Save changes</button>
    </fieldset></form><Link to="/profile">Back to profile</Link>
  </section>
}

function WishlistPage({ wishlist, onToggleWishlist }) {
  const items = games.filter((game) => wishlist.includes(game.id))

  return (
    <section className="content-section">
      <div className="section-header-inline">
        <h1>My Wishlist</h1>
        <p className="subtle-text">Saved for later.</p>
      </div>

      <p role="status">This list is unavailable until the server provides persistence. No saved items have been loaded.</p>
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
          <h3>Wishlist unavailable</h3>
          <p>Adding and removing wishlist games is currently unavailable.</p>
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

      <p role="status">This list is unavailable until the server provides persistence. No saved items have been loaded.</p>
      {items.length > 0 ? (
        <div className="game-grid">
          {items.map((game) => (
            <article key={game.id} className="game-card backlog-card">
              <img src={game.cover} alt={game.title} className="game-cover" />
              <div className="game-card-body">
                <h3>{game.title}</h3>
                <p>{game.genre}</p>
                <button type="button" className="secondary-button" disabled onClick={() => onToggleBacklog(game.id)}>
                  Remove from backlog
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state card-panel">
          <h3>Backlog unavailable</h3>
          <p>Adding, removing, and updating backlog games is currently unavailable.</p>
        </div>
      )}
    </section>
  )
}

function UserProfilePage() {
  return <Unavailable title="Public profile unavailable">Public profiles and shared wishlists cannot be loaded. Server authorization and privacy enforcement are required before any list can be displayed.</Unavailable>
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
  const [userProfile, setUserProfile] = useState(null)
  const [checking, setChecking] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const loginInFlight = useRef(false)
  const isAuthenticated = Boolean(userProfile)
  const wishlist = []
  const backlog = []
  const reviews = []
  useEffect(() => {
    const controller = new AbortController()
    auth.me(controller.signal).then(user => {
      if (!controller.signal.aborted) setUserProfile(user)
    }).catch(error => {
      if (!controller.signal.aborted) {
        if (error.status === 401 || ['AUTH_NOT_CONFIGURED', 'GOOGLE_NOT_CONFIGURED'].includes(error.code)) setUserProfile(null)
        else setError(error.message)
      }
    }).finally(() => { if (!controller.signal.aborted) setChecking(false) })
    return () => controller.abort()
  }, [attempt])
  async function authenticate(request) {
    if (loginInFlight.current) return
    loginInFlight.current = true
    setBusy(true)
    try { setUserProfile(await request()); setError('') }
    finally { loginInFlight.current = false; setBusy(false) }
  }
  const login = credential => authenticate(() => auth.login(credential))
  const passwordLogin = credentials => authenticate(() => auth.passwordLogin(credentials))
  const register = account => authenticate(() => auth.register(account))
  async function logout() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await auth.logout()
      setUserProfile(null)
      window.google?.accounts?.id?.disableAutoSelect()
    } catch (error) { setError(error.message) }
    finally { setBusy(false) }
  }
  const unavailable = () => setError('Saving is unavailable until the server publishes this feature.')
  const handleToggleWishlist = unavailable
  const handleToggleBacklog = unavailable

  return (
    <Layout isAuthenticated={isAuthenticated} onLogout={logout} busy={busy}>
      {error && <div className="card-panel" role="alert">{error} <button type="button" className="secondary-button" onClick={() => { setError(''); setChecking(true); setAttempt(value => value + 1) }}>Retry connection</button></div>}
      {checking ? <p role="status">Checking your session…</p> : <>
      <Routes>
        <Route path="/" element={<LandingPage wishlist={wishlist} onToggleWishlist={handleToggleWishlist} />} />
        <Route path="/login" element={<LoginPage key="login" isAuthenticated={isAuthenticated} onLogin={login} onPasswordLogin={passwordLogin} onRegister={register} busy={busy} />} />
        <Route path="/register" element={<LoginPage key="register" registering isAuthenticated={isAuthenticated} onLogin={login} onPasswordLogin={passwordLogin} onRegister={register} busy={busy} />} />
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
            />
          }
        />
        <Route path="/rankings" element={<RankingsPage />} />
        <Route path="/users/:userId" element={<UserProfileRoute />} />
        <Route
          path="/profile"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <ProfilePage user={userProfile} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile/edit"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <EditProfilePage />
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
      </>}
    </Layout>
  )
}

export default App

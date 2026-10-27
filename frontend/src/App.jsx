import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import './App.css'
import Layout from './components/Layout'
import GameCard from './components/GameCard'
import ReviewForm from './components/ReviewForm'
import GoogleSignIn from './components/GoogleSignIn'
import { auth } from './services/auth'
import { api } from './services/api'
import { useApi } from './services/useApi'
import { ratingLabel } from './utils/games'

const SORTS = [
  ['title', 'Title (A–Z)'],
  ['top', 'Highest rated'],
  ['lowest', 'Lowest rated'],
  ['popular', 'Most rated'],
  ['newest', 'Newest'],
]
const STATUS_LABELS = { wishlist: 'Wishlist', backlog: 'Backlog', playing: 'Playing', played: 'Played' }
const PAGE_SIZE = 24

function stars(rating) {
  return Number.isInteger(rating) ? `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}` : ''
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : ''
}

function LoadState({ loading, error, onRetry, children }) {
  if (error) {
    return <div className="empty-state card-panel" role="alert">
      <h3>Couldn&apos;t load this</h3><p>{error.message}</p>
      {onRetry && <button type="button" className="secondary-button" onClick={onRetry}>Try again</button>}
    </div>
  }
  if (loading) return <p role="status">Loading…</p>
  return children
}

function Pager({ page, pages, onPage }) {
  if (!pages || pages <= 1) return null
  return <div className="inline-actions pager">
    <button type="button" className="secondary-button" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
    <span className="subtle-text">Page {page} of {pages}</span>
    <button type="button" className="secondary-button" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
  </div>
}

function ProtectedRoute({ isAuthenticated, children }) {
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}

// The signed-in user's wishlist/backlog/playing/played status per game. One
// record holds one status, so adding to the wishlist moves a game off the backlog.
function useLibrary(isAuthenticated) {
  const [statuses, setStatuses] = useState({})
  const [pending, setPending] = useState({})
  const [version, setVersion] = useState(0)
  useEffect(() => {
    setStatuses({})
    if (!isAuthenticated) return undefined
    const controller = new AbortController()
    async function loadAll() {
      const next = {}
      for (let page = 1, pages = 1; page <= pages; page += 1) {
        const result = await api.myLogs({ page, limit: 50 }, controller.signal)
        for (const log of result.logs) if (log.status) next[log.game.id] = log.status
        pages = result.pages
      }
      if (!controller.signal.aborted) setStatuses(next)
    }
    loadAll().catch(() => {})
    return () => controller.abort()
  }, [isAuthenticated])
  const setStatus = useCallback(async (gameId, status) => {
    setPending(previous => ({ ...previous, [gameId]: true }))
    try {
      const { log } = await api.saveLog(gameId, { status })
      setStatuses(previous => {
        const next = { ...previous }
        if (log?.status) next[gameId] = log.status
        else delete next[gameId]
        return next
      })
      setVersion(value => value + 1)
    } finally {
      setPending(previous => { const next = { ...previous }; delete next[gameId]; return next })
    }
  }, [])
  const forget = useCallback(gameId => {
    setStatuses(previous => { const next = { ...previous }; delete next[gameId]; return next })
    setVersion(value => value + 1)
  }, [])
  return { statuses, pending, version, setStatus, forget }
}

function LandingPage({ wishlistProps }) {
  const top = useApi(signal => api.topGames(3, signal), [])
  const popular = useApi(signal => api.games({ sort: 'popular', limit: 3 }, signal), [])
  const topGame = top.data?.games[0]
  const mostRated = popular.data?.games[0]
  const highlights = [
    { label: 'Top Rated', value: topGame?.title ?? 'Not enough ratings yet',
      meta: topGame ? ratingLabel(topGame) : `Games need ${top.data?.minCount ?? 3}+ ratings to rank` },
    { label: 'Most Rated', value: mostRated?.ratingCount ? mostRated.title : 'No ratings yet',
      meta: mostRated?.ratingCount ? ratingLabel(mostRated) : 'Be the first to rate a game' },
    { label: 'In the Catalog', value: popular.data ? `${popular.data.total} games` : '—', meta: 'Imported from IGDB' },
  ]
  const featured = top.data?.games.length ? top.data.games : popular.data?.games ?? []

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
          <p>Make your wishlist public so friends always know what to gift or play next.</p>
        </div>
      </section>

      <section className="community-grid">
        {highlights.map((item) => (
          <div className="community-panel card-panel" key={item.label}>
            <p className="eyebrow">{item.label}</p>
            <strong>{item.value}</strong>
            <span>{item.meta}</span>
          </div>
        ))}
      </section>

      <section className="content-section">
        <div className="section-header-inline">
          <h2>{top.data?.games.length ? 'Top Rated Games' : 'Popular Games'}</h2>
          <Link to="/rankings" className="text-link">See all rankings</Link>
        </div>

        <LoadState loading={top.loading || popular.loading} error={top.error || popular.error} onRetry={() => { top.reload(); popular.reload() }}>
          <div className="game-grid compact-grid">
            {featured.map((game) => <GameCard key={game.id} game={game} {...wishlistProps(game.id)} />)}
          </div>
        </LoadState>
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
    <p className="auth-divider">Or use your SideQuest account</p>
    <form key={registering ? 'register' : 'login'} className="stack-form" onSubmit={submit} noValidate>
      <fieldset disabled={busy}>
        {registering ? <>
          <label>Username<input name="username" autoComplete="username" required maxLength={30} /></label>
          <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
        </> : <label>Username or email<input name="identifier" autoComplete="username" required maxLength={254} /></label>}
        <label>Password<input name="password" type="password" autoComplete={registering ? 'new-password' : 'current-password'} required aria-describedby={registering ? 'password-help' : undefined} /></label>
        {registering && <>
          <label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" required /></label>
          <p id="password-help" className="subtle-text">Password must contain at least 15 characters.</p>
        </>}
        <button className="primary-button" type="submit">{busy ? 'Please wait…' : registering ? 'Create account' : 'Log in'}</button>
      </fieldset>
    </form>
    {googleConfigured && <p className="subtle-text">Your first successful Google sign-in creates a separate SideQuest account.</p>}
    {error && <p role="alert">{error}</p>}
    <p className="auth-switch">{registering ? <>Already have an account? <Link to="/login">Log in here</Link></> : <>Need an account? <Link to="/register">Sign up now</Link></>}</p>
  </div></section>
}

function GameDiscoveryPage({ wishlistProps }) {
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('title')
  const [genre, setGenre] = useState('')
  const [platform, setPlatform] = useState('')
  const [page, setPage] = useState(1)
  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search.trim()); setPage(1) }, 300)
    return () => clearTimeout(timer)
  }, [search])
  const filters = useApi(signal => api.gameFilters(signal), [])
  const results = useApi(signal => api.games({ q: query, genre, platform, sort, page, limit: PAGE_SIZE }, signal),
    [query, genre, platform, sort, page])
  const change = setter => event => { setter(event.target.value); setPage(1) }
  function reset() {
    setSearch(''); setQuery(''); setGenre(''); setPlatform(''); setSort('title'); setPage(1)
  }

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
          maxLength={100}
        />

        <select value={genre} onChange={change(setGenre)} aria-label="Filter by genre">
          <option value="">All genres</option>
          {filters.data?.genres.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
        </select>

        <select value={platform} onChange={change(setPlatform)} aria-label="Filter by platform">
          <option value="">All platforms</option>
          {filters.data?.platforms.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
        </select>

        <select value={sort} onChange={change(setSort)} aria-label="Sort games">
          {SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      <div className="inline-actions">
        <button type="button" className="secondary-button" onClick={reset}>Reset filters</button>
        {results.data && <p role="status" className="subtle-text">{results.data.total} {results.data.total === 1 ? 'game' : 'games'} found</p>}
      </div>
      <LoadState loading={results.loading && !results.data} error={results.error} onRetry={results.reload}>
        <div className="game-grid">
          {results.data?.games.length ? (
            results.data.games.map((game) => <GameCard key={game.id} game={game} {...wishlistProps(game.id)} />)
          ) : (
            <div className="empty-state card-panel">
              <h3>No games match those filters.</h3>
              <p>Try a different search, or reset the filters.</p>
            </div>
          )}
        </div>
        <Pager page={page} pages={results.data?.pages} onPage={setPage} />
      </LoadState>
    </section>
  )
}

function GameDetailsPage({ isAuthenticated, library, onError }) {
  const { gameId } = useParams()
  const [reviewPage, setReviewPage] = useState(1)
  const game = useApi(signal => api.game(gameId, signal), [gameId])
  const reviews = useApi(signal => api.reviews(gameId, { page: reviewPage, limit: 10 }, signal), [gameId, reviewPage])
  const mine = useApi(signal => (isAuthenticated ? api.myLog(gameId, signal) : Promise.resolve({ log: null })),
    [gameId, isAuthenticated, library.version])

  if (game.error?.status === 404 || game.error?.status === 400) {
    return <section className="content-section empty-state card-panel"><h1>Game not found</h1>
      <p>That game isn&apos;t in the catalog.</p><Link className="text-link" to="/games">Browse games</Link></section>
  }
  if (!game.data) return <section className="content-section"><LoadState loading={game.loading} error={game.error} onRetry={game.reload} /></section>

  const details = game.data.game
  const status = library.statuses[gameId]
  const myLog = mine.data?.log
  const busy = Boolean(library.pending[gameId])
  async function setStatus(next) {
    try { await library.setStatus(gameId, status === next ? null : next) } catch (error) { onError(error.message) }
  }
  async function saveReview(review) {
    await api.saveLog(gameId, review)
    game.reload(); reviews.reload(); mine.reload()
  }
  async function deleteReview() {
    try {
      await api.deleteLog(myLog.id)
      library.forget(gameId)
      game.reload(); reviews.reload(); mine.reload()
    } catch (error) { onError(error.message) }
  }

  return (
    <section className="content-section">
      <div className="game-detail-hero card-panel">
        {details.coverUrl
          ? <img src={details.coverUrl} alt={details.title} className="detail-cover" />
          : <div role="img" aria-label={`Artwork unavailable for ${details.title}`} className="detail-cover cover-fallback">Artwork unavailable</div>}
        <div className="detail-copy">
          <p className="eyebrow">{details.genres.join(' · ')}</p>
          <h1>{details.title}</h1>
          <p className="detail-meta">
            {[details.releaseDate && formatDate(details.releaseDate), `${details.reviewCount} written ${details.reviewCount === 1 ? 'review' : 'reviews'}`].filter(Boolean).join(' · ')}
          </p>
          <p className="lead small">{details.summary}</p>
          {isAuthenticated ? (
            <div className="inline-actions">
              <button type="button" className="primary-button" disabled={busy} aria-pressed={status === 'wishlist'} onClick={() => setStatus('wishlist')}>
                {status === 'wishlist' ? 'Remove from wishlist' : 'Add to wishlist'}
              </button>
              <button type="button" className="secondary-button" disabled={busy} aria-pressed={status === 'backlog'} onClick={() => setStatus('backlog')}>
                {status === 'backlog' ? 'Remove from backlog' : 'Add to backlog'}
              </button>
              <label className="subtle-text">Status{' '}
                <select aria-label="Play status" value={status ?? ''} disabled={busy}
                  onChange={event => library.setStatus(gameId, event.target.value || null).catch(error => onError(error.message))}>
                  <option value="">None</option>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            </div>
          ) : <p className="subtle-text"><Link to="/login">Log in</Link> to rate this game or add it to your lists.</p>}
        </div>
      </div>

      <div className="two-column-layout">
        <div className="card-panel">
          <h2>Community rating</h2>
          <div className="rating-summary">
            <strong>{details.ratingCount ? details.ratingAvg.toFixed(1) : '—'}</strong>
            <span>{details.ratingCount ? `Based on ${details.ratingCount} community ${details.ratingCount === 1 ? 'rating' : 'ratings'}` : 'No ratings yet'}</span>
          </div>
          <div className="tag-list">
            {details.platforms.map((tag) => <span key={tag} className="tag">{tag}</span>)}
          </div>
        </div>
      </div>

      {isAuthenticated && (
        <div className="card-panel review-panel">
          <h2>{myLog?.rating || myLog?.text ? 'Update your review' : 'Rate and review'}</h2>
          {(myLog?.rating || myLog?.text) && (
            <div className="review-item">
              <p>Your rating: {myLog.rating ? stars(myLog.rating) : 'none'}</p>
              {myLog.text && <p>{myLog.text}</p>}
              <button type="button" className="secondary-button" onClick={deleteReview}>Delete my review</button>
            </div>
          )}
          <ReviewForm available onSubmit={saveReview} />
        </div>
      )}

      <div className="card-panel">
        <h2>Recent reviews</h2>
        <LoadState loading={reviews.loading && !reviews.data} error={reviews.error} onRetry={reviews.reload}>
          <div className="review-list">
            {reviews.data?.reviews.length ? (
              reviews.data.reviews.map((review) => (
                <article key={review.id} className="review-item">
                  <div className="review-header">
                    <div>
                      {review.user ? <Link to={`/users/${review.user.id}`}><strong>{review.user.displayName}</strong></Link> : <strong>Former player</strong>}
                      <p aria-label={review.rating ? `${review.rating} out of 5 stars` : 'No rating'}>{stars(review.rating)}</p>
                    </div>
                    <span className="review-title">{formatDate(review.createdAt)}</span>
                  </div>
                  {review.text && <p>{review.text}</p>}
                </article>
              ))
            ) : (
              <p className="subtle-text">No reviews yet — be the first to share your thoughts.</p>
            )}
          </div>
          <Pager page={reviewPage} pages={reviews.data?.pages} onPage={setReviewPage} />
        </LoadState>
      </div>
    </section>
  )
}

function RankingsPage({ wishlistProps }) {
  const [sort, setSort] = useState('rating')
  const ranking = useApi(signal => (sort === 'rating'
    ? api.topGames(50, signal)
    : api.games({ sort: 'popular', limit: 50 }, signal).then(result => ({ games: result.games.filter(game => game.ratingCount > 0) }))),
  [sort])
  const games = ranking.data?.games ?? []

  return (
    <section className="content-section">
      <div className="section-header-inline">
        <h1>Rankings</h1>
        <p className="subtle-text">Top-rated games across the community.</p>
      </div>

      <label>Rank games by <select aria-label="Rank games by" value={sort} onChange={event => setSort(event.target.value)}><option value="rating">Top rated</option><option value="popular">Most rated</option></select></label>
      {sort === 'rating' && ranking.data && <p className="subtle-text">Only games with at least {ranking.data.minCount} ratings are ranked.</p>}
      <LoadState loading={ranking.loading} error={ranking.error} onRetry={ranking.reload}>
        {games.length === 0 && <div className="empty-state card-panel"><h3>No ranked games yet</h3><p>Rate a few games to get the rankings started.</p></div>}
        <div className="rankings-list">
          {games.map((game, index) => (
            <div className="ranking-row card-panel" key={game.id}>
              <div className="rank-number">#{index + 1}</div>
              {game.coverUrl ? <img src={game.coverUrl} alt={game.title} className="ranking-cover" /> : <div className="ranking-cover cover-fallback" />}
              <div className="ranking-copy">
                <h3>{game.title}</h3>
                <p>{game.genres.slice(0, 2).join(' · ')}</p>
              </div>
              <div className="ranking-score">
                <strong>{game.ratingAvg.toFixed(1)}</strong>
                <span>{game.ratingCount} {game.ratingCount === 1 ? 'rating' : 'ratings'}</span>
              </div>
              {wishlistProps(game.id).onToggleWishlist && <GameCardWishlist game={game} {...wishlistProps(game.id)} />}
              <Link to={`/games/${game.id}`} className="text-link">Open</Link>
            </div>
          ))}
        </div>
      </LoadState>
    </section>
  )
}

function GameCardWishlist({ game, isWishlisted, onToggleWishlist, busy }) {
  return <button type="button" disabled={busy} aria-pressed={isWishlisted} aria-label={`${isWishlisted ? 'Remove' : 'Add'} ${game.title} ${isWishlisted ? 'from' : 'to'} wishlist`}
    className={`mini-button ${isWishlisted ? 'active' : ''}`} onClick={() => onToggleWishlist(game.id)}>
    {isWishlisted ? 'Wishlisted' : '+ Wishlist'}
  </button>
}

function HistoryList({ logs, emptyText }) {
  if (!logs.length) return <p className="subtle-text">{emptyText}</p>
  return <div className="review-list">
    {logs.map(log => (
      <article key={log.id} className="review-item">
        <div className="review-header">
          <div>
            <Link to={`/games/${log.game.id}`}><strong>{log.game.title}</strong></Link>
            {log.rating && <p aria-label={`${log.rating} out of 5 stars`}>{stars(log.rating)}</p>}
          </div>
          <span className="review-title">{[STATUS_LABELS[log.status], formatDate(log.updatedAt)].filter(Boolean).join(' · ')}</span>
        </div>
        {log.text && <p>{log.text}</p>}
      </article>
    ))}
  </div>
}

function ProfilePage({ user, library }) {
  const history = useApi(signal => api.myLogs({ limit: 50 }, signal), [library.version])
  const counts = Object.values(library.statuses).reduce((total, status) => ({ ...total, [status]: (total[status] ?? 0) + 1 }), {})
  return <section className="content-section">
    <div className="profile-header card-panel"><div><p className="eyebrow">Profile</p>
      <h1>{user.displayName}</h1><p>{user.email}</p>
      <p className="subtle-text"><Link to={`/users/${user.id}`}>View your public profile</Link></p></div>
      <Link to="/profile/edit" className="secondary-button">Edit profile</Link>
    </div>
    <div className="list-grid">
      <div className="card-panel"><h2>Your library</h2>
        <p><Link to="/wishlist">Wishlist</Link>: {counts.wishlist ?? 0} · <Link to="/backlog">Backlog</Link>: {counts.backlog ?? 0}</p>
        <p>Playing: {counts.playing ?? 0} · Played: {counts.played ?? 0}</p>
      </div>
      <div className="card-panel"><h2>Played games and rating history</h2>
        <LoadState loading={history.loading && !history.data} error={history.error} onRetry={history.reload}>
          <HistoryList logs={history.data?.logs ?? []} emptyText="Rate a game or add one to your lists and it will show up here." />
        </LoadState>
      </div>
    </div>
  </section>
}

function EditProfilePage() {
  const visibility = useApi(signal => api.wishlistVisibility(signal), [])
  const [value, setValue] = useState(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const current = value ?? visibility.data?.wishlistVisibility ?? 'private'
  async function save(event) {
    event.preventDefault()
    setSaving(true); setMessage(null)
    try {
      const result = await api.setWishlistVisibility(current)
      setValue(result.wishlistVisibility)
      setMessage({ role: 'status', text: `Saved. Your wishlist is now ${result.wishlistVisibility}.` })
    } catch (error) {
      setMessage({ role: 'alert', text: error.message })
    } finally { setSaving(false) }
  }
  return <section className="content-section card-panel form-panel"><h1>Edit profile</h1>
    <LoadState loading={visibility.loading} error={visibility.error} onRetry={visibility.reload}>
      <form className="stack-form" onSubmit={save}><fieldset disabled={saving}>
        <label>Wishlist visibility<select value={current} onChange={event => { setValue(event.target.value); setMessage(null) }}>
          <option value="private">Private (only you)</option><option value="public">Public (anyone with your profile link)</option>
        </select></label>
        <button className="primary-button" type="submit">{saving ? 'Saving…' : 'Save changes'}</button>
      </fieldset></form>
      {message && <p role={message.role}>{message.text}</p>}
      <p className="subtle-text">Bio and display name editing are coming soon.</p>
    </LoadState>
    <Link to="/profile">Back to profile</Link>
  </section>
}

function LibraryPage({ status, title, subtitle, emptyText, library, onError }) {
  const list = useApi(signal => api.myLogs({ status, limit: 50 }, signal), [status, library.version])
  async function remove(gameId) {
    try { await library.setStatus(gameId, null) } catch (error) { onError(error.message) }
  }
  return (
    <section className="content-section">
      <div className="section-header-inline">
        <h1>{title}</h1>
        <p className="subtle-text">{subtitle}</p>
      </div>
      <LoadState loading={list.loading && !list.data} error={list.error} onRetry={list.reload}>
        {list.data?.logs.length ? (
          <div className="game-grid">
            {list.data.logs.map(({ game }) => (
              <article key={game.id} className="game-card backlog-card">
                {game.coverUrl ? <img src={game.coverUrl} alt={game.title} className="game-cover" /> : <div className="game-cover cover-fallback">Artwork unavailable</div>}
                <div className="game-card-body">
                  <h3>{game.title}</h3>
                  <p>{game.genres.slice(0, 2).join(' · ')}</p>
                  <Link to={`/games/${game.id}`} className="text-link">View details</Link>
                  <button type="button" className="secondary-button" disabled={Boolean(library.pending[game.id])} onClick={() => remove(game.id)}>
                    Remove from {STATUS_LABELS[status].toLowerCase()}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state card-panel">
            <h3>Your {STATUS_LABELS[status].toLowerCase()} is empty</h3>
            <p>{emptyText} <Link to="/games">Browse games</Link></p>
          </div>
        )}
      </LoadState>
    </section>
  )
}

function UserProfilePage() {
  const { userId } = useParams()
  const profile = useApi(signal => api.user(userId, signal), [userId])
  const history = useApi(signal => api.userLogs(userId, { limit: 50 }, signal), [userId])
  const wishlist = useApi(signal => api.userWishlist(userId, { limit: 50 }, signal), [userId])
  if (profile.error?.status === 404 || profile.error?.status === 400) {
    return <section className="content-section empty-state card-panel"><h1>Player not found</h1>
      <p>That profile doesn&apos;t exist.</p><Link className="text-link" to="/games">Browse games</Link></section>
  }
  if (!profile.data) return <section className="content-section"><LoadState loading={profile.loading} error={profile.error} onRetry={profile.reload} /></section>
  const person = profile.data.user
  return <section className="content-section">
    <div className="profile-header card-panel"><div><p className="eyebrow">Player</p>
      <h1>{person.displayName}</h1>{person.username && <p>@{person.username}</p>}{person.bio && <p>{person.bio}</p>}</div></div>
    <div className="list-grid">
      <div className="card-panel"><h2>Wishlist</h2>
        {wishlist.error?.code === 'WISHLIST_PRIVATE'
          ? <p role="status">This wishlist is private.</p>
          : <LoadState loading={wishlist.loading} error={wishlist.error} onRetry={wishlist.reload}>
            {wishlist.data?.logs.length
              ? <ul>{wishlist.data.logs.map(({ game }) => <li key={game.id}><Link to={`/games/${game.id}`}>{game.title}</Link></li>)}</ul>
              : <p className="subtle-text">Nothing on this wishlist yet.</p>}
          </LoadState>}
      </div>
      <div className="card-panel"><h2>Played games and ratings</h2>
        <LoadState loading={history.loading} error={history.error} onRetry={history.reload}>
          <HistoryList logs={history.data?.logs ?? []} emptyText="No public activity yet." />
        </LoadState>
      </div>
    </div>
  </section>
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
  const library = useLibrary(isAuthenticated)
  const [actionError, setActionError] = useState('')
  const navigate = useNavigate()
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
  // Props for any wishlist toggle; signed-out visitors are sent to log in.
  function wishlistProps(gameId) {
    const isWishlisted = library.statuses[gameId] === 'wishlist'
    return {
      isWishlisted,
      busy: Boolean(library.pending[gameId]),
      onToggleWishlist: () => {
        if (!isAuthenticated) { navigate('/login'); return }
        setActionError('')
        library.setStatus(gameId, isWishlisted ? null : 'wishlist').catch(error => setActionError(error.message))
      },
    }
  }

  return (
    <Layout isAuthenticated={isAuthenticated} onLogout={logout} busy={busy}>
      {error && <div className="card-panel" role="alert">{error} <button type="button" className="secondary-button" onClick={() => { setError(''); setChecking(true); setAttempt(value => value + 1) }}>Retry connection</button></div>}
      {actionError && <div className="card-panel" role="alert">{actionError} <button type="button" className="secondary-button" onClick={() => setActionError('')}>Dismiss</button></div>}
      {checking ? <p role="status">Checking your session…</p> : <>
      <Routes>
        <Route path="/" element={<LandingPage wishlistProps={wishlistProps} />} />
        <Route path="/login" element={<LoginPage key="login" isAuthenticated={isAuthenticated} onLogin={login} onPasswordLogin={passwordLogin} onRegister={register} busy={busy} />} />
        <Route path="/register" element={<LoginPage key="register" registering isAuthenticated={isAuthenticated} onLogin={login} onPasswordLogin={passwordLogin} onRegister={register} busy={busy} />} />
        <Route path="/games" element={<GameDiscoveryPage wishlistProps={wishlistProps} />} />
        <Route
          path="/games/:gameId"
          element={<GameDetailsPage isAuthenticated={isAuthenticated} library={library} onError={setActionError} />}
        />
        <Route path="/rankings" element={<RankingsPage wishlistProps={wishlistProps} />} />
        <Route path="/users/:userId" element={<UserProfilePage />} />
        <Route
          path="/profile"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <ProfilePage user={userProfile} library={library} />
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
              <LibraryPage status="wishlist" title="My Wishlist" subtitle="Saved for later." emptyText="Add games you want to play." library={library} onError={setActionError} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/backlog"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <LibraryPage status="backlog" title="My Backlog" subtitle="Games planned for future play." emptyText="Add games you own but haven't played yet." library={library} onError={setActionError} />
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

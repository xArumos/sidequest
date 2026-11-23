import { useEffect, useId, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import LoadState from '../components/LoadState'
import Pager from '../components/Pager'
import { api } from '../services/api'
import { useApi } from '../services/useApi'
import { formatDate, stars } from '../utils/games'

const MAX_TEXT = 500
const REVIEW_SORTS = [['newest', 'Newest first'], ['oldest', 'Oldest first'], ['highest', 'Highest rated'], ['lowest', 'Lowest rated']]
const REQUEST_STATUSES = [['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['all', 'All']]
const RATINGS = [1, 2, 3, 4, 5]

// A polite status message that takes focus whenever a new one appears, so keyboard
// and screen reader users are not dropped to the page body when the control they
// used disappears. `message` is { text } so repeating the same text still refocuses.
function ActionStatus({ message }) {
  const ref = useRef(null)
  useEffect(() => { if (message) ref.current?.focus() }, [message])
  return <div ref={ref} role="status" tabIndex={-1} className="action-status">{message && <p>{message.text}</p>}</div>
}

// Cancelling a form unmounts it along with the focused control; this returns focus
// to the button that opened it. Returns [ref for that button, function to call on cancel].
function useReturnFocus() {
  const pending = useRef(false)
  const ref = node => {
    if (node && pending.current) { node.focus(); pending.current = false }
  }
  return [ref, () => { pending.current = true }]
}

function Reviewer({ user }) {
  return user ? <Link to={`/users/${user.id}`}><strong>{user.displayName}</strong></Link> : <strong>Former player</strong>
}

// On a game page: request developer access, or show the request's state (PBI-32).
export function DeveloperAccess({ gameId }) {
  const mine = useApi(signal => api.myDeveloperRequest(gameId, signal), [gameId])
  const [open, setOpen] = useState(false)
  const [justification, setJustification] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const field = useRef(null)
  const errorId = useId()
  const [opener, returnFocus] = useReturnFocus()
  if (!mine.data) return null
  const request = mine.data.request

  if (request?.status === 'approved') {
    return <p className="developer-access"><Link className="text-link" to={`/dev?gameId=${encodeURIComponent(gameId)}`}>Open developer reviews</Link></p>
  }
  if (request?.status === 'pending') {
    return <p className="developer-access subtle-text" role="status">Developer access requested on {formatDate(request.requestedAt)}. Waiting for approval.</p>
  }
  if (request?.status === 'rejected') {
    return <p className="developer-access subtle-text">Your developer access request was not approved.</p>
  }
  if (!open) {
    return <p className="developer-access"><button ref={opener} type="button" className="link-button" onClick={() => setOpen(true)}>Request developer access</button></p>
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (!justification.trim()) {
      setError('Tell us how you worked on this game.')
      field.current?.focus()
      return
    }
    setBusy(true)
    try {
      await api.requestDeveloperAccess(gameId, justification.trim())
      mine.reload()
    } catch (error) {
      setError(error.message)
      if (error.status === 409) mine.reload()
    } finally { setBusy(false) }
  }
  return <form className="stack-form developer-access" onSubmit={submit} noValidate>
    <fieldset disabled={busy}>
      <label>How did you work on this game?
        <textarea ref={field} autoFocus rows={3} maxLength={MAX_TEXT} value={justification}
          aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : undefined}
          onChange={event => { setJustification(event.target.value); setError('') }} />
      </label>
      <p className="subtle-text">{justification.length}/{MAX_TEXT} characters. An admin reviews every request.</p>
      <div className="inline-actions">
        <button className="primary-button" type="submit">{busy ? 'Sending…' : 'Send request'}</button>
        <button className="secondary-button" type="button" onClick={() => { returnFocus(); setOpen(false); setError('') }}>Cancel</button>
      </div>
    </fieldset>
    {error && <p id={errorId} role="alert">{error}</p>}
  </form>
}

function DeveloperReview({ review, onRemoved }) {
  const [removing, setRemoving] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const field = useRef(null)
  const errorId = useId()
  const [opener, returnFocus] = useReturnFocus()
  const author = review.user?.displayName ?? 'a former player'
  async function remove(event) {
    event.preventDefault()
    setError('')
    if (!reason.trim()) {
      setError('Give a reason for removing this review.')
      field.current?.focus()
      return
    }
    setBusy(true)
    try {
      await api.removeReview(review.id, reason.trim())
      onRemoved()
    } catch (error) { setError(error.message); setBusy(false) }
  }
  return <article className="review-item">
    <div className="review-header">
      <div>
        <Reviewer user={review.user} />
        <p aria-label={review.rating ? `${review.rating} out of 5 stars` : 'No rating'}>{stars(review.rating)}</p>
      </div>
      <span className="review-title">{[review.game?.title, formatDate(review.createdAt)].filter(Boolean).join(' · ')}</span>
    </div>
    {review.text && <p>{review.text}</p>}
    {removing ? (
      <form className="stack-form" onSubmit={remove} noValidate>
        <fieldset disabled={busy}>
          <label>Reason for removal
            <textarea ref={field} autoFocus rows={2} maxLength={MAX_TEXT} value={reason}
              aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : undefined}
              onChange={event => { setReason(event.target.value); setError('') }} />
          </label>
          <p className="subtle-text">The review is hidden from everyone else and no longer counts toward the rating. Its author still sees it with this reason.</p>
          <div className="inline-actions">
            <button className="danger-button" type="submit">{busy ? 'Removing…' : 'Remove review'}</button>
            <button className="secondary-button" type="button" onClick={() => { returnFocus(); setRemoving(false); setError('') }}>Cancel</button>
          </div>
        </fieldset>
        {error && <p id={errorId} role="alert">{error}</p>}
      </form>
    ) : (
      <button ref={opener} type="button" className="secondary-button" aria-label={`Remove review by ${author}`} onClick={() => setRemoving(true)}>Remove</button>
    )}
  </article>
}

const NO_FILTERS = { sort: 'newest', minRating: '', maxRating: '', from: '', to: '', hasText: '' }

// Reviews of the signed-in developer's games, with filters (PBI-32, PBI-33). A
// minimal page; the full dashboard is planned separately.
export function DeveloperPage({ games }) {
  const [searchParams] = useSearchParams()
  const [filters, setFilters] = useState(() => ({ ...NO_FILTERS, gameId: searchParams.get('gameId') ?? '' }))
  const [page, setPage] = useState(1)
  const [success, setSuccess] = useState(null)
  const problem = filters.minRating && filters.maxRating && Number(filters.minRating) > Number(filters.maxRating)
    ? 'The minimum rating must not be above the maximum.'
    : filters.from && filters.to && filters.from > filters.to ? 'The start date must not be after the end date.' : ''
  const reviews = useApi(signal => (problem ? Promise.resolve(null) : api.devReviews({ ...filters, page, limit: 20 }, signal)),
    [filters, page, problem])
  // Any new query makes an earlier success message stale.
  const query = (nextFilters, nextPage = 1) => { setFilters(nextFilters); setPage(nextPage); setSuccess(null) }
  const change = name => event => query({ ...filters, [name]: event.target.value })
  const myGames = games.data?.games ?? []

  function onRemoved() {
    setSuccess({ text: 'Review removed.' })
    reviews.reload()
  }

  return <section className="content-section">
    <div className="section-header-inline">
      <h1>Developer reviews</h1>
      <p className="subtle-text">Read and moderate reviews of the games you develop.</p>
    </div>
    <LoadState loading={games.loading && !games.data} error={games.error} onRetry={games.reload}>
      {myGames.length === 0 ? (
        <div className="empty-state card-panel">
          <h3>No developer access yet</h3>
          <p>Open one of your games and choose &ldquo;Request developer access&rdquo;. <Link to="/games">Browse games</Link></p>
        </div>
      ) : <>
        <div className="filter-panel developer-filters">
          <div className="developer-filter-selects">
            <select aria-label="Game" value={filters.gameId} onChange={change('gameId')}>
              <option value="">All my games</option>
              {myGames.map(game => <option key={game.id} value={game.id}>{game.title}</option>)}
            </select>
            <select aria-label="Sort reviews" value={filters.sort} onChange={change('sort')}>
              {REVIEW_SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select aria-label="Written text" value={filters.hasText} onChange={change('hasText')}>
              <option value="">With or without text</option>
              <option value="true">With written text</option>
              <option value="false">Rating only</option>
            </select>
            <select aria-label="Minimum rating" value={filters.minRating} onChange={change('minRating')}>
              <option value="">Any minimum rating</option>
              {RATINGS.map(rating => <option key={rating} value={rating}>At least {rating} {rating === 1 ? 'star' : 'stars'}</option>)}
            </select>
            <select aria-label="Maximum rating" value={filters.maxRating} onChange={change('maxRating')}>
              <option value="">Any maximum rating</option>
              {RATINGS.map(rating => <option key={rating} value={rating}>At most {rating} {rating === 1 ? 'star' : 'stars'}</option>)}
            </select>
          </div>
          <div className="two-field-row developer-filter-dates">
            <label className="date-field">From<input type="date" value={filters.from} max={filters.to || undefined} onChange={change('from')} /></label>
            <label className="date-field">To<input type="date" value={filters.to} min={filters.from || undefined} onChange={change('to')} /></label>
          </div>
        </div>
        <div className="inline-actions">
          <button type="button" className="secondary-button" onClick={() => query({ ...NO_FILTERS, gameId: '' })}>Reset filters</button>
          {reviews.data && <p role="status" className="subtle-text">{reviews.data.total} {reviews.data.total === 1 ? 'review' : 'reviews'} found</p>}
        </div>
        <ActionStatus message={success} />
        {problem ? <p role="alert">{problem}</p> : (
          <div className="card-panel">
            <LoadState loading={reviews.loading && !reviews.data} error={reviews.error} onRetry={reviews.reload}>
              <div className="review-list">
                {reviews.data?.reviews.length
                  ? reviews.data.reviews.map(review => <DeveloperReview key={review.id} review={review} onRemoved={onRemoved} />)
                  : <p className="subtle-text">No reviews match these filters.</p>}
              </div>
              <Pager page={page} pages={reviews.data?.pages} onPage={next => query(filters, next)} />
            </LoadState>
          </div>
        )}
      </>}
    </LoadState>
  </section>
}

// Admin tooling for developer access requests (#93).
export function AdminPage() {
  const [status, setStatus] = useState('pending')
  const [page, setPage] = useState(1)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)
  const list = useApi(signal => api.developerRequests({ status, page, limit: 20 }, signal), [status, page])
  async function decide(request, action) {
    setBusyId(request.id); setError(''); setSuccess(null)
    try {
      await api.decideDeveloperRequest(request.id, action)
      const text = action === 'approve' ? 'Developer access approved.'
        : request.status === 'approved' ? 'Developer access revoked.' : 'Developer access rejected.'
      setSuccess({ text })
      list.reload()
    } catch (error) { setError(error.message) }
    finally { setBusyId(null) }
  }
  return <section className="content-section">
    <div className="section-header-inline">
      <h1>Admin</h1>
      <p className="subtle-text">Approve or reject developer access requests.</p>
    </div>
    <div className="card-panel">
      <div className="panel-header">
        <h2>Developer requests</h2>
        <select aria-label="Request status" className="compact-select" value={status} onChange={event => { setStatus(event.target.value); setPage(1); setSuccess(null) }}>
          {REQUEST_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      {error && <p role="alert">{error}</p>}
      <ActionStatus message={success} />
      <LoadState loading={list.loading && !list.data} error={list.error} onRetry={list.reload}>
        <div className="review-list">
          {list.data?.requests.length ? list.data.requests.map(request => (
            <article key={request.id} className="review-item request-item">
              <div className="review-header">
                <div>
                  <Reviewer user={request.user} />
                  <span className="request-game subtle-text">for {request.game ? <Link className="text-link" to={`/games/${request.game.id}`}>{request.game.title}</Link> : 'a deleted game'}</span>
                </div>
                <span className="review-title">{[request.status[0].toUpperCase() + request.status.slice(1), formatDate(request.requestedAt)].join(' · ')}</span>
              </div>
              {request.justification && <p>{request.justification}</p>}
              <div className="inline-actions">
                {request.status !== 'approved' && <button type="button" className="primary-button" disabled={busyId === request.id}
                  aria-label={`Approve ${request.user?.displayName ?? 'request'} for ${request.game?.title ?? 'this game'}`} onClick={() => decide(request, 'approve')}>Approve</button>}
                {request.status !== 'rejected' && <button type="button" className="secondary-button" disabled={busyId === request.id}
                  aria-label={`${request.status === 'approved' ? 'Revoke' : 'Reject'} ${request.user?.displayName ?? 'request'} for ${request.game?.title ?? 'this game'}`} onClick={() => decide(request, 'reject')}>
                  {request.status === 'approved' ? 'Revoke' : 'Reject'}
                </button>}
              </div>
            </article>
          )) : <p className="subtle-text">No {status === 'all' ? '' : `${status} `}developer requests.</p>}
        </div>
        <Pager page={page} pages={list.data?.pages} onPage={next => { setPage(next); setSuccess(null) }} />
      </LoadState>
    </div>
  </section>
}

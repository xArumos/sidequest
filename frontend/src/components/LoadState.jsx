// Shows an error with an optional retry, a loading message, or the children.
export default function LoadState({ loading, error, onRetry, children }) {
  if (error) {
    return <div className="empty-state card-panel" role="alert">
      <h3>Couldn&apos;t load this</h3><p>{error.message}</p>
      {onRetry && <button type="button" className="secondary-button" onClick={onRetry}>Try again</button>}
    </div>
  }
  if (loading) return <p role="status">Loading…</p>
  return children
}

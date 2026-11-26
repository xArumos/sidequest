export default function Pager({ page, pages, onPage }) {
  if (!pages || pages <= 1) return null
  return <div className="inline-actions pager">
    <button type="button" className="secondary-button" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
    <span className="subtle-text">Page {page} of {pages}</span>
    <button type="button" className="secondary-button" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
  </div>
}

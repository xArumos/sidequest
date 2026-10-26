import { useState } from 'react'
import RatingInput from './RatingInput'

// Enable only when a real persistence callback and supported API contract exist.
export default function ReviewForm({ onSubmit, available = false }) {
  const [rating, setRating] = useState(0)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const canSave = available && typeof onSubmit === 'function'
  async function submit(event) {
    event.preventDefault()
    setError('')
    setSaved(false)
    if (!canSave || busy) return
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      setError('Choose a rating from 1 to 5 before submitting.')
      return
    }
    if (text.trim().length > 2000) {
      setError('Reviews must be 2,000 characters or fewer.')
      return
    }
    setBusy(true)
    try {
      await onSubmit({ rating, text: text.trim() })
      setSaved(true)
      setRating(0)
      setText('')
    } catch (error) {
      setError(error.message || 'Your review could not be saved. Try again.')
    } finally { setBusy(false) }
  }
  return <form className="stack-form" onSubmit={submit} aria-busy={busy}>
    <p>Your rating (1–5)</p>
    <RatingInput value={rating} onChange={value => { setRating(value); setSaved(false) }} />
    <label>Your review (optional)
      <textarea name="text" rows={5} maxLength={2000} value={text} onChange={event => { setText(event.target.value); setSaved(false) }} />
    </label>
    <span className="subtle-text">{text.length}/2000 characters</span>
    {!canSave && <p role="status">Review publishing is unavailable until the review API is published. Drafts are not saved.</p>}
    {error && <p role="alert">{error}</p>}
    {saved && <p role="status">Review saved.</p>}
    <button disabled={!canSave || busy} type="submit" className="primary-button">{busy ? 'Saving…' : 'Submit review'}</button>
  </form>
}

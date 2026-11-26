import { useEffect, useId, useRef, useState } from 'react'
import { api } from '../services/api'

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

// Modal confirmation for account deletion (#92). Password accounts re-enter their
// password; Google accounts, which have none, type their username or email. Focus
// moves into the dialog, stays there while it is open, and Escape cancels.
function DeleteAccountDialog({ user, onCancel, onDeleted }) {
  const usesPassword = user.authMethod !== 'google'
  const confirmText = user.username || user.email
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const dialog = useRef(null)
  const input = useRef(null)
  const ids = useId()

  // Focus the field on open, and again after an error once it is enabled.
  useEffect(() => { if (!busy) input.current?.focus() }, [busy, error])

  function onKeyDown(event) {
    if (event.key === 'Escape' && !busy) {
      event.stopPropagation()
      onCancel()
      return
    }
    if (event.key !== 'Tab') return
    const items = [...dialog.current.querySelectorAll(FOCUSABLE)]
    if (!items.length) return
    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }

  async function submit(event) {
    event.preventDefault()
    if (!value.trim()) {
      setError(usesPassword ? 'Enter your password.' : `Type ${confirmText} to confirm.`)
      input.current?.focus()
      return
    }
    setBusy(true)
    setError('')
    try {
      await api.deleteAccount(usesPassword ? { password: value } : { confirm: value })
      onDeleted()
    } catch (failure) {
      setError(failure.message)
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div
        ref={dialog}
        className="modal card-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${ids}-title`}
        aria-describedby={`${ids}-description`}
        onKeyDown={onKeyDown}
      >
        <h2 id={`${ids}-title`}>Delete your account?</h2>
        <p id={`${ids}-description`}>
          This permanently deletes your profile, ratings, reviews, lists, follows, and developer access, and signs you
          out on every device. It cannot be undone.
        </p>
        <form className="stack-form" onSubmit={submit} noValidate>
          <label>
            {usesPassword ? 'Password' : <span>Type <strong>{confirmText}</strong> to confirm</span>}
            <input
              ref={input}
              type={usesPassword ? 'password' : 'text'}
              autoComplete={usesPassword ? 'current-password' : 'off'}
              value={value}
              onChange={event => { setValue(event.target.value); setError('') }}
              aria-invalid={error ? 'true' : undefined}
              aria-describedby={error ? `${ids}-error` : undefined}
              disabled={busy}
            />
          </label>
          {error && <p id={`${ids}-error`} role="alert" className="form-error">{error}</p>}
          <div className="inline-actions modal-actions">
            <button type="button" className="secondary-button" onClick={onCancel} disabled={busy}>Cancel</button>
            <button type="submit" className="danger-button" disabled={busy}>
              {busy ? 'Deleting…' : 'Delete account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// The "Delete account" danger zone on the edit profile page.
export default function DeleteAccountSection({ user, onDeleted }) {
  const [open, setOpen] = useState(false)
  const trigger = useRef(null)
  const returnFocus = useRef(false)
  // Return focus to the button that opened the dialog once the dialog is gone.
  useEffect(() => {
    if (!open && returnFocus.current) {
      returnFocus.current = false
      trigger.current?.focus()
    }
  }, [open])
  function close() {
    returnFocus.current = true
    setOpen(false)
  }
  return (
    <section className="danger-zone" aria-labelledby="delete-account-heading">
      <h2 id="delete-account-heading">Delete account</h2>
      <p className="subtle-text">Permanently delete your account and everything in it. This cannot be undone.</p>
      <button ref={trigger} type="button" className="danger-button" onClick={() => setOpen(true)}>
        Delete account…
      </button>
      {open && <DeleteAccountDialog user={user} onCancel={close} onDeleted={onDeleted} />}
    </section>
  )
}

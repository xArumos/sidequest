import { useEffect, useRef, useState } from 'react'

let scriptPromise
function loadGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id)
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      const fail = () => {
        script.remove()
        reject(new Error('Google sign-in could not load. Check your connection and try again.'))
      }
      const timeout = setTimeout(fail, 15000)
      script.onload = () => {
        clearTimeout(timeout)
        if (window.google?.accounts?.id) resolve(window.google.accounts.id)
        else fail()
      }
      script.onerror = () => { clearTimeout(timeout); fail() }
      document.head.append(script)
    }).catch(error => { scriptPromise = undefined; throw error })
  }
  return scriptPromise
}

export default function GoogleSignIn({ onCredential, busy }) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || import.meta.env.SIDEQUEST_GOOGLE_CLIENT_ID
  const container = useRef(null)
  const callback = useRef(onCredential)
  const pending = useRef(busy)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(Boolean(clientId))
  const [attempt, setAttempt] = useState(0)
  useEffect(() => { callback.current = onCredential; pending.current = busy }, [onCredential, busy])
  useEffect(() => {
    if (!clientId) return
    let active = true
    loadGoogle().then(id => {
      if (!active) return
      id.initialize({
        client_id: clientId,
        auto_select: false,
        callback: ({ credential } = {}) => {
          if (!active || pending.current) return
          if (typeof credential !== 'string' || !credential.trim()) {
            setError('Google did not return a sign-in credential. Please try again.')
            return
          }
          callback.current(credential)
        },
      })
      id.renderButton(container.current, { theme: 'outline', size: 'large', text: 'continue_with', width: 240 })
      setLoading(false)
    }).catch(error => {
      if (active) { setError(error.message); setLoading(false) }
    })
    return () => { active = false }
  }, [clientId, attempt])
  if (!clientId) return <div className="google-signin">
    <button type="button" className="google-signin-placeholder" disabled>Continue with Google</button>
  </div>
  return <div className="google-signin" aria-busy={busy || loading}>
    <div ref={container} hidden={busy || loading || Boolean(error)} />
    {loading && !busy && <p role="status">Loading Google sign-in…</p>}
    {busy && <p role="status">Signing in…</p>}
    {error && <>
      <p role="alert">{error}</p>
      <button type="button" className="secondary-button" disabled={busy} onClick={() => { setError(''); setLoading(true); setAttempt(value => value + 1) }}>Retry Google sign-in</button>
    </>}
  </div>
}

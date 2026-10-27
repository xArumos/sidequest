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
      id.renderButton(container.current, { theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill', width: 240 })
      setLoading(false)
    }).catch(error => {
      if (active) { setError(error.message); setLoading(false) }
    })
    return () => { active = false }
  }, [clientId, attempt])
  if (!clientId) return <div className="google-signin">
    <button type="button" className="google-signin-placeholder" disabled>
      <svg className="google-signin-icon" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
        <path fill="#4285F4" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.797 2.716v2.258h2.909c1.702-1.567 2.684-3.875 2.684-6.614Z" />
        <path fill="#34A853" d="M9 18c2.43 0 4.468-.806 5.957-2.181l-2.909-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.583-5.036-3.71H.957v2.332A9 9 0 0 0 9 18Z" />
        <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A9 9 0 0 0 0 9c0 1.452.347 2.827.957 4.042l3.007-2.332Z" />
        <path fill="#EA4335" d="M9 3.58c1.321 0 2.507.454 3.44 1.346l2.581-2.582C13.464.892 11.426 0 9 0A9 9 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" />
      </svg>
      <span>Continue with Google</span>
    </button>
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

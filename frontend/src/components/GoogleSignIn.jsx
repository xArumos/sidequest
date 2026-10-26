import { useEffect, useRef, useState } from 'react'

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
let scriptPromise
function loadGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id)
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.onload = () => window.google?.accounts?.id
        ? resolve(window.google.accounts.id) : reject(new Error('Google sign-in could not load.'))
      script.onerror = () => { script.remove(); reject(new Error('Google sign-in could not load. Check your connection and reload.')) }
      document.head.append(script)
    }).catch(error => { scriptPromise = undefined; throw error })
  }
  return scriptPromise
}

export default function GoogleSignIn({ onCredential, busy }) {
  const container = useRef(null)
  const callback = useRef(onCredential)
  const [error, setError] = useState('')
  useEffect(() => { callback.current = onCredential }, [onCredential])
  useEffect(() => {
    if (!clientId) return
    let active = true
    loadGoogle().then(id => {
      if (!active) return
      id.initialize({ client_id: clientId, callback: ({ credential }) => {
        if (active) callback.current(credential)
      } })
      id.renderButton(container.current, { theme: 'outline', size: 'large', width: 240 })
    }).catch(error => { if (active) setError(error.message) })
    return () => { active = false }
  }, [])
  if (!clientId) return <p role="status">Google sign-in is unavailable until the application is configured.</p>
  return <div aria-busy={busy}>
    <div ref={container} hidden={busy} />
    {busy && <p role="status">Signing in…</p>}
    {error && <p role="alert">{error}</p>}
  </div>
}

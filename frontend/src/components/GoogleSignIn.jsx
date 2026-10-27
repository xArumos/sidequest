import { useEffect, useRef, useState } from 'react'

let scriptPromise
function loadGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google)
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.onload = () => resolve(window.google)
      script.onerror = () => {
        script.remove()
        scriptPromise = undefined
        reject(new Error('Google sign-in could not load. You can still use a password.'))
      }
      document.head.append(script)
    })
  }
  return scriptPromise
}

export default function GoogleSignIn({ onCredential, disabled }) {
  const container = useRef(null)
  const callback = useRef(onCredential)
  const [error, setError] = useState('')
  useEffect(() => { callback.current = onCredential }, [onCredential])
  useEffect(() => {
    let active = true
    loadGoogle().then(google => {
      if (!active) return
      google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: result => callback.current(result.credential),
        auto_select: false,
      })
      google.accounts.id.renderButton(container.current, { theme: 'outline', size: 'large' })
    }).catch(error => { if (active) setError(error.message) })
    return () => { active = false }
  }, [])
  return <div className="google-signin">
    <p className="divider">or continue with Google</p>
    <div ref={container} inert={disabled} />
    {error && <p role="alert">{error}</p>}
  </div>
}

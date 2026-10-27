import { useEffect, useState } from 'react'
import { authRequest } from '../auth-api'
import GoogleSignIn from './GoogleSignIn'

export default function AuthPanel() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)
  const [mode, setMode] = useState('login')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    authRequest('/me').then(result => {
      if (active) setUser(result.user)
    }).catch(error => {
      if (active && error.status !== 401) setError(error.message)
    }).finally(() => { if (active) setChecking(false) })
    return () => { active = false }
  }, [])

  async function authenticate(path, body) {
    setBusy(true)
    setError('')
    try {
      const result = await authRequest(path, body)
      setUser(result.user)
    } catch (error) {
      setError(error.message)
    } finally {
      setBusy(false)
    }
  }
  function submit(event) {
    event.preventDefault()
    const form = event.currentTarget
    const data = Object.fromEntries(new FormData(form))
    if (mode === 'register') {
      if (data.password !== data.confirmPassword) {
        setError('Passwords do not match.')
        return
      }
      const length = [...data.password].length
      if (length < 15 || length > 128) {
        setError('Use a password of 15-128 characters.')
        return
      }
      delete data.confirmPassword
    }
    authenticate(mode === 'register' ? '/register' : '/login', data)
  }
  async function logout() {
    setBusy(true)
    setError('')
    try {
      await authRequest('/logout', {})
      window.google?.accounts?.id?.disableAutoSelect()
      setUser(null)
    } catch (error) {
      setError(error.message)
    } finally {
      setBusy(false)
    }
  }

  return <section className="auth-card" aria-labelledby="auth-title" aria-busy={checking || busy}>
    {checking ? <p role="status">Checking your session...</p> : user ? <>
      <p className="eyebrow">You’re signed in</p>
      <h2 id="auth-title">Welcome, {user.displayName}</h2>
      {user.username && <p>@{user.username}</p>}
      <p className="account-email">{user.email}</p>
      <button className="primary" type="button" disabled={busy} onClick={logout}>{busy ? 'Signing out...' : 'Log out'}</button>
    </> : <>
      <h2 id="auth-title">{mode === 'register' ? 'Create your account' : 'Welcome back'}</h2>
      <p className="auth-intro">{mode === 'register' ? 'Start your next SideQuest.' : 'Sign in to your SideQuest account.'}</p>
      <form key={mode} onSubmit={submit}>
        <fieldset disabled={busy}>
          {mode === 'register' ? <>
            <label htmlFor="username">Username</label>
            <input id="username" name="username" autoComplete="username" required minLength={3} maxLength={30} pattern="[A-Za-z0-9_]{3,30}" aria-describedby="username-help" />
            <small id="username-help">3-30 letters, numbers, or underscores.</small>
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} />
          </> : <>
            <label htmlFor="identifier">Username or email</label>
            <input id="identifier" name="identifier" autoComplete="username" required maxLength={254} />
          </>}
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required aria-describedby={mode === 'register' ? 'password-help' : undefined} />
          {mode === 'register' && <>
            <small id="password-help">15-128 characters. A long phrase works well.</small>
            <label htmlFor="confirmPassword">Confirm password</label>
            <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
          </>}
          <button className="primary" type="submit">{busy ? 'Please wait...' : mode === 'register' ? 'Create account' : 'Log in'}</button>
        </fieldset>
      </form>
      <button className="text-button" type="button" disabled={busy} onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>
        {mode === 'login' ? 'New here? Create an account' : 'Already registered? Log in'}
      </button>
      {import.meta.env.VITE_GOOGLE_CLIENT_ID && <GoogleSignIn disabled={busy} onCredential={credential => authenticate('/google', { credential })} />}
    </>}
    {error && <p className="auth-error" role="alert">{error}</p>}
  </section>
}

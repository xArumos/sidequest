import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../services/api'
import { useApi } from '../services/useApi'

const messages = {
  cancelled: 'Steam sign-in was cancelled.',
  expired: 'This connection attempt expired. Start again to connect Steam.',
  failed: 'Steam sign-in could not be verified. Please try again.',
  'in-use': 'That Steam account is already connected to another SideQuest account.',
}

export default function SteamConnection() {
  const connection = useApi(api.steamConnection, [])
  const [params, setParams] = useSearchParams()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const linked = Boolean(connection.data?.steamId)
  const result = params.get('steam')
  const message = error || (Object.hasOwn(messages, result) ? messages[result] : '')

  async function disconnect() {
    setBusy(true)
    setError('')
    if (params.has('steam')) {
      const next = new URLSearchParams(params)
      next.delete('steam')
      setParams(next, { replace: true })
    }
    try {
      await api.disconnectSteam()
      connection.reload()
    } catch (error) {
      setError(error.message)
    }
    setBusy(false)
  }

  return (
    <section className="card-panel">
      <h2>Steam account</h2>
      {connection.loading && <p>Checking your Steam connection…</p>}
      {connection.error && <p role="alert">{connection.error.message}{' '}
        <button type="button" className="secondary-button" onClick={connection.reload}>Try again</button>
      </p>}
      {message && <p role={error || result !== 'cancelled' ? 'alert' : 'status'}>{message}</p>}
      {!connection.loading && !connection.error && (linked ? <>
        <p>Connected to Steam.</p>
        <button type="button" className="secondary-button" disabled={busy} onClick={disconnect}>
          {busy ? 'Working…' : 'Disconnect Steam'}
        </button>
      </> : <form method="post" action={api.steamConnectUrl}>
        <button type="submit" className="secondary-button">Connect Steam</button>
      </form>)}
    </section>
  )
}

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import App from '../App'
// Only the external Google widget is replaced. App and the real frontend auth service run together.
vi.mock('../components/GoogleSignIn', () => ({ default: ({ onCredential, busy }) =>
  <button disabled={busy} onClick={() => onCredential('synthetic-google-credential')}>Synthetic Google callback</button>,
}))
const user = { id: 'synthetic-user', displayName: 'Synthetic Player', email: 'player@example.test', avatarUrl: '' }
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
function visit(path) { render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>) }
afterEach(() => vi.unstubAllGlobals())
it('[TC-FE-INTEGRATION-01] renders account data returned through the actual frontend fetch service', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ user })))
  visit('/profile')
  expect(await screen.findByRole('heading', { name: user.displayName })).toBeInTheDocument()
  expect(screen.getByText(user.email)).toBeInTheDocument()
  expect(fetch).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({ credentials: 'include' }))
})
it('[TC-FE-INTEGRATION-02] exchanges a widget credential and clears state after bodyless logout', async () => {
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(json({ error: { message: 'Please sign in.' } }, 401))
    .mockResolvedValueOnce(json({ user }))
    .mockResolvedValueOnce(new Response(null, { status: 204 })))
  visit('/login')
  await userEvent.click(await screen.findByRole('button', { name: 'Synthetic Google callback' }))
  await screen.findByRole('heading', { name: user.displayName })
  expect(fetch).toHaveBeenNthCalledWith(2, '/api/auth/google', expect.objectContaining({ credentials: 'include', body: JSON.stringify({ credential: 'synthetic-google-credential' }) }))
  await userEvent.click(screen.getByRole('button', { name: 'Log out' }))
  expect(await screen.findByRole('heading', { name: 'Sign in to continue' })).toBeInTheDocument()
  expect(screen.queryByText(user.email)).not.toBeInTheDocument()
})
it('[TC-FE-INTEGRATION-03] surfaces structured rate-limit errors without authenticating', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(json({ error: { code: 'RATE_LIMITED', message: 'Synthetic rate limit: try again later.' } }, 429)))
  visit('/login')
  await userEvent.click(await screen.findByRole('button', { name: 'Synthetic Google callback' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Synthetic rate limit')
  expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument()
})
it('[TC-FE-INTEGRATION-04] rejects malformed profile data with a visible retry path', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ user: { id: 'synthetic-user' } })))
  visit('/profile')
  expect(await screen.findByRole('alert')).toHaveTextContent('invalid account response')
  expect(screen.getByRole('button', { name: 'Retry connection' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: user.displayName })).not.toBeInTheDocument()
})
it('[TC-FE-INTEGRATION-05] aborts the session request when the application unmounts', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise(() => {})))
  const view = render(<MemoryRouter><App /></MemoryRouter>)
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  const { signal } = fetch.mock.calls[0][1]
  expect(signal.aborted).toBe(false)
  view.unmount()
  expect(signal.aborted).toBe(true)
})
it('[TC-FE-INTEGRATION-06] recovers from a network failure through the real request service', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new TypeError('Synthetic network failure')).mockResolvedValueOnce(json({ user })))
  visit('/profile')
  expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach SideQuest')
  await userEvent.click(screen.getByRole('button', { name: 'Retry connection' }))
  expect(await screen.findByRole('heading', { name: user.displayName })).toBeInTheDocument()
})

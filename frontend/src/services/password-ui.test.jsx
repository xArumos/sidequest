import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import App from '../App'
vi.mock('../components/GoogleSignIn', () => ({ default: () => <p>Google sign-in remains available when configured.</p> }))
const user = { id: 'synthetic-password-account', username: 'synthetic_player', displayName: 'synthetic_player', email: 'player@example.test', avatarUrl: '' }
const json = (body, status = 200) => new Response(JSON.stringify(body), { status })
async function signedOut(path) {
  const fetch = vi.fn().mockResolvedValueOnce(json({ error: { message: 'Please sign in.' } }, 401))
  vi.stubGlobal('fetch', fetch)
  render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
  await screen.findByLabelText('Password')
  return fetch
}
afterEach(() => vi.unstubAllGlobals())
async function registration(password = 'synthetic password phrase') {
  await userEvent.type(screen.getByLabelText('Username', { exact: true }), 'synthetic_player')
  await userEvent.type(screen.getByLabelText('Email'), user.email)
  await userEvent.type(screen.getByLabelText('Password', { exact: true }), password)
  await userEvent.type(screen.getByLabelText('Confirm password'), password)
}
it('[TC-FE-PASSWORD-01] validates required registration fields and email without sending a request', async () => {
  const fetch = await signedOut('/register')
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
  expect(screen.getByRole('alert')).toHaveTextContent('username')
  await userEvent.type(screen.getByLabelText('Username', { exact: true }), 'synthetic_player')
  await userEvent.type(screen.getByLabelText('Email'), 'not-an-email')
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
  expect(screen.getByRole('alert')).toHaveTextContent('valid email')
  expect(fetch).toHaveBeenCalledTimes(1)
})
it('[TC-FE-PASSWORD-02] rejects short passwords and mismatched confirmation while retaining input', async () => {
  const fetch = await signedOut('/register')
  await registration('too short')
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
  expect(screen.getByRole('alert')).toHaveTextContent('15–128')
  await userEvent.clear(screen.getByLabelText('Password', { exact: true }))
  await userEvent.type(screen.getByLabelText('Password', { exact: true }), 'synthetic password phrase')
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match')
  expect(screen.getByLabelText('Email')).toHaveValue(user.email)
  expect(fetch).toHaveBeenCalledTimes(1)
})
it('[TC-FE-PASSWORD-03] registers through the real frontend service without sending confirmation', async () => {
  const fetch = await signedOut('/register')
  await registration()
  fetch.mockResolvedValueOnce(json({ user }, 201))
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
  expect(await screen.findByRole('heading', { name: user.displayName })).toBeInTheDocument()
  expect(fetch).toHaveBeenLastCalledWith('/api/auth/register', expect.objectContaining({ credentials: 'include', method: 'POST', body: JSON.stringify({ username: user.username, email: user.email, password: 'synthetic password phrase' }) }))
})
it('[TC-FE-PASSWORD-04] signs in using a username or email and displays server rejection safely', async () => {
  const fetch = await signedOut('/login')
  await userEvent.click(screen.getByRole('button', { name: 'Log in', exact: true }))
  expect(screen.getByRole('alert')).toHaveTextContent('Enter your username or email and password')
  await userEvent.type(screen.getByLabelText('Username or email'), user.email)
  await userEvent.type(screen.getByLabelText('Password'), 'synthetic rejected password')
  fetch.mockResolvedValueOnce(json({ error: { code: 'INVALID_CREDENTIALS', message: 'Username, email, or password is incorrect.' } }, 401))
  await userEvent.click(screen.getByRole('button', { name: 'Log in', exact: true }))
  expect(await screen.findByRole('alert')).toHaveTextContent('incorrect')
  expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument()
  fetch.mockResolvedValueOnce(json({ user }))
  await userEvent.click(screen.getByRole('button', { name: 'Log in', exact: true }))
  expect(await screen.findByRole('heading', { name: user.displayName })).toBeInTheDocument()
})
it('[TC-FE-PASSWORD-05] prevents duplicate submissions until the server confirms the session', async () => {
  const fetch = await signedOut('/login')
  let resolve
  fetch.mockReturnValueOnce(new Promise(done => { resolve = done }))
  await userEvent.type(screen.getByLabelText('Username or email'), user.username)
  await userEvent.type(screen.getByLabelText('Password'), 'synthetic password phrase')
  await userEvent.click(screen.getByRole('button', { name: 'Log in', exact: true }))
  expect(screen.getByLabelText('Password')).toBeDisabled()
  await userEvent.click(screen.getByRole('button', { name: 'Please wait…' }))
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
  resolve(json({ user }))
  expect(await screen.findByRole('heading', { name: user.displayName })).toBeInTheDocument()
})
it('[TC-FE-PASSWORD-06] counts Unicode code points for the minimum password length', async () => {
  const fetch = await signedOut('/register')
  const password = '🎮'.repeat(15)
  await registration(password)
  fetch.mockResolvedValueOnce(json({ user }, 201))
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
  expect(await screen.findByRole('heading', { name: user.displayName })).toBeInTheDocument()
  expect(JSON.parse(fetch.mock.calls[1][1].body).password).toBe(password)
})

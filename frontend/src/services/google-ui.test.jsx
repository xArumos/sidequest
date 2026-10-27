import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import App from '../App'
// The real App, GoogleSignIn component, and auth service run together.
// Only Google's external SDK and HTTP responses are synthetic.
const user = { id: 'synthetic-google-user', username: null, displayName: 'Synthetic Google Player', email: 'google-player@example.test', avatarUrl: '' }
const json = (body, status = 200) => new Response(JSON.stringify(body), { status })
let sdkCallback
let sdk
beforeEach(() => {
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'synthetic-google.apps.googleusercontent.com')
  sdk = {
    initialize: vi.fn(config => { sdkCallback = config.callback }),
    renderButton: vi.fn(container => {
      const button = document.createElement('button')
      button.textContent = 'Continue with Google'
      button.addEventListener('click', () => sdkCallback({ credential: 'synthetic-google-credential' }))
      container.replaceChildren(button)
    }),
    disableAutoSelect: vi.fn(),
  }
  vi.stubGlobal('google', { accounts: { id: sdk } })
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
const visit = path => render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
it('[TC-FE-GOOGLE-FLOW-01] signs in through the actual Google component and restores and logs out the cookie session', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(json({ user })).mockResolvedValueOnce(json({ user })).mockResolvedValueOnce(new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetch)
  const storage = vi.spyOn(Storage.prototype, 'setItem')
  const view = visit('/login')
  await userEvent.click(await screen.findByRole('button', { name: 'Continue with Google' }))
  expect(await screen.findByRole('heading', { name: user.displayName })).toBeInTheDocument()
  expect(fetch).toHaveBeenNthCalledWith(2, '/api/auth/google', expect.objectContaining({ method: 'POST', credentials: 'include', body: JSON.stringify({ credential: 'synthetic-google-credential' }) }))
  expect(storage).not.toHaveBeenCalled()
  view.unmount()
  visit('/profile')
  expect(await screen.findByRole('heading', { name: user.displayName })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Log out' }))
  expect(await screen.findByRole('heading', { name: 'Sign in to continue' })).toBeInTheDocument()
  expect(sdk.disableAutoSelect).toHaveBeenCalledTimes(1)
})
it('[TC-FE-GOOGLE-FLOW-02] exposes Google rejection and preserves the password login alternative', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(json({ error: { code: 'INVALID_GOOGLE_TOKEN', message: 'Google sign-in could not be verified.' } }, 401)))
  visit('/register')
  await userEvent.click(await screen.findByRole('button', { name: 'Continue with Google' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('could not be verified')
  expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled()
  expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument()
  expect(screen.getByLabelText('Password', { exact: true })).toBeEnabled()
})
it('[TC-FE-GOOGLE-FLOW-03] ignores duplicate SDK callbacks while the session request is pending', async () => {
  let resolve
  const fetch = vi.fn().mockResolvedValueOnce(json({}, 401)).mockReturnValueOnce(new Promise(done => { resolve = done }))
  vi.stubGlobal('fetch', fetch)
  visit('/login')
  await screen.findByRole('button', { name: 'Continue with Google' })
  act(() => {
    sdkCallback({ credential: 'synthetic-google-credential' })
    sdkCallback({ credential: 'synthetic-google-credential' })
  })
  expect(screen.getByLabelText('Password')).toBeDisabled()
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
  await act(async () => { resolve(json({ user })); await Promise.resolve() })
  expect(await screen.findByRole('heading', { name: user.displayName })).toBeInTheDocument()
})

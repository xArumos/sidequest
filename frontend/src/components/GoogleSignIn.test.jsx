import { render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import GoogleSignIn from './GoogleSignIn'
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
it('[TC-FE-GOOGLE-01] hides Google configuration notices when sign-in is unconfigured', () => {
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '')
  vi.stubEnv('SIDEQUEST_GOOGLE_CLIENT_ID', '')
  render(<GoogleSignIn onCredential={vi.fn()} />)
  expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeDisabled()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
it('[TC-FE-GOOGLE-02] initializes the official SDK and forwards credentials only while mounted', async () => {
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'public-client-id')
  const id = { initialize: vi.fn(), renderButton: vi.fn() }
  vi.stubGlobal('google', { accounts: { id } })
  const callback = vi.fn()
  const view = render(<GoogleSignIn onCredential={callback} />)
  await waitFor(() => expect(id.renderButton).toHaveBeenCalled())
  const options = id.initialize.mock.calls[0][0]
  expect(options.client_id).toBe('public-client-id')
  options.callback({ credential: 'token' })
  expect(callback).toHaveBeenCalledWith('token')
  view.unmount()
  options.callback({ credential: 'late-token' })
  expect(callback).toHaveBeenCalledTimes(1)
})
it('[TC-FE-GOOGLE-03] announces in-progress authentication', () => {
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'public-client-id')
  vi.stubGlobal('google', { accounts: { id: { initialize: vi.fn(), renderButton: vi.fn() } } })
  render(<GoogleSignIn busy onCredential={vi.fn()} />)
  expect(screen.getByRole('status')).toHaveTextContent('Signing in')
})

it('[TC-FE-GOOGLE-12] initializes Google with the shared public backend client ID', async () => {
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '')
  vi.stubEnv('SIDEQUEST_GOOGLE_CLIENT_ID', 'synthetic-shared.apps.googleusercontent.com')
  const id = { initialize: vi.fn(), renderButton: vi.fn() }
  vi.stubGlobal('google', { accounts: { id } })
  render(<GoogleSignIn onCredential={vi.fn()} />)
  await waitFor(() => expect(id.initialize).toHaveBeenCalled())
  expect(id.initialize.mock.calls[0][0].client_id).toBe('synthetic-shared.apps.googleusercontent.com')
  expect(id.initialize.mock.calls[0][0].auto_select).toBe(false)
})

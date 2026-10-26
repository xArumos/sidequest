import { render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import GoogleSignIn from './GoogleSignIn'
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
it('explains unavailable configuration without showing a fake login', () => {
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '')
  render(<GoogleSignIn onCredential={vi.fn()} />)
  expect(screen.getByRole('status')).toHaveTextContent('unavailable')
})
it('initializes the official SDK and forwards credentials only while mounted', async () => {
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
it('announces in-progress authentication', () => {
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'public-client-id')
  vi.stubGlobal('google', { accounts: { id: { initialize: vi.fn(), renderButton: vi.fn() } } })
  render(<GoogleSignIn busy onCredential={vi.fn()} />)
  expect(screen.getByRole('status')).toHaveTextContent('Signing in')
})

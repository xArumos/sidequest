import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react'
import { vi } from 'vitest'

beforeEach(() => { vi.resetModules(); vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'synthetic-client-id') })
afterEach(() => {
  cleanup()
  document.querySelectorAll('script[src="https://accounts.google.com/gsi/client"]').forEach(script => script.remove())
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})
it('[TC-FE-GOOGLE-04] reports SDK network failure and allows a fresh load on remount', async () => {
  const { default: GoogleSignIn } = await import('./GoogleSignIn')
  const first = render(<GoogleSignIn onCredential={vi.fn()} />)
  const script = document.querySelector('script[src="https://accounts.google.com/gsi/client"]')
  fireEvent.error(script)
  expect(await screen.findByRole('alert')).toHaveTextContent('could not load')
  expect(script).not.toBeInTheDocument()
  first.unmount()
  render(<GoogleSignIn onCredential={vi.fn()} />)
  const retry = document.querySelector('script[src="https://accounts.google.com/gsi/client"]')
  expect(retry).not.toBe(script)
  const id = { initialize: vi.fn(), renderButton: vi.fn() }
  vi.stubGlobal('google', { accounts: { id } })
  fireEvent.load(retry)
  await waitFor(() => expect(id.renderButton).toHaveBeenCalledTimes(1))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
it('[TC-FE-GOOGLE-05] handles a script that loads without the expected SDK', async () => {
  const { default: GoogleSignIn } = await import('./GoogleSignIn')
  render(<GoogleSignIn onCredential={vi.fn()} />)
  fireEvent.load(document.querySelector('script[src="https://accounts.google.com/gsi/client"]'))
  expect(await screen.findByRole('alert')).toHaveTextContent('could not load')
})
it('[TC-FE-GOOGLE-06] avoids initializing the SDK after its component unmounts', async () => {
  const { default: GoogleSignIn } = await import('./GoogleSignIn')
  const view = render(<GoogleSignIn onCredential={vi.fn()} />)
  const script = document.querySelector('script[src="https://accounts.google.com/gsi/client"]')
  view.unmount()
  const id = { initialize: vi.fn(), renderButton: vi.fn() }
  vi.stubGlobal('google', { accounts: { id } })
  fireEvent.load(script)
  await Promise.resolve()
  expect(id.initialize).not.toHaveBeenCalled()
})
it('[TC-FE-GOOGLE-07] calls the latest credential callback after a parent rerender', async () => {
  const { default: GoogleSignIn } = await import('./GoogleSignIn')
  const id = { initialize: vi.fn(), renderButton: vi.fn() }
  vi.stubGlobal('google', { accounts: { id } })
  const oldCallback = vi.fn()
  const newCallback = vi.fn()
  const view = render(<GoogleSignIn onCredential={oldCallback} />)
  await waitFor(() => expect(id.initialize).toHaveBeenCalled())
  view.rerender(<GoogleSignIn onCredential={newCallback} />)
  id.initialize.mock.calls[0][0].callback({ credential: 'synthetic-token' })
  expect(newCallback).toHaveBeenCalledWith('synthetic-token')
  expect(oldCallback).not.toHaveBeenCalled()
})

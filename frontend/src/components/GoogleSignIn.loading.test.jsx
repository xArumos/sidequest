import { render, screen, waitFor, fireEvent, cleanup, act } from '@testing-library/react'
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
it('[TC-FE-GOOGLE-08] retries SDK loading in place without leaving the login page', async () => {
  const { default: GoogleSignIn } = await import('./GoogleSignIn')
  render(<GoogleSignIn onCredential={vi.fn()} />)
  const first = document.querySelector('script[src="https://accounts.google.com/gsi/client"]')
  fireEvent.error(first)
  await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button', { name: 'Retry Google sign-in' }))
  const retry = document.querySelector('script[src="https://accounts.google.com/gsi/client"]')
  expect(retry).not.toBe(first)
  const id = { initialize: vi.fn(), renderButton: vi.fn() }
  vi.stubGlobal('google', { accounts: { id } })
  fireEvent.load(retry)
  await waitFor(() => expect(id.renderButton).toHaveBeenCalledTimes(1))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
it('[TC-FE-GOOGLE-09] prevents callbacks while another authentication request is pending', async () => {
  const { default: GoogleSignIn } = await import('./GoogleSignIn')
  const id = { initialize: vi.fn(), renderButton: vi.fn() }
  vi.stubGlobal('google', { accounts: { id } })
  const callback = vi.fn()
  const view = render(<GoogleSignIn busy onCredential={callback} />)
  await waitFor(() => expect(id.initialize).toHaveBeenCalled())
  id.initialize.mock.calls[0][0].callback({ credential: 'synthetic-token' })
  expect(callback).not.toHaveBeenCalled()
  view.rerender(<GoogleSignIn busy={false} onCredential={callback} />)
  id.initialize.mock.calls[0][0].callback({ credential: 'synthetic-token' })
  expect(callback).toHaveBeenCalledTimes(1)
})
it('[TC-FE-GOOGLE-10] rejects an empty SDK credential without attempting authentication', async () => {
  const { default: GoogleSignIn } = await import('./GoogleSignIn')
  const id = { initialize: vi.fn(), renderButton: vi.fn() }
  vi.stubGlobal('google', { accounts: { id } })
  const callback = vi.fn()
  render(<GoogleSignIn onCredential={callback} />)
  await waitFor(() => expect(id.initialize).toHaveBeenCalled())
  act(() => id.initialize.mock.calls[0][0].callback({ credential: '' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('did not return a sign-in credential')
  expect(callback).not.toHaveBeenCalled()
})

it('[TC-FE-GOOGLE-11] times out a stalled SDK request and offers retry', async () => {
  vi.useFakeTimers()
  try {
    const { default: GoogleSignIn } = await import('./GoogleSignIn')
    render(<GoogleSignIn onCredential={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading Google sign-in')
    await act(async () => { await vi.advanceTimersByTimeAsync(15000) })
    expect(screen.getByRole('alert')).toHaveTextContent('could not load')
    expect(screen.getByRole('button', { name: 'Retry Google sign-in' })).toBeEnabled()
  } finally { vi.useRealTimers() }
})

import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import GoogleSignIn from './GoogleSignIn'

afterEach(() => { cleanup(); delete window.google; vi.unstubAllEnvs() })

it('uses the configured Google client and forwards the credential callback', async () => {
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'example.apps.googleusercontent.com')
  const initialize = vi.fn()
  const renderButton = vi.fn()
  window.google = { accounts: { id: { initialize, renderButton } } }
  const onCredential = vi.fn()
  const { rerender } = render(<GoogleSignIn onCredential={onCredential} disabled={false} />)
  await waitFor(() => expect(initialize).toHaveBeenCalled())
  const config = initialize.mock.calls[0][0]
  expect(config.client_id).toBe('example.apps.googleusercontent.com')
  expect(config.auto_select).toBe(false)
  config.callback({ credential: 'signed-token' })
  expect(onCredential).toHaveBeenCalledWith('signed-token')
  const latestCallback = vi.fn()
  rerender(<GoogleSignIn onCredential={latestCallback} disabled />)
  config.callback({ credential: 'another-token' })
  expect(latestCallback).toHaveBeenCalledWith('another-token')
  expect(renderButton.mock.calls[0][0]).toHaveAttribute('inert')
})

it('offers a password fallback if the Google script cannot load', async () => {
  render(<GoogleSignIn onCredential={vi.fn()} disabled={false} />)
  document.querySelector('script[src="https://accounts.google.com/gsi/client"]').dispatchEvent(new Event('error'))
  expect(await screen.findByRole('alert')).toHaveTextContent('You can still use a password.')
})

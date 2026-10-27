import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AuthPanel from './AuthPanel'
import { authRequest } from '../auth-api'

vi.mock('../auth-api', () => ({ authRequest: vi.fn() }))
beforeEach(() => vi.stubEnv('VITE_GOOGLE_CLIENT_ID', ''))
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllEnvs() })
const user = { id: '1', username: 'player', displayName: 'player', email: 'player@example.com' }
async function signedOut() {
  authRequest.mockRejectedValueOnce(Object.assign(new Error('Please sign in.'), { status: 401 }))
  render(<AuthPanel />)
  await screen.findByRole('button', { name: 'Log in' })
  return userEvent.setup()
}

describe('AuthPanel', () => {
  it('restores an existing session and logs out', async () => {
    authRequest.mockResolvedValueOnce({ user }).mockResolvedValueOnce(null)
    const actor = userEvent.setup()
    render(<AuthPanel />)
    expect(await screen.findByText('Welcome, player')).toBeInTheDocument()
    await actor.click(screen.getByRole('button', { name: 'Log out' }))
    expect(await screen.findByRole('button', { name: 'Log in' })).toBeInTheDocument()
    expect(authRequest).toHaveBeenLastCalledWith('/logout', {})
  })

  it('registers with confirmation and shows the signed-in user', async () => {
    const actor = await signedOut()
    await actor.click(screen.getByRole('button', { name: /New here/ }))
    await actor.type(screen.getByLabelText('Username'), 'player')
    await actor.type(screen.getByLabelText('Email'), user.email)
    await actor.type(screen.getByLabelText('Password', { exact: true }), 'a long test password')
    await actor.type(screen.getByLabelText('Confirm password'), 'does not match')
    await actor.click(screen.getByRole('button', { name: 'Create account' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match.')
    expect(authRequest).toHaveBeenCalledTimes(1)
    await actor.clear(screen.getByLabelText('Confirm password'))
    await actor.type(screen.getByLabelText('Confirm password'), 'a long test password')
    authRequest.mockResolvedValueOnce({ user })
    await actor.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText('Welcome, player')).toBeInTheDocument()
    expect(authRequest).toHaveBeenLastCalledWith('/register', { username: 'player', email: user.email, password: 'a long test password' })
  })

  it('submits login identifiers and displays server errors', async () => {
    const actor = await signedOut()
    await actor.type(screen.getByLabelText('Username or email'), user.email)
    await actor.type(screen.getByLabelText('Password'), 'wrong password')
    authRequest.mockRejectedValueOnce(new Error('Username, email, or password is incorrect.'))
    await actor.click(screen.getByRole('button', { name: 'Log in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Username, email, or password is incorrect.')
    expect(authRequest).toHaveBeenLastCalledWith('/login', { identifier: user.email, password: 'wrong password' })
    expect(screen.getByRole('button', { name: 'Log in' })).toBeEnabled()
  })

  it('retains the account on a failed logout', async () => {
    authRequest.mockResolvedValueOnce({ user }).mockRejectedValueOnce(new Error('Unable to reach SideQuest.'))
    render(<AuthPanel />)
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole('button', { name: 'Log out' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach SideQuest.')
    expect(screen.getByText('Welcome, player')).toBeInTheDocument()
  })
})

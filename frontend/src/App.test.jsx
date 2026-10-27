import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import App from './App'
import { auth, ApiError } from './services/auth'

vi.mock('./services/auth', async importOriginal => ({
  ...await importOriginal(), auth: { me: vi.fn(), login: vi.fn(), logout: vi.fn() },
}))
vi.mock('./components/GoogleSignIn', () => ({ default: ({ onCredential, busy }) =>
  <button disabled={busy} onClick={() => onCredential('google-test-credential')}>Continue with Google</button>,
}))
const user = { id: 'user-1', displayName: 'Synthetic Player', email: 'player@example.test', avatarUrl: '' }
function visit(path = '/') {
  render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
}
beforeEach(() => {
  vi.resetAllMocks()
  auth.me.mockRejectedValue(new ApiError('Please sign in.', 401))
})

it('[TC-FE-APP-01] has one pair of homepage authentication links and no fixture statistics', async () => {
  visit()
  await screen.findByRole('heading', { name: /rate, review, and track/i })
  expect(screen.getAllByRole('link', { name: /^join now$/i })).toHaveLength(1)
  expect(screen.getAllByRole('link', { name: /^log in$/i })).toHaveLength(1)
  expect(screen.queryByText('Elden Ring')).not.toBeInTheDocument()
  expect(screen.queryByText('1.7k')).not.toBeInTheDocument()
})
it('[TC-LOGIN-01] waits for session restoration before redirecting protected routes', async () => {
  let resolve
  auth.me.mockReturnValue(new Promise(done => { resolve = done }))
  visit('/profile')
  expect(screen.getByRole('status')).toHaveTextContent('Checking your session')
  resolve(user)
  expect(await screen.findByRole('heading', { name: user.displayName })).toBeInTheDocument()
})
it('[TC-FE-APP-04] redirects signed-out users to the real sign-in flow', async () => {
  visit('/wishlist')
  expect(await screen.findByRole('heading', { name: /sign in to continue/i })).toBeInTheDocument()
  expect(screen.getByLabelText('Password')).toBeInTheDocument()
})
it('[TC-FE-APP-06] creates account through the same Google authentication contract', async () => {
  auth.login.mockResolvedValue(user)
  visit('/register')
  await userEvent.click(await screen.findByRole('button', { name: /continue with google/i }))
  expect(auth.login).toHaveBeenCalledWith('google-test-credential')
  expect(await screen.findByRole('heading', { name: user.displayName })).toBeInTheDocument()
})
it('[TC-FE-APP-08] retains sign-in errors without pretending authentication succeeded', async () => {
  auth.login.mockRejectedValue(new ApiError('Google sign-in could not be verified.', 401))
  visit('/login')
  await userEvent.click(await screen.findByRole('button', { name: /continue with google/i }))
  expect(await screen.findByRole('alert')).toHaveTextContent('could not be verified')
  expect(screen.queryByRole('button', { name: /log out/i })).not.toBeInTheDocument()
})
it('[TC-LOGIN-02] keeps the account visible when logout fails and clears it on successful retry', async () => {
  auth.me.mockResolvedValue(user)
  auth.logout.mockRejectedValueOnce(new ApiError('Cannot reach SideQuest.', 0)).mockResolvedValueOnce(null)
  visit('/profile')
  await screen.findByRole('heading', { name: user.displayName })
  await userEvent.click(screen.getByRole('button', { name: /log out/i }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach')
  expect(screen.getByRole('heading', { name: user.displayName })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /log out/i }))
  expect(await screen.findByRole('heading', { name: /sign in to continue/i })).toBeInTheDocument()
})
it('[TC-FE-APP-12] allows retry after a session connection failure', async () => {
  auth.me.mockRejectedValueOnce(new ApiError('Cannot reach SideQuest.', 0)).mockResolvedValueOnce(user)
  visit('/profile')
  await userEvent.click(await screen.findByRole('button', { name: /retry connection/i }))
  expect(await screen.findByRole('heading', { name: user.displayName })).toBeInTheDocument()
})
it('[TC-FE-APP-14] resets catalog filters and distinguishes unavailable data from an empty library', async () => {
  visit('/games')
  const search = await screen.findByRole('searchbox')
  await userEvent.type(search, 'a game')
  await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort games/i }), 'reviews')
  await userEvent.click(screen.getByRole('button', { name: /reset filters/i }))
  expect(search).toHaveValue('')
  expect(screen.getByRole('combobox', { name: /sort games/i })).toHaveValue('title')
  expect(screen.getByRole('heading', { name: /catalog unavailable/i })).toBeInTheDocument()
})
it.each([[1, '/users/unknown'], [2, '/users/u1'], [3, '/users/u2']])('[TC-FE-PRIVACY-01-%d] never shows fixture or private profile data', async (_case, path) => {
  visit(path)
  expect(await screen.findByRole('heading', { name: /public profile unavailable/i })).toBeInTheDocument()
  expect(screen.queryByText('Alex Morgan')).not.toBeInTheDocument()
  expect(screen.queryByText('Sam Rivera')).not.toBeInTheDocument()
})
it.each([['WISHLIST', '/wishlist', 'Wishlist unavailable'], ['BACKLOG', '/backlog', 'Backlog unavailable'], ['DETAIL', '/games/unknown', 'Game unavailable']])('[TC-FE-UNAVAILABLE-%s] shows the unavailable state', async (_feature, path, heading) => {
  auth.me.mockResolvedValue(user)
  visit(path)
  expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
})
it('[TC-FE-APP-16] disables profile changes and privacy controls without persistence', async () => {
  auth.me.mockResolvedValue(user)
  visit('/profile/edit')
  expect(await screen.findByRole('button', { name: /save changes/i })).toBeDisabled()
  expect(screen.getByRole('combobox', { name: /wishlist visibility/i })).toBeDisabled()
})
it('[TC-FE-APP-18] handles unmatched routes', async () => {
  visit('/missing')
  expect(await screen.findByRole('heading', { name: /page not found/i })).toBeInTheDocument()
  await waitFor(() => expect(auth.me).toHaveBeenCalledTimes(1))
})
it('[TC-FE-APP-20] lets users select most-reviewed rankings without showing invented results', async () => {
  visit('/rankings')
  const ranking = await screen.findByRole('combobox', { name: /rank games by/i })
  await userEvent.selectOptions(ranking, 'reviews')
  expect(ranking).toHaveValue('reviews')
  expect(screen.getByText(/rankings are unavailable until/i)).toBeInTheDocument()
  expect(screen.queryByText(/1,740/)).not.toBeInTheDocument()
})
it('[TC-FE-APP-22] clears a stale account when session retry reports expiration', async () => {
  auth.me.mockResolvedValueOnce(user).mockRejectedValueOnce(new ApiError('Please sign in.', 401))
  auth.logout.mockRejectedValueOnce(new ApiError('Cannot reach SideQuest.', 0))
  visit('/profile')
  await screen.findByRole('heading', { name: user.displayName })
  await userEvent.click(screen.getByRole('button', { name: /log out/i }))
  await userEvent.click(await screen.findByRole('button', { name: /retry connection/i }))
  expect(await screen.findByRole('heading', { name: /sign in to continue/i })).toBeInTheDocument()
  expect(screen.queryByText(user.email)).not.toBeInTheDocument()
})

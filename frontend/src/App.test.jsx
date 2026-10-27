import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import App from './App'
import { auth, ApiError } from './services/auth'
import { api } from './services/api'

vi.mock('./services/auth', async importOriginal => ({
  ...await importOriginal(), auth: { me: vi.fn(), login: vi.fn(), logout: vi.fn() },
}))
vi.mock('./services/api', async () => ({ api: (await import('./test/apiMock')).createApiMock() }))
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
const celeste = {
  id: 'a'.repeat(24), title: 'Celeste', slug: 'celeste', coverUrl: '', genres: ['Platform', 'Indie'], platforms: ['PC'],
  releaseDate: '2018-01-25T00:00:00.000Z', ratingAvg: 4.5, ratingCount: 4,
}
const page = games => ({ games, total: games.length, page: 1, pages: games.length ? 1 : 0 })
const lastCall = mock => mock.mock.calls.at(-1)[0]

it('[TC-FE-APP-14] loads the catalog and sends search, filter, and sort changes to the API', async () => {
  api.games.mockResolvedValue(page([celeste]))
  api.gameFilters.mockResolvedValue({ genres: ['Indie', 'Platform'], platforms: ['PC', 'Switch'] })
  visit('/games')
  expect(await screen.findByRole('heading', { name: 'Celeste' })).toBeInTheDocument()
  expect(screen.getByText('1 game found')).toBeInTheDocument()
  expect(lastCall(api.games)).toMatchObject({ q: '', genre: '', platform: '', sort: 'title', page: 1 })

  await userEvent.type(screen.getByRole('searchbox'), 'cel')
  await waitFor(() => expect(lastCall(api.games)).toMatchObject({ q: 'cel' }))
  await userEvent.selectOptions(await screen.findByRole('combobox', { name: /filter by genre/i }), 'Indie')
  await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort games/i }), 'top')
  await waitFor(() => expect(lastCall(api.games)).toMatchObject({ q: 'cel', genre: 'Indie', sort: 'top' }))

  await userEvent.click(screen.getByRole('button', { name: /reset filters/i }))
  expect(screen.getByRole('searchbox')).toHaveValue('')
  expect(screen.getByRole('combobox', { name: /sort games/i })).toHaveValue('title')
  await waitFor(() => expect(lastCall(api.games)).toMatchObject({ q: '', genre: '', sort: 'title' }))
})
it('[TC-SORT-03] shows an empty result instead of an error when nothing matches', async () => {
  visit('/games')
  expect(await screen.findByRole('heading', { name: /no games match/i })).toBeInTheDocument()
})
it('[TC-FE-APP-15] sends signed-out visitors to log in when they try to wishlist a game', async () => {
  api.games.mockResolvedValue(page([celeste]))
  visit('/games')
  await userEvent.click(await screen.findByRole('button', { name: '+ Wishlist' }))
  expect(await screen.findByRole('heading', { name: /sign in to continue/i })).toBeInTheDocument()
  expect(api.saveLog).not.toHaveBeenCalled()
})
it('[TC-USRDATA-01] adds a game to the wishlist from the catalog for a signed-in user', async () => {
  auth.me.mockResolvedValue(user)
  api.games.mockResolvedValue(page([celeste]))
  api.saveLog.mockResolvedValue({ log: { id: 'log-1', game: celeste.id, status: 'wishlist' } })
  visit('/games')
  await userEvent.click(await screen.findByRole('button', { name: '+ Wishlist' }))
  expect(api.saveLog).toHaveBeenCalledWith(celeste.id, { status: 'wishlist' })
  expect(await screen.findByRole('button', { name: 'Wishlisted' })).toHaveAttribute('aria-pressed', 'true')
})
it('[TC-RATE-01] submits a rating and review from the game page and refreshes the game', async () => {
  auth.me.mockResolvedValue(user)
  api.game.mockResolvedValue({ game: { ...celeste, summary: 'Climb the mountain.', reviewCount: 0 } })
  api.saveLog.mockResolvedValue({ log: { id: 'log-1', game: celeste.id, rating: 4, text: 'Tough.' } })
  visit(`/games/${celeste.id}`)
  expect(await screen.findByRole('heading', { name: 'Celeste' })).toBeInTheDocument()
  expect(screen.getByText('Based on 4 community ratings')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Rate 4 stars' }))
  await userEvent.type(screen.getByRole('textbox'), 'Tough.')
  const loads = api.game.mock.calls.length
  await userEvent.click(screen.getByRole('button', { name: /submit review/i }))
  expect(api.saveLog).toHaveBeenCalledWith(celeste.id, { rating: 4, text: 'Tough.' })
  await waitFor(() => expect(api.game.mock.calls.length).toBeGreaterThan(loads))
})
it('[TC-RATE-03] deletes the signed-in user’s own review', async () => {
  auth.me.mockResolvedValue(user)
  api.game.mockResolvedValue({ game: { ...celeste, summary: '', reviewCount: 1 } })
  api.myLog.mockResolvedValue({ log: { id: 'log-1', game: celeste.id, rating: 5, text: 'Loved it.', status: null } })
  visit(`/games/${celeste.id}`)
  await userEvent.click(await screen.findByRole('button', { name: /delete my review/i }))
  expect(api.deleteLog).toHaveBeenCalledWith('log-1')
})
it('[TC-FE-APP-17] shows public reviews with links to the reviewer profiles', async () => {
  api.game.mockResolvedValue({ game: { ...celeste, summary: '', reviewCount: 1 } })
  api.reviews.mockResolvedValue({ reviews: [{ id: 'r1', rating: 3, text: 'Fine.', createdAt: '2026-10-01T00:00:00.000Z',
    user: { id: 'u2', displayName: 'Other Player', username: null, avatarUrl: '' } }], total: 1, page: 1, pages: 1 })
  visit(`/games/${celeste.id}`)
  expect(await screen.findByRole('link', { name: 'Other Player' })).toHaveAttribute('href', '/users/u2')
  expect(screen.getByText('Fine.')).toBeInTheDocument()
  expect(screen.getByText(/to rate this game or add it to your lists/i)).toBeInTheDocument()
})
it('[TC-FE-PRIVACY-01] shows a private wishlist as private without listing its games', async () => {
  api.user.mockResolvedValue({ user: { id: 'u2', displayName: 'Other Player', username: 'other', avatarUrl: '', bio: '', wishlistVisibility: 'private' } })
  api.userWishlist.mockRejectedValue(new ApiError("This user's wishlist is private.", 403, 'WISHLIST_PRIVATE'))
  visit('/users/u2')
  expect(await screen.findByRole('heading', { name: 'Other Player' })).toBeInTheDocument()
  expect(await screen.findByText('This wishlist is private.')).toBeInTheDocument()
})
it('[TC-WISH-01] shows a public wishlist and the player’s history', async () => {
  api.user.mockResolvedValue({ user: { id: 'u2', displayName: 'Other Player', username: null, avatarUrl: '', bio: '', wishlistVisibility: 'public' } })
  api.userWishlist.mockResolvedValue({ logs: [{ id: 'l1', game: celeste, status: 'wishlist' }], total: 1, page: 1, pages: 1 })
  api.userLogs.mockResolvedValue({ logs: [{ id: 'l2', game: { ...celeste, id: 'b'.repeat(24), title: 'Hades' }, rating: 5, text: '', status: 'played', updatedAt: '2026-10-01T00:00:00.000Z' }], total: 1, page: 1, pages: 1 })
  visit('/users/u2')
  expect(await screen.findByRole('link', { name: 'Celeste' })).toBeInTheDocument()
  expect(await screen.findByRole('link', { name: 'Hades' })).toBeInTheDocument()
})
it('[TC-FE-PRIVACY-02] reports an unknown player', async () => {
  visit('/users/unknown')
  expect(await screen.findByRole('heading', { name: /player not found/i })).toBeInTheDocument()
})
it.each([['wishlist', '/wishlist'], ['backlog', '/backlog']])('[TC-USRDATA-02-%s] lists the %s and removes a game from it', async (status, path) => {
  auth.me.mockResolvedValue(user)
  api.myLogs.mockImplementation(async ({ status: requested } = {}) => (requested === status
    ? { logs: [{ id: 'l1', game: celeste, status }], total: 1, page: 1, pages: 1 }
    : { logs: [], total: 0, page: 1, pages: 0 }))
  visit(path)
  await userEvent.click(await screen.findByRole('button', { name: `Remove from ${status}` }))
  expect(api.saveLog).toHaveBeenCalledWith(celeste.id, { status: null })
})
it('[TC-FE-UNAVAILABLE-DETAIL] reports a game that is not in the catalog', async () => {
  visit('/games/unknown')
  expect(await screen.findByRole('heading', { name: /game not found/i })).toBeInTheDocument()
})
it('[TC-FE-APP-16] saves wishlist visibility and confirms the server value', async () => {
  auth.me.mockResolvedValue(user)
  visit('/profile/edit')
  await userEvent.selectOptions(await screen.findByRole('combobox', { name: /wishlist visibility/i }), 'public')
  await userEvent.click(screen.getByRole('button', { name: /save changes/i }))
  expect(api.setWishlistVisibility).toHaveBeenCalledWith('public')
  expect(await screen.findByText(/your wishlist is now public/i)).toBeInTheDocument()
})
it('[TC-FE-APP-18] handles unmatched routes', async () => {
  visit('/missing')
  expect(await screen.findByRole('heading', { name: /page not found/i })).toBeInTheDocument()
  await waitFor(() => expect(auth.me).toHaveBeenCalledTimes(1))
})
it('[TC-SORT-02] ranks top-rated games by default and most-rated games on request', async () => {
  api.topGames.mockResolvedValue({ games: [celeste], minCount: 3 })
  api.games.mockResolvedValue(page([{ ...celeste, id: 'c'.repeat(24), title: 'Hades', ratingCount: 9 }]))
  visit('/rankings')
  expect(await screen.findByRole('heading', { name: 'Celeste' })).toBeInTheDocument()
  expect(screen.getByText(/at least 3 ratings/i)).toBeInTheDocument()
  await userEvent.selectOptions(screen.getByRole('combobox', { name: /rank games by/i }), 'popular')
  expect(await screen.findByRole('heading', { name: 'Hades' })).toBeInTheDocument()
  expect(lastCall(api.games)).toMatchObject({ sort: 'popular' })
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

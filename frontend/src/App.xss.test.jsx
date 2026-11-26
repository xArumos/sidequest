import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import App from './App'
import { auth, ApiError } from './services/auth'
import { api } from './services/api'

vi.mock('./services/auth', async importOriginal => ({
  ...await importOriginal(), auth: { me: vi.fn(), login: vi.fn(), logout: vi.fn() },
}))
vi.mock('./services/api', async () => ({ api: (await import('./test/apiMock')).createApiMock() }))
vi.mock('./components/GoogleSignIn', () => ({ default: () => null }))

// User-written fields must render as literal text, never as markup.
const payload = name => `<img src="x" data-xss="${name}" onerror="window.__xss='${name}'"><script>window.__xss='${name}'</script><b>${name}</b>`
const game = {
  id: 'a'.repeat(24), title: 'Celeste', slug: 'celeste', coverUrl: '', genres: ['Indie'], platforms: ['PC'],
  releaseDate: '2018-01-25T00:00:00.000Z', ratingAvg: 4, ratingCount: 1, summary: '', reviewCount: 1,
}
const user = { id: 'user-1', displayName: 'Synthetic Player', email: 'player@example.test', avatarUrl: '' }

function visit(path) {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>).container
}
function expectInert(container) {
  expect(container.querySelector('[data-xss], script, b')).toBeNull()
  expect(window.__xss).toBeUndefined()
}

beforeEach(() => {
  vi.resetAllMocks()
  delete window.__xss
  auth.me.mockRejectedValue(new ApiError('Please sign in.', 401))
})

it('[TC-FE-XSS-01] renders HTML in public and own review text as literal text', async () => {
  auth.me.mockResolvedValue(user)
  api.game.mockResolvedValue({ game })
  api.myLog.mockResolvedValue({ log: { id: 'log-1', game: game.id, rating: 4, text: payload('own-review'), status: null } })
  api.reviews.mockResolvedValue({ reviews: [{ id: 'r1', rating: 3, text: payload('review'), createdAt: '2026-10-01T00:00:00.000Z',
    user: { id: 'u2', displayName: payload('reviewer'), username: null, avatarUrl: '' } }], total: 1, page: 1, pages: 1 })
  const container = visit(`/games/${game.id}`)
  expect(await screen.findByText(payload('review'))).toBeInTheDocument()
  expect(screen.getByText(payload('own-review'))).toBeInTheDocument()
  expect(screen.getByText(payload('reviewer'))).toBeInTheDocument()
  expectInert(container)
})

it('[TC-FE-XSS-02] renders HTML in profile bios, names, and history as literal text', async () => {
  api.user.mockResolvedValue({ user: { id: 'u2', displayName: payload('name'), username: 'other', avatarUrl: '',
    bio: payload('bio'), wishlistVisibility: 'public' } })
  api.userLogs.mockResolvedValue({ logs: [{ id: 'l1', game, rating: 5, text: payload('history'), status: 'played',
    updatedAt: '2026-10-01T00:00:00.000Z' }], total: 1, page: 1, pages: 1 })
  const container = visit('/users/u2')
  expect(await screen.findByText(payload('bio'))).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: payload('name') })).toBeInTheDocument()
  expect(await screen.findByText(payload('history'))).toBeInTheDocument()
  expectInert(container)
})

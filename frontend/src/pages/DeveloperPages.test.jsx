import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import App from '../App'
import { auth, ApiError } from '../services/auth'
import { api } from '../services/api'

vi.mock('../services/auth', async importOriginal => ({
  ...await importOriginal(), auth: { me: vi.fn(), login: vi.fn(), logout: vi.fn() },
}))
vi.mock('../services/api', async () => ({ api: (await import('../test/apiMock')).createApiMock() }))
vi.mock('../components/GoogleSignIn', () => ({ default: () => null }))

const user = { id: 'user-1', displayName: 'Synthetic Player', email: 'player@example.test', avatarUrl: '', admin: false }
const celeste = {
  id: 'a'.repeat(24), title: 'Celeste', slug: 'celeste', coverUrl: '', genres: ['Platform'], platforms: ['PC'],
  releaseDate: null, ratingAvg: 4.5, ratingCount: 4, summary: '', reviewCount: 1,
}
const review = {
  id: 'r1', rating: 1, text: 'Spam link.', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
  user: { id: 'u2', displayName: 'Spammer', username: null, avatarUrl: '' }, game: { id: celeste.id, title: 'Celeste' },
}
const lastCall = mock => mock.mock.calls.at(-1)[0]
function visit(path) {
  render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
}
beforeEach(() => {
  vi.resetAllMocks()
  auth.me.mockResolvedValue(user)
  api.game.mockResolvedValue({ game: celeste })
})

describe('game page developer access (TC-DEV-01)', () => {
  it('requests developer access with a justification and shows the pending state', async () => {
    api.requestDeveloperAccess.mockResolvedValue({ request: { id: 'd1', status: 'pending' } })
    visit(`/games/${celeste.id}`)
    await userEvent.click(await screen.findByRole('button', { name: 'Request developer access' }))
    await userEvent.click(screen.getByRole('button', { name: 'Send request' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Tell us how you worked on this game.')
    expect(api.requestDeveloperAccess).not.toHaveBeenCalled()

    api.myDeveloperRequest.mockResolvedValue({ request: { id: 'd1', status: 'pending', requestedAt: '2026-11-01T12:00:00.000Z' } })
    await userEvent.type(screen.getByRole('textbox', { name: /how did you work/i }), '  Level designer.  ')
    await userEvent.click(screen.getByRole('button', { name: 'Send request' }))
    expect(api.requestDeveloperAccess).toHaveBeenCalledWith(celeste.id, 'Level designer.')
    expect(await screen.findByText(/developer access requested on .*waiting for approval/i)).toBeInTheDocument()
  })

  it('links approved developers to their reviews', async () => {
    api.myDeveloperRequest.mockResolvedValue({ request: { id: 'd1', status: 'approved' } })
    visit(`/games/${celeste.id}`)
    expect(await screen.findByRole('link', { name: 'Open developer reviews' })).toHaveAttribute('href', `/dev?gameId=${celeste.id}`)
  })

  it('does not offer developer access to signed-out visitors', async () => {
    auth.me.mockRejectedValue(new ApiError('Please sign in.', 401))
    visit(`/games/${celeste.id}`)
    await screen.findByRole('heading', { name: 'Celeste' })
    expect(screen.queryByRole('button', { name: 'Request developer access' })).not.toBeInTheDocument()
    expect(api.myDeveloperRequest).not.toHaveBeenCalled()
  })

  it('shows the author their removed review with the reason and no edit form', async () => {
    api.myLog.mockResolvedValue({ log: { id: 'log-1', game: celeste.id, rating: 1, text: 'Spam link.', status: null,
      removed: { at: '2026-11-02T00:00:00.000Z', reason: 'Off-topic advertising.' } } })
    visit(`/games/${celeste.id}`)
    expect(await screen.findByText(/a developer removed this review/i)).toHaveTextContent('Reason: Off-topic advertising.')
    expect(screen.queryByRole('button', { name: /submit review/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /delete my review/i })).toBeInTheDocument()
  })
})

describe('developer reviews page (TC-DEV-02, TC-DEV-03)', () => {
  beforeEach(() => {
    api.devGames.mockResolvedValue({ games: [celeste, { ...celeste, id: 'b'.repeat(24), title: 'Hades' }] })
    api.devReviews.mockResolvedValue({ reviews: [review], total: 1, page: 1, pages: 1 })
  })

  it('starts from the game in the link and sends filter changes to the API', async () => {
    visit(`/dev?gameId=${celeste.id}`)
    expect(await screen.findByText('Spam link.')).toBeInTheDocument()
    expect(lastCall(api.devReviews)).toMatchObject({ gameId: celeste.id, sort: 'newest', page: 1, limit: 20 })
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Minimum rating' }), '2')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Sort reviews' }), 'lowest')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Written text' }), 'true')
    await waitFor(() => expect(lastCall(api.devReviews)).toMatchObject({ minRating: '2', sort: 'lowest', hasText: 'true' }))

    const calls = api.devReviews.mock.calls.length
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Maximum rating' }), '1')
    expect(await screen.findByRole('alert')).toHaveTextContent('minimum rating must not be above the maximum')
    expect(api.devReviews.mock.calls.length).toBe(calls)

    await userEvent.click(screen.getByRole('button', { name: 'Reset filters' }))
    await waitFor(() => expect(lastCall(api.devReviews)).toMatchObject({ gameId: '', minRating: '', maxRating: '', sort: 'newest' }))
  })

  it('removes a review with a reason and reloads the list', async () => {
    api.removeReview.mockResolvedValue({ review: { id: 'r1' } })
    visit('/dev')
    await userEvent.click(await screen.findByRole('button', { name: 'Remove review by Spammer' }))
    const form = screen.getByRole('textbox', { name: /reason for removal/i }).closest('form')
    await userEvent.click(within(form).getByRole('button', { name: 'Remove review' }))
    expect(await within(form).findByRole('alert')).toHaveTextContent('Give a reason')

    api.devReviews.mockResolvedValue({ reviews: [], total: 0, page: 1, pages: 0 })
    await userEvent.type(screen.getByRole('textbox', { name: /reason for removal/i }), 'Spam.')
    await userEvent.click(within(form).getByRole('button', { name: 'Remove review' }))
    expect(api.removeReview).toHaveBeenCalledWith('r1', 'Spam.')
    expect(await screen.findByText('No reviews match these filters.')).toBeInTheDocument()
  })

  it('explains how to get access when the user develops no games', async () => {
    api.devGames.mockResolvedValue({ games: [] })
    visit('/dev')
    expect(await screen.findByRole('heading', { name: 'No developer access yet' })).toBeInTheDocument()
  })
})

describe('admin page (#93)', () => {
  const request = {
    id: 'd1', status: 'pending', justification: 'Lead designer.', requestedAt: '2026-11-01T00:00:00.000Z', decidedAt: null,
    decidedBy: null, user: { id: 'u3', displayName: 'Dana', username: null, avatarUrl: '' }, game: { id: celeste.id, title: 'Celeste' },
  }

  it('is hidden from users who are not admins', async () => {
    visit('/admin')
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument()
    expect(api.developerRequests).not.toHaveBeenCalled()
  })

  it('lets admins approve pending requests', async () => {
    auth.me.mockResolvedValue({ ...user, admin: true })
    api.developerRequests.mockResolvedValue({ requests: [request], total: 1, page: 1, pages: 1 })
    api.decideDeveloperRequest.mockResolvedValue({ request: { ...request, status: 'approved' } })
    visit('/admin')
    expect(await screen.findByText('Lead designer.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/admin')
    api.developerRequests.mockResolvedValue({ requests: [], total: 0, page: 1, pages: 0 })
    await userEvent.click(screen.getByRole('button', { name: 'Approve Dana for Celeste' }))
    expect(api.decideDeveloperRequest).toHaveBeenCalledWith('d1', 'approve')
    expect(await screen.findByText('No pending developer requests.')).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Request status' }), 'all')
    await waitFor(() => expect(lastCall(api.developerRequests)).toMatchObject({ status: 'all', page: 1 }))
  })
})

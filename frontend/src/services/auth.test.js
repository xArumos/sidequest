import { afterEach, expect, it, vi } from 'vitest'
import { auth } from './auth'
afterEach(() => vi.unstubAllGlobals())
const user = { id: 'a', displayName: 'Player', email: 'a@example.com' }
function respond(status, body) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body ? JSON.stringify(body) : null, { status })))
}
it('restores cookie sessions', async () => {
  respond(200, { user })
  expect(await auth.me()).toEqual(user)
  expect(fetch).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({ credentials: 'include' }))
})
it('posts the Google credential without storing a token', async () => {
  respond(200, { user })
  expect(await auth.login('credential')).toEqual(user)
  expect(fetch).toHaveBeenCalledWith('/api/auth/google', expect.objectContaining({ method: 'POST', credentials: 'include', body: JSON.stringify({ credential: 'credential' }) }))
})
it('handles logout with no JSON body', async () => {
  respond(204)
  expect(await auth.logout()).toBeNull()
  expect(fetch).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST', credentials: 'include' }))
})
it.each([401, 403, 429, 503])('preserves server errors (%d)', async status => {
  respond(status, { error: { message: 'Server message' } })
  await expect(auth.me()).rejects.toMatchObject({ message: 'Server message', status })
})
it('rejects invalid success responses', async () => {
  respond(200, {})
  await expect(auth.me()).rejects.toThrow('invalid account response')
})
it('handles network failure', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
  await expect(auth.me()).rejects.toMatchObject({ status: 0, message: expect.stringContaining('Cannot reach') })
})
it('preserves abort cancellation', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')))
  await expect(auth.me()).rejects.toMatchObject({ name: 'AbortError' })
})

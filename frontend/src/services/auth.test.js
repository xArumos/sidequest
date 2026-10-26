import { afterEach, expect, it, vi } from 'vitest'
import { auth } from './auth'
afterEach(() => vi.unstubAllGlobals())
const user = { id: 'a', displayName: 'Player', email: 'a@example.test' }
function respond(status, body) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body ? JSON.stringify(body) : null, { status })))
}
it('[TC-FE-AUTH-01] restores cookie sessions', async () => {
  respond(200, { user })
  expect(await auth.me()).toEqual(user)
  expect(fetch).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({ credentials: 'include' }))
})
it('[TC-FE-AUTH-02] posts the Google credential without storing a token', async () => {
  respond(200, { user })
  expect(await auth.login('credential')).toEqual(user)
  expect(fetch).toHaveBeenCalledWith('/api/auth/google', expect.objectContaining({ method: 'POST', credentials: 'include', body: JSON.stringify({ credential: 'credential' }) }))
})
it('[TC-FE-AUTH-03] handles logout with no JSON body', async () => {
  respond(204)
  expect(await auth.logout()).toBeNull()
  expect(fetch).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST', credentials: 'include' }))
})
it.each([401, 403, 429, 503])('[TC-FE-AUTH-STATUS-%d] preserves server errors', async status => {
  respond(status, { error: { message: 'Server message' } })
  await expect(auth.me()).rejects.toMatchObject({ message: 'Server message', status })
})
it('[TC-FE-AUTH-04] rejects invalid success responses', async () => {
  respond(200, {})
  await expect(auth.me()).rejects.toThrow('invalid account response')
})
it('[TC-FE-AUTH-05] handles network failure', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
  await expect(auth.me()).rejects.toMatchObject({ status: 0, message: expect.stringContaining('Cannot reach') })
})
it('[TC-FE-AUTH-06] preserves abort cancellation', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')))
  await expect(auth.me()).rejects.toMatchObject({ name: 'AbortError' })
})
it('[TC-FE-AUTH-11] rejects non-JSON error responses with a safe fallback message', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Synthetic gateway failure</html>', { status: 502 })))
  await expect(auth.me()).rejects.toMatchObject({ status: 502, message: 'SideQuest could not complete this request.' })
})
it('[TC-FE-AUTH-12] rejects malformed user fields rather than creating a partial account', async () => {
  for (const malformed of [{ id: {}, displayName: 'Synthetic', email: 'x@example.test' }, { id: 'x', displayName: 2, email: 'x@example.test' }, { id: 'x', displayName: 'Synthetic' }]) {
    respond(200, { user: malformed })
    await expect(auth.me()).rejects.toThrow('invalid account response')
  }
})
it('[TC-FE-AUTH-13] rejects an empty success body for session restoration', async () => {
  respond(204)
  await expect(auth.me()).rejects.toThrow('invalid account response')
})
it('[TC-FE-AUTH-14] normalizes a configured API base without changing cookie handling', async () => {
  vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test/')
  vi.resetModules()
  const configured = await import('./auth')
  respond(200, { user })
  expect(await configured.auth.me()).toEqual(user)
  expect(fetch).toHaveBeenCalledWith('https://api.example.test/api/auth/me', expect.objectContaining({ credentials: 'include' }))
  vi.unstubAllEnvs()
  vi.resetModules()
})

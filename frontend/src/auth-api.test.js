import { afterEach, expect, it, vi } from 'vitest'
import { authRequest } from './auth-api'

afterEach(() => vi.unstubAllGlobals())
it('sends JSON credentials and cookie sessions to the API', async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ user: { id: '1' } }) })
  vi.stubGlobal('fetch', fetch)
  expect(await authRequest('/login', { identifier: 'player', password: 'secret' })).toEqual({ user: { id: '1' } })
  expect(fetch).toHaveBeenCalledWith('http://localhost:5000/api/auth/login', expect.objectContaining({
    credentials: 'include', method: 'POST', body: JSON.stringify({ identifier: 'player', password: 'secret' }),
  }))
})
it('supports empty logout responses and reports connection errors', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, status: 204 }).mockRejectedValueOnce(new TypeError('Failed to fetch')))
  expect(await authRequest('/logout', {})).toBeNull()
  await expect(authRequest('/me')).rejects.toThrow('Unable to reach SideQuest.')
})

const baseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

async function request(path, options = {}) {
  let response
  try {
    response = await fetch(`${baseUrl}/api/auth/${path}`, {
      credentials: 'include',
      ...options,
      headers: { ...options.headers },
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new ApiError('Cannot reach SideQuest. Check your connection and try again.', 0)
  }
  if (response.status === 204 && path === 'logout') return null
  const result = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(result?.error?.message || 'SideQuest could not complete this request.', response.status)
  if (typeof result?.user?.id !== 'string' || !result.user.id.trim() || typeof result.user.displayName !== 'string' || typeof result.user.email !== 'string') {
    throw new ApiError('SideQuest returned an invalid account response. Please try again.', response.status)
  }
  return result.user
}

export const auth = {
  me: (signal) => request('me', { signal }),
  login: (credential) => request('google', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential }),
  }),
  logout: () => request('logout', { method: 'POST' }),
}

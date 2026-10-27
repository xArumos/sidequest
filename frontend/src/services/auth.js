const baseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message)
    this.status = status
    this.code = code
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
  if (!response.ok) {
    const code = result?.error?.code
    const message = ['AUTH_NOT_CONFIGURED', 'GOOGLE_NOT_CONFIGURED'].includes(code)
      ? 'Sign-in is temporarily unavailable. Please try again later.'
      : result?.error?.message || 'SideQuest could not complete this request.'
    throw new ApiError(message, response.status, code)
  }
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
  passwordLogin: (credentials) => request('login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials),
  }),
  register: (account) => request('register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(account),
  }),
  logout: () => request('logout', { method: 'POST' }),
}

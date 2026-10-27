import { ApiError } from './auth'

const baseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

async function request(path, { method = 'GET', body, signal } = {}) {
  let response
  try {
    response = await fetch(`${baseUrl}/api${path}`, {
      method,
      credentials: 'include',
      signal,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new ApiError('Cannot reach SideQuest. Check your connection and try again.', 0)
  }
  if (response.status === 204) return null
  const result = await response.json().catch(() => null)
  if (!response.ok) {
    const code = result?.error?.code
    const message = code === 'AUTH_NOT_CONFIGURED'
      ? 'Sign-in is temporarily unavailable. Please try again later.'
      : result?.error?.message || 'SideQuest could not complete this request.'
    throw new ApiError(message, response.status, code)
  }
  return result
}

function query(params) {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== '' && value !== null)
  return entries.length ? `?${new URLSearchParams(entries)}` : ''
}

const id = value => encodeURIComponent(value)

// Thin wrappers over the routes documented in PRs #28-#30.
export const api = {
  games: ({ q, genre, platform, sort, page, limit } = {}, signal) =>
    request(`/games${query({ q, genre, platform, sort, page, limit })}`, { signal }),
  gameFilters: signal => request('/games/filters', { signal }),
  topGames: (limit, signal) => request(`/games/top${query({ limit })}`, { signal }),
  game: (gameId, signal) => request(`/games/${id(gameId)}`, { signal }),
  reviews: (gameId, { page, limit } = {}, signal) => request(`/games/${id(gameId)}/reviews${query({ page, limit })}`, { signal }),
  myLog: (gameId, signal) => request(`/games/${id(gameId)}/log`, { signal }),
  saveLog: (gameId, changes) => request(`/games/${id(gameId)}/log`, { method: 'POST', body: changes }),
  deleteLog: logId => request(`/logs/${id(logId)}`, { method: 'DELETE' }),
  myLogs: ({ status, page, limit } = {}, signal) => request(`/me/logs${query({ status, page, limit })}`, { signal }),
  wishlistVisibility: signal => request('/me/wishlist-visibility', { signal }),
  setWishlistVisibility: wishlistVisibility =>
    request('/me/wishlist-visibility', { method: 'PATCH', body: { wishlistVisibility } }),
  user: (userId, signal) => request(`/users/${id(userId)}`, { signal }),
  userLogs: (userId, { page, limit } = {}, signal) => request(`/users/${id(userId)}/logs${query({ page, limit })}`, { signal }),
  userWishlist: (userId, { page, limit } = {}, signal) => request(`/users/${id(userId)}/wishlist${query({ page, limit })}`, { signal }),
}

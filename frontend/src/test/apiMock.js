import { vi } from 'vitest'

// Default responses for every catalog/library call, shaped like the real API.
// vi.fn(impl) keeps these defaults after vi.resetAllMocks(); override per test
// with mockResolvedValueOnce / mockRejectedValueOnce.
export const emptyGames = { games: [], total: 0, page: 1, pages: 0 }
const emptyLogs = { logs: [], total: 0, page: 1, pages: 0 }

export function createApiMock() {
  return {
    games: vi.fn(async () => emptyGames),
    gameFilters: vi.fn(async () => ({ genres: [], platforms: [] })),
    topGames: vi.fn(async () => ({ games: [], minCount: 3 })),
    game: vi.fn(async () => { throw Object.assign(new Error('Game not found.'), { status: 404, code: 'GAME_NOT_FOUND' }) }),
    reviews: vi.fn(async () => ({ reviews: [], total: 0, page: 1, pages: 0 })),
    myLog: vi.fn(async () => ({ log: null })),
    saveLog: vi.fn(async () => ({ log: null })),
    deleteLog: vi.fn(async () => null),
    myLogs: vi.fn(async () => emptyLogs),
    wishlistVisibility: vi.fn(async () => ({ wishlistVisibility: 'private' })),
    setWishlistVisibility: vi.fn(async wishlistVisibility => ({ wishlistVisibility })),
    user: vi.fn(async () => { throw Object.assign(new Error('User not found.'), { status: 404, code: 'USER_NOT_FOUND' }) }),
    userLogs: vi.fn(async () => emptyLogs),
    userWishlist: vi.fn(async () => emptyLogs),
  }
}

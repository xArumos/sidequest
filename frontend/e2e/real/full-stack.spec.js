import { test as base, expect } from '@playwright/test'
import seed from '../../../server/test/e2e/seed.js'

// Runs against the real API and an in-memory MongoDB seeded from
// server/test/e2e/seed.js (see playwright.e2e.config.js). No routes are mocked.
// Specs share the database, so each one uses a user and game no other spec writes.

const byKey = list => Object.fromEntries(list.map(item => [item.key, item]))
const users = byKey(seed.users)
const games = byKey(seed.games)

// Fails any test whose page throws an uncaught error.
const test = base.extend({
  // Named `runTest`, not `use`, so the React hooks lint rule does not misfire.
  page: async ({ page }, runTest) => {
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await runTest(page)
    expect(errors, 'uncaught page errors').toEqual([])
  },
})

async function logIn(page, user) {
  await page.goto('/login')
  await page.getByLabel('Username or email').fill(user.username)
  await page.getByLabel('Password').fill(user.password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(/\/profile$/)
  await expect(page.getByRole('heading', { level: 1, name: user.displayName })).toBeVisible()
}

test('[TC-E2E-01] a visitor browses the seeded catalog and opens a game', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Games' }).click()
  await expect(page.getByRole('heading', { name: 'Game Discovery' })).toBeVisible()
  await expect(page.getByRole('status')).toHaveText(`${seed.games.length} games found`)
  for (const game of seed.games) await expect(page.getByRole('heading', { level: 3, name: game.title })).toBeVisible()

  // Sorting and filtering are answered by the real database queries.
  await page.getByRole('combobox', { name: 'Sort games' }).selectOption('top')
  await expect(page.locator('.game-card h3').first()).toHaveText(games.starfall.title)
  await page.getByRole('combobox', { name: 'Filter by genre' }).selectOption('Puzzle')
  await expect(page.getByRole('status')).toHaveText('1 game found')
  await page.getByRole('button', { name: 'Reset filters' }).click()
  await page.getByRole('searchbox', { name: 'Search games' }).fill('Harbor')
  await expect(page.getByRole('status')).toHaveText('1 game found')

  const card = page.locator('.game-card', { has: page.getByRole('heading', { name: games.harbor.title }) })
  await expect(card).toContainText('★ 4.0 · 1 rating')
  await card.getByRole('link', { name: 'View details' }).click()

  await expect(page.getByRole('heading', { level: 1, name: games.harbor.title })).toBeVisible()
  await expect(page.getByText(games.harbor.summary)).toBeVisible()
  await expect(page.locator('.rating-summary')).toContainText('4.0')
  await expect(page.locator('.rating-summary')).toContainText('Based on 1 community rating')
  await expect(page.getByRole('link', { name: users.grace.displayName })).toBeVisible()
  await expect(page.getByText('to rate this game or add it to your lists.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Submit review' })).toHaveCount(0)
})

test('[TC-E2E-02] a seeded reviewer has a public profile with their reviews', async ({ page }) => {
  await page.goto('/games')
  await page.getByRole('searchbox', { name: 'Search games' }).fill('Starfall')
  await expect(page.getByRole('status')).toHaveText('1 game found')
  await page.getByRole('link', { name: 'View details' }).click()
  await expect(page.getByText('Seeded review: a stellar journey.')).toBeVisible()
  await page.getByRole('link', { name: users.grace.displayName }).click()

  await expect(page.getByRole('heading', { level: 1, name: users.grace.displayName })).toBeVisible()
  await expect(page.getByText(`@${users.grace.username}`)).toBeVisible()
  const wishlist = page.locator('.card-panel', { has: page.getByRole('heading', { name: 'Wishlist' }) })
  await expect(wishlist.getByRole('link', { name: games.circuit.title })).toBeVisible()
  const history = page.locator('.card-panel', { has: page.getByRole('heading', { name: 'Played games and ratings' }) })
  await expect(history.getByRole('link', { name: games.ember.title })).toBeVisible()
  await expect(history.getByText('Seeded review: fun but repetitive.')).toBeVisible()
})

test('[TC-E2E-03] a password user rates and reviews a game, sees it on their profile, and logs out', async ({ page }) => {
  const ada = users.ada
  const game = games.circuit
  const reviewText = 'E2E review: clever puzzles and a calm soundtrack.'

  await page.goto('/login')
  await page.getByLabel('Username or email').fill(ada.username)
  await page.getByLabel('Password').fill('wrong-password-for-e2e-test')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)

  await logIn(page, ada)

  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Games' }).click()
  await page.getByRole('searchbox', { name: 'Search games' }).fill('Circuit')
  await expect(page.getByRole('status')).toHaveText('1 game found')
  await page.getByRole('link', { name: 'View details' }).click()
  await expect(page.getByRole('heading', { level: 1, name: game.title })).toBeVisible()
  await expect(page.locator('.rating-summary')).toContainText('No ratings yet')

  await page.getByRole('button', { name: 'Rate 4 stars' }).click()
  await page.getByLabel('Your review (optional)').fill(reviewText)
  await page.getByRole('button', { name: 'Submit review' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Review saved.' })).toBeVisible()

  await expect(page.getByRole('heading', { name: 'Update your review' })).toBeVisible()
  await expect(page.getByText('Your rating: ★★★★☆')).toBeVisible()
  await expect(page.locator('.rating-summary')).toContainText('4.0')
  await expect(page.locator('.rating-summary')).toContainText('Based on 1 community rating')
  const recent = page.locator('.card-panel', { has: page.getByRole('heading', { name: 'Recent reviews' }) })
  await expect(recent.getByRole('link', { name: ada.displayName })).toBeVisible()
  await expect(recent.getByLabel('4 out of 5 stars')).toBeVisible()
  await expect(recent.getByText(reviewText)).toBeVisible()

  // The review persisted in the database, not just in page state.
  await page.reload()
  await expect(page.getByText('Your rating: ★★★★☆')).toBeVisible()

  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Profile' }).click()
  await expect(page.getByRole('heading', { level: 1, name: ada.displayName })).toBeVisible()
  const history = page.locator('.card-panel', { has: page.getByRole('heading', { name: 'Played games and rating history' }) })
  await expect(history.getByRole('link', { name: game.title })).toBeVisible()
  await expect(history.getByLabel('4 out of 5 stars')).toBeVisible()
  await expect(history.getByText(reviewText)).toBeVisible()

  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('link', { name: 'Log in', exact: true }).first()).toBeVisible()
  // The server session is gone, so a reload stays signed out.
  await page.goto('/profile')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible()
})

// The browser cannot load Google's real SDK in tests, so this checks the stubbed
// verifier through the same proxy and session cookie the app uses.
test('[TC-E2E-04] Google sign-in is stubbed at the server boundary', async ({ request, baseURL }) => {
  const signIn = credential => request.post('/api/auth/google', { headers: { Origin: baseURL }, data: { credential } })
  expect((await signIn('not-a-stub-credential')).status()).toBe(401)

  const accepted = await signIn('google:e2e_player')
  expect(accepted.status()).toBe(200)
  const { user } = await accepted.json()
  expect(user).toMatchObject({ displayName: 'e2e_player', email: 'e2e_player@google.e2e.sidequest.test' })
  const me = await request.get('/api/auth/me')
  expect((await me.json()).user.id).toBe(user.id)
})

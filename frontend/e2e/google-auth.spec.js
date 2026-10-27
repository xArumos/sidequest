import { test, expect } from '@playwright/test'
const user = { id: 'synthetic-google-user', username: null, displayName: 'Synthetic Google Player', email: 'google-browser@example.test', avatarUrl: '' }
// External Google SDK only is simulated. Actual application components and API service execute.
const sdk = `window.google = { accounts: { id: {
  initialize(config) { this.callback = config.callback; },
  renderButton(container) {
    const button = document.createElement('button');
    button.textContent = 'Continue with Google';
    button.onclick = () => this.callback({ credential: 'synthetic-google-browser-credential' });
    container.replaceChildren(button);
  },
  disableAutoSelect() {}
} } };`
const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })
async function authRoutes(page, { rejectGoogle = false } = {}) {
  let authenticated = false
  const requests = []
  await page.route('**/api/auth/**', async route => {
    const path = new URL(route.request().url()).pathname
    requests.push(path)
    if (path.endsWith('/me')) return route.fulfill(authenticated ? json({ user }) : json({ error: { message: 'Please sign in.' } }, 401))
    if (path.endsWith('/google')) {
      expect(route.request().postDataJSON()).toEqual({ credential: 'synthetic-google-browser-credential' })
      if (rejectGoogle) return route.fulfill(json({ error: { code: 'INVALID_GOOGLE_TOKEN', message: 'Google sign-in could not be verified.' } }, 401))
      authenticated = true
      return route.fulfill(json({ user }))
    }
    if (path.endsWith('/logout')) { authenticated = false; return route.fulfill({ status: 204, body: '' }) }
    throw new Error(`Unexpected auth endpoint: ${path}`)
  })
  return requests
}
test('[TC-FE-GOOGLE-BROWSER-01] completes the Google callback session flow and refresh/logout at each viewport', async ({ page }) => {
  await page.route('https://accounts.google.com/gsi/client', route => route.fulfill({ contentType: 'text/javascript', body: sdk }))
  const requests = await authRoutes(page)
  await page.goto('/login')
  const google = page.getByRole('button', { name: 'Continue with Google' })
  await expect(google).toBeVisible()
  const buttonBounds = await google.boundingBox()
  const passwordBounds = await page.getByLabel('Password', { exact: true }).boundingBox()
  expect(buttonBounds.y).toBeLessThan(passwordBounds.y)
  await google.click()
  await expect(page.getByRole('heading', { name: user.displayName })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: user.displayName })).toBeVisible()
  expect(await page.evaluate(() => JSON.stringify(localStorage) + JSON.stringify(sessionStorage))).not.toContain('synthetic-google-browser-credential')
  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible()
  expect(requests.filter(path => path.endsWith('/google'))).toHaveLength(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
test('[TC-FE-GOOGLE-BROWSER-02] renders rejected Google authentication without losing registration inputs', async ({ page }) => {
  await page.route('https://accounts.google.com/gsi/client', route => route.fulfill({ contentType: 'text/javascript', body: sdk }))
  await authRoutes(page, { rejectGoogle: true })
  await page.goto('/register')
  await page.getByLabel('Username', { exact: true }).fill('synthetic_player')
  await page.getByRole('button', { name: 'Continue with Google' }).click()
  await expect(page.getByRole('alert')).toContainText('could not be verified')
  await expect(page.getByLabel('Username', { exact: true })).toHaveValue('synthetic_player')
  await expect(page.getByRole('button', { name: 'Create account' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Log out' })).toHaveCount(0)
})
test('[TC-FE-GOOGLE-BROWSER-03] recovers from a failed Google SDK load using the in-page retry', async ({ page }) => {
  let attempt = 0
  await page.route('https://accounts.google.com/gsi/client', route => ++attempt === 1 ? route.abort() : route.fulfill({ contentType: 'text/javascript', body: sdk }))
  await authRoutes(page)
  await page.goto('/login')
  await expect(page.getByRole('alert')).toContainText('could not load')
  await page.getByRole('button', { name: 'Retry Google sign-in' }).click()
  await page.getByRole('button', { name: 'Continue with Google' }).click()
  await expect(page.getByRole('heading', { name: user.displayName })).toBeVisible()
  expect(attempt).toBe(2)
})

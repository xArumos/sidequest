import { defineConfig } from '@playwright/test'

// Full-stack browser tests: the real Express API on mongodb-memory-server with the
// seed in server/test/e2e/seed.js, plus the Vite dev server proxying /api to it.
// Nothing is mocked in the browser; only third-party services are stubbed inside
// the test server. Run with `npm run test:e2e` after installing server and
// database dependencies.
//
// The specs share one seeded database, so they run serially in one worker.
const apiPort = 5055
const webPort = 4175
const webOrigin = `http://127.0.0.1:${webPort}`

export default defineConfig({
  testDir: './e2e/real',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/e2e', open: 'never' }]],
  use: {
    baseURL: webOrigin,
    browserName: 'chromium',
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
    viewport: { width: 1280, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      // The first run downloads a MongoDB binary, so allow a generous timeout.
      command: 'node test/e2e/server.js',
      cwd: '../server',
      url: `http://127.0.0.1:${apiPort}/api/ready`,
      timeout: 180_000,
      reuseExistingServer: false,
      stdout: 'pipe',
      env: { E2E_API_PORT: String(apiPort), E2E_FRONTEND_ORIGIN: webOrigin },
    },
    {
      // Same-origin requests through the Vite proxy keep the session cookie
      // first-party, and the proxy forwards the browser's Origin header, which
      // matches E2E_FRONTEND_ORIGIN above. Empty Google client IDs keep any local
      // .env from loading the real Google SDK.
      command: `npm run dev -- --host 127.0.0.1 --port ${webPort} --strictPort`,
      url: webOrigin,
      reuseExistingServer: false,
      env: {
        API_PROXY_TARGET: `http://127.0.0.1:${apiPort}`,
        VITE_API_BASE_URL: '',
        VITE_GOOGLE_CLIENT_ID: '',
        GOOGLE_CLIENT_ID: '',
      },
    },
  ],
})

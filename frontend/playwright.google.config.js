import { defineConfig } from '@playwright/test'
import base from './playwright.config.js'
export default defineConfig({
  ...base,
  testMatch: 'google-auth.spec.js',
  reporter: [['list'], ['json', { outputFile: 'docs/testing/artifacts/google-browser-results.json' }]],
  webServer: {
    ...base.webServer,
    env: { ...base.webServer.env, VITE_GOOGLE_CLIENT_ID: 'synthetic-google-browser.apps.googleusercontent.com' },
  },
})

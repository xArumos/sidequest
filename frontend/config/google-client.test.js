import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { resolveGoogleClientId } from './google-client'
let project
let frontend
beforeEach(() => {
  vi.stubEnv('GOOGLE_CLIENT_ID', undefined)
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', undefined)
  project = mkdtempSync(join(tmpdir(), 'sidequest-public-google-config-'))
  frontend = join(project, 'frontend')
  mkdirSync(frontend)
})
afterEach(() => { rmSync(project, { recursive: true, force: true }); vi.unstubAllEnvs() })
it('[TC-FE-GOOGLE-CONFIG-01] reuses only the backend public client ID when the frontend override is absent', () => {
  writeFileSync(join(project, '.env'), 'GOOGLE_CLIENT_ID=synthetic-backend.apps.googleusercontent.com\nSESSION_SECRET=synthetic-private-marker\nTWITCH_CLIENT_SECRET=synthetic-twitch-marker\n')
  expect(resolveGoogleClientId('development', frontend, project)).toBe('synthetic-backend.apps.googleusercontent.com')
})
it('[TC-FE-GOOGLE-CONFIG-02] gives the explicit frontend environment precedence over the backend default', () => {
  writeFileSync(join(project, '.env'), 'GOOGLE_CLIENT_ID=synthetic-backend.apps.googleusercontent.com\n')
  writeFileSync(join(frontend, '.env.local'), 'VITE_GOOGLE_CLIENT_ID=synthetic-frontend.apps.googleusercontent.com\n')
  expect(resolveGoogleClientId('production', frontend, project)).toBe('synthetic-frontend.apps.googleusercontent.com')
})
it('[TC-FE-GOOGLE-CONFIG-03] isolates unit tests from local Google settings and handles unconfigured environments', () => {
  expect(resolveGoogleClientId('development', frontend, project)).toBe('')
  writeFileSync(join(project, '.env'), 'GOOGLE_CLIENT_ID=synthetic-backend.apps.googleusercontent.com\n')
  expect(resolveGoogleClientId('test', frontend, project)).toBe('')
})

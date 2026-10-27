import { loadEnv } from 'vite'

// A Google web client ID is public. Read only its prefixes; never expose server secrets.
export function resolveGoogleClientId(mode, frontendDirectory, projectDirectory) {
  if (mode === 'test') return '' // Unit tests always configure synthetic SDK values explicitly.
  const frontend = loadEnv(mode, frontendDirectory, 'VITE_GOOGLE_CLIENT_ID')
  const backend = loadEnv(mode, projectDirectory, 'GOOGLE_CLIENT_ID')
  return frontend.VITE_GOOGLE_CLIENT_ID || backend.GOOGLE_CLIENT_ID || ''
}

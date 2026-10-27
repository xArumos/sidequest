import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { resolveGoogleClientId } from './config/google-client.js'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: {
    'import.meta.env.SIDEQUEST_GOOGLE_CLIENT_ID': JSON.stringify(resolveGoogleClientId(mode, fileURLToPath(new URL('./', import.meta.url)), fileURLToPath(new URL('../', import.meta.url)))),
  },
  server: { proxy: { '/api': { target: loadEnv(mode, process.cwd(), '').API_PROXY_TARGET || 'http://localhost:5000' } } },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    globals: true,
    exclude: ['**/node_modules/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/**/*.test.*', 'src/test/**', 'src/data/**', 'src/main.jsx'],
      reporter: ['text', 'json-summary', 'html'],
    },
  },
}))

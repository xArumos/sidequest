# SideQuest frontend

The account panel supports Google sign-in, session restoration after reload, and logout using the existing backend. New accounts are created by the backend on first Google sign-in.

Create or update frontend/.env.local:

```dotenv
VITE_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
VITE_API_ORIGIN=http://localhost:5000
```

Update the repository root .env (preserve existing settings):

```dotenv
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
SESSION_SECRET=REPLACE_WITH_A_RANDOM_SECRET_AT_LEAST_32_BYTES
FRONTEND_ORIGIN=http://localhost:5173
```

Use the same Google OAuth Web client ID in both files. Generate a random session secret with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Never put SESSION_SECRET in a VITE_ variable.

In Google Cloud, authorize http://localhost:5173 as a JavaScript origin for the OAuth Web client. Configure the consent screen and test users if required. Start MongoDB and the API using the repository README, restart Vite after changing environment variables, and open http://localhost:5173. Use localhost for browser requests to both services, as documented by the backend.

The panel displays errors when the backend is unreachable, authentication is disabled, or Google rejects the credential. Retry is available for startup failures. Keep the frontend and API on the same site for session cookies; use localhost for both during development.

Run `npm test`, `npm run lint`, and `npm run build` in this directory. Authentication tests mock Google and HTTP responses. A real Google/MongoDB browser test still requires configured credentials and running services.

Ratings remain a prototype: the backend currently has no rating/review endpoints. Profile editing is also not implemented by the backend.

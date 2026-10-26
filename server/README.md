# Google account sign-in

Google-only sign-in creates a SideQuest account on the first successful login.
The backend verifies Google's ID token using `google-auth-library`, identifies the account by Google's stable `sub`, and stores the account in MongoDB.
No Google passwords, access tokens, or ID tokens are stored.
An HttpOnly session cookie keeps the user signed in for up to seven days.
Sessions are stored in MongoDB and survive server restarts.

## Enable locally

1. Create or select a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Configure Google Auth Platform branding, audience, and test users as required by your project's publishing status.
3. Create an OAuth client with application type **Web application**.
4. Add `http://localhost` and `http://localhost:5173` to **Authorized JavaScript origins**.
5. Copy the client ID into `GOOGLE_CLIENT_ID` in the root `.env`.
6. Generate a random session secret with the command below and put it in `SESSION_SECRET`.
7. Start MongoDB and restart the API using the root README instructions.

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

The client ID ends in `.apps.googleusercontent.com` and is also supplied to the frontend.
This Google Identity Services callback flow does not need a client secret or redirect URI.
Keep the session secret private and stable across server restarts and instances.
Do not commit `.env`.
If both authentication settings are empty, health endpoints continue working and auth endpoints return `503 AUTH_NOT_CONFIGURED`.
If only one setting is provided or the secret is too short, startup fails with a configuration error.

Google's setup and verification references:
[Client setup](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid) and [server verification](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).

## Frontend handoff

The frontend teammate adds Google's official **Sign in with Google** button using the script at `https://accounts.google.com/gsi/client`.
Initialize it with the same client ID and a JavaScript callback that receives `{ credential }`.
Post that credential to the backend as JSON:

```js
const response = await fetch('http://localhost:5000/api/auth/google', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ credential }),
});
const result = await response.json();
if (!response.ok) throw new Error(result.error.message);
// result.user contains id, email, displayName, and avatarUrl.
```

Use `credentials: 'include'` for `/api/auth/me` and `/api/auth/logout` too.
Call `GET /api/auth/me` when the app loads to restore the signed-in state.
Call `POST /api/auth/logout` to log out of SideQuest, then clear frontend user state and call `google.accounts.id.disableAutoSelect()` if using automatic Google sign-in.
Logout ends the SideQuest session; it does not sign the user out of Google.

Use `localhost` for both the frontend and API request URLs during development.
Mixing `localhost` with `127.0.0.1` makes them different sites for cookie purposes.
The backend may still bind to `127.0.0.1`.
`FRONTEND_ORIGIN` must exactly match the browser's frontend origin, including the port.
The browser supplies the Origin header automatically; the frontend must not try to set it.
Non-browser POST tests such as curl must supply `Origin: http://localhost:5173` explicitly.

This endpoint accepts the Google JavaScript callback flow only, not Google's direct HTML form-post mode.
The backend requires an exact allowed Origin on login and logout to prevent cross-site login/logout requests, in addition to validating Google's token.

## API behavior

| Endpoint | Success | Expected errors |
| --- | --- | --- |
| `POST /api/auth/google` | `200 { user: { id, email, displayName, avatarUrl } }` and session cookie | `400` missing credential; `401` rejected token or unverified email; `403` invalid/missing Origin; `429` excessive attempts |
| `GET /api/auth/me` | `200 { user: { id, email, displayName, avatarUrl } }` | `401` absent, expired, tampered, or deleted-user session |
| `POST /api/auth/logout` | `204`, clears cookie and destroys session | `403` invalid/missing Origin |

Login updates the Google-supplied display name, email, and avatar on the existing account.
Email is not a unique account key, and accounts are never automatically linked by email.
Sessions are rotated after login to prevent session fixation.
Login is limited to 30 attempts per IP per 15 minutes per server process.
Auth responses are marked `Cache-Control: no-store`.

`NODE_ENV=production` enables Secure cookies, which require HTTPS.
For deployment behind an HTTPS reverse proxy, configure Express's `trust proxy` for that trusted proxy before enabling production mode.
Frontend and API must be on the same site for the current `SameSite=Lax` cookie setting.

## Health checks and errors

| Endpoint | Response |
| --- | --- |
| `GET /api/health` | `200 {"status":"ok"}` while the HTTP process is running |
| `GET /api/ready` | `200 {"status":"ready"}` after a successful database ping, otherwise `503 {"status":"unavailable"}` |

Readiness pings have a 1.5-second timeout and responses are not cached.
Unknown routes return a JSON `404`.
Malformed JSON returns `400`, and JSON bodies larger than 100 KB return `413`.
Errors use the shape `{"error":{"code":"NOT_FOUND","message":"Route not found."}}`.
Unexpected errors return a generic `500` response without exposing internal details.

```sh
curl http://127.0.0.1:5000/api/health
curl http://127.0.0.1:5000/api/ready
```

## Tests and limitations

Run `npm test --prefix server` and `npm run test:integration --prefix server` from the repository root.
Tests cover signed-token verification, invalid credentials, cross-site requests, session rotation, cookie tampering, logout, rate limits, and MongoDB persistence.
Test-only Google credentials are injected into test app instances; production always verifies through Google's SDK.
A real browser Google sign-in still requires your own configured client ID and the frontend button.
Password login, password recovery, account linking, and profile editing are outside this first version.

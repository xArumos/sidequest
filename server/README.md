# Account authentication

SideQuest supports password accounts and Google sign-in.
Password registration collects a username, email, and password; login accepts either the username or email.
Google sign-in creates an account on its first successful login and identifies returning users by Google's stable `sub`.
Accounts are never automatically linked by email, so a Google account and a password account may share an email while remaining separate users.

Both methods use the same HttpOnly session cookie, valid for up to seven days.
Sessions live in MongoDB and survive API restarts when the session secret stays the same.
No Google passwords, access tokens, or ID tokens are stored.

## Local setup and migration

Start MongoDB and install the database and server packages as described in the root README.
Set `SESSION_SECRET` in the root `.env` to at least 32 bytes of random data.
Generate a secret with:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Keep the secret private and stable across restarts and API instances.
Never commit `.env`.
`GOOGLE_CLIENT_ID` is optional: leaving it empty enables password authentication without Google.
Leaving both settings empty keeps health checks available but returns `503 AUTH_NOT_CONFIGURED` from auth endpoints.
A Google client ID without a session secret, an invalid client ID, or a short secret prevents startup.

Before starting the API against an existing database, stop all API instances and run:

```sh
npm run migrate:auth --prefix server
npm start --prefix server
```

The migration replaces the legacy required unique `googleId` index with a partial unique index that includes only string Google IDs.
It also creates the username and password-account email indexes.
It preserves accounts and unrelated indexes, is safe to repeat, and uses the root environment's database settings.
Run it during a maintenance window with no API instances accepting writes.
A failed migration exits nonzero; correct the reported database issue and rerun before starting the API.
Startup refuses a legacy Google index and tells you to run this command.
Fresh databases receive the required indexes at startup.

Usernames are globally unique.
Emails are unique among password accounts, but Google accounts may share those emails.
Existing Google accounts keep their IDs, profile fields, and sessions.
The database schema permits exactly one authentication method per account.

## Optional Google setup

1. Create or select a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Configure Google Auth Platform branding, audience, and test users as required by the project's publishing status.
3. Create an OAuth client with application type **Web application**.
4. Add your frontend origin, normally `http://localhost:5173`, to **Authorized JavaScript origins**.
5. Set the root `GOOGLE_CLIENT_ID` and frontend `VITE_GOOGLE_CLIENT_ID` to the same client ID, then restart both servers.

The client ID ends in `.apps.googleusercontent.com`.
This Google Identity Services JavaScript callback flow does not require a client secret or redirect URI.
The backend verifies the credential through `google-auth-library` and requires a verified Google email.
Subsequent Google logins refresh only that Google account's email, display name, and avatar.

## API contract

All paths below are relative to `/api/auth`.
POST requests must use JSON and include the exact configured `Origin`, including its port.
Browsers set Origin automatically; non-browser clients must supply it explicitly.
Every authentication request should use `credentials: 'include'`.

| Method and path | JSON body | Success |
| --- | --- | --- |
| `POST /register` | `{ "username": "player_1", "email": "player@example.com", "password": "a long example phrase" }` | `201 { user }`, creates account and session |
| `POST /login` | `{ "identifier": "player_1", "password": "a long example phrase" }` | `200 { user }`, starts a new session; identifier can also be an email |
| `POST /google` | `{ "credential": "<Google ID token>" }` | `200 { user }`, creates or finds a Google account and starts a session |
| `GET /me` | None | `200 { user }`, restores account state from the session |
| `POST /logout` | `{}` | `204`, destroys the session and clears its cookie |

The public user shape is `{ id, username, email, displayName, avatarUrl }`.
`username` is `null` for Google accounts without one.
Password accounts initially use their normalized username as the display name and have an empty avatar URL.
Credential hashes and Google IDs are never included in public user responses.

Registration trims and lowercases usernames and emails.
Usernames must contain 3-30 ASCII letters, digits, or underscores.
Emails must have a valid address structure and be at most 254 characters.
Passwords must contain 15-128 Unicode code points and are neither trimmed nor normalized.
Password confirmation belongs in the frontend; do not send it to the API.
Passwords are stored as salted, versioned scrypt hashes with `N=32768`, `r=8`, `p=3`, a 16-byte random salt, and a 64-byte derived key.
Verification uses timing-safe comparison, including a dummy derivation for unknown users.
Login trims and lowercases the identifier and accepts the exact password.

| Status | Code | Meaning |
| --- | --- | --- |
| `400` | `INVALID_REGISTRATION` | Invalid username, email, or password |
| `400` | `INVALID_LOGIN` | Missing or malformed identifier/password |
| `400` | `INVALID_CREDENTIAL` | Missing or malformed Google credential |
| `401` | `INVALID_CREDENTIALS` | Unknown password account or incorrect password; same message for both |
| `401` | `INVALID_GOOGLE_TOKEN` | Invalid Google token or unverified email |
| `401` | `UNAUTHENTICATED` | Missing, expired, tampered, or deleted-user session |
| `403` | `INVALID_ORIGIN` | Missing or incorrect POST Origin |
| `409` | `ACCOUNT_EXISTS` | Registration username or password-account email is already taken |
| `429` | `RATE_LIMITED` | More than 30 attempts per IP per endpoint per 15 minutes |
| `503` | `GOOGLE_NOT_CONFIGURED` | Password auth is enabled but Google is not configured |
| `503` | `AUTH_NOT_CONFIGURED` | Session secret is not configured |

Each registration/login/Google limiter is independent and held in memory per API process.
A multi-instance production deployment should use a shared limiter store.
Errors use `{ "error": { "code": "...", "message": "..." } }`.
Unexpected failures return a generic `500 INTERNAL_ERROR`.
Authentication responses use `Cache-Control: no-store`.
Session IDs rotate after registration and either login method to prevent session fixation.

## Temporary frontend and teammate handoff

The current React app includes a temporary authentication panel for manual testing.
It provides password registration with confirmation, username/email login, session restoration, account details, logout, and Google's official button when configured.
The existing rating form remains a standalone prototype.
The panel can be replaced without changing the API contract.

Copy `frontend/.env.example` to `frontend/.env` if overrides are needed.
`VITE_API_BASE_URL` defaults to `http://localhost:5000` and excludes `/api/auth`.
`VITE_GOOGLE_CLIENT_ID` is optional and must match the backend Google client ID.
Vite loads frontend environment variables from `frontend/.env`, separately from the root backend `.env`.
Restart Vite after changing them.

```js
const response = await fetch('http://localhost:5000/api/auth/login', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: 'player_1', password }),
});
const result = await response.json();
if (!response.ok) throw new Error(result.error.message);
// result.user is the authenticated account.
```

Call `GET /me` on page load; `401` means the visitor is signed out.
For Google, initialize the SDK at `https://accounts.google.com/gsi/client` with the configured client ID and POST the callback's credential to `/google`.
Only the SDK callback flow is accepted, not Google's direct HTML form POST mode.
On successful logout, clear the frontend account state and call `google.accounts.id.disableAutoSelect()` if the SDK is loaded.
Logout ends the SideQuest session and does not sign the visitor out of Google.

Use `localhost` consistently for frontend and API URLs.
Mixing `localhost` and `127.0.0.1` causes cross-site cookie problems, even though the API may bind to `127.0.0.1`.
If macOS AirPlay occupies port 5000, choose another backend `PORT` and update `VITE_API_BASE_URL` to match.
If Vite selects another port, set `FRONTEND_ORIGIN` to the displayed origin and restart the API.
For example, these root commands use fixed alternative ports in two terminals:

```sh
PORT=5001 FRONTEND_ORIGIN=http://localhost:5174 npm start --prefix server
VITE_API_BASE_URL=http://localhost:5001 npm run dev --prefix frontend -- --host localhost --port 5174 --strictPort
```

`NODE_ENV=production` enables Secure cookies and requires HTTPS.
For a trusted HTTPS reverse proxy, configure Express's `trust proxy` to match that deployment before enabling production mode.
Frontend and API must be on the same site for the current `SameSite=Lax` cookie setting.

## Health checks, verification, and limits

`GET /api/health` returns `200 {"status":"ok"}` while the HTTP process is running.
`GET /api/ready` returns `200 {"status":"ready"}` after a database ping or `503 {"status":"unavailable"}` otherwise.
Readiness pings have a 1.5-second timeout and responses are not cached.
Unknown routes return JSON `404` errors; malformed JSON returns `400`, and bodies larger than 100 KB return `413`.

```sh
npm test --prefix server
npm run test:integration --prefix server
npm test --prefix frontend
npm run lint --prefix frontend
npm run build --prefix frontend
```

Integration tests require MongoDB and use `sidequest_test` unless `MONGODB_TEST_URI` supplies another URI.
They clean up their own account and session records.
Migration tests create and drop a uniquely named disposable database and verify repeatability and preservation of legacy users and unrelated indexes.
Google credentials are injected only into test app instances; the production verifier has no bypass.
A real Google browser login requires a configured OAuth client.
Email verification, password recovery and changes, account linking, and profile editing are deferred.
Emails collected by password registration are unverified contact information and must not be treated as proof of ownership.

## Game catalog import (IGDB)

Games come from [IGDB](https://api-docs.igdb.com/), which uses Twitch app credentials.

1. Turn on two-factor authentication for your Twitch account, then open the [Twitch developer console](https://dev.twitch.tv/console) and register an application (OAuth redirect `http://localhost`, category "Application Integration", client type "Confidential").
2. Copy the client ID and a new client secret into `.env` as `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET`.
3. With MongoDB running, import the most-rated games:

```bash
npm run import:games -- --limit 500
```

The import upserts by IGDB id, so re-running it refreshes titles, covers, genres, platforms, and Steam app IDs without touching stored ratings. Requests are throttled to IGDB's limit of 4 per second. Tests use `test/fixtures/igdb-games.json` and never call the live API.

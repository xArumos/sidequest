# SideQuest

A platform for sharing video game experiences, ratings, and reviews.
The backend provides Express startup, MongoDB connectivity, health endpoints, and Google account sign-in.
See [Google authentication setup and frontend handoff](server/README.md) to enable login.

## Local setup

Requires Node.js 22.9 or newer, npm, and Docker with Compose.

From the repository root:

```sh
cp .env.example .env
docker compose up -d mongodb
npm ci --prefix database
npm ci --prefix server
npm run dev --prefix server
```

If `.env` already exists, merge the example settings instead of replacing it.
The server imports the existing database package through a local npm dependency, so install both packages as shown.
The server waits for MongoDB before accepting HTTP requests.
Use `npm start --prefix server` to run without automatic restarts.
Press Ctrl+C to close the HTTP server and database connection.

To run the React frontend in another terminal:

```sh
npm ci --prefix frontend
npm run dev --prefix frontend
```

Vite normally serves the frontend at `http://localhost:5173`.
If it selects a different port, set `FRONTEND_ORIGIN` to the displayed origin and restart the backend.

## Configuration

Server scripts load the root `.env` file when it exists.
Environment variables already set in the shell take precedence.
`config/app.yaml` is an unused historical planning reference, not runtime configuration.

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | HTTP bind address; use `0.0.0.0` inside a container |
| `PORT` | `5000` | HTTP port |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | Browser origin allowed by CORS, without a trailing slash |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/sidequest_dev` | MongoDB connection URI |
| `MONGODB_DB_NAME` | `sidequest_dev` | MongoDB database name |
| `GOOGLE_CLIENT_ID` | Empty | Google OAuth web client ID; required to enable sign-in |
| `SESSION_SECRET` | Empty | Random session signing secret of at least 32 bytes; required with the client ID |

If port 5000 is occupied, choose a free `PORT` in `.env`.
Google sign-in remains disabled until both authentication settings are configured.
CORS controls browser access; account authentication uses a server-side session cookie.

## API

| Method | Path | Response |
| --- | --- | --- |
| GET | `/api/health` | `200 {"status":"ok"}` while the HTTP process is running |
| GET | `/api/ready` | `200 {"status":"ready"}` after a successful database ping, otherwise `503 {"status":"unavailable"}` |
| POST | `/api/auth/google` | Verify a Google ID token, create or find the account, and start a session |
| GET | `/api/auth/me` | Return the signed-in user, or `401` |
| POST | `/api/auth/logout` | End the session and return `204` |

Readiness pings have a 1.5-second timeout and responses are not cached.
Unknown routes return a JSON `404`.
Malformed JSON returns `400`, and JSON bodies larger than 100 KB return `413`.
Errors use the shape `{"error":{"code":"NOT_FOUND","message":"Route not found."}}`.
Unexpected errors return a generic `500` response without exposing internal details.

```sh
curl http://127.0.0.1:5000/api/health
curl http://127.0.0.1:5000/api/ready
```

## Verification

```sh
npm test --prefix server
npm run test:integration --prefix server
npm run check --prefix database
```

Unit tests exercise real HTTP requests without requiring MongoDB.
Integration tests require the local MongoDB service and launch child server processes on temporary ports.
They verify database-backed readiness, shutdown signals, failed startup, and account/session persistence.
Set `MONGODB_TEST_URI` to test against another MongoDB instance.
Integration tests use the `sidequest_test` database, create uniquely identified test records, and remove only those records afterward.

Stop local MongoDB with `docker compose stop mongodb` when finished.

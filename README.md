# SideQuest

*A way to discover and share games with friends.*

SideQuest is a social video game tracking and review site, like Letterboxd but for games. Users can rate and review games, track what they've played, want to play, or own but haven't played, and (later) connect Steam to show achievements next to their ratings.

This is a university software engineering course project (Section 10705, Group 1), run in Scrum across two sprints.

## Tech stack

| Layer | Tech |
|---|---|
| Database | MongoDB 8 (via Docker Compose), Mongoose |
| Backend | Node.js + Express 5, Password and Google sign-in with MongoDB-backed sessions |
| Frontend | React 19 + Vite |
| External API | Steam Web API *(Sprint 2)* |

## Prerequisites

- Node.js **22.9+** and npm
- Docker with Compose (for the local MongoDB container)

## Quick start

From the repository root:

```bash
# 1. Create your local env file (never commit .env).
#    If .env already exists, merge in any new settings instead of replacing it.
cp .env.example .env

# 2. Start MongoDB (binds to 127.0.0.1:27017)
docker compose up -d mongodb

# 3. Install the database package and verify the connection
npm ci --prefix database
npm run check --prefix database     # prints "Connected to sidequest_dev."

# 4. Install the server, prepare authentication indexes, and run the API
npm ci --prefix server
npm run migrate:auth --prefix server
npm run dev --prefix server
```

In a second terminal, run the frontend:

```bash
npm ci --prefix frontend
npm run dev --prefix frontend       # http://localhost:5173
```

The server imports the `database` package as a local npm dependency, so install both.
It waits for MongoDB before accepting requests, and Ctrl+C shuts down the HTTP server and database connection cleanly.
If Vite picks a port other than 5173, set `FRONTEND_ORIGIN` to the URL it shows and restart the server.

Set a random `SESSION_SECRET` of at least 32 bytes in the root `.env` to enable password authentication.
`GOOGLE_CLIENT_ID` additionally enables Google sign-in.
The frontend includes a temporary login and registration panel for testing.
See [server/README.md](server/README.md) for secret generation, the required migration for existing databases, optional Google setup, and the frontend integration contract.

Stop MongoDB with `docker compose stop mongodb` when you're done.

## Scripts

| Package | Script | What it does |
|---|---|---|
| `server/` | `npm run dev` | API with automatic restarts on file changes |
| | `npm start` | API without automatic restarts |
| | `npm test` | Unit tests (no MongoDB needed) |
| | `npm run test:integration` | Integration tests against local MongoDB |
| `database/` | `npm run check` | Connect to MongoDB and print the database name |
| | `npm test` | Tests against an in-memory MongoDB |
| `frontend/` | `npm run dev` | Vite dev server with HMR on port 5173 |
| | `npm run build` | Production build to `frontend/dist` |
| | `npm run preview` | Serve the production build locally |
| | `npm run lint` | Lint with oxlint |
| | `npm test` / `npm run test:watch` | Component tests, once or in watch mode |

Run any of these from the root with `--prefix <package>`, e.g. `npm test --prefix server`.

## API overview

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | `200` while the HTTP process is running |
| GET | `/api/ready` | `200` once MongoDB answers a ping, otherwise `503` |
| POST | `/api/auth/register` | Register with username, email, and password; start a session |
| POST | `/api/auth/login` | Sign in with username or email and password |
| POST | `/api/auth/google` | Verify a Google ID token, find or create the account, start a session |
| GET | `/api/auth/me` | The signed-in user, or `401` |
| POST | `/api/auth/logout` | End the session (`204`) |

Request limits, error formats, and auth details are in [server/README.md](server/README.md).

## Testing

```bash
npm test --prefix server               # unit tests, real HTTP requests, no MongoDB needed
npm run test:integration --prefix server   # needs local MongoDB running
npm test --prefix database             # in-memory MongoDB (no Docker needed)
npm test --prefix frontend             # Vitest + React Testing Library (jsdom)
```

- **server/** uses Node's built-in test runner (`node --test`). Integration tests start child server processes on temporary ports, use the `sidequest_test` database, and delete only the records they create. Set `MONGODB_TEST_URI` to point them at a different MongoDB instance.
- **database/** and **frontend/** use [Vitest](https://vitest.dev). The database tests use `mongodb-memory-server`, which downloads a `mongod` binary on the first run. Frontend tests sit next to the code as `*.test.jsx`, and database tests are under `database/tests/`.

**CI:** GitHub Actions (`.github/workflows/ci.yml`) runs `npm ci`, lint, tests, and build for every package in its matrix, on every pull request and on pushes to `main`. When you add a package, add it to the matrix.

## Repository layout

```
server/              Express API: health checks, password and Google sign-in, sessions
database/            Mongoose connection helper, models, `npm run check` script
frontend/            Vite + React client
config/app.yaml      Historical planning reference; no code loads it
compose.yaml         Local MongoDB container
.env.example         Environment variable names and local defaults
```

## Environment variables

Server and database scripts load the root `.env` if it exists. Variables already set in your shell take precedence.

| Variable | Default | Purpose |
|---|---|---|
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/sidequest_dev` | MongoDB connection string |
| `MONGODB_DB_NAME` | `sidequest_dev` | Database name |
| `HOST` | `127.0.0.1` | HTTP bind address; use `0.0.0.0` inside a container |
| `PORT` | `5000` | HTTP port; pick another if 5000 is taken |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | Browser origin allowed by CORS, with no trailing slash |
| `GOOGLE_CLIENT_ID` | *(empty)* | Optional Google OAuth web client ID; enables Google sign-in |
| `SESSION_SECRET` | *(empty)* | Random session signing secret, at least 32 bytes; enables password authentication |

## Contributing

- Branch off `main` using `feature/...`, `fix/...`, `docs/...`, or `ci/...`, keep commits small, and open a pull request. Don't push directly to `main`.
- Validate and sanitize all input on the server, and never commit secrets.
- Sprint planning and the product backlog live in Trello.

## License

GPL-3.0. See [LICENSE](LICENSE).

# SideQuest

*A way to discover and share games with friends.*

SideQuest is a social video game tracking and review site, like Letterboxd but for games. Users can rate and review games, track what they've played, want to play, or own but haven't played, and (later) connect Steam to show achievements next to their ratings.

This is a university software engineering course project (Section 10705, Group 1), run in Scrum across two sprints.

## Tech stack

| Layer | Tech |
|---|---|
| Database | MongoDB 8 (via Docker Compose), Mongoose |
| Backend | Node.js + Express *(not started yet)* |
| Frontend | React 19 + Vite |
| External API | Steam Web API *(Sprint 2)* |

## Prerequisites

- Node.js **22.9+**
- Docker (for the local MongoDB container)

## Quick start

```bash
# 1. Start MongoDB (binds to 127.0.0.1:27017)
docker compose up -d

# 2. Create your local env file (never commit .env)
cp .env.example .env

# 3. Verify the database connection
cd database
npm install
npm run check        # prints "Connected to sidequest_dev."

# 4. Run the frontend
cd ../frontend
npm install
npm run dev          # http://localhost:5173
```

### Frontend scripts (`frontend/`)

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server with HMR on port 5173 |
| `npm run build` | Production build to `frontend/dist` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Lint with oxlint |
| `npm test` | Run tests once (Vitest + React Testing Library, jsdom) |
| `npm run test:watch` | Run tests in watch mode |

## Testing

Each package runs its own tests with [Vitest](https://vitest.dev):

```bash
cd frontend && npm test   # component tests (jsdom + React Testing Library)
cd database && npm test   # DB tests against an in-memory MongoDB (no Docker needed)
```

The database tests use `mongodb-memory-server`, which downloads a `mongod` binary on the first run. Test files sit next to the code as `*.test.jsx` (frontend) or under `database/tests/`.

**CI:** GitHub Actions (`.github/workflows/ci.yml`) runs `npm ci`, lint, tests, and build for every package on every pull request and on pushes to `main`. When you add a new package (e.g. `server/`), add it to the workflow matrix.

## Repository layout

```
config/app.yaml      Shared app settings (ports, CORS, logging); not loaded by code yet
database/            Mongoose connection helper + `npm run check` script
frontend/            Vite + React client
compose.yaml         Local MongoDB container
.env.example         Required environment variable names
```

## Environment variables

| Name | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `MONGODB_DB_NAME` | Database name |

## Contributing

- Branch off `main` using `feature/...`, `fix/...`, `docs/...`, or `ci/...`, keep commits small, and open a pull request. Don't push directly to `main`.
- Validate and sanitize all input on the server, and never commit secrets.
- Sprint planning and the product backlog live in Trello.

## License

GPL-3.0. See [LICENSE](LICENSE).

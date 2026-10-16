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

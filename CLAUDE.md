# CLAUDE.md

Guidance for Claude Code in this repo. The full product vision and the 35-PBI backlog are in `sidequest-project-overview.md`, a local file kept untracked. Read it there; this file doesn't repeat it.

## Overview

SideQuest is a social game tracking and review site, "Letterboxd for games". Users rate and review games, track play status (playing / played / backlog / wishlist), and in Sprint 2 connect Steam for achievements. It's a university Scrum project (Section 10705, Group 1) with four devs. Trello holds the backlog and GitHub holds the code.

Planned stack: MongoDB + Node/Express REST API + React frontend. Steam Web API is optional, Sprint 2. Keep frontend, backend, DB, and external API concerns separated.

## Commands (only these exist today)

```bash
docker compose up -d              # MongoDB 8 on 127.0.0.1:27017
cp .env.example .env              # MONGODB_URI, MONGODB_DB_NAME

cd database && npm install
npm run check                     # ping DB using ../.env (node --env-file-if-exists)
npm test                          # Vitest + mongodb-memory-server (no Docker needed)

cd frontend && npm install
npm run dev                       # Vite dev server, http://localhost:5173
npm run build | npm run preview
npm run lint                      # oxlint
npm test | npm run test:watch     # Vitest + jsdom + React Testing Library
```

There's no backend package or server start command yet. CI (`.github/workflows/ci.yml`) runs `npm ci`, lint, test, and build per package on every PR. A new package must be added to its matrix.

## Repo structure

```
config/app.yaml        server port 5000, client port 5173, CORS, JWT, logging. NOT read by any code yet
database/              CommonJS package (mongoose ^9, Node >=22.9)
  connection.js        connectDatabase({uri, dbName}) / disconnectDatabase(); env-driven with local defaults
  scripts/check.js     connectivity ping
frontend/              ESM, Vite 8 + React 19, package name "client"
  src/App.jsx          renders <RatingForm/> only
  src/components/RatingForm.jsx   dummy integer 1-5 input; submit only console.logs
compose.yaml           mongo:8.0 with named volume
client/.vite/          stray committed Vite cache (not a real package; see Gaps)
```

## Implementation status

| Area | State | PBIs |
|---|---|---|
| MongoDB connection helper + compose | Done (groundwork) | supports all |
| Rating form UI | Stub only, no API call, no validation | 05 (partial) |
| Backend / Express app | Not started | all API work |
| Auth, profiles | Not started | 01–04 |
| Ratings/reviews API | Not started | 05–10 |
| Catalog, aggregates, rankings, filters | Not started | 11–16 |
| Wishlist / backlog | Not started | 17–22, 28–29 |
| Steam, follows, dev view | Sprint 2 | 23–27, 30–33 |

## Data models and API routes

**Existing:** none. No Mongoose schemas, routes, controllers, or middleware exist yet.

**Proposed** (from the overview §6–7; reconcile with the DB owner before building):

- **User**: username, email, passwordHash, profile fields, later steamId
- **Game**: externalId, title, coverUrl, platforms[], genres[], releaseDate, description, `ratingAvg`, `ratingCount`
- **Log**: user ref, game ref, `status` (playing/played/backlog/wishlist), `rating` (0.5–5, half steps), `reviewText?`, `playedDate`, timestamps. Unique index on (user, game).

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/games` | search, genre/platform filter, sort, paginate |
| GET | `/api/games/:id` | detail + aggregate rating |
| GET | `/api/games/top` | ranked list with min rating-count threshold |
| POST | `/api/games/:id/log` | upsert the authenticated user's log |
| PATCH/DELETE | `/api/logs/:id` | edit/delete own log (owner only) |
| GET | `/api/games/:id/reviews` | paginated reviews |
| GET | `/api/users/:id/logs` | a user's logs (profile/history) |

## Conventions

- **Git:** use feature branches + PRs and keep commits small. Claude may create branches, commit, push, and open **draft** PRs, but must **never merge** to `main`.
- **Security:**
  - Validate and sanitize all input on the server.
  - Write routes must check ownership.
  - Secrets go only in `.env`, never in `config/app.yaml` or code.
- **Steam:** keep that code isolated and optional so it can never block the MVP.
- **Testing:** test as you build. Every feature area has a testing PBI.
  - Frontend tests go next to components as `*.test.jsx`, with setup in `frontend/src/test/setup.js`.
  - DB/backend tests use `mongodb-memory-server`, never the dev database (see `database/tests/`).
- **Module systems:** `database/` is CommonJS (`require`/`module.exports`) and `frontend/` is ESM. Match the package you're in.
- **Lint:** the frontend uses oxlint with `react/rules-of-hooks` (error) and `react/only-export-components` (warn).
- **Env config:** read via `process.env` with safe local defaults. Scripts load `../.env` with `node --env-file-if-exists`.

## My scope (the author of this file)

**Area 1: Game catalog and data layer**
- PBI-14 genres/categories (model + ingestion)
- PBI-15 sort/filter (backend query logic)
- PBI-16 sort/filter tests (empty and combined results)
- PBI-11 average rating + count
- PBI-12 ranked list
- PBI-13 min-count threshold
- PBI-25 (Sprint 2) match Steam games to local records

Backlog gap: no PBI covers game ingestion (RAWG/IGDB → MongoDB), search, or detail endpoints. Do this first.

**Area 2: Logging, ratings, reviews**
- PBI-05 rating API
- PBI-06 written reviews
- PBI-07 store with user/game/date
- PBI-08 edit/delete own
- PBI-09 averages + reviews on game page
- PBI-10 tests

Coordinate with:
- the profiles/auth owner on PBI-03 (history consumes logs) and PBI-17–22 (wishlist/backlog as log statuses)
- the DB owner on schemas

Dependencies: auth (who is rating), the catalog, and agreed schemas.

## Open questions / gaps

1. **No backend yet.** Decide where it goes (e.g. `server/`). It should reuse `database/connection.js`.
2. **Rating scale conflict:** RatingForm uses integers 1–5, but the proposed model uses 0.5–5 in half steps. Needs a team decision.
3. **No game ingestion/search/detail PBIs.** Propose them to the team.
4. `config/app.yaml` contains `jwt_secret: "REPLACE_ME"`. The real secret must come from `.env`, and nothing loads app.yaml yet.
5. `client/.vite/deps/` is a committed Vite cache outside `frontend/`. It should be deleted and gitignored.
6. `frontend/src/App.jsx` has unused imports (`useState`, hero/logo assets).

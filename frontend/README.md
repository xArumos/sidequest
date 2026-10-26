# SideQuest frontend

Existing React 19 / Vite application. The gaming theme and route structure are preserved.

## Run locally

Install with `npm ci` in this directory, then `npm run dev`. Start the merged API and MongoDB using the root README. Vite proxies `/api` to `http://localhost:5000` by default. Override `API_PROXY_TARGET` in a frontend `.env.local` if needed.

Merge the values from `.env.example` into a frontend `.env.local` (preserve any existing settings):

- `VITE_GOOGLE_CLIENT_ID`: public Google web OAuth client ID, matching server `GOOGLE_CLIENT_ID`.
- `VITE_API_BASE_URL`: optional browser-facing API origin; empty uses same-origin `/api`.
- `API_PROXY_TARGET`: development proxy target, never included in browser code.

Restart Vite after changing environment settings. Configure the frontend's exact browser origin in server `FRONTEND_ORIGIN` and Google authorized JavaScript origins. Use `localhost` consistently for browser-facing development URLs so session cookies work. Server `SESSION_SECRET`, database credentials, and Twitch secrets belong only on the server.

Production needs HTTPS and a same-site API for the backend's SameSite=Lax session cookie. With an empty API base, configure the host to reverse proxy `/api` to Express. Configure SPA history fallback to `index.html` for application routes. Vite's proxy only applies to the development server.

## Available functionality

- Google creates an account on first sign-in; returning users reuse their account.
- Startup restores the HttpOnly cookie session through `GET /api/auth/me`.
- `POST /api/auth/google` exchanges Google's callback credential for the session.
- `POST /api/auth/logout` clears the session; UI state changes only on success.
- Profile displays `displayName` and `email` from the API. Credentials are not saved in browser storage.
- Protected routes wait for session restoration. Errors support retry.

Password registration is not supported by the merged backend, so there are no fake password forms. Google sign-in needs configuration and a real browser to verify end to end.

Catalog, reviews, rankings, wishlist, backlog, profile editing/history, and shared wishlist APIs have not been implemented in the inspected remote branches. These routes show unavailable states and disable persistence rather than use fixture data. Existing `src/data/mockData.js` remains preserved but is not imported into the application. The review form supports local drafting and validation; publishing defaults to disabled. Do not enable it until a real API contract and persistence callback exist.

PR #10 proposes whole-number ratings 1–5, review text up to 2,000 characters, one record per user/game, and a single `status` including `wishlist` and `backlog`. It does **not** support independent simultaneous wishlist/backlog memberships. Confirm the merged contract before wiring those controls. `ratingCount` counts ratings, not necessarily written reviews; a most-reviewed ranking needs an actual review-count contract.

## Validation

- `npm run build`
- `npm run lint`
- `npm test`

Frontend tests cover session loading/restoration, Google callback integration, auth errors, logout failure/success, expiration, protected routes, navigation, filter reset, rankings selection, privacy-safe unavailable states, and review validation/draft retention. Mocked frontend requests do not establish browser cookie or Google production configuration correctness.

See [Sprint 1 status](../docs/sprint1-frontend-status.md) and [copy-ready team reports](../docs/sprint1-team-issues.md).

# SideQuest Sprint 1 frontend status

Reviewed October 26, 2026. Sprint 1 is **not fully operational**: the available backend exposes authentication but not the remaining feature APIs. No unapproved feature PR was merged. No backend/database code was authored or modified to fill those gaps.

## 1. Sprint 1 completion checklist

| Feature area | PBIs | Frontend status | Backend integration status | Fully functional? | Remaining requirements |
|---|---|---|---|---|---|
| Accounts & profiles | 1–4 | Google registration/login, protected routes, logout, session restoration, account display, loading/errors/retry | Merged auth endpoints connected; profile update/history routes absent | Partial | Configure Google and verify browser flow; profile editing, played games, rating history and richer profile data need APIs |
| Ratings & reviews | 5–10 | Reusable 1–5 rating/review form, 2,000-character cap, validation, pending/error/confirmation, failed-draft retention; publishing disabled in app | No review HTTP API; #10 proposes further model rules | No | Catalog/review read/write, ownership, aggregate updates, history; confirm edit/delete requirements |
| Game rankings | 11–13 | Existing Top Rated / Most Reviewed / Community Mood sections preserved with honest unavailable states; ranking selector | No ranking/catalog API; aggregate groundwork in open #10 | No | Real catalog, scope/pagination and reliable aggregates; written-review count definition |
| Sorting & filtering | 14–16 | Existing search/genre/sort controls preserved; whitespace handling, reset, unavailable state | No catalog HTTP API or real dataset | No | Publish catalog contract; connect data and validate actual result changes; adapt final multi-genre fields |
| Wishlists | 17–19 | Separate wishlist page; add/remove controls disabled without persistence | No list HTTP API; model status proposed in #10 | No | Authorized list read/write and membership contract |
| Game backlog | 20–22 | Separate backlog page; unavailable state; mutations disabled | No list HTTP API; model status proposed in #10 | No | Authorized status transitions/read/write and final backlog-management rules |
| Wishlist sharing/privacy | 28–29 | Disabled privacy controls; public profile/shared-list unavailable state; no private fixture exposure | No server enforcement; visibility field only in open #10 | No | Owner visibility update, public reads, server-enforced privacy and response separation |

## 2. Frontend changes made

- Preserved the existing React/Vite structure, routes, gaming theme, and user-provided components/fonts. Wireframe PDFs remain untouched and untracked.
- Added `services/auth.js`: configurable API base, cookie credentials, structured error handling, response validation, session cancellation, and correct bodyless logout handling. No credentials are placed in local/session storage.
- Added `GoogleSignIn.jsx`: official Google Identity Services button, callback handoff, missing-configuration, script-error, and signing-in states. Login and registration use the merged backend's Google-only flow; first sign-in creates the account.
- Updated `App.jsx`: real session restore, account rendering, protected-route loading, auth error/retry, logout failure retention, expired-session clearing, and duplicate-login prevention.
- Removed simulated sign-in, local-only saved reviews/lists/profile updates, fabricated current-user display, and fixture rankings/statistics from runtime. `mockData.js` is preserved but not imported into the app.
- Updated `ReviewForm.jsx`: reusable draft UI, integer 1–5 ratings, optional text capped at 2,000, API callback boundary, validation, pending state, failure retention, and confirmation only after callback success. Disabled by default; no invented review endpoint. Removed unsupported review-title input. `RatingForm` now delegates to this safe boundary instead of logging a pretend submission.
- Preserved discovery controls, added reset and rankings criterion selection. With no catalog API, those controls cannot yet produce real results and are not claimed complete.
- Updated layout/cards: one Join now / Log in pair on homepage, accessible skip link, disabled unsupported saves, rating selected-state accessibility, title wrapping, flexible headers/statistics, narrow-screen ranking layout, focus indicators, and reduced-motion handling.
- Added frontend environment example and development `/api` proxy; documented same-site cookies, CORS/origin settings, production proxy/history fallback, and configuration boundaries.
- Added/expanded auth service, application, Google button, review form, and legacy form tests.

No new application pages or dependencies were needed. No game artwork was downloaded or committed; existing mock image URLs are not rendered.

## 3. Teammate code integrated

Remote branches and all available PRs were inspected after `git fetch --all --prune`.

| Source | Discovery | Action |
|---|---|---|
| `origin/main`, `4a85143`, merged PR #7 | Express foundation, Google ID-token verification, MongoDB accounts and sessions, current-account endpoint, logout | Merged already-approved main into the frontend feature branch without modifying teammate implementation; integrated three auth endpoints |
| `origin/feat/catalog-models`, `1424d17`, open PR #10 | Catalog metadata, rating aggregates/recalculation, single user/game record with play status, wishlist visibility | Inspected diff, schema, PR description/review/checks; not merged; review required |
| `origin/feat/igdb-import`, `739f65f`, open PR #11 targeting catalog branch | IGDB client and import tooling; server-only Twitch settings; stacks on #10 | Inspected import mapping and changes; not merged; no HTTP catalog endpoints; live IGDB testing pending in PR |
| Dependabot branch, open PR #12 | body-parser 2.4.0 update | Left for teammate review; referenced existing security fix |
| Original frontend branch, `3acf7e5` | Existing Sprint 1 UI work and simplified homepage auth | Used as feature-branch base; preserved its work rather than replacing it with main's template |

Connected API contracts:

| Method/path | Payload | Success | Session behavior |
|---|---|---|---|
| `GET /api/auth/me` | none | `{ user: { id, email, displayName, avatarUrl } }` | `credentials: include`; 401 means signed out |
| `POST /api/auth/google` | JSON `{ credential }` | same user envelope | Server verifies token and creates/rotates HttpOnly cookie session |
| `POST /api/auth/logout` | none | 204 without JSON | Server destroys session; frontend clears account only on success |

Server errors are `{ error: { code, message } }`. Google auth can return 400/401/403/429; unconfigured auth returns 503. Frontend uses the server message without manufacturing success. Server origin must match the frontend browser origin exactly. No password endpoint exists; no competing password auth was added.

## 4. Features currently blocked

- **Frontend incomplete / waiting on contract:** Real catalog mapping, multi-genre filtering, ranking count semantics and pagination, community review rendering, personal history rendering, list status transitions, and public-profile rendering still need final API schemas and integration tests against real returned data. Existing fixture-shaped card/detail views remain preserved but cannot run without a catalog source. A completed empty-state screen is not considered completed functionality.
- **Backend not implemented:** Catalog/detail/ranking HTTP reads; review create/read/update/delete; personal history/played-game reads; profile editing; wishlist/backlog read/write; public profiles/shared wishlists; visibility writes and server-enforced privacy. Users expect all these actions; current UI communicates unavailability and avoids simulated saves. Implement the agreed HTTP contracts before connecting the UI. See the copy-ready reports for per-feature expectations, evidence, impact, and owners.
- **Backend implemented but not merged:** #10 provides database groundwork and #11 ingestion, not feature API handlers. Review/merge these through normal teammate ownership; then build the remaining backend APIs. Neither PR alone unblocks the frontend. #10 requests model-owner review from `@antmlap`.
- **Backend implemented but failing:** No functional auth defect found. Initial default MongoDB test failures were local service availability; the suite passed with temporary MongoDB. Server dependency audit finding is already covered by #12.
- **Integration not yet tested:** Actual Google sign-in in a browser, deployed CORS/cookie behavior, and configured production services. This workspace has no root `.env`, no running default MongoDB, and no available browser-testing tool. No assertion is made that a real Google account successfully signed in here.

The proposed single `Review.status` means wishlist/backlog are distinct states rather than two simultaneously independent memberships. Existing frontend controls must follow the final merged semantics. `ratingCount` must not automatically become “written review count.” Privacy must be enforced by the server before any list is returned.

## 5. Discord issues

Posted: **none**. No authorized Discord integration was found; no connection, tokens, webhooks, or credentials were requested or used.

Manual reports: catalog/rankings, reviews/history, list persistence, and profile/privacy. See [copy-ready issue reports](sprint1-team-issues.md). GitHub issue search returned no issues; Discord duplicate history was unavailable. Avoided duplicating Dependabot PR #12. Local MongoDB setup failure is documented as environment-related, not a teammate defect.

## 6. Tests and validation

- Existing lockfile installs completed for frontend, database, and server. Server/database installation required access outside the sandbox after the sandboxed install failed.
- Frontend production build: passed.
- Frontend oxlint: passed, no warnings in final run.
- Frontend tests: 35 passed across 5 files.
- Backend unit/HTTP tests: 21 passed, including cookies, origin rejection, session rotation, logout, invalid tokens, and rate limiting.
- Database test: 1 passed against in-memory MongoDB.
- Backend persistence/startup integration: initially 1 passed / 3 failed with `ECONNREFUSED 127.0.0.1:27017`; rerun against temporary MongoDB using existing `mongodb-memory-server` and `MONGODB_TEST_URI`: **4 passed**. No server or database test code was changed.
- `git diff --check`: passed.
- Responsive/overflow behavior reviewed in CSS; real viewport screenshots, visual browser checks, and runtime browser console inspection were not available. UI tests use jsdom and mock auth responses; backend HTTP tests and MongoDB tests validate the server separately, not full browser-to-Google behavior.
- Existing server dependency audit: one high body-parser finding, existing PR #12. No automatic dependency fix or unapproved PR merge.

## 7. GitHub status

Feature branch: `feature/sprint1-frontend-integration`, preserving the original frontend branch and incorporating only merged main.

Commits include preservation of existing components/fonts, merged main, Google-session integration/unavailable states, review-form validation, responsive fixes, test coverage, and this handoff documentation. Exact hashes and review URL are provided with the final delivery.

No push to main or automatic PR merge. User's untracked `frontend/wireframes/` files are preserved and excluded from commits.

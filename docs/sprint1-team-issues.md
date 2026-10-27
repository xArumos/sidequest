# Sprint 1 team reports — copy-ready, not posted

Reviewed GitHub branches and PRs on October 26, 2026. No authorized Discord integration was available; no messages were sent. GitHub issue search returned no issues. Discord history could not be checked, so duplicates there remain unknown. These are integration gaps, not claims that planned teammate work is defective.

## Catalog and ranking HTTP contracts are not published

**Feature:** PBIs 11–16; catalog dependency for 5–22.

**Problem:** Catalog data, details, ranking results, and community statistics cannot be requested by the frontend.

**Expected Behavior:** An agreed API returns real catalog records and reliable rating/review aggregates, with defined pagination and ranking scope.

**Current Behavior:** `server/src/app.js` mounts only health, readiness, and auth routes. Other requests receive JSON 404. The frontend reports catalog/ranking unavailability instead of ranking fixtures.

**Evidence:** Merged `origin/main` at `4a85143`; `server/src/app.js`. [PR #10](https://github.com/xArumos/sidequest/pull/10), commit `1424d17`, adds `Game` metadata, `ratingAvg`, `ratingCount`, indexes, and rating recalculation. [PR #11](https://github.com/xArumos/sidequest/pull/11), commit `739f65f`, adds server-side ingestion, stacked on #10. Neither adds catalog HTTP routes. #11's description says live IGDB verification still needs Twitch credentials. A count of ratings must not be relabeled as a count of written reviews without an agreed definition.

**Impact:** Real discovery/filter results, game details, artwork, top-rated games, most-reviewed games, and community mood cannot function.

**Suggested Owner:** Backend/API, with database review by the model owner. Publish the response schema, supported fields, pagination/completeness, and ranking/count semantics after model/import review. Keep IGDB credentials on the server.

## Review persistence and user history API are missing

**Feature:** PBIs 3–10.

**Problem:** No review read/write or user rating/played-history API exists in inspected branches.

**Expected Behavior:** Authenticated users can save ratings/review text and retrieve their history; agreed edit/delete behavior enforces ownership and recalculates community aggregates.

**Current Behavior:** Review drafts can be validated independently; publish is disabled. Profile history is explicitly unavailable.

**Evidence:** `server/src/auth.js` exposes only Google login, current account, and logout. Merged `database/models/Review.js` has rating 1–5, text capped at 2,000, and unique user/game. #10 makes rating optional for status/text records, requires whole-number ratings, and adds `database/ratings.js`; no API routes are added.

**Impact:** Rating/review submissions, existing community review display, personal history, and edit/delete cannot be integrated.

**Suggested Owner:** Backend/API. Confirm the final request/response contract, ownership rules, optional-rating behavior, and required edit/delete scope. The frontend no longer asks for an unsupported stored review title.

## Wishlist and backlog persistence endpoints are missing

**Feature:** PBIs 17–22.

**Problem:** Wishlist/backlog operations have model groundwork only, without HTTP handlers.

**Expected Behavior:** Users can retrieve, add, remove, and update supported list entries with persistent membership and authorization.

**Current Behavior:** The two routes stay distinct and show unavailable states. No local-only membership changes are represented as saved.

**Evidence:** #10 proposes `Review.status` with `playing | played | backlog | wishlist` and a unique user/game record. It is unmerged and under review; #11 adds ingestion only. Neither branch adds list handlers. A single status means simultaneous independent wishlist and backlog memberships must not be assumed.

**Impact:** All persistent list actions and saved-state indicators are blocked.

**Suggested Owner:** Backend/API and database/model owner. Review #10 and publish endpoints plus status transition semantics. The frontend must adopt those semantics rather than create separate competing collections.

## Profile editing and wishlist privacy enforcement are missing

**Feature:** PBIs 3–4, 28–29.

**Problem:** Current-account auth output is limited to `id`, `email`, `displayName`, `avatarUrl`. There are no profile-update, public-profile, shared-list, or visibility-update handlers.

**Expected Behavior:** Profile updates persist; owners can choose wishlist visibility; public viewers receive only authorized data; private lists are denied by the server.

**Current Behavior:** The signed-in profile shows returned name/email. Edit/privacy controls are disabled. Public profile routes do not fetch or expose any fixture or private list data.

**Evidence:** `server/src/auth.js:publicUser`, `server/src/app.js`. #10 adds only `User.wishlistVisibility`, default `private`; a schema field does not enforce API access.

**Impact:** Editing, full profile/history display, sharing, and privacy settings are not operational.

**Suggested Owner:** Backend/API and authentication. Define separate owner/public response contracts and enforce authorization before returning lists. Confirm editable profile fields and validate them on the server.

## Existing dependency report — do not duplicate

`npm audit --prefix server --json` reports high-severity body-parser advisory GHSA-27r3-jxmh-p828 for versions below 2.4.0. [Dependabot PR #12](https://github.com/xArumos/sidequest/pull/12) already upgrades it to 2.4.0. No backend dependency changes or additional issue were created. Backend maintainers should review that existing PR.

## Local setup observation — not a backend defect

The default integration command initially failed three tests because no MongoDB was listening at `127.0.0.1:27017`. All four passed when rerun with temporary in-memory MongoDB through `MONGODB_TEST_URI`. Do not report this as a broken authentication implementation. Google browser verification remains pending configured OAuth settings and a browser environment.

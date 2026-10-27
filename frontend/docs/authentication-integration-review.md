# Frontend authentication integration review

This branch contains frontend-only changes on top of the existing frontend/test work. It keeps the gaming design, routed discovery/profile/list pages, and Google SDK component while adding the password API contracts from teammate PR #18. It does not modify that PR or any server/database file.

## Dependency and review status

PR #18 is not yet merged into main. Password registration/login require its reviewed API, session/index configuration, and migration performed by the backend owner. This frontend branch must remain a draft until that dependency is available. There is no simulated login or saved account. Main currently returns an error for unsupported password endpoints; the UI displays the server error without inventing success.

Google login remains `POST /api/auth/google`; password registration sends `{ username, email, password }` to `POST /api/auth/register`; password login sends `{ identifier, password }` to `POST /api/auth/login`. All requests use `credentials: include`. Registration confirmation stays in the browser and is not transmitted. Both login methods use the same session restore/logout and signed-in navigation.

Username validation follows the backend's 3–30 ASCII letters/digits/underscores rule; email input is validated; passwords use the backend's 15–128 Unicode-code-point rule, preserve whitespace, and require matching confirmation. Pending authentication disables the form and duplicate requests are guarded. Errors retain draft fields and are announced with role=alert.

## Validation

The frontend integration was first tested alongside the unmodified PR #18 backend: 92 frontend tests passed (including seven legacy prototype tests from that teammate branch), plus frontend lint/build and 18 responsive Chrome executions.

A separate real Chrome → Vite proxy → Express → disposable MongoDB check also passed registration, refresh/session restoration, logout, invalid-password rejection, username login, and email login, with no browser runtime exceptions. Only synthetic accounts and test-only session settings were used; no user database was touched. Live Google account verification was not repeated. This real-API test used PR #18 code and does not mean that backend is merged into main.

On this frontend-only branch, 85 tests passed: the existing 79 plus six new integration tests in `src/services/password-ui.test.jsx`. The extra seven legacy prototype tests are not present because their prototype files belong to PR #18, not to this frontend branch. Frontend lint and production build passed independently on this frontend-only branch.

Run from the repository root:

```bash
npm ci --prefix frontend
npm test --prefix frontend
npm run lint --prefix frontend
npm run build --prefix frontend
PLAYWRIGHT_CHANNEL=chrome npm run test:browser --prefix frontend
```

These six new automated tests use controlled fetch responses and the real frontend auth service; they do not claim live Google or production backend operation. The existing testing documents remain a historical snapshot at their explicitly recorded revision.

## Other PR review findings

- #10: reproduced a rating recalculation race. Two stored reviews (5 and 1 stars) can leave Game statistics at average 5/count 1 instead of average 3/count 2 when an earlier aggregate's update finishes last. No backend fix was authored; a review comment was posted for its owner.
- #11: import work depends on #10; leave pending until the model/recalculation finding is resolved. Unit/import tests pass; live IGDB was not called.
- #14: nine database tests pass; literal search escaping, deterministic pagination and input validation reviewed. Its branch is behind main, and only the owner should update it under the user's authorization limits.
- #13/#15: existing frontend and regression work tested together; GitHub still enforces branch updates, CI and independent approval requirements.
- #18: backend unit and migration/session integration tests pass. Its temporary frontend conflicts with the established app; this separate frontend branch provides a reviewable adaptation without changing teammate source.

## Posted review findings

- Ratings race: https://github.com/xArumos/sidequest/pull/10#issuecomment-6431352822
- Authentication/frontend conflicts: https://github.com/xArumos/sidequest/pull/18#issuecomment-6431353042
- Search PR owner update needed: https://github.com/xArumos/sidequest/pull/14#issuecomment-6431389387

PR #13 was synchronized with main and all CI checks passed. Its protected merge was rejected because independent review is still required. Repository auto-merge is disabled, and no protection bypass was attempted. Only user-authored frontend PRs were changed.

## Google UI follow-up

Google is now the first authentication option on both routes, above the password form. The existing Google API contract works on main as well as PR #18; only the password endpoints depend on merging PR #18. This checkout currently has no local Google client configuration and no reachable API, so live Google account login was not claimed. The teammate's reported successful Google login is evidence from their environment, not a live login repeated here.

Vite reuses only the public root `GOOGLE_CLIENT_ID` when `VITE_GOOGLE_CLIENT_ID` is absent. Explicit frontend configuration takes precedence. No session/database/Twitch secret is exposed. A production build using synthetic private markers confirmed the public ID is present and private markers are absent. Unit tests isolate themselves from local OAuth settings.

The official SDK button has loading, pending and error states; failed/stalled loads time out and can be retried in place. Empty/duplicate callbacks cannot manufacture login or duplicate pending requests. Credentials are exchanged with `/api/auth/google` using cookie credentials and are not written to browser storage. The API-confirmed account appears on the existing profile, reload restores the session, and logout clears it only after server success.

New tests run the real App, GoogleSignIn and frontend service with controlled SDK/HTTP fixtures. Google-specific browser tests run at desktop/tablet/mobile sizes; they are frontend integration tests, not verification of real Google tokens. All current per-test results and coverage are regenerated under docs/testing.

Git conflicts in PR #18 still require its owner to retain the established frontend instead of choosing the temporary AuthPanel/App wholesale. This frontend now supports its contract; no backend behavior change is needed to use it. Only the user's frontend PR is updated by this work.

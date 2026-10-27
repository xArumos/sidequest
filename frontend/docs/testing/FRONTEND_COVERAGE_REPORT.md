# Frontend coverage report

Measured by @vitest/coverage-v8 5.0.5 from the 96-test Vitest run on Monday, October 26, 2026 at 9:40 PM. This is executable JavaScript/JSX coverage, not a feature-completion score.

| Source | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| **TOTAL** | 92.04% (266/289) | 91.24% (198/217) | 80.41% (78/97) | 93.36% (211/226) |
| src/App.jsx | 86.09% (130/151) | 81.92% (68/83) | 68.42% (39/57) | 87.82% (101/115) |
| src/components/GameCard.jsx | 85.71% (6/7) | 94.73% (18/19) | 66.66% (2/3) | 85.71% (6/7) |
| src/components/GoogleSignIn.jsx | 100% (61/61) | 94.59% (35/37) | 100% (15/15) | 100% (44/44) |
| src/components/Layout.jsx | 100% (1/1) | 100% (4/4) | 100% (1/1) | 100% (1/1) |
| src/components/RatingForm.jsx | 100% (1/1) | 100% (0/0) | 100% (1/1) | 100% (1/1) |
| src/components/RatingInput.jsx | 100% (3/3) | 100% (3/3) | 100% (3/3) | 100% (3/3) |
| src/components/ReviewForm.jsx | 96.42% (27/28) | 95.23% (20/21) | 100% (4/4) | 100% (23/23) |
| src/services/auth.js | 100% (23/23) | 100% (19/19) | 100% (8/8) | 100% (19/19) |
| src/utils/games.js | 100% (9/9) | 100% (22/22) | 100% (4/4) | 100% (8/8) |
| src/utils/reviews.js | 100% (5/5) | 100% (9/9) | 100% (1/1) | 100% (5/5) |

## Scope and limitations

Includes production files under src/**/*.js and src/**/*.jsx, even files not imported by a test. Explicitly excludes test files/setup, unused mockData fixtures, and main.jsx's DOM bootstrap. Main is exercised by browser tests but is not in the V8 unit report. Browser CSS/layout execution is separate; no combined browser/unit coverage is claimed. V8 counts transformed React functions and source mappings, so percentages are not percentages of rendered UI states.

Build-time public-client configuration is tested separately by config/google-client.test.js but is outside the src-only coverage denominator.

App.jsx has the largest gap (especially functions/branches): populated catalog/detail/review/list sections and mutation closures are unreachable with the currently empty catalog and missing APIs. We did not expose test-only production data or pretend these branches work. GameCard's disabled wishlist callback remains unexecuted intentionally because no persistence endpoint exists. GoogleSignIn still has SDK/script sharing and guarded error branches needing additional concurrency scenarios. ReviewForm's defensive pending guard has limited separate coverage because actual controls are locked while saving.

## Untested frontend functionality and recommendations

- Integrate a real agreed catalog contract, then test populated discovery/detail/rankings routes, multi-genre handling, pagination completeness and count semantics using frontend HTTP mocks.
- Add tests for populated wishlist/backlog lists, confirmed add/remove, duplicates, cross-component state, and failed mutations when frontend handlers exist.
- Implement and then test own-review edit/delete/upsert and absence of other-author controls; confirm required scope with the team first.
- Test authorized public wishlists, denied/private responses and confirmed/failed visibility updates once server enforcement and frontend contracts exist.
- Add profile history, profile mutation and stale-session behavior around those actions once implemented.
- Add shared Google SDK concurrent-mount/retry cases and real-browser Google/cookie verification in a configured environment.
- Extend browser checks to another engine and smaller devices. Current measurements verify specific overlap/overflow conditions at 1280, 768 and 390 pixels; they are not exhaustive visual regression or accessibility audits.

Run npm run test:coverage --prefix frontend and open frontend/coverage/index.html for source-level details. Machine metrics are retained in artifacts/coverage-summary.json. No arbitrary threshold was added to hide missing feature branches.

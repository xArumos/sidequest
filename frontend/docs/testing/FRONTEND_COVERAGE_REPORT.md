# Frontend coverage report

Measured by @vitest/coverage-v8 5.0.5 from the 79-test Vitest run on Monday, October 26, 2026 at 4:32 PM. This is executable JavaScript/JSX coverage, not a feature-completion score.

| Source | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| **TOTAL** | 89.69% (209/233) | 87.8% (144/164) | 77.64% (66/85) | 91.97% (172/187) |
| src/App.jsx | 81.35% (96/118) | 65.95% (31/47) | 64% (32/50) | 85.1% (80/94) |
| src/components/GameCard.jsx | 85.71% (6/7) | 94.73% (18/19) | 66.66% (2/3) | 85.71% (6/7) |
| src/components/GoogleSignIn.jsx | 100% (40/40) | 90% (18/20) | 100% (12/12) | 100% (28/28) |
| src/components/Layout.jsx | 100% (1/1) | 100% (4/4) | 100% (1/1) | 100% (1/1) |
| src/components/RatingForm.jsx | 100% (1/1) | 100% (0/0) | 100% (1/1) | 100% (1/1) |
| src/components/RatingInput.jsx | 100% (3/3) | 100% (3/3) | 100% (3/3) | 100% (3/3) |
| src/components/ReviewForm.jsx | 96.42% (27/28) | 95.23% (20/21) | 100% (4/4) | 100% (23/23) |
| src/services/auth.js | 100% (21/21) | 100% (19/19) | 100% (6/6) | 100% (17/17) |
| src/utils/games.js | 100% (9/9) | 100% (22/22) | 100% (4/4) | 100% (8/8) |
| src/utils/reviews.js | 100% (5/5) | 100% (9/9) | 100% (1/1) | 100% (5/5) |

## Scope and limitations

Includes production files under src/**/*.js and src/**/*.jsx, even files not imported by a test. Explicitly excludes test files/setup, unused mockData fixtures, and main.jsx's DOM bootstrap. Main is exercised by browser tests but is not in the V8 unit report. Browser CSS/layout execution is separate; no combined browser/unit coverage is claimed. V8 counts transformed React functions and source mappings, so percentages are not percentages of rendered UI states.

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

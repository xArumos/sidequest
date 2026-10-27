# Frontend test execution results

- Vitest execution: Monday, October 26, 2026 at 10:08 PM (America/New_York).
- Browser execution: Monday, October 26, 2026 at 10:01 PM (America/New_York).
- Branch: `feature/frontend-password-auth-integration`.
- Validated application/test code commit: `033a92531be395e525ca219211d2085399b5e10c`. Documentation commits follow this code revision; see git history for delivery HEAD.
- Frameworks: Vitest 5.0.5, React Testing Library, user-event, jsdom; V8 coverage provider 5.0.5; Playwright 1.64.1 with installed Google Chrome.
- Runtime: v24.16.0.
- Baseline: **35 passing tests**, confirmed before changes.
- Created: **63 new Vitest tests + 10 browser scenarios = 73 new scenarios**. Three browser viewports do not inflate the scenario count.
- Final suite: **98 Vitest tests + 30 browser executions = 128 executions**, covering 108 distinct scenarios.
- Passed: **128**. Failed: **0**. Skipped/not run: **0**. Blocked executable tests: **0**. Full-stack E2E tests run: **0**.
- Missing planned scenarios: **3 NOT IMPLEMENTED**, separately listed below; they are not counted as passing or skipped automated tests.

## Commands executed

From repository root:

```bash
npm test --prefix frontend -- --reporter=json --outputFile=/tmp/sidequest-frontend-baseline.json
npm run test:coverage --prefix frontend -- --reporter=default --reporter=json --outputFile=docs/testing/artifacts/unit-results.json
PLAYWRIGHT_CHANNEL=chrome npm run test:browser --prefix frontend
PLAYWRIGHT_CHANNEL=chrome npm run test:google-browser --prefix frontend
npm run lint --prefix frontend
npm run build --prefix frontend
git diff --check
```

Dependency changes: only the matching V8 coverage provider and Playwright were added. Vitest/RTL/user-event were reused; no MSW or second unit-test framework was necessary. No backend/database tests were run for this assignment.

## Results by feature area

| Area | Vitest executions | Browser executions | Passed | Failed |
|---|---|---|---|---|
| Authentication | 50 | 12 | 62 | 0 |
| Backlog | 1 | 3 | 4 | 0 |
| Discovery & rankings | 10 | 3 | 13 | 0 |
| Game cards | 6 | 3 | 9 | 0 |
| Navigation & accessibility | 6 | 6 | 12 | 0 |
| Privacy | 4 | 3 | 7 | 0 |
| Profiles | 3 | 0 | 3 | 0 |
| Ratings & reviews | 15 | 0 | 15 | 0 |
| Wishlists | 3 | 0 | 3 | 0 |

## Failures investigated and bugs fixed

Initial regression runs deliberately exercised real production behavior and recorded **7 failing regression tests** in `artifacts/regressions-before-fix.json`. Final expectations were retained while fixing frontend code:

1. Missing card ratings crashed on `undefined.toFixed`: render Not rated and an unavailable-count label.
2. Broken/absent artwork had no fallback: provide named, accessible artwork placeholders.
3. Pending review requests allowed edits that were discarded on save: lock draft text/star controls and retain failed drafts for retry.
4. Malformed object-valued account IDs were accepted: require a nonempty string ID.
5. Empty 204 session responses were accepted: bodyless success is valid only for logout.
6. Incomplete discovery metadata could produce NaN comparisons: production sort/filter helper puts absent scores last and ignores untitled records. Known synthetic order tests cover ties, counts and immutability.

A temporary test-ID annotation mistake also changed route fixture strings during development, causing 11 route-test failures. The fixture strings were corrected; assertions were not weakened. That harness issue is distinct from product regressions. Final run has no failures. There are no disabled or skipped failure cases.

## Mocking and outstanding dependencies

App component tests mock the frontend auth service. Frontend integration tests run App and the actual fetch service together with controlled fetch responses and a synthetic Google widget. Browser tests run real Vite/React/CSS/Chrome but intercept auth responses; the card fixture renders actual GameCard with synthetic games. Pure sorting tests call production logic with a known four-game dataset. Review tests use callback spies/deferred promises, never an invented review route.

The catalog remains empty in the real application until an API exists. These tests do not inject synthetic catalog rankings into production. List add/remove flows, own-review editing/deletion, public list data and confirmed privacy changes cannot be meaningfully mocked because their frontend persistence handlers do not exist. Password forms are connected to the contract in unmerged backend PR #18; tests do not imply those endpoints exist on main. Live Google sign-in, real API cookies/persistence and backend privacy remain unverified.

Remote review: PR #13 contains the original frontend integration. Open PR #10 proposes models, #11 ingestion, and new #14 database game-search/filter helpers; none supplies the missing HTTP feature routes. None was merged or changed. Server/database and Steam functionality were untouched. Untracked wireframes were preserved.

## Spreadsheet traceability and unimplemented scope

Source: `Mod9_SoftwareTests-2.xlsx`, found in Downloads. All 13 populated cases were reviewed across ID, description, preconditions, steps, data, expected results and postconditions. Original workbook was not copied into the repository. All automation uses synthetic data; workbook credential values are excluded. Actual-result/status cells in the workbook were blank, so they are not evidence of execution.

| Original ID | Frontend adaptation | Remaining scope / status |
|---|---|---|
| TC-RATE-01 | Deferred success, rating/text validation, draft retention and character limit | PARTIAL: callback is mocked; published game/profile/community display and persistence are unavailable |
| TC-LOGIN-01 | Session restoration and account display; real frontend service integration also tested | PARTIAL: no username/history/list data API and no live Google account tested |
| TC-SORT-01 | Production sort/filter helper tested with known synthetic game orders; reset UI and browser checks | PARTIAL: no populated catalog route, no least-rated UI option; no claim of live ranking correctness |
| TC-USRDATA-01 | Supplemental tests verify disabled saves, supplied indicator and unavailable wishlist page | NOT IMPLEMENTED: add/remove, duplicates, populated list, failure recovery and cross-component saved membership flows have no frontend API boundary to exercise |
| TC-USRDATA-02 | Supplemental component/browser tests distinguish backlog from wishlist | NOT IMPLEMENTED: add/remove/update, duplicates, populated backlog and mutation failure flows are absent |
| TC-RATE-02 | Integer-only star choices and production validator boundaries (-1,0,6,5.4,NaN,Infinity,string/undefined) | PARTIAL: deleting/recalculating community totals is outside available frontend behavior |
| TC-RATE-03 | No manufactured edit/delete test | NOT IMPLEMENTED: own-review edit/delete, upsert/duplicate handling and other-author controls do not exist; workbook's API path is a test-plan reference, not an implemented endpoint |
| TC-LOGIN-02 | Mocked login errors, Google account creation UI, logout and protected navigation | PARTIAL: password forms and validation use the API contract from unmerged backend PR #18; duplicate-email handling and live deployment remain separate verification |
| TC-STEAM-01, TC-STEAM-02 | Excluded | OUT OF SCOPE: Sprint 2 |
| TC-FRIEND-01 | Excluded | OUT OF SCOPE: friendship |
| TC-DEV-01, TC-DEV-02 | Excluded | OUT OF SCOPE: developer accounts/moderation |

The workbook's TC-RATE-01 broadly says users cannot delete reviews, while TC-RATE-03 explicitly allows editing/deleting one's own review. Do not invent moderation/ownership behavior to resolve this ambiguity. The stored review contract caps text at **2,000 characters**, whereas TC-RATE-01 mentions an unspecified word count; tests follow the implemented character cap.

Three complete in-scope scenarios are NOT IMPLEMENTED (TC-USRDATA-01/02 and TC-RATE-03); they are documentation gaps, not silently skipped executable tests. Other cases are partial adaptations as stated. Frontend private/unavailable rendering does not establish server-side privacy enforcement.


## Complete execution summary

| Test ID | Description | Type | Status | Source file |
|---|---|---|---|---|
| TC-FE-GOOGLE-CONFIG-01 | reuses only the backend public client ID when the frontend override is absent | Unit | PASS | frontend/config/google-client.test.js |
| TC-FE-GOOGLE-CONFIG-02 | gives the explicit frontend environment precedence over the backend default | Unit | PASS | frontend/config/google-client.test.js |
| TC-FE-GOOGLE-CONFIG-03 | isolates unit tests from local Google settings and handles unconfigured environments | Unit | PASS | frontend/config/google-client.test.js |
| TC-FE-APP-01 | has one pair of homepage authentication links and no fixture statistics | Component | PASS | frontend/src/App.test.jsx |
| TC-LOGIN-01 | waits for session restoration before redirecting protected routes | Component | PASS | frontend/src/App.test.jsx |
| TC-FE-APP-04 | redirects signed-out users to the real sign-in flow | Component | PASS | frontend/src/App.test.jsx |
| TC-FE-APP-06 | creates account through the same Google authentication contract | Component | PASS | frontend/src/App.test.jsx |
| TC-FE-APP-08 | retains sign-in errors without pretending authentication succeeded | Component | PASS | frontend/src/App.test.jsx |
| TC-LOGIN-02 | keeps the account visible when logout fails and clears it on successful retry | Component | PASS | frontend/src/App.test.jsx |
| TC-FE-APP-12 | allows retry after a session connection failure | Component | PASS | frontend/src/App.test.jsx |
| TC-FE-APP-14 | resets catalog filters and distinguishes unavailable data from an empty library | Component | PASS | frontend/src/App.test.jsx |
| TC-FE-PRIVACY-01-1 | never shows fixture or private profile data | Component | PASS | frontend/src/App.test.jsx |
| TC-FE-PRIVACY-01-2 | never shows fixture or private profile data | Component | PASS | frontend/src/App.test.jsx |
| TC-FE-PRIVACY-01-3 | never shows fixture or private profile data | Component | PASS | frontend/src/App.test.jsx |
| TC-FE-UNAVAILABLE-WISHLIST | shows the unavailable state | Component | PASS | frontend/src/App.test.jsx |
| TC-FE-UNAVAILABLE-BACKLOG | shows the unavailable state | Component | PASS | frontend/src/App.test.jsx |
| TC-FE-UNAVAILABLE-DETAIL | shows the unavailable state | Component | PASS | frontend/src/App.test.jsx |
| TC-FE-APP-16 | disables profile changes and privacy controls without persistence | Component | PASS | frontend/src/App.test.jsx |
| TC-FE-APP-18 | handles unmatched routes | Component | PASS | frontend/src/App.test.jsx |
| TC-FE-APP-20 | lets users select most-reviewed rankings without showing invented results | Component | PASS | frontend/src/App.test.jsx |
| TC-FE-APP-22 | clears a stale account when session retry reports expiration | Component | PASS | frontend/src/App.test.jsx |
| TC-FE-CARD-01 | displays title genre description artwork and community metadata | Component | PASS | frontend/src/components/GameCard.test.jsx |
| TC-FE-CARD-02 | retains a complete long title as text rather than HTML | Component | PASS | frontend/src/components/GameCard.test.jsx |
| TC-FE-CARD-03 | handles missing rating and review-count data without crashing | Component | PASS | frontend/src/components/GameCard.test.jsx |
| TC-FE-CARD-04 | replaces a failed image with an accessible fallback | Component | PASS | frontend/src/components/GameCard.test.jsx |
| TC-FE-CARD-05 | handles an absent cover with a named fallback | Component | PASS | frontend/src/components/GameCard.test.jsx |
| TC-FE-WISHLIST-01 | never invokes unavailable wishlist persistence on repeated clicks | Component | PASS | frontend/src/components/GameCard.test.jsx |
| TC-FE-WISHLIST-02 | displays supplied wishlist membership without claiming it was saved | Component | PASS | frontend/src/components/GameCard.test.jsx |
| TC-FE-CARD-06 | follows the game detail link using its actual identifier | Component | PASS | frontend/src/components/GameCard.test.jsx |
| TC-FE-GOOGLE-04 | reports SDK network failure and allows a fresh load on remount | Component | PASS | frontend/src/components/GoogleSignIn.loading.test.jsx |
| TC-FE-GOOGLE-05 | handles a script that loads without the expected SDK | Component | PASS | frontend/src/components/GoogleSignIn.loading.test.jsx |
| TC-FE-GOOGLE-06 | avoids initializing the SDK after its component unmounts | Component | PASS | frontend/src/components/GoogleSignIn.loading.test.jsx |
| TC-FE-GOOGLE-07 | calls the latest credential callback after a parent rerender | Component | PASS | frontend/src/components/GoogleSignIn.loading.test.jsx |
| TC-FE-GOOGLE-08 | retries SDK loading in place without leaving the login page | Component | PASS | frontend/src/components/GoogleSignIn.loading.test.jsx |
| TC-FE-GOOGLE-09 | prevents callbacks while another authentication request is pending | Component | PASS | frontend/src/components/GoogleSignIn.loading.test.jsx |
| TC-FE-GOOGLE-10 | rejects an empty SDK credential without attempting authentication | Component | PASS | frontend/src/components/GoogleSignIn.loading.test.jsx |
| TC-FE-GOOGLE-11 | times out a stalled SDK request and offers retry | Component | PASS | frontend/src/components/GoogleSignIn.loading.test.jsx |
| TC-FE-GOOGLE-01 | hides Google configuration notices when sign-in is unconfigured | Component | PASS | frontend/src/components/GoogleSignIn.test.jsx |
| TC-FE-GOOGLE-02 | initializes the official SDK and forwards credentials only while mounted | Component | PASS | frontend/src/components/GoogleSignIn.test.jsx |
| TC-FE-GOOGLE-03 | announces in-progress authentication | Component | PASS | frontend/src/components/GoogleSignIn.test.jsx |
| TC-FE-GOOGLE-12 | initializes Google with the shared public backend client ID | Component | PASS | frontend/src/components/GoogleSignIn.test.jsx |
| TC-FE-NAV-01 | gives keyboard users a skip link targeting the main landmark | Component | PASS | frontend/src/components/Layout.test.jsx |
| TC-FE-NAV-02 | exposes private navigation only for a signed-in account | Component | PASS | frontend/src/components/Layout.test.jsx |
| TC-FE-NAV-03 | marks the current discovery route for assistive technology | Component | PASS | frontend/src/components/Layout.test.jsx |
| TC-FE-NAV-04 | disables repeated logout while a request is pending | Component | PASS | frontend/src/components/Layout.test.jsx |
| TC-FE-LEGACY-01 | keeps legacy rating form imports safe without an API connection | Component | PASS | frontend/src/components/RatingForm.test.jsx |
| TC-RATE-02 | offers only integer ratings 1 through 5 with selected feedback | Component | PASS | frontend/src/components/RatingInput.test.jsx |
| TC-FE-RATE-01 | selects a star with keyboard focus and Enter | Component | PASS | frontend/src/components/RatingInput.test.jsx |
| TC-FE-RATE-02 | blocks rating changes while disabled | Component | PASS | frontend/src/components/RatingInput.test.jsx |
| TC-FE-REVIEW-01 | allows local drafting but disables publishing without a real integration | Component | PASS | frontend/src/components/ReviewForm.test.jsx |
| TC-FE-REVIEW-02 | validates a rating and keeps a failed draft for retry | Component | PASS | frontend/src/components/ReviewForm.test.jsx |
| TC-RATE-01 | shows confirmation only after persistence resolves | Component | PASS | frontend/src/components/ReviewForm.test.jsx |
| TC-FE-RATE-03 | allows rating-only submission with optional text | Component | PASS | frontend/src/components/ReviewForm.test.jsx |
| TC-FE-RATE-04 | never enables publishing from an availability flag without a persistence callback | Component | PASS | frontend/src/components/ReviewForm.test.jsx |
| TC-FE-RATE-05 | retains the character limit and counter at the 2000-character boundary | Component | PASS | frontend/src/components/ReviewForm.test.jsx |
| TC-FE-RATE-06 | does not discard a new draft while an earlier submission is pending | Component | PASS | frontend/src/components/ReviewForm.test.jsx |
| TC-FE-RATE-07 | removes stale success feedback when a new draft begins | Component | PASS | frontend/src/components/ReviewForm.test.jsx |
| TC-FE-RATE-08 | uses an accessible fallback error and supports retry without losing text | Component | PASS | frontend/src/components/ReviewForm.test.jsx |
| TC-FE-INTEGRATION-01 | renders account data returned through the actual frontend fetch service | Integration | PASS | frontend/src/services/auth-ui.test.jsx |
| TC-FE-INTEGRATION-02 | exchanges a widget credential and clears state after bodyless logout | Integration | PASS | frontend/src/services/auth-ui.test.jsx |
| TC-FE-INTEGRATION-03 | surfaces structured rate-limit errors without authenticating | Integration | PASS | frontend/src/services/auth-ui.test.jsx |
| TC-FE-INTEGRATION-04 | rejects malformed profile data with a visible retry path | Integration | PASS | frontend/src/services/auth-ui.test.jsx |
| TC-FE-INTEGRATION-05 | aborts the session request when the application unmounts | Integration | PASS | frontend/src/services/auth-ui.test.jsx |
| TC-FE-INTEGRATION-06 | recovers from a network failure through the real request service | Integration | PASS | frontend/src/services/auth-ui.test.jsx |
| TC-FE-INTEGRATION-07 | keeps startup authentication configuration notices off the homepage | Integration | PASS | frontend/src/services/auth-ui.test.jsx |
| TC-FE-INTEGRATION-08 | reports an attempted unavailable sign-in without showing configuration details | Integration | PASS | frontend/src/services/auth-ui.test.jsx |
| TC-FE-AUTH-01 | restores cookie sessions | Unit | PASS | frontend/src/services/auth.test.js |
| TC-FE-AUTH-02 | posts the Google credential without storing a token | Unit | PASS | frontend/src/services/auth.test.js |
| TC-FE-AUTH-03 | handles logout with no JSON body | Unit | PASS | frontend/src/services/auth.test.js |
| TC-FE-AUTH-STATUS-401 | preserves server errors | Unit | PASS | frontend/src/services/auth.test.js |
| TC-FE-AUTH-STATUS-403 | preserves server errors | Unit | PASS | frontend/src/services/auth.test.js |
| TC-FE-AUTH-STATUS-429 | preserves server errors | Unit | PASS | frontend/src/services/auth.test.js |
| TC-FE-AUTH-STATUS-503 | preserves server errors | Unit | PASS | frontend/src/services/auth.test.js |
| TC-FE-AUTH-04 | rejects invalid success responses | Unit | PASS | frontend/src/services/auth.test.js |
| TC-FE-AUTH-05 | handles network failure | Unit | PASS | frontend/src/services/auth.test.js |
| TC-FE-AUTH-06 | preserves abort cancellation | Unit | PASS | frontend/src/services/auth.test.js |
| TC-FE-AUTH-11 | rejects non-JSON error responses with a safe fallback message | Unit | PASS | frontend/src/services/auth.test.js |
| TC-FE-AUTH-12 | rejects malformed user fields rather than creating a partial account | Unit | PASS | frontend/src/services/auth.test.js |
| TC-FE-AUTH-13 | rejects an empty success body for session restoration | Unit | PASS | frontend/src/services/auth.test.js |
| TC-FE-AUTH-14 | normalizes a configured API base without changing cookie handling | Unit | PASS | frontend/src/services/auth.test.js |
| TC-FE-GOOGLE-FLOW-01 | signs in through the actual Google component and restores and logs out the cookie session | Integration | PASS | frontend/src/services/google-ui.test.jsx |
| TC-FE-GOOGLE-FLOW-02 | exposes Google rejection and preserves the password login alternative | Integration | PASS | frontend/src/services/google-ui.test.jsx |
| TC-FE-GOOGLE-FLOW-03 | ignores duplicate SDK callbacks while the session request is pending | Integration | PASS | frontend/src/services/google-ui.test.jsx |
| TC-FE-PASSWORD-01 | validates required registration fields and email without sending a request | Integration | PASS | frontend/src/services/password-ui.test.jsx |
| TC-FE-PASSWORD-02 | rejects short passwords and mismatched confirmation while retaining input | Integration | PASS | frontend/src/services/password-ui.test.jsx |
| TC-FE-PASSWORD-03 | registers through the real frontend service without sending confirmation | Integration | PASS | frontend/src/services/password-ui.test.jsx |
| TC-FE-PASSWORD-04 | signs in using a username or email and displays server rejection safely | Integration | PASS | frontend/src/services/password-ui.test.jsx |
| TC-FE-PASSWORD-05 | prevents duplicate submissions until the server confirms the session | Integration | PASS | frontend/src/services/password-ui.test.jsx |
| TC-FE-PASSWORD-06 | counts Unicode code points for the minimum password length | Integration | PASS | frontend/src/services/password-ui.test.jsx |
| TC-SORT-01 | combines title search genre filtering and highest-rating sorting | Unit | PASS | frontend/src/utils/games.test.js |
| TC-FE-SORT-01 | orders top rated games without mutating the source dataset | Unit | PASS | frontend/src/utils/games.test.js |
| TC-FE-SORT-02 | orders most-reviewed games by counts rather than ratings | Unit | PASS | frontend/src/utils/games.test.js |
| TC-FE-SORT-03 | defaults to alphabetical titles and returns all genres | Unit | PASS | frontend/src/utils/games.test.js |
| TC-FE-SORT-04 | trims search whitespace and ignores title case | Unit | PASS | frontend/src/utils/games.test.js |
| TC-FE-SORT-05 | returns empty results for unmatched filters and empty datasets | Unit | PASS | frontend/src/utils/games.test.js |
| TC-FE-SORT-06 | places missing scores last and ignores records without usable titles | Unit | PASS | frontend/src/utils/games.test.js |
| TC-FE-RATE-09 | rejects out-of-range fractional and nonnumeric ratings before persistence | Unit | PASS | frontend/src/utils/reviews.test.js |
| TC-FE-RATE-10 | checks text boundaries after trimming without requiring review text | Unit | PASS | frontend/src/utils/reviews.test.js |
| TC-FE-BROWSER-01-DESKTOP | homepage auth navigation and viewport fit | Integration (browser) | PASS | frontend/e2e/frontend.spec.js |
| TC-FE-BROWSER-02-DESKTOP | keyboard skip navigation | Integration (browser) | PASS | frontend/e2e/frontend.spec.js |
| TC-FE-BROWSER-03-DESKTOP | discovery controls and responsive fit | Integration (browser) | PASS | frontend/e2e/frontend.spec.js |
| TC-FE-BROWSER-04-DESKTOP | card overflow and fallback layout | Integration (browser) | PASS | frontend/e2e/frontend.spec.js |
| TC-FE-BROWSER-05-DESKTOP | signed-in library navigation | Integration (browser) | PASS | frontend/e2e/frontend.spec.js |
| TC-FE-BROWSER-06-DESKTOP | privacy-safe public profile state | Integration (browser) | PASS | frontend/e2e/frontend.spec.js |
| TC-FE-BROWSER-07-DESKTOP | displays the local Google option without configuration banners | Integration (browser) | PASS | frontend/e2e/frontend.spec.js |
| TC-FE-BROWSER-01-TABLET | homepage auth navigation and viewport fit | Integration (browser) | PASS | frontend/e2e/frontend.spec.js |
| TC-FE-BROWSER-02-TABLET | keyboard skip navigation | Integration (browser) | PASS | frontend/e2e/frontend.spec.js |
| TC-FE-BROWSER-03-TABLET | discovery controls and responsive fit | Integration (browser) | PASS | frontend/e2e/frontend.spec.js |
| TC-FE-BROWSER-04-TABLET | card overflow and fallback layout | Integration (browser) | PASS | frontend/e2e/frontend.spec.js |
| TC-FE-BROWSER-05-TABLET | signed-in library navigation | Integration (browser) | PASS | frontend/e2e/frontend.spec.js |
| TC-FE-BROWSER-06-TABLET | privacy-safe public profile state | Integration (browser) | PASS | frontend/e2e/frontend.spec.js |
| TC-FE-BROWSER-07-TABLET | displays the local Google option without configuration banners | Integration (browser) | PASS | frontend/e2e/frontend.spec.js |
| TC-FE-BROWSER-01-MOBILE | homepage auth navigation and viewport fit | Integration (browser) | PASS | frontend/e2e/frontend.spec.js |
| TC-FE-BROWSER-02-MOBILE | keyboard skip navigation | Integration (browser) | PASS | frontend/e2e/frontend.spec.js |
| TC-FE-BROWSER-03-MOBILE | discovery controls and responsive fit | Integration (browser) | PASS | frontend/e2e/frontend.spec.js |
| TC-FE-BROWSER-04-MOBILE | card overflow and fallback layout | Integration (browser) | PASS | frontend/e2e/frontend.spec.js |
| TC-FE-BROWSER-05-MOBILE | signed-in library navigation | Integration (browser) | PASS | frontend/e2e/frontend.spec.js |
| TC-FE-BROWSER-06-MOBILE | privacy-safe public profile state | Integration (browser) | PASS | frontend/e2e/frontend.spec.js |
| TC-FE-BROWSER-07-MOBILE | displays the local Google option without configuration banners | Integration (browser) | PASS | frontend/e2e/frontend.spec.js |
| TC-FE-GOOGLE-BROWSER-01-DESKTOP | completes the Google callback session flow and refresh/logout at each viewport | Integration (browser) | PASS | frontend/e2e/google-auth.spec.js |
| TC-FE-GOOGLE-BROWSER-02-DESKTOP | renders rejected Google authentication without losing registration inputs | Integration (browser) | PASS | frontend/e2e/google-auth.spec.js |
| TC-FE-GOOGLE-BROWSER-03-DESKTOP | recovers from a failed Google SDK load using the in-page retry | Integration (browser) | PASS | frontend/e2e/google-auth.spec.js |
| TC-FE-GOOGLE-BROWSER-01-TABLET | completes the Google callback session flow and refresh/logout at each viewport | Integration (browser) | PASS | frontend/e2e/google-auth.spec.js |
| TC-FE-GOOGLE-BROWSER-02-TABLET | renders rejected Google authentication without losing registration inputs | Integration (browser) | PASS | frontend/e2e/google-auth.spec.js |
| TC-FE-GOOGLE-BROWSER-03-TABLET | recovers from a failed Google SDK load using the in-page retry | Integration (browser) | PASS | frontend/e2e/google-auth.spec.js |
| TC-FE-GOOGLE-BROWSER-01-MOBILE | completes the Google callback session flow and refresh/logout at each viewport | Integration (browser) | PASS | frontend/e2e/google-auth.spec.js |
| TC-FE-GOOGLE-BROWSER-02-MOBILE | renders rejected Google authentication without losing registration inputs | Integration (browser) | PASS | frontend/e2e/google-auth.spec.js |
| TC-FE-GOOGLE-BROWSER-03-MOBILE | recovers from a failed Google SDK load using the in-page retry | Integration (browser) | PASS | frontend/e2e/google-auth.spec.js |

## Evidence

- `artifacts/unit-output.txt`, `artifacts/unit-results.json`: actual Vitest output and per-case results.
- `artifacts/browser-output.txt`, `artifacts/browser-results.json`: actual Chrome execution output and per-project results.
- `artifacts/lint-output.txt`, `artifacts/build-output.txt`: successful lint/build output.
- `artifacts/coverage-summary.json`: measured V8 coverage; browser coverage is not merged into it.
- `artifacts/execution-info.json`, `artifacts/baseline-summary.json`: revision/runtime and pre-change counts.

Passing counts do not establish comprehensive feature coverage. See the coverage report for unexercised code and the scope table for unimplemented behavior.

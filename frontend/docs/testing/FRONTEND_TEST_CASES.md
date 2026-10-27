# Frontend automated test cases

Executed Monday, October 26, 2026 at 9:40 PM (America/New_York). 105 distinct automated scenarios; 123 executions including three browser viewports. Existing tests are preserved with traceable IDs.

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

## Executed automated cases

Browser base IDs expand to DESKTOP, TABLET and MOBILE execution IDs. These are browser integration tests using mocked API responses, not full-stack E2E.

### TC-FE-GOOGLE-CONFIG-01

**Test Case ID:** TC-FE-GOOGLE-CONFIG-01

**Test Name:** reuses only the backend public client ID when the frontend override is absent

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Unit

**Purpose:** Verify that the frontend reuses only the backend public client ID when the frontend override is absent.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Write a temporary backend environment with synthetic client and secret values.
2. Resolve the frontend Google client ID.

**Test Data:** Synthetic backend OAuth client ID and private markers

**Expected Result:** Only the public client ID is returned.

**Actual Result:** All assertions passed in the recorded execution. Only the public client ID is returned.

**Status:** PASS

**Test File:** [frontend/config/google-client.test.js](../../config/google-client.test.js)

**Dependencies:** Temporary synthetic environment files; no credentials.

**Notes:** Adapts TC-LOGIN-01, TC-LOGIN-02 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-GOOGLE-CONFIG-02

**Test Case ID:** TC-FE-GOOGLE-CONFIG-02

**Test Name:** gives the explicit frontend environment precedence over the backend default

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Unit

**Purpose:** Verify that the frontend gives the explicit frontend environment precedence over the backend default.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Write distinct synthetic root and frontend public IDs.
2. Resolve production configuration.

**Test Data:** Two synthetic public client IDs

**Expected Result:** The frontend override takes precedence.

**Actual Result:** All assertions passed in the recorded execution. The frontend override takes precedence.

**Status:** PASS

**Test File:** [frontend/config/google-client.test.js](../../config/google-client.test.js)

**Dependencies:** Temporary synthetic environment files; no credentials.

**Notes:** Adapts TC-LOGIN-01, TC-LOGIN-02 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-GOOGLE-CONFIG-03

**Test Case ID:** TC-FE-GOOGLE-CONFIG-03

**Test Name:** isolates unit tests from local Google settings and handles unconfigured environments

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Unit

**Purpose:** Verify that the frontend isolates unit tests from local Google settings and handles unconfigured environments.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Resolve an unconfigured checkout.
2. Write a synthetic root public ID.
3. Resolve in test mode.

**Test Data:** Empty configuration; synthetic root client ID

**Expected Result:** Missing configuration and test isolation both return an empty fallback.

**Actual Result:** All assertions passed in the recorded execution. Missing configuration and test isolation both return an empty fallback.

**Status:** PASS

**Test File:** [frontend/config/google-client.test.js](../../config/google-client.test.js)

**Dependencies:** Temporary synthetic environment files; no credentials.

**Notes:** Adapts TC-LOGIN-01, TC-LOGIN-02 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-APP-01

**Test Case ID:** TC-FE-APP-01

**Test Name:** has one pair of homepage authentication links and no fixture statistics

**Feature Area:** Navigation & accessibility

**Related Sprint 1 PBI:** 1–2

**Test Type:** Component

**Purpose:** Verify that the frontend has one pair of homepage authentication links and no fixture statistics.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Render signed-out homepage.
2. Count Join now and Log in links.
3. Check fixture title and fabricated statistic are absent.

**Test Data:** Anonymous session; /

**Expected Result:** Exactly one of each auth link; no fixture community data.

**Actual Result:** All assertions passed in the recorded execution. Exactly one of each auth link; no fixture community data.

**Status:** PASS

**Test File:** [frontend/src/App.test.jsx](../../src/App.test.jsx)

**Dependencies:** Mocked auth service and Google widget.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-LOGIN-01

**Test Case ID:** TC-LOGIN-01

**Test Name:** waits for session restoration before redirecting protected routes

**Feature Area:** Profiles

**Related Sprint 1 PBI:** 1–4

**Test Type:** Component

**Purpose:** Verify that the frontend waits for session restoration before redirecting protected routes.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Hold session response pending at /profile.
2. Verify loading status.
3. Resolve synthetic account.

**Test Data:** Deferred auth.me; user-1, Synthetic Player, player@example.test

**Expected Result:** No premature redirect; account heading appears after resolution.

**Actual Result:** All assertions passed in the recorded execution. No premature redirect; account heading appears after resolution.

**Status:** PASS

**Test File:** [frontend/src/App.test.jsx](../../src/App.test.jsx)

**Dependencies:** Mocked auth service and Google widget.

**Notes:** Adapts TC-LOGIN-01 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-APP-04

**Test Case ID:** TC-FE-APP-04

**Test Name:** redirects signed-out users to the real sign-in flow

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–2

**Test Type:** Component

**Purpose:** Verify that the frontend redirects signed-out users to the real sign-in flow.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Open /wishlist with a 401 session.
2. Wait for sign-in.
3. Check absence of password field.

**Test Data:** Anonymous session

**Expected Result:** Protected route redirects to sign-in and exposes the supported password field alongside Google.

**Actual Result:** All assertions passed in the recorded execution. Protected route redirects to sign-in and exposes the supported password field alongside Google.

**Status:** PASS

**Test File:** [frontend/src/App.test.jsx](../../src/App.test.jsx)

**Dependencies:** Mocked auth service and Google widget.

**Notes:** Adapts TC-LOGIN-02 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-APP-06

**Test Case ID:** TC-FE-APP-06

**Test Name:** creates account through the same Google authentication contract

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–2

**Test Type:** Component

**Purpose:** Verify that the frontend creates account through the same Google authentication contract.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Open /register.
2. Trigger synthetic Google callback.
3. Resolve login.

**Test Data:** Synthetic callback credential; synthetic account

**Expected Result:** Callback reaches auth service; returned account is displayed.

**Actual Result:** All assertions passed in the recorded execution. Callback reaches auth service; returned account is displayed.

**Status:** PASS

**Test File:** [frontend/src/App.test.jsx](../../src/App.test.jsx)

**Dependencies:** Mocked auth service and Google widget.

**Notes:** Adapts TC-LOGIN-02 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-APP-08

**Test Case ID:** TC-FE-APP-08

**Test Name:** retains sign-in errors without pretending authentication succeeded

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–2

**Test Type:** Component

**Purpose:** Verify that the frontend retains sign-in errors without pretending authentication succeeded.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Open /login.
2. Trigger callback.
3. Reject login with 401.

**Test Data:** Google sign-in could not be verified.

**Expected Result:** Accessible error appears; logout is absent.

**Actual Result:** All assertions passed in the recorded execution. Accessible error appears; logout is absent.

**Status:** PASS

**Test File:** [frontend/src/App.test.jsx](../../src/App.test.jsx)

**Dependencies:** Mocked auth service and Google widget.

**Notes:** Adapts TC-LOGIN-02 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-LOGIN-02

**Test Case ID:** TC-LOGIN-02

**Test Name:** keeps the account visible when logout fails and clears it on successful retry

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–2

**Test Type:** Component

**Purpose:** Verify that the frontend keeps the account visible when logout fails and clears it on successful retry.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Restore account.
2. Reject first logout.
3. Verify account remains.
4. Resolve retry.

**Test Data:** Synthetic account; network error then successful logout

**Expected Result:** Failure preserves profile; successful logout returns to sign-in.

**Actual Result:** All assertions passed in the recorded execution. Failure preserves profile; successful logout returns to sign-in.

**Status:** PASS

**Test File:** [frontend/src/App.test.jsx](../../src/App.test.jsx)

**Dependencies:** Mocked auth service and Google widget.

**Notes:** Adapts TC-LOGIN-02 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-APP-12

**Test Case ID:** TC-FE-APP-12

**Test Name:** allows retry after a session connection failure

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Component

**Purpose:** Verify that the frontend allows retry after a session connection failure.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Reject initial session request.
2. Click Retry connection.
3. Resolve account.

**Test Data:** Connection error followed by synthetic account

**Expected Result:** Profile becomes available after retry.

**Actual Result:** All assertions passed in the recorded execution. Profile becomes available after retry.

**Status:** PASS

**Test File:** [frontend/src/App.test.jsx](../../src/App.test.jsx)

**Dependencies:** Mocked auth service and Google widget.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-APP-14

**Test Case ID:** TC-FE-APP-14

**Test Name:** resets catalog filters and distinguishes unavailable data from an empty library

**Feature Area:** Discovery & rankings

**Related Sprint 1 PBI:** 14–16

**Test Type:** Component

**Purpose:** Verify that the frontend resets catalog filters and distinguishes unavailable data from an empty library.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Type search and select most-reviewed sort.
2. Reset filters.
3. Inspect controls and unavailable message.

**Test Data:** a game; reviews sort; no published catalog

**Expected Result:** Search clears, title sort is restored; no false empty-library claim.

**Actual Result:** All assertions passed in the recorded execution. Search clears, title sort is restored; no false empty-library claim.

**Status:** PASS

**Test File:** [frontend/src/App.test.jsx](../../src/App.test.jsx)

**Dependencies:** Mocked auth service and Google widget.

**Notes:** Adapts TC-SORT-01 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-PRIVACY-01-1

**Test Case ID:** TC-FE-PRIVACY-01-1

**Test Name:** never shows fixture or private profile data

**Feature Area:** Privacy

**Related Sprint 1 PBI:** 28–29

**Test Type:** Component

**Purpose:** Verify that the frontend never shows fixture or private profile data.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Open /users/unknown anonymously.
2. Inspect public-profile message.
3. Check no fixture names appear.

**Test Data:** /users/unknown

**Expected Result:** Only unavailable state is displayed; no fixture profile or list data.

**Actual Result:** All assertions passed in the recorded execution. Only unavailable state is displayed; no fixture profile or list data.

**Status:** PASS

**Test File:** [frontend/src/App.test.jsx](../../src/App.test.jsx)

**Dependencies:** Mocked auth service and Google widget.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-PRIVACY-01-2

**Test Case ID:** TC-FE-PRIVACY-01-2

**Test Name:** never shows fixture or private profile data

**Feature Area:** Privacy

**Related Sprint 1 PBI:** 28–29

**Test Type:** Component

**Purpose:** Verify that the frontend never shows fixture or private profile data.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Open /users/u1 anonymously.
2. Inspect public-profile message.
3. Check no fixture names appear.

**Test Data:** /users/u1

**Expected Result:** Only unavailable state is displayed; no fixture profile or list data.

**Actual Result:** All assertions passed in the recorded execution. Only unavailable state is displayed; no fixture profile or list data.

**Status:** PASS

**Test File:** [frontend/src/App.test.jsx](../../src/App.test.jsx)

**Dependencies:** Mocked auth service and Google widget.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-PRIVACY-01-3

**Test Case ID:** TC-FE-PRIVACY-01-3

**Test Name:** never shows fixture or private profile data

**Feature Area:** Privacy

**Related Sprint 1 PBI:** 28–29

**Test Type:** Component

**Purpose:** Verify that the frontend never shows fixture or private profile data.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Open /users/u2 anonymously.
2. Inspect public-profile message.
3. Check no fixture names appear.

**Test Data:** /users/u2

**Expected Result:** Only unavailable state is displayed; no fixture profile or list data.

**Actual Result:** All assertions passed in the recorded execution. Only unavailable state is displayed; no fixture profile or list data.

**Status:** PASS

**Test File:** [frontend/src/App.test.jsx](../../src/App.test.jsx)

**Dependencies:** Mocked auth service and Google widget.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-UNAVAILABLE-WISHLIST

**Test Case ID:** TC-FE-UNAVAILABLE-WISHLIST

**Test Name:** shows the unavailable state

**Feature Area:** Wishlists

**Related Sprint 1 PBI:** 17–19

**Test Type:** Component

**Purpose:** Verify that the frontend shows the unavailable state.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Restore synthetic account.
2. Open /wishlist.
3. Inspect unavailable heading.

**Test Data:** /wishlist

**Expected Result:** Unavailable state is explicit; no fabricated saved data.

**Actual Result:** All assertions passed in the recorded execution. Unavailable state is explicit; no fabricated saved data.

**Status:** PASS

**Test File:** [frontend/src/App.test.jsx](../../src/App.test.jsx)

**Dependencies:** Mocked auth service and Google widget.

**Notes:** Adapts TC-USRDATA-01 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-UNAVAILABLE-BACKLOG

**Test Case ID:** TC-FE-UNAVAILABLE-BACKLOG

**Test Name:** shows the unavailable state

**Feature Area:** Backlog

**Related Sprint 1 PBI:** 20–22

**Test Type:** Component

**Purpose:** Verify that the frontend shows the unavailable state.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Restore synthetic account.
2. Open /backlog.
3. Inspect unavailable heading.

**Test Data:** /backlog

**Expected Result:** Unavailable state is explicit; no fabricated saved data.

**Actual Result:** All assertions passed in the recorded execution. Unavailable state is explicit; no fabricated saved data.

**Status:** PASS

**Test File:** [frontend/src/App.test.jsx](../../src/App.test.jsx)

**Dependencies:** Mocked auth service and Google widget.

**Notes:** Adapts TC-USRDATA-02 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-UNAVAILABLE-DETAIL

**Test Case ID:** TC-FE-UNAVAILABLE-DETAIL

**Test Name:** shows the unavailable state

**Feature Area:** Discovery & rankings

**Related Sprint 1 PBI:** 5–16

**Test Type:** Component

**Purpose:** Verify that the frontend shows the unavailable state.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Restore synthetic account.
2. Open /games/unknown.
3. Inspect unavailable heading.

**Test Data:** /games/unknown

**Expected Result:** Unavailable state is explicit; no fabricated saved data.

**Actual Result:** All assertions passed in the recorded execution. Unavailable state is explicit; no fabricated saved data.

**Status:** PASS

**Test File:** [frontend/src/App.test.jsx](../../src/App.test.jsx)

**Dependencies:** Mocked auth service and Google widget.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-APP-16

**Test Case ID:** TC-FE-APP-16

**Test Name:** disables profile changes and privacy controls without persistence

**Feature Area:** Privacy

**Related Sprint 1 PBI:** 3–4, 28–29

**Test Type:** Component

**Purpose:** Verify that the frontend disables profile changes and privacy controls without persistence.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Open /profile/edit with a restored session.
2. Inspect save and visibility controls.

**Test Data:** Synthetic account; no profile persistence API

**Expected Result:** Save and visibility controls remain disabled; no claimed privacy update.

**Actual Result:** All assertions passed in the recorded execution. Save and visibility controls remain disabled; no claimed privacy update.

**Status:** PASS

**Test File:** [frontend/src/App.test.jsx](../../src/App.test.jsx)

**Dependencies:** Mocked auth service and Google widget.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-APP-18

**Test Case ID:** TC-FE-APP-18

**Test Name:** handles unmatched routes

**Feature Area:** Navigation & accessibility

**Related Sprint 1 PBI:** Cross-cutting

**Test Type:** Component

**Purpose:** Verify that the frontend handles unmatched routes.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Open /missing.
2. Inspect heading.
3. Check session request count.

**Test Data:** Unmatched route

**Expected Result:** Page not found is displayed; session is requested once.

**Actual Result:** All assertions passed in the recorded execution. Page not found is displayed; session is requested once.

**Status:** PASS

**Test File:** [frontend/src/App.test.jsx](../../src/App.test.jsx)

**Dependencies:** Mocked auth service and Google widget.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-APP-20

**Test Case ID:** TC-FE-APP-20

**Test Name:** lets users select most-reviewed rankings without showing invented results

**Feature Area:** Discovery & rankings

**Related Sprint 1 PBI:** 11–13

**Test Type:** Component

**Purpose:** Verify that the frontend lets users select most-reviewed rankings without showing invented results.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Open /rankings.
2. Select reviews.
3. Check unavailable message and absence of fixture count.

**Test Data:** reviews; no dataset

**Expected Result:** Selection changes while no fake ranking is shown.

**Actual Result:** All assertions passed in the recorded execution. Selection changes while no fake ranking is shown.

**Status:** PASS

**Test File:** [frontend/src/App.test.jsx](../../src/App.test.jsx)

**Dependencies:** Mocked auth service and Google widget.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-APP-22

**Test Case ID:** TC-FE-APP-22

**Test Name:** clears a stale account when session retry reports expiration

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Component

**Purpose:** Verify that the frontend clears a stale account when session retry reports expiration.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Restore account.
2. Reject logout.
3. Retry session request returning 401.

**Test Data:** Synthetic account; expired session

**Expected Result:** Account data clears and protected route shows sign-in.

**Actual Result:** All assertions passed in the recorded execution. Account data clears and protected route shows sign-in.

**Status:** PASS

**Test File:** [frontend/src/App.test.jsx](../../src/App.test.jsx)

**Dependencies:** Mocked auth service and Google widget.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-CARD-01

**Test Case ID:** TC-FE-CARD-01

**Test Name:** displays title genre description artwork and community metadata

**Feature Area:** Game cards

**Related Sprint 1 PBI:** 11–16

**Test Type:** Component

**Purpose:** Verify that the frontend displays title genre description artwork and community metadata.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Render card.
2. Inspect heading genre description image and score.

**Test Data:** Synthetic Adventure; Puzzle; 4.5; 12 reviews

**Expected Result:** All supplied metadata and artwork accessible name render.

**Actual Result:** All assertions passed in the recorded execution. All supplied metadata and artwork accessible name render.

**Status:** PASS

**Test File:** [frontend/src/components/GameCard.test.jsx](../../src/components/GameCard.test.jsx)

**Dependencies:** Synthetic inputs; no backend services.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-CARD-02

**Test Case ID:** TC-FE-CARD-02

**Test Name:** retains a complete long title as text rather than HTML

**Feature Area:** Game cards

**Related Sprint 1 PBI:** 11–16

**Test Type:** Component

**Purpose:** Verify that the frontend retains a complete long title as text rather than HTML.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Render long title containing HTML-like text.
2. Inspect heading and image count.

**Test Data:** Synthetic <img onerror=alert(1)> plus repeated title

**Expected Result:** Title remains text; no injected image is created.

**Actual Result:** All assertions passed in the recorded execution. Title remains text; no injected image is created.

**Status:** PASS

**Test File:** [frontend/src/components/GameCard.test.jsx](../../src/components/GameCard.test.jsx)

**Dependencies:** Synthetic inputs; no backend services.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-CARD-03

**Test Case ID:** TC-FE-CARD-03

**Test Name:** handles missing rating and review-count data without crashing

**Feature Area:** Game cards

**Related Sprint 1 PBI:** 11–16

**Test Type:** Component

**Purpose:** Verify that the frontend handles missing rating and review-count data without crashing.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Render card without rating or count.
2. Inspect fallback text.

**Test Data:** undefined rating/reviewCount

**Expected Result:** No crash, undefined or NaN; Not rated appears.

**Actual Result:** All assertions passed in the recorded execution. No crash, undefined or NaN; Not rated appears.

**Status:** PASS

**Test File:** [frontend/src/components/GameCard.test.jsx](../../src/components/GameCard.test.jsx)

**Dependencies:** Synthetic inputs; no backend services.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-CARD-04

**Test Case ID:** TC-FE-CARD-04

**Test Name:** replaces a failed image with an accessible fallback

**Feature Area:** Game cards

**Related Sprint 1 PBI:** 11–16

**Test Type:** Component

**Purpose:** Verify that the frontend replaces a failed image with an accessible fallback.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Render artwork.
2. Dispatch image error.
3. Inspect fallback.

**Test Data:** /synthetic-cover.svg error event

**Expected Result:** Accessible Artwork unavailable fallback replaces broken image.

**Actual Result:** All assertions passed in the recorded execution. Accessible Artwork unavailable fallback replaces broken image.

**Status:** PASS

**Test File:** [frontend/src/components/GameCard.test.jsx](../../src/components/GameCard.test.jsx)

**Dependencies:** Synthetic inputs; no backend services.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-CARD-05

**Test Case ID:** TC-FE-CARD-05

**Test Name:** handles an absent cover with a named fallback

**Feature Area:** Game cards

**Related Sprint 1 PBI:** 11–16

**Test Type:** Component

**Purpose:** Verify that the frontend handles an absent cover with a named fallback.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Render empty cover.
2. Inspect artwork fallback.

**Test Data:** Empty cover URL

**Expected Result:** Named fallback renders immediately.

**Actual Result:** All assertions passed in the recorded execution. Named fallback renders immediately.

**Status:** PASS

**Test File:** [frontend/src/components/GameCard.test.jsx](../../src/components/GameCard.test.jsx)

**Dependencies:** Synthetic inputs; no backend services.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-WISHLIST-01

**Test Case ID:** TC-FE-WISHLIST-01

**Test Name:** never invokes unavailable wishlist persistence on repeated clicks

**Feature Area:** Wishlists

**Related Sprint 1 PBI:** 17–19

**Test Type:** Component

**Purpose:** Verify that the frontend never invokes unavailable wishlist persistence on repeated clicks.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Render wishlist button.
2. Double-click it.
3. Inspect disabled state and callback count.

**Test Data:** Synthetic card; spy callback

**Expected Result:** Unavailable action stays disabled and never calls persistence.

**Actual Result:** All assertions passed in the recorded execution. Unavailable action stays disabled and never calls persistence.

**Status:** PASS

**Test File:** [frontend/src/components/GameCard.test.jsx](../../src/components/GameCard.test.jsx)

**Dependencies:** Synthetic inputs; no backend services.

**Notes:** Adapts TC-USRDATA-01 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-WISHLIST-02

**Test Case ID:** TC-FE-WISHLIST-02

**Test Name:** displays supplied wishlist membership without claiming it was saved

**Feature Area:** Wishlists

**Related Sprint 1 PBI:** 17–19

**Test Type:** Component

**Purpose:** Verify that the frontend displays supplied wishlist membership without claiming it was saved.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Supply wishlist membership.
2. Inspect button and confirmation text.

**Test Data:** isWishlisted=true

**Expected Result:** Wishlisted indicator is disabled; no save confirmation is invented.

**Actual Result:** All assertions passed in the recorded execution. Wishlisted indicator is disabled; no save confirmation is invented.

**Status:** PASS

**Test File:** [frontend/src/components/GameCard.test.jsx](../../src/components/GameCard.test.jsx)

**Dependencies:** Synthetic inputs; no backend services.

**Notes:** Adapts TC-USRDATA-01 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-CARD-06

**Test Case ID:** TC-FE-CARD-06

**Test Name:** follows the game detail link using its actual identifier

**Feature Area:** Game cards

**Related Sprint 1 PBI:** 11–16

**Test Type:** Component

**Purpose:** Verify that the frontend follows the game detail link using its actual identifier.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Render card inside router.
2. Click View details.
3. Inspect destination.

**Test Data:** synthetic-game-1

**Expected Result:** Link navigates using the actual game id.

**Actual Result:** All assertions passed in the recorded execution. Link navigates using the actual game id.

**Status:** PASS

**Test File:** [frontend/src/components/GameCard.test.jsx](../../src/components/GameCard.test.jsx)

**Dependencies:** Synthetic inputs; no backend services.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-GOOGLE-04

**Test Case ID:** TC-FE-GOOGLE-04

**Test Name:** reports SDK network failure and allows a fresh load on remount

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–2

**Test Type:** Component

**Purpose:** Verify that the frontend reports SDK network failure and allows a fresh load on remount.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Fail script loading.
2. Inspect alert.
3. Remount.
4. Dispatch successful retry load.

**Test Data:** Synthetic SDK and script events

**Expected Result:** Failed script is removed; retry initializes a fresh button.

**Actual Result:** All assertions passed in the recorded execution. Failed script is removed; retry initializes a fresh button.

**Status:** PASS

**Test File:** [frontend/src/components/GoogleSignIn.loading.test.jsx](../../src/components/GoogleSignIn.loading.test.jsx)

**Dependencies:** Synthetic SDK/script events; no Google network.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-GOOGLE-05

**Test Case ID:** TC-FE-GOOGLE-05

**Test Name:** handles a script that loads without the expected SDK

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–2

**Test Type:** Component

**Purpose:** Verify that the frontend handles a script that loads without the expected SDK.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Dispatch script load without defining SDK.

**Test Data:** Missing window.google

**Expected Result:** Accessible load error appears.

**Actual Result:** All assertions passed in the recorded execution. Accessible load error appears.

**Status:** PASS

**Test File:** [frontend/src/components/GoogleSignIn.loading.test.jsx](../../src/components/GoogleSignIn.loading.test.jsx)

**Dependencies:** Synthetic SDK/script events; no Google network.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-GOOGLE-06

**Test Case ID:** TC-FE-GOOGLE-06

**Test Name:** avoids initializing the SDK after its component unmounts

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–2

**Test Type:** Component

**Purpose:** Verify that the frontend avoids initializing the SDK after its component unmounts.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Start SDK load.
2. Unmount.
3. Complete loading.

**Test Data:** Deferred synthetic script

**Expected Result:** SDK is not initialized after unmount.

**Actual Result:** All assertions passed in the recorded execution. SDK is not initialized after unmount.

**Status:** PASS

**Test File:** [frontend/src/components/GoogleSignIn.loading.test.jsx](../../src/components/GoogleSignIn.loading.test.jsx)

**Dependencies:** Synthetic SDK/script events; no Google network.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-GOOGLE-07

**Test Case ID:** TC-FE-GOOGLE-07

**Test Name:** calls the latest credential callback after a parent rerender

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–2

**Test Type:** Component

**Purpose:** Verify that the frontend calls the latest credential callback after a parent rerender.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Initialize SDK.
2. Replace parent callback.
3. Invoke credential callback.

**Test Data:** Two callback spies; synthetic-token

**Expected Result:** Only the latest parent callback runs.

**Actual Result:** All assertions passed in the recorded execution. Only the latest parent callback runs.

**Status:** PASS

**Test File:** [frontend/src/components/GoogleSignIn.loading.test.jsx](../../src/components/GoogleSignIn.loading.test.jsx)

**Dependencies:** Synthetic SDK/script events; no Google network.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-GOOGLE-08

**Test Case ID:** TC-FE-GOOGLE-08

**Test Name:** retries SDK loading in place without leaving the login page

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Component

**Purpose:** Verify that the frontend retries SDK loading in place without leaving the login page.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Fail script loading.
2. Click Retry Google sign-in.
3. Complete the next synthetic SDK load.

**Test Data:** Synthetic SDK load/error events

**Expected Result:** A fresh SDK load renders the button and clears the error.

**Actual Result:** All assertions passed in the recorded execution. A fresh SDK load renders the button and clears the error.

**Status:** PASS

**Test File:** [frontend/src/components/GoogleSignIn.loading.test.jsx](../../src/components/GoogleSignIn.loading.test.jsx)

**Dependencies:** Synthetic Google SDK and event/timer spies.

**Notes:** Adapts TC-LOGIN-01, TC-LOGIN-02 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-GOOGLE-09

**Test Case ID:** TC-FE-GOOGLE-09

**Test Name:** prevents callbacks while another authentication request is pending

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Component

**Purpose:** Verify that the frontend prevents callbacks while another authentication request is pending.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Render busy Google sign-in.
2. Invoke SDK callback.
3. Clear busy and invoke again.

**Test Data:** Synthetic token; busy flag

**Expected Result:** Pending callback is ignored; the enabled callback runs once.

**Actual Result:** All assertions passed in the recorded execution. Pending callback is ignored; the enabled callback runs once.

**Status:** PASS

**Test File:** [frontend/src/components/GoogleSignIn.loading.test.jsx](../../src/components/GoogleSignIn.loading.test.jsx)

**Dependencies:** Synthetic Google SDK and event/timer spies.

**Notes:** Adapts TC-LOGIN-01, TC-LOGIN-02 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-GOOGLE-10

**Test Case ID:** TC-FE-GOOGLE-10

**Test Name:** rejects an empty SDK credential without attempting authentication

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Component

**Purpose:** Verify that the frontend rejects an empty SDK credential without attempting authentication.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Initialize synthetic SDK.
2. Invoke callback with an empty credential.
3. Inspect accessible error.

**Test Data:** Empty synthetic credential

**Expected Result:** No authentication callback occurs; an error appears.

**Actual Result:** All assertions passed in the recorded execution. No authentication callback occurs; an error appears.

**Status:** PASS

**Test File:** [frontend/src/components/GoogleSignIn.loading.test.jsx](../../src/components/GoogleSignIn.loading.test.jsx)

**Dependencies:** Synthetic Google SDK and event/timer spies.

**Notes:** Adapts TC-LOGIN-01, TC-LOGIN-02 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-GOOGLE-11

**Test Case ID:** TC-FE-GOOGLE-11

**Test Name:** times out a stalled SDK request and offers retry

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Component

**Purpose:** Verify that the frontend times out a stalled SDK request and offers retry.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Start an unresolved SDK request.
2. Advance fake clock 15 seconds.
3. Inspect error and retry control.

**Test Data:** Fake timers; no SDK response

**Expected Result:** Loading terminates with a retryable error.

**Actual Result:** All assertions passed in the recorded execution. Loading terminates with a retryable error.

**Status:** PASS

**Test File:** [frontend/src/components/GoogleSignIn.loading.test.jsx](../../src/components/GoogleSignIn.loading.test.jsx)

**Dependencies:** Synthetic Google SDK and event/timer spies.

**Notes:** Adapts TC-LOGIN-01, TC-LOGIN-02 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-GOOGLE-01

**Test Case ID:** TC-FE-GOOGLE-01

**Test Name:** explains unavailable configuration without showing a fake login

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–2

**Test Type:** Component

**Purpose:** Verify that the frontend explains unavailable configuration without showing a fake login.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Clear public client configuration.
2. Render sign-in.

**Test Data:** Empty VITE_GOOGLE_CLIENT_ID

**Expected Result:** Configuration-unavailable status replaces fake login.

**Actual Result:** All assertions passed in the recorded execution. Configuration-unavailable status replaces fake login.

**Status:** PASS

**Test File:** [frontend/src/components/GoogleSignIn.test.jsx](../../src/components/GoogleSignIn.test.jsx)

**Dependencies:** Synthetic SDK/script events; no Google network.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-GOOGLE-02

**Test Case ID:** TC-FE-GOOGLE-02

**Test Name:** initializes the official SDK and forwards credentials only while mounted

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–2

**Test Type:** Component

**Purpose:** Verify that the frontend initializes the official SDK and forwards credentials only while mounted.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Provide SDK spy.
2. Render button.
3. Invoke callback.
4. Unmount.
5. Invoke late callback.

**Test Data:** Synthetic public client id and tokens

**Expected Result:** SDK initializes/renders; credential is forwarded once only while mounted.

**Actual Result:** All assertions passed in the recorded execution. SDK initializes/renders; credential is forwarded once only while mounted.

**Status:** PASS

**Test File:** [frontend/src/components/GoogleSignIn.test.jsx](../../src/components/GoogleSignIn.test.jsx)

**Dependencies:** Synthetic SDK/script events; no Google network.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-GOOGLE-03

**Test Case ID:** TC-FE-GOOGLE-03

**Test Name:** announces in-progress authentication

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–2

**Test Type:** Component

**Purpose:** Verify that the frontend announces in-progress authentication.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Render sign-in while busy.

**Test Data:** Synthetic SDK; busy=true

**Expected Result:** Signing in status is announced.

**Actual Result:** All assertions passed in the recorded execution. Signing in status is announced.

**Status:** PASS

**Test File:** [frontend/src/components/GoogleSignIn.test.jsx](../../src/components/GoogleSignIn.test.jsx)

**Dependencies:** Synthetic SDK/script events; no Google network.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-GOOGLE-12

**Test Case ID:** TC-FE-GOOGLE-12

**Test Name:** initializes Google with the shared public backend client ID

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Component

**Purpose:** Verify that the frontend initializes Google with the shared public backend client ID.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Clear frontend ID override.
2. Provide synthetic shared public ID.
3. Initialize SDK and inspect options.

**Test Data:** synthetic-shared.apps.googleusercontent.com

**Expected Result:** Shared ID is used and automatic account selection is disabled.

**Actual Result:** All assertions passed in the recorded execution. Shared ID is used and automatic account selection is disabled.

**Status:** PASS

**Test File:** [frontend/src/components/GoogleSignIn.test.jsx](../../src/components/GoogleSignIn.test.jsx)

**Dependencies:** Synthetic Google SDK and event/timer spies.

**Notes:** Adapts TC-LOGIN-01, TC-LOGIN-02 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-NAV-01

**Test Case ID:** TC-FE-NAV-01

**Test Name:** gives keyboard users a skip link targeting the main landmark

**Feature Area:** Navigation & accessibility

**Related Sprint 1 PBI:** Cross-cutting

**Test Type:** Component

**Purpose:** Verify that the frontend gives keyboard users a skip link targeting the main landmark.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Render layout.
2. Tab once.
3. Inspect link and target landmark.

**Test Data:** Synthetic page

**Expected Result:** Skip link has focus and points to main-content.

**Actual Result:** All assertions passed in the recorded execution. Skip link has focus and points to main-content.

**Status:** PASS

**Test File:** [frontend/src/components/Layout.test.jsx](../../src/components/Layout.test.jsx)

**Dependencies:** Synthetic inputs; no backend services.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-NAV-02

**Test Case ID:** TC-FE-NAV-02

**Test Name:** exposes private navigation only for a signed-in account

**Feature Area:** Navigation & accessibility

**Related Sprint 1 PBI:** Cross-cutting

**Test Type:** Component

**Purpose:** Verify that the frontend exposes private navigation only for a signed-in account.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Render signed out.
2. Inspect navigation.
3. Rerender signed in.

**Test Data:** Authentication flag false then true

**Expected Result:** Private links appear only signed in; Join now disappears.

**Actual Result:** All assertions passed in the recorded execution. Private links appear only signed in; Join now disappears.

**Status:** PASS

**Test File:** [frontend/src/components/Layout.test.jsx](../../src/components/Layout.test.jsx)

**Dependencies:** Synthetic inputs; no backend services.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-NAV-03

**Test Case ID:** TC-FE-NAV-03

**Test Name:** marks the current discovery route for assistive technology

**Feature Area:** Navigation & accessibility

**Related Sprint 1 PBI:** Cross-cutting

**Test Type:** Component

**Purpose:** Verify that the frontend marks the current discovery route for assistive technology.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Render /games.
2. Inspect aria-current.

**Test Data:** /games

**Expected Result:** Games is current; Home is not current.

**Actual Result:** All assertions passed in the recorded execution. Games is current; Home is not current.

**Status:** PASS

**Test File:** [frontend/src/components/Layout.test.jsx](../../src/components/Layout.test.jsx)

**Dependencies:** Synthetic inputs; no backend services.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-NAV-04

**Test Case ID:** TC-FE-NAV-04

**Test Name:** disables repeated logout while a request is pending

**Feature Area:** Navigation & accessibility

**Related Sprint 1 PBI:** Cross-cutting

**Test Type:** Component

**Purpose:** Verify that the frontend disables repeated logout while a request is pending.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Render pending logout.
2. Click.
3. Clear busy.
4. Click again.

**Test Data:** Logout spy; busy true then false

**Expected Result:** Pending click does nothing; enabled click calls logout once.

**Actual Result:** All assertions passed in the recorded execution. Pending click does nothing; enabled click calls logout once.

**Status:** PASS

**Test File:** [frontend/src/components/Layout.test.jsx](../../src/components/Layout.test.jsx)

**Dependencies:** Synthetic inputs; no backend services.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-LEGACY-01

**Test Case ID:** TC-FE-LEGACY-01

**Test Name:** keeps legacy rating form imports safe without an API connection

**Feature Area:** Ratings & reviews

**Related Sprint 1 PBI:** 5–10

**Test Type:** Component

**Purpose:** Verify that the frontend keeps legacy rating form imports safe without an API connection.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Render legacy RatingForm import.
2. Inspect publish control and status.

**Test Data:** No persistence callback

**Expected Result:** Legacy boundary uses the safe disabled review form.

**Actual Result:** All assertions passed in the recorded execution. Legacy boundary uses the safe disabled review form.

**Status:** PASS

**Test File:** [frontend/src/components/RatingForm.test.jsx](../../src/components/RatingForm.test.jsx)

**Dependencies:** Synthetic inputs; no backend services.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-RATE-02

**Test Case ID:** TC-RATE-02

**Test Name:** offers only integer ratings 1 through 5 with selected feedback

**Feature Area:** Ratings & reviews

**Related Sprint 1 PBI:** 5–10

**Test Type:** Component

**Purpose:** Verify that the frontend offers only integer ratings 1 through 5 with selected feedback.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Inspect five star buttons.
2. Click each valid rating.
3. Rerender controlled value.
4. Inspect pressed feedback.

**Test Data:** Integer stars 1,2,3,4,5

**Expected Result:** Only five integer choices exist; callback and selected state match each star.

**Actual Result:** All assertions passed in the recorded execution. Only five integer choices exist; callback and selected state match each star.

**Status:** PASS

**Test File:** [frontend/src/components/RatingInput.test.jsx](../../src/components/RatingInput.test.jsx)

**Dependencies:** Synthetic inputs; no backend services.

**Notes:** Adapts TC-RATE-02 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-RATE-01

**Test Case ID:** TC-FE-RATE-01

**Test Name:** selects a star with keyboard focus and Enter

**Feature Area:** Ratings & reviews

**Related Sprint 1 PBI:** 5–10

**Test Type:** Component

**Purpose:** Verify that the frontend selects a star with keyboard focus and Enter.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Tab to first star.
2. Press Enter.
3. Inspect callback.

**Test Data:** 1-star keyboard selection

**Expected Result:** Accessible first star receives focus and returns rating 1.

**Actual Result:** All assertions passed in the recorded execution. Accessible first star receives focus and returns rating 1.

**Status:** PASS

**Test File:** [frontend/src/components/RatingInput.test.jsx](../../src/components/RatingInput.test.jsx)

**Dependencies:** Synthetic inputs; no backend services.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-RATE-02

**Test Case ID:** TC-FE-RATE-02

**Test Name:** blocks rating changes while disabled

**Feature Area:** Ratings & reviews

**Related Sprint 1 PBI:** 5–10

**Test Type:** Component

**Purpose:** Verify that the frontend blocks rating changes while disabled.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Render disabled stars.
2. Attempt click.
3. Inspect callbacks.

**Test Data:** disabled=true; current rating 2

**Expected Result:** All stars are disabled and no change callback fires.

**Actual Result:** All assertions passed in the recorded execution. All stars are disabled and no change callback fires.

**Status:** PASS

**Test File:** [frontend/src/components/RatingInput.test.jsx](../../src/components/RatingInput.test.jsx)

**Dependencies:** Synthetic inputs; no backend services.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-REVIEW-01

**Test Case ID:** TC-FE-REVIEW-01

**Test Name:** allows local drafting but disables publishing without a real integration

**Feature Area:** Ratings & reviews

**Related Sprint 1 PBI:** 5–10

**Test Type:** Component

**Purpose:** Verify that the frontend allows local drafting but disables publishing without a real integration.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Render default unavailable form.
2. Choose star and type draft.
3. Inspect publish state.

**Test Data:** Rating 4; Draft

**Expected Result:** Draft is local, publish disabled, persistence never called.

**Actual Result:** All assertions passed in the recorded execution. Draft is local, publish disabled, persistence never called.

**Status:** PASS

**Test File:** [frontend/src/components/ReviewForm.test.jsx](../../src/components/ReviewForm.test.jsx)

**Dependencies:** Spy/deferred persistence callback; no review API.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-REVIEW-02

**Test Case ID:** TC-FE-REVIEW-02

**Test Name:** validates a rating and keeps a failed draft for retry

**Feature Area:** Ratings & reviews

**Related Sprint 1 PBI:** 5–10

**Test Type:** Component

**Purpose:** Verify that the frontend validates a rating and keeps a failed draft for retry.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Submit without rating.
2. Select 5 and enter padded text.
3. Reject submission.

**Test Data:** Rating 0 then 5; padded Loved it; Service unavailable

**Expected Result:** Validation prevents empty rating; failed draft is retained and no success appears.

**Actual Result:** All assertions passed in the recorded execution. Validation prevents empty rating; failed draft is retained and no success appears.

**Status:** PASS

**Test File:** [frontend/src/components/ReviewForm.test.jsx](../../src/components/ReviewForm.test.jsx)

**Dependencies:** Spy/deferred persistence callback; no review API.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-RATE-01

**Test Case ID:** TC-RATE-01

**Test Name:** shows confirmation only after persistence resolves

**Feature Area:** Ratings & reviews

**Related Sprint 1 PBI:** 5–10

**Test Type:** Component

**Purpose:** Verify that the frontend shows confirmation only after persistence resolves.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Select 3 stars.
2. Submit to deferred callback.
3. Inspect pending state.
4. Resolve callback.

**Test Data:** Synthetic deferred persistence callback

**Expected Result:** Confirmation appears only after resolution, not while pending.

**Actual Result:** All assertions passed in the recorded execution. Confirmation appears only after resolution, not while pending.

**Status:** PASS

**Test File:** [frontend/src/components/ReviewForm.test.jsx](../../src/components/ReviewForm.test.jsx)

**Dependencies:** Spy/deferred persistence callback; no review API.

**Notes:** Adapts TC-RATE-01 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-RATE-03

**Test Case ID:** TC-FE-RATE-03

**Test Name:** allows rating-only submission with optional text

**Feature Area:** Ratings & reviews

**Related Sprint 1 PBI:** 5–10

**Test Type:** Component

**Purpose:** Verify that the frontend allows rating-only submission with optional text.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Choose 1 star.
2. Submit with empty optional review.

**Test Data:** rating 1; empty text

**Expected Result:** Callback receives rating-only payload and confirms after resolution.

**Actual Result:** All assertions passed in the recorded execution. Callback receives rating-only payload and confirms after resolution.

**Status:** PASS

**Test File:** [frontend/src/components/ReviewForm.test.jsx](../../src/components/ReviewForm.test.jsx)

**Dependencies:** Spy/deferred persistence callback; no review API.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-RATE-04

**Test Case ID:** TC-FE-RATE-04

**Test Name:** never enables publishing from an availability flag without a persistence callback

**Feature Area:** Ratings & reviews

**Related Sprint 1 PBI:** 5–10

**Test Type:** Component

**Purpose:** Verify that the frontend never enables publishing from an availability flag without a persistence callback.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Render available flag without callback.
2. Inspect publishing.

**Test Data:** available=true; no callback

**Expected Result:** Publish remains disabled and unavailable status is shown.

**Actual Result:** All assertions passed in the recorded execution. Publish remains disabled and unavailable status is shown.

**Status:** PASS

**Test File:** [frontend/src/components/ReviewForm.test.jsx](../../src/components/ReviewForm.test.jsx)

**Dependencies:** Spy/deferred persistence callback; no review API.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-RATE-05

**Test Case ID:** TC-FE-RATE-05

**Test Name:** retains the character limit and counter at the 2000-character boundary

**Feature Area:** Ratings & reviews

**Related Sprint 1 PBI:** 5–10

**Test Type:** Component

**Purpose:** Verify that the frontend retains the character limit and counter at the 2000-character boundary.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Paste exact text limit.
2. Attempt extra character.
3. Select 2 stars.
4. Submit.

**Test Data:** 2000 x characters plus attempted z

**Expected Result:** Counter/maxlength enforce 2000; valid payload contains exact-limit text.

**Actual Result:** All assertions passed in the recorded execution. Counter/maxlength enforce 2000; valid payload contains exact-limit text.

**Status:** PASS

**Test File:** [frontend/src/components/ReviewForm.test.jsx](../../src/components/ReviewForm.test.jsx)

**Dependencies:** Spy/deferred persistence callback; no review API.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-RATE-06

**Test Case ID:** TC-FE-RATE-06

**Test Name:** does not discard a new draft while an earlier submission is pending

**Feature Area:** Ratings & reviews

**Related Sprint 1 PBI:** 5–10

**Test Type:** Component

**Purpose:** Verify that the frontend does not discard a new draft while an earlier submission is pending.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Enter draft and rating.
2. Submit pending request.
3. Inspect disabled inputs.
4. Attempt repeat submit.
5. Resolve.

**Test Data:** Rating 4; Pending draft; deferred callback

**Expected Result:** Draft controls lock, callback runs once, and confirmed save resets inputs.

**Actual Result:** All assertions passed in the recorded execution. Draft controls lock, callback runs once, and confirmed save resets inputs.

**Status:** PASS

**Test File:** [frontend/src/components/ReviewForm.test.jsx](../../src/components/ReviewForm.test.jsx)

**Dependencies:** Spy/deferred persistence callback; no review API.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-RATE-07

**Test Case ID:** TC-FE-RATE-07

**Test Name:** removes stale success feedback when a new draft begins

**Feature Area:** Ratings & reviews

**Related Sprint 1 PBI:** 5–10

**Test Type:** Component

**Purpose:** Verify that the frontend removes stale success feedback when a new draft begins.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Save review.
2. Begin a new draft.
3. Inspect old confirmation.

**Test Data:** Rating 5 then New draft

**Expected Result:** Success feedback clears when new editing begins.

**Actual Result:** All assertions passed in the recorded execution. Success feedback clears when new editing begins.

**Status:** PASS

**Test File:** [frontend/src/components/ReviewForm.test.jsx](../../src/components/ReviewForm.test.jsx)

**Dependencies:** Spy/deferred persistence callback; no review API.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-RATE-08

**Test Case ID:** TC-FE-RATE-08

**Test Name:** uses an accessible fallback error and supports retry without losing text

**Feature Area:** Ratings & reviews

**Related Sprint 1 PBI:** 5–10

**Test Type:** Component

**Purpose:** Verify that the frontend uses an accessible fallback error and supports retry without losing text.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Submit draft to failing callback.
2. Inspect fallback error and retained text.
3. Retry successfully.

**Test Data:** Rating 3; Retry draft; empty error object then success

**Expected Result:** Accessible fallback error, retained draft, successful retry and cleared error.

**Actual Result:** All assertions passed in the recorded execution. Accessible fallback error, retained draft, successful retry and cleared error.

**Status:** PASS

**Test File:** [frontend/src/components/ReviewForm.test.jsx](../../src/components/ReviewForm.test.jsx)

**Dependencies:** Spy/deferred persistence callback; no review API.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-INTEGRATION-01

**Test Case ID:** TC-FE-INTEGRATION-01

**Test Name:** renders account data returned through the actual frontend fetch service

**Feature Area:** Profiles

**Related Sprint 1 PBI:** 1–4

**Test Type:** Integration

**Purpose:** Verify that the frontend renders account data returned through the actual frontend fetch service.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Restore /profile via real auth service and mocked fetch.
2. Inspect returned heading/email.
3. Check cookie request.

**Test Data:** 200 user envelope

**Expected Result:** Returned account renders and credentials: include is used.

**Actual Result:** All assertions passed in the recorded execution. Returned account renders and credentials: include is used.

**Status:** PASS

**Test File:** [frontend/src/services/auth-ui.test.jsx](../../src/services/auth-ui.test.jsx)

**Dependencies:** Mocked fetch; real App and frontend auth service; synthetic Google widget.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-INTEGRATION-02

**Test Case ID:** TC-FE-INTEGRATION-02

**Test Name:** exchanges a widget credential and clears state after bodyless logout

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Integration

**Purpose:** Verify that the frontend exchanges a widget credential and clears state after bodyless logout.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Return 401 session.
2. Trigger widget callback.
3. Return account.
4. Return 204 logout.
5. Inspect signed-out state.

**Test Data:** Synthetic credential; 401/200/204

**Expected Result:** Real frontend service posts the credential and clears account only on logout success.

**Actual Result:** All assertions passed in the recorded execution. Real frontend service posts the credential and clears account only on logout success.

**Status:** PASS

**Test File:** [frontend/src/services/auth-ui.test.jsx](../../src/services/auth-ui.test.jsx)

**Dependencies:** Mocked fetch; real App and frontend auth service; synthetic Google widget.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-INTEGRATION-03

**Test Case ID:** TC-FE-INTEGRATION-03

**Test Name:** surfaces structured rate-limit errors without authenticating

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Integration

**Purpose:** Verify that the frontend surfaces structured rate-limit errors without authenticating.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Return 401 session.
2. Trigger callback.
3. Return structured 429 error.

**Test Data:** RATE_LIMITED synthetic message

**Expected Result:** Error is announced; no signed-in navigation appears.

**Actual Result:** All assertions passed in the recorded execution. Error is announced; no signed-in navigation appears.

**Status:** PASS

**Test File:** [frontend/src/services/auth-ui.test.jsx](../../src/services/auth-ui.test.jsx)

**Dependencies:** Mocked fetch; real App and frontend auth service; synthetic Google widget.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-INTEGRATION-04

**Test Case ID:** TC-FE-INTEGRATION-04

**Test Name:** rejects malformed profile data with a visible retry path

**Feature Area:** Profiles

**Related Sprint 1 PBI:** 1–4

**Test Type:** Integration

**Purpose:** Verify that the frontend rejects malformed profile data with a visible retry path.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Return incomplete user envelope at /profile.
2. Inspect alert and retry control.

**Test Data:** User with id only

**Expected Result:** Malformed account is rejected and retry is available.

**Actual Result:** All assertions passed in the recorded execution. Malformed account is rejected and retry is available.

**Status:** PASS

**Test File:** [frontend/src/services/auth-ui.test.jsx](../../src/services/auth-ui.test.jsx)

**Dependencies:** Mocked fetch; real App and frontend auth service; synthetic Google widget.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-INTEGRATION-05

**Test Case ID:** TC-FE-INTEGRATION-05

**Test Name:** aborts the session request when the application unmounts

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Integration

**Purpose:** Verify that the frontend aborts the session request when the application unmounts.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Hold fetch pending.
2. Capture AbortSignal.
3. Unmount application.

**Test Data:** Pending session request

**Expected Result:** Signal changes to aborted.

**Actual Result:** All assertions passed in the recorded execution. Signal changes to aborted.

**Status:** PASS

**Test File:** [frontend/src/services/auth-ui.test.jsx](../../src/services/auth-ui.test.jsx)

**Dependencies:** Mocked fetch; real App and frontend auth service; synthetic Google widget.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-INTEGRATION-06

**Test Case ID:** TC-FE-INTEGRATION-06

**Test Name:** recovers from a network failure through the real request service

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Integration

**Purpose:** Verify that the frontend recovers from a network failure through the real request service.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Reject fetch.
2. Inspect network alert.
3. Retry with valid account.

**Test Data:** TypeError then synthetic account

**Expected Result:** Real service error is visible and retry restores profile.

**Actual Result:** All assertions passed in the recorded execution. Real service error is visible and retry restores profile.

**Status:** PASS

**Test File:** [frontend/src/services/auth-ui.test.jsx](../../src/services/auth-ui.test.jsx)

**Dependencies:** Mocked fetch; real App and frontend auth service; synthetic Google widget.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-AUTH-01

**Test Case ID:** TC-FE-AUTH-01

**Test Name:** restores cookie sessions

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Unit

**Purpose:** Verify that the frontend restores cookie sessions.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Restore session.
2. Inspect request URL/options.

**Test Data:** 200 synthetic user

**Expected Result:** Returned account matches response and cookie credentials are included.

**Actual Result:** All assertions passed in the recorded execution. Returned account matches response and cookie credentials are included.

**Status:** PASS

**Test File:** [frontend/src/services/auth.test.js](../../src/services/auth.test.js)

**Dependencies:** Mocked fetch; no HTTP server.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-AUTH-02

**Test Case ID:** TC-FE-AUTH-02

**Test Name:** posts the Google credential without storing a token

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Unit

**Purpose:** Verify that the frontend posts the Google credential without storing a token.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Submit credential.
2. Inspect JSON body and request options.

**Test Data:** Synthetic credential

**Expected Result:** POST /api/auth/google sends only credential with cookies.

**Actual Result:** All assertions passed in the recorded execution. POST /api/auth/google sends only credential with cookies.

**Status:** PASS

**Test File:** [frontend/src/services/auth.test.js](../../src/services/auth.test.js)

**Dependencies:** Mocked fetch; no HTTP server.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-AUTH-03

**Test Case ID:** TC-FE-AUTH-03

**Test Name:** handles logout with no JSON body

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Unit

**Purpose:** Verify that the frontend handles logout with no JSON body.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Return bodyless logout response.
2. Inspect request and return value.

**Test Data:** 204 with no body

**Expected Result:** Logout returns null without JSON parsing failure.

**Actual Result:** All assertions passed in the recorded execution. Logout returns null without JSON parsing failure.

**Status:** PASS

**Test File:** [frontend/src/services/auth.test.js](../../src/services/auth.test.js)

**Dependencies:** Mocked fetch; no HTTP server.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-AUTH-STATUS-401

**Test Case ID:** TC-FE-AUTH-STATUS-401

**Test Name:** preserves server errors

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Unit

**Purpose:** Verify that the frontend preserves server errors.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Return structured error response.
2. Await rejection and compare message/status.

**Test Data:** HTTP 401; Server message

**Expected Result:** Original server message and HTTP status are preserved.

**Actual Result:** All assertions passed in the recorded execution. Original server message and HTTP status are preserved.

**Status:** PASS

**Test File:** [frontend/src/services/auth.test.js](../../src/services/auth.test.js)

**Dependencies:** Mocked fetch; no HTTP server.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-AUTH-STATUS-403

**Test Case ID:** TC-FE-AUTH-STATUS-403

**Test Name:** preserves server errors

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Unit

**Purpose:** Verify that the frontend preserves server errors.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Return structured error response.
2. Await rejection and compare message/status.

**Test Data:** HTTP 403; Server message

**Expected Result:** Original server message and HTTP status are preserved.

**Actual Result:** All assertions passed in the recorded execution. Original server message and HTTP status are preserved.

**Status:** PASS

**Test File:** [frontend/src/services/auth.test.js](../../src/services/auth.test.js)

**Dependencies:** Mocked fetch; no HTTP server.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-AUTH-STATUS-429

**Test Case ID:** TC-FE-AUTH-STATUS-429

**Test Name:** preserves server errors

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Unit

**Purpose:** Verify that the frontend preserves server errors.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Return structured error response.
2. Await rejection and compare message/status.

**Test Data:** HTTP 429; Server message

**Expected Result:** Original server message and HTTP status are preserved.

**Actual Result:** All assertions passed in the recorded execution. Original server message and HTTP status are preserved.

**Status:** PASS

**Test File:** [frontend/src/services/auth.test.js](../../src/services/auth.test.js)

**Dependencies:** Mocked fetch; no HTTP server.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-AUTH-STATUS-503

**Test Case ID:** TC-FE-AUTH-STATUS-503

**Test Name:** preserves server errors

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Unit

**Purpose:** Verify that the frontend preserves server errors.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Return structured error response.
2. Await rejection and compare message/status.

**Test Data:** HTTP 503; Server message

**Expected Result:** Original server message and HTTP status are preserved.

**Actual Result:** All assertions passed in the recorded execution. Original server message and HTTP status are preserved.

**Status:** PASS

**Test File:** [frontend/src/services/auth.test.js](../../src/services/auth.test.js)

**Dependencies:** Mocked fetch; no HTTP server.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-AUTH-04

**Test Case ID:** TC-FE-AUTH-04

**Test Name:** rejects invalid success responses

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Unit

**Purpose:** Verify that the frontend rejects invalid success responses.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Return malformed success envelope.
2. Await rejection.

**Test Data:** 200 {}

**Expected Result:** Invalid account response error is raised.

**Actual Result:** All assertions passed in the recorded execution. Invalid account response error is raised.

**Status:** PASS

**Test File:** [frontend/src/services/auth.test.js](../../src/services/auth.test.js)

**Dependencies:** Mocked fetch; no HTTP server.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-AUTH-05

**Test Case ID:** TC-FE-AUTH-05

**Test Name:** handles network failure

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Unit

**Purpose:** Verify that the frontend handles network failure.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Reject fetch.
2. Await service rejection.

**Test Data:** Synthetic TypeError

**Expected Result:** Friendly network error with status 0 is raised.

**Actual Result:** All assertions passed in the recorded execution. Friendly network error with status 0 is raised.

**Status:** PASS

**Test File:** [frontend/src/services/auth.test.js](../../src/services/auth.test.js)

**Dependencies:** Mocked fetch; no HTTP server.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-AUTH-06

**Test Case ID:** TC-FE-AUTH-06

**Test Name:** preserves abort cancellation

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Unit

**Purpose:** Verify that the frontend preserves abort cancellation.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Reject fetch with AbortError.
2. Await rejection.

**Test Data:** Synthetic DOMException

**Expected Result:** Cancellation retains AbortError identity.

**Actual Result:** All assertions passed in the recorded execution. Cancellation retains AbortError identity.

**Status:** PASS

**Test File:** [frontend/src/services/auth.test.js](../../src/services/auth.test.js)

**Dependencies:** Mocked fetch; no HTTP server.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-AUTH-11

**Test Case ID:** TC-FE-AUTH-11

**Test Name:** rejects non-JSON error responses with a safe fallback message

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Unit

**Purpose:** Verify that the frontend rejects non-JSON error responses with a safe fallback message.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Return HTML gateway error.
2. Await rejection.

**Test Data:** 502 HTML response

**Expected Result:** Safe fallback message is used; HTML is not rendered.

**Actual Result:** All assertions passed in the recorded execution. Safe fallback message is used; HTML is not rendered.

**Status:** PASS

**Test File:** [frontend/src/services/auth.test.js](../../src/services/auth.test.js)

**Dependencies:** Mocked fetch; no HTTP server.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-AUTH-12

**Test Case ID:** TC-FE-AUTH-12

**Test Name:** rejects malformed user fields rather than creating a partial account

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Unit

**Purpose:** Verify that the frontend rejects malformed user fields rather than creating a partial account.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Return three malformed user shapes.
2. Await rejection for each.

**Test Data:** Object id; numeric displayName; missing email

**Expected Result:** Every malformed user is rejected.

**Actual Result:** All assertions passed in the recorded execution. Every malformed user is rejected.

**Status:** PASS

**Test File:** [frontend/src/services/auth.test.js](../../src/services/auth.test.js)

**Dependencies:** Mocked fetch; no HTTP server.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-AUTH-13

**Test Case ID:** TC-FE-AUTH-13

**Test Name:** rejects an empty success body for session restoration

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Unit

**Purpose:** Verify that the frontend rejects an empty success body for session restoration.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Return bodyless session response.
2. Await rejection.

**Test Data:** 204 /api/auth/me

**Expected Result:** Empty success is rejected instead of treated as a restored session.

**Actual Result:** All assertions passed in the recorded execution. Empty success is rejected instead of treated as a restored session.

**Status:** PASS

**Test File:** [frontend/src/services/auth.test.js](../../src/services/auth.test.js)

**Dependencies:** Mocked fetch; no HTTP server.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-AUTH-14

**Test Case ID:** TC-FE-AUTH-14

**Test Name:** normalizes a configured API base without changing cookie handling

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Unit

**Purpose:** Verify that the frontend normalizes a configured API base without changing cookie handling.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Set synthetic API base.
2. Reload service module.
3. Restore session.
4. Inspect URL.

**Test Data:** https://api.example.test/

**Expected Result:** Trailing slash is normalized and cookie credentials remain included.

**Actual Result:** All assertions passed in the recorded execution. Trailing slash is normalized and cookie credentials remain included.

**Status:** PASS

**Test File:** [frontend/src/services/auth.test.js](../../src/services/auth.test.js)

**Dependencies:** Mocked fetch; no HTTP server.

**Notes:** Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-GOOGLE-FLOW-01

**Test Case ID:** TC-FE-GOOGLE-FLOW-01

**Test Name:** signs in through the actual Google component and restores and logs out the cookie session

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Integration

**Purpose:** Verify that the frontend signs in through the actual Google component and restores and logs out the cookie session.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Render real App and GoogleSignIn with synthetic SDK.
2. Return signed-out response.
3. Click Google button and return account.
4. Remount and restore session.
5. Log out and inspect state.

**Test Data:** Synthetic Google credential/account; controlled 401/200/204 fetch responses

**Expected Result:** Correct Google POST is sent, account/restored session render, logout clears state, no credential is stored.

**Actual Result:** All assertions passed in the recorded execution. Correct Google POST is sent, account/restored session render, logout clears state, no credential is stored.

**Status:** PASS

**Test File:** [frontend/src/services/google-ui.test.jsx](../../src/services/google-ui.test.jsx)

**Dependencies:** Synthetic Google SDK and controlled HTTP responses; no live Google account.

**Notes:** Adapts TC-LOGIN-01, TC-LOGIN-02 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-GOOGLE-FLOW-02

**Test Case ID:** TC-FE-GOOGLE-FLOW-02

**Test Name:** exposes Google rejection and preserves the password login alternative

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Integration

**Purpose:** Verify that the frontend exposes Google rejection and preserves the password login alternative.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Open registration with real Google component.
2. Click synthetic SDK button.
3. Return invalid-token response.
4. Inspect error and password form.

**Test Data:** Synthetic 401 INVALID_GOOGLE_TOKEN

**Expected Result:** Error appears; no false login; password registration remains enabled.

**Actual Result:** All assertions passed in the recorded execution. Error appears; no false login; password registration remains enabled.

**Status:** PASS

**Test File:** [frontend/src/services/google-ui.test.jsx](../../src/services/google-ui.test.jsx)

**Dependencies:** Synthetic Google SDK and controlled HTTP responses; no live Google account.

**Notes:** Adapts TC-LOGIN-01, TC-LOGIN-02 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-GOOGLE-FLOW-03

**Test Case ID:** TC-FE-GOOGLE-FLOW-03

**Test Name:** ignores duplicate SDK callbacks while the session request is pending

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Integration

**Purpose:** Verify that the frontend ignores duplicate SDK callbacks while the session request is pending.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Hold Google authentication response pending.
2. Invoke SDK callback twice.
3. Inspect request count and disabled password field.
4. Resolve account.

**Test Data:** Deferred synthetic Google authentication

**Expected Result:** Only one login request runs; UI updates after confirmation.

**Actual Result:** All assertions passed in the recorded execution. Only one login request runs; UI updates after confirmation.

**Status:** PASS

**Test File:** [frontend/src/services/google-ui.test.jsx](../../src/services/google-ui.test.jsx)

**Dependencies:** Synthetic Google SDK and controlled HTTP responses; no live Google account.

**Notes:** Adapts TC-LOGIN-01, TC-LOGIN-02 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-PASSWORD-01

**Test Case ID:** TC-FE-PASSWORD-01

**Test Name:** validates required registration fields and email without sending a request

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Integration

**Purpose:** Verify that the frontend validates required registration fields and email without sending a request.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Open /register signed out.
2. Submit empty form.
3. Enter username and malformed email.
4. Submit and check alert/request count.

**Test Data:** synthetic_player; not-an-email

**Expected Result:** Required username and invalid email errors appear without a registration request.

**Actual Result:** All assertions passed in the recorded execution. Required username and invalid email errors appear without a registration request.

**Status:** PASS

**Test File:** [frontend/src/services/password-ui.test.jsx](../../src/services/password-ui.test.jsx)

**Dependencies:** Mocked fetch; real App and frontend auth service; no live backend.

**Notes:** Adapts TC-LOGIN-02 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-PASSWORD-02

**Test Case ID:** TC-FE-PASSWORD-02

**Test Name:** rejects short passwords and mismatched confirmation while retaining input

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Integration

**Purpose:** Verify that the frontend rejects short passwords and mismatched confirmation while retaining input.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Enter valid username/email and short password.
2. Submit and inspect length error.
3. Replace password with a valid long phrase but keep old confirmation.
4. Submit and inspect mismatch and retained email.

**Test Data:** too short; synthetic password phrase; player@example.test

**Expected Result:** Both validation errors prevent requests and retain account input.

**Actual Result:** All assertions passed in the recorded execution. Both validation errors prevent requests and retain account input.

**Status:** PASS

**Test File:** [frontend/src/services/password-ui.test.jsx](../../src/services/password-ui.test.jsx)

**Dependencies:** Mocked fetch; real App and frontend auth service; no live backend.

**Notes:** Adapts TC-LOGIN-02 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-PASSWORD-03

**Test Case ID:** TC-FE-PASSWORD-03

**Test Name:** registers through the real frontend service without sending confirmation

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Integration

**Purpose:** Verify that the frontend registers through the real frontend service without sending confirmation.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Complete valid registration.
2. Return a synthetic 201 user response.
3. Submit.
4. Inspect profile and request payload.

**Test Data:** synthetic_player; player@example.test; synthetic password phrase

**Expected Result:** Profile renders after success; POST contains username/email/password only with cookie credentials.

**Actual Result:** All assertions passed in the recorded execution. Profile renders after success; POST contains username/email/password only with cookie credentials.

**Status:** PASS

**Test File:** [frontend/src/services/password-ui.test.jsx](../../src/services/password-ui.test.jsx)

**Dependencies:** Mocked fetch; real App and frontend auth service; no live backend.

**Notes:** Adapts TC-LOGIN-02 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-PASSWORD-04

**Test Case ID:** TC-FE-PASSWORD-04

**Test Name:** signs in using a username or email and displays server rejection safely

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Integration

**Purpose:** Verify that the frontend signs in using a username or email and displays server rejection safely.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Submit empty login.
2. Enter identifier/password.
3. Return 401 and inspect error.
4. Retry with 200 account response.

**Test Data:** Synthetic email and rejected password; 401 then 200

**Expected Result:** Validation and server error appear; retry signs in without false early success.

**Actual Result:** All assertions passed in the recorded execution. Validation and server error appear; retry signs in without false early success.

**Status:** PASS

**Test File:** [frontend/src/services/password-ui.test.jsx](../../src/services/password-ui.test.jsx)

**Dependencies:** Mocked fetch; real App and frontend auth service; no live backend.

**Notes:** Adapts TC-LOGIN-02 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-PASSWORD-05

**Test Case ID:** TC-FE-PASSWORD-05

**Test Name:** prevents duplicate submissions until the server confirms the session

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Integration

**Purpose:** Verify that the frontend prevents duplicate submissions until the server confirms the session.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Enter credentials.
2. Hold login response pending.
3. Attempt repeated submit.
4. Resolve user response.

**Test Data:** Deferred synthetic login

**Expected Result:** Form controls disable, one login request runs, and profile appears only after response.

**Actual Result:** All assertions passed in the recorded execution. Form controls disable, one login request runs, and profile appears only after response.

**Status:** PASS

**Test File:** [frontend/src/services/password-ui.test.jsx](../../src/services/password-ui.test.jsx)

**Dependencies:** Mocked fetch; real App and frontend auth service; no live backend.

**Notes:** Adapts TC-LOGIN-02 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-PASSWORD-06

**Test Case ID:** TC-FE-PASSWORD-06

**Test Name:** counts Unicode code points for the minimum password length

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Integration

**Purpose:** Verify that the frontend counts Unicode code points for the minimum password length.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Complete registration with fifteen game-controller emoji.
2. Return 201 user envelope.
3. Submit and inspect payload.

**Test Data:** 15 synthetic emoji code points

**Expected Result:** Minimum-length Unicode password is accepted and transmitted unchanged.

**Actual Result:** All assertions passed in the recorded execution. Minimum-length Unicode password is accepted and transmitted unchanged.

**Status:** PASS

**Test File:** [frontend/src/services/password-ui.test.jsx](../../src/services/password-ui.test.jsx)

**Dependencies:** Mocked fetch; real App and frontend auth service; no live backend.

**Notes:** Adapts TC-LOGIN-02 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-SORT-01

**Test Case ID:** TC-SORT-01

**Test Name:** combines title search genre filtering and highest-rating sorting

**Feature Area:** Discovery & rankings

**Related Sprint 1 PBI:** 11–16

**Test Type:** Unit

**Purpose:** Verify that the frontend combines title search genre filtering and highest-rating sorting.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Filter quest titles in RPG genre.
2. Sort by rating.
3. Repeat for Puzzle.

**Test Data:** Quest/RPG => a,d,c; Puzzle => b

**Expected Result:** Combined filtering and descending rating order match the known dataset.

**Actual Result:** All assertions passed in the recorded execution. Combined filtering and descending rating order match the known dataset.

**Status:** PASS

**Test File:** [frontend/src/utils/games.test.js](../../src/utils/games.test.js)

**Dependencies:** Synthetic inputs; no backend services.

**Notes:** Adapts TC-SORT-01 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-SORT-01

**Test Case ID:** TC-FE-SORT-01

**Test Name:** orders top rated games without mutating the source dataset

**Feature Area:** Discovery & rankings

**Related Sprint 1 PBI:** 11–16

**Test Type:** Unit

**Purpose:** Verify that the frontend orders top rated games without mutating the source dataset.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Freeze source and records.
2. Sort by rating.
3. Compare input order.

**Test Data:** c:3/40, a:5/2, b:4/20, d:4/12 (rating/reviews)

**Expected Result:** Order a,b,d,c; original c,a,b,d remains unchanged.

**Actual Result:** All assertions passed in the recorded execution. Order a,b,d,c; original c,a,b,d remains unchanged.

**Status:** PASS

**Test File:** [frontend/src/utils/games.test.js](../../src/utils/games.test.js)

**Dependencies:** Synthetic inputs; no backend services.

**Notes:** Adapts TC-SORT-01 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-SORT-02

**Test Case ID:** TC-FE-SORT-02

**Test Name:** orders most-reviewed games by counts rather than ratings

**Feature Area:** Discovery & rankings

**Related Sprint 1 PBI:** 11–16

**Test Type:** Unit

**Purpose:** Verify that the frontend orders most-reviewed games by counts rather than ratings.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Sort the known dataset by review count.

**Test Data:** Same synthetic dataset

**Expected Result:** Order c,b,d,a, independent of rating order.

**Actual Result:** All assertions passed in the recorded execution. Order c,b,d,a, independent of rating order.

**Status:** PASS

**Test File:** [frontend/src/utils/games.test.js](../../src/utils/games.test.js)

**Dependencies:** Synthetic inputs; no backend services.

**Notes:** Adapts TC-SORT-01 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-SORT-03

**Test Case ID:** TC-FE-SORT-03

**Test Name:** defaults to alphabetical titles and returns all genres

**Feature Area:** Discovery & rankings

**Related Sprint 1 PBI:** 11–16

**Test Type:** Unit

**Purpose:** Verify that the frontend defaults to alphabetical titles and returns all genres.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Call discovery helper with defaults.

**Test Data:** Same synthetic dataset

**Expected Result:** Alphabetical order a,b,c,d across all genres.

**Actual Result:** All assertions passed in the recorded execution. Alphabetical order a,b,c,d across all genres.

**Status:** PASS

**Test File:** [frontend/src/utils/games.test.js](../../src/utils/games.test.js)

**Dependencies:** Synthetic inputs; no backend services.

**Notes:** Adapts TC-SORT-01 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-SORT-04

**Test Case ID:** TC-FE-SORT-04

**Test Name:** trims search whitespace and ignores title case

**Feature Area:** Discovery & rankings

**Related Sprint 1 PBI:** 11–16

**Test Type:** Unit

**Purpose:** Verify that the frontend trims search whitespace and ignores title case.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Search uppercase text with surrounding spaces.

**Test Data:**   AMBER  

**Expected Result:** Only Amber Quest is returned.

**Actual Result:** All assertions passed in the recorded execution. Only Amber Quest is returned.

**Status:** PASS

**Test File:** [frontend/src/utils/games.test.js](../../src/utils/games.test.js)

**Dependencies:** Synthetic inputs; no backend services.

**Notes:** Adapts TC-SORT-01 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-SORT-05

**Test Case ID:** TC-FE-SORT-05

**Test Name:** returns empty results for unmatched filters and empty datasets

**Feature Area:** Discovery & rankings

**Related Sprint 1 PBI:** 11–16

**Test Type:** Unit

**Purpose:** Verify that the frontend returns empty results for unmatched filters and empty datasets.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Search absent title.
2. Filter absent genre.
3. Supply empty array.

**Test Data:** missing; Strategy; []

**Expected Result:** All return empty arrays.

**Actual Result:** All assertions passed in the recorded execution. All return empty arrays.

**Status:** PASS

**Test File:** [frontend/src/utils/games.test.js](../../src/utils/games.test.js)

**Dependencies:** Synthetic inputs; no backend services.

**Notes:** Adapts TC-SORT-01 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-SORT-06

**Test Case ID:** TC-FE-SORT-06

**Test Name:** places missing scores last and ignores records without usable titles

**Feature Area:** Discovery & rankings

**Related Sprint 1 PBI:** 11–16

**Test Type:** Unit

**Purpose:** Verify that the frontend places missing scores last and ignores records without usable titles.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Include null/untitled records and missing scores.
2. Sort by rating and reviews.

**Test Data:** Missing metadata record plus four known games

**Expected Result:** Malformed titles are ignored and missing scores sort last.

**Actual Result:** All assertions passed in the recorded execution. Malformed titles are ignored and missing scores sort last.

**Status:** PASS

**Test File:** [frontend/src/utils/games.test.js](../../src/utils/games.test.js)

**Dependencies:** Synthetic inputs; no backend services.

**Notes:** Adapts TC-SORT-01 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-RATE-09

**Test Case ID:** TC-FE-RATE-09

**Test Name:** rejects out-of-range fractional and nonnumeric ratings before persistence

**Feature Area:** Ratings & reviews

**Related Sprint 1 PBI:** 5–10

**Test Type:** Unit

**Purpose:** Verify that the frontend rejects out-of-range fractional and nonnumeric ratings before persistence.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Validate each invalid boundary.
2. Validate each valid whole-number star.

**Test Data:** Invalid -1,0,6,5.4,NaN,Infinity,string 3,undefined; valid 1–5

**Expected Result:** Invalid values return validation errors; valid integers pass.

**Actual Result:** All assertions passed in the recorded execution. Invalid values return validation errors; valid integers pass.

**Status:** PASS

**Test File:** [frontend/src/utils/reviews.test.js](../../src/utils/reviews.test.js)

**Dependencies:** Synthetic inputs; no backend services.

**Notes:** Adapts TC-RATE-02 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-RATE-10

**Test Case ID:** TC-FE-RATE-10

**Test Name:** checks text boundaries after trimming without requiring review text

**Feature Area:** Ratings & reviews

**Related Sprint 1 PBI:** 5–10

**Test Type:** Unit

**Purpose:** Verify that the frontend checks text boundaries after trimming without requiring review text.

**Preconditions:** Frontend dependencies installed; Vitest jsdom environment (pure helpers execute within the configured frontend runner); synthetic dependencies configured as below.

**Test Steps:**

1. Validate exact limit.
2. Validate excess text.
3. Validate whitespace and non-text.

**Test Data:** 2000/2001 characters; whitespace; undefined

**Expected Result:** Exact limit and trimmed empty text pass; excess and non-text fail.

**Actual Result:** All assertions passed in the recorded execution. Exact limit and trimmed empty text pass; excess and non-text fail.

**Status:** PASS

**Test File:** [frontend/src/utils/reviews.test.js](../../src/utils/reviews.test.js)

**Dependencies:** Synthetic inputs; no backend services.

**Notes:** Adapts TC-RATE-01 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-BROWSER-01-DESKTOP

**Test Case ID:** TC-FE-BROWSER-01-DESKTOP

**Test Name:** homepage auth navigation and viewport fit

**Feature Area:** Navigation & accessibility

**Related Sprint 1 PBI:** Cross-cutting

**Test Type:** Integration (browser)

**Purpose:** Verify that the frontend homepage auth navigation and viewport fit.

**Preconditions:** Frontend dependencies installed; Chrome available and Playwright starts isolated Vite on port 4174; synthetic dependencies configured as below.

**Test Steps:**

1. Mock signed-out session.
2. Open homepage.
3. Check horizontal fit and auth count.
4. Follow Join now and Log in links.
5. Capture page errors.

**Test Data:** 401 session; three viewport sizes

**Expected Result:** Auth navigation works, layout fits, and no uncaught page errors occur.

**Actual Result:** All assertions passed in the recorded execution. Auth navigation works, layout fits, and no uncaught page errors occur.

**Status:** PASS

**Test File:** [frontend/e2e/frontend.spec.js](../../e2e/frontend.spec.js)

**Dependencies:** Real Chrome and Vite; mocked auth HTTP responses; synthetic card harness.

**Notes:** Browser project desktop; viewport 1280×900. Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-BROWSER-02-DESKTOP

**Test Case ID:** TC-FE-BROWSER-02-DESKTOP

**Test Name:** keyboard skip navigation

**Feature Area:** Navigation & accessibility

**Related Sprint 1 PBI:** Cross-cutting

**Test Type:** Integration (browser)

**Purpose:** Verify that the frontend keyboard skip navigation.

**Preconditions:** Frontend dependencies installed; Chrome available and Playwright starts isolated Vite on port 4174; synthetic dependencies configured as below.

**Test Steps:**

1. Open homepage.
2. Tab to skip link.
3. Verify viewport visibility.
4. Press Enter.

**Test Data:** Keyboard navigation at three sizes

**Expected Result:** Skip link is focused/visible and URL targets main-content.

**Actual Result:** All assertions passed in the recorded execution. Skip link is focused/visible and URL targets main-content.

**Status:** PASS

**Test File:** [frontend/e2e/frontend.spec.js](../../e2e/frontend.spec.js)

**Dependencies:** Real Chrome and Vite; mocked auth HTTP responses; synthetic card harness.

**Notes:** Browser project desktop; viewport 1280×900. Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-BROWSER-03-DESKTOP

**Test Case ID:** TC-FE-BROWSER-03-DESKTOP

**Test Name:** discovery controls and responsive fit

**Feature Area:** Discovery & rankings

**Related Sprint 1 PBI:** 14–16

**Test Type:** Integration (browser)

**Purpose:** Verify that the frontend discovery controls and responsive fit.

**Preconditions:** Frontend dependencies installed; Chrome available and Playwright starts isolated Vite on port 4174; synthetic dependencies configured as below.

**Test Steps:**

1. Open /games.
2. Enter search and reviews sort.
3. Reset.
4. Inspect controls and viewport.

**Test Data:** Synthetic search; reviews

**Expected Result:** Filters reset and catalog-unavailable message fits the viewport.

**Actual Result:** All assertions passed in the recorded execution. Filters reset and catalog-unavailable message fits the viewport.

**Status:** PASS

**Test File:** [frontend/e2e/frontend.spec.js](../../e2e/frontend.spec.js)

**Dependencies:** Real Chrome and Vite; mocked auth HTTP responses; synthetic card harness.

**Notes:** Browser project desktop; viewport 1280×900. Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-BROWSER-04-DESKTOP

**Test Case ID:** TC-FE-BROWSER-04-DESKTOP

**Test Name:** card overflow and fallback layout

**Feature Area:** Game cards

**Related Sprint 1 PBI:** 11–16

**Test Type:** Integration (browser)

**Purpose:** Verify that the frontend card overflow and fallback layout.

**Preconditions:** Frontend dependencies installed; Chrome available and Playwright starts isolated Vite on port 4174; synthetic dependencies configured as below.

**Test Steps:**

1. Open real-card harness.
2. Fail artwork.
3. Measure title/metadata/card bounds.
4. Inspect unrated fallback and page width.

**Test Data:** Long unbroken synthetic title; broken/empty artwork; missing rating

**Expected Result:** No overlap or horizontal overflow; accessible artwork and rating fallbacks render.

**Actual Result:** All assertions passed in the recorded execution. No overlap or horizontal overflow; accessible artwork and rating fallbacks render.

**Status:** PASS

**Test File:** [frontend/e2e/frontend.spec.js](../../e2e/frontend.spec.js)

**Dependencies:** Real Chrome and Vite; mocked auth HTTP responses; synthetic card harness.

**Notes:** Browser project desktop; viewport 1280×900. Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-BROWSER-05-DESKTOP

**Test Case ID:** TC-FE-BROWSER-05-DESKTOP

**Test Name:** signed-in library navigation

**Feature Area:** Backlog

**Related Sprint 1 PBI:** 17–22

**Test Type:** Integration (browser)

**Purpose:** Verify that the frontend signed-in library navigation.

**Preconditions:** Frontend dependencies installed; Chrome available and Playwright starts isolated Vite on port 4174; synthetic dependencies configured as below.

**Test Steps:**

1. Mock account.
2. Open profile.
3. Navigate to Wishlist then Backlog.
4. Check page width.

**Test Data:** Synthetic Browser Player, browser@example.test

**Expected Result:** Both distinct unavailable pages are reachable and fit the viewport.

**Actual Result:** All assertions passed in the recorded execution. Both distinct unavailable pages are reachable and fit the viewport.

**Status:** PASS

**Test File:** [frontend/e2e/frontend.spec.js](../../e2e/frontend.spec.js)

**Dependencies:** Real Chrome and Vite; mocked auth HTTP responses; synthetic card harness.

**Notes:** Browser project desktop; viewport 1280×900. Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-BROWSER-06-DESKTOP

**Test Case ID:** TC-FE-BROWSER-06-DESKTOP

**Test Name:** privacy-safe public profile state

**Feature Area:** Privacy

**Related Sprint 1 PBI:** 28–29

**Test Type:** Integration (browser)

**Purpose:** Verify that the frontend privacy-safe public profile state.

**Preconditions:** Frontend dependencies installed; Chrome available and Playwright starts isolated Vite on port 4174; synthetic dependencies configured as below.

**Test Steps:**

1. Open synthetic public-profile path.
2. Inspect status.
3. Check no articles or edit/delete controls.

**Test Data:** /users/synthetic-private-player; signed out

**Expected Result:** Only unavailable information renders; no list records leak.

**Actual Result:** All assertions passed in the recorded execution. Only unavailable information renders; no list records leak.

**Status:** PASS

**Test File:** [frontend/e2e/frontend.spec.js](../../e2e/frontend.spec.js)

**Dependencies:** Real Chrome and Vite; mocked auth HTTP responses; synthetic card harness.

**Notes:** Browser project desktop; viewport 1280×900. Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-BROWSER-01-TABLET

**Test Case ID:** TC-FE-BROWSER-01-TABLET

**Test Name:** homepage auth navigation and viewport fit

**Feature Area:** Navigation & accessibility

**Related Sprint 1 PBI:** Cross-cutting

**Test Type:** Integration (browser)

**Purpose:** Verify that the frontend homepage auth navigation and viewport fit.

**Preconditions:** Frontend dependencies installed; Chrome available and Playwright starts isolated Vite on port 4174; synthetic dependencies configured as below.

**Test Steps:**

1. Mock signed-out session.
2. Open homepage.
3. Check horizontal fit and auth count.
4. Follow Join now and Log in links.
5. Capture page errors.

**Test Data:** 401 session; three viewport sizes

**Expected Result:** Auth navigation works, layout fits, and no uncaught page errors occur.

**Actual Result:** All assertions passed in the recorded execution. Auth navigation works, layout fits, and no uncaught page errors occur.

**Status:** PASS

**Test File:** [frontend/e2e/frontend.spec.js](../../e2e/frontend.spec.js)

**Dependencies:** Real Chrome and Vite; mocked auth HTTP responses; synthetic card harness.

**Notes:** Browser project tablet; viewport 768×1024. Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-BROWSER-02-TABLET

**Test Case ID:** TC-FE-BROWSER-02-TABLET

**Test Name:** keyboard skip navigation

**Feature Area:** Navigation & accessibility

**Related Sprint 1 PBI:** Cross-cutting

**Test Type:** Integration (browser)

**Purpose:** Verify that the frontend keyboard skip navigation.

**Preconditions:** Frontend dependencies installed; Chrome available and Playwright starts isolated Vite on port 4174; synthetic dependencies configured as below.

**Test Steps:**

1. Open homepage.
2. Tab to skip link.
3. Verify viewport visibility.
4. Press Enter.

**Test Data:** Keyboard navigation at three sizes

**Expected Result:** Skip link is focused/visible and URL targets main-content.

**Actual Result:** All assertions passed in the recorded execution. Skip link is focused/visible and URL targets main-content.

**Status:** PASS

**Test File:** [frontend/e2e/frontend.spec.js](../../e2e/frontend.spec.js)

**Dependencies:** Real Chrome and Vite; mocked auth HTTP responses; synthetic card harness.

**Notes:** Browser project tablet; viewport 768×1024. Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-BROWSER-03-TABLET

**Test Case ID:** TC-FE-BROWSER-03-TABLET

**Test Name:** discovery controls and responsive fit

**Feature Area:** Discovery & rankings

**Related Sprint 1 PBI:** 14–16

**Test Type:** Integration (browser)

**Purpose:** Verify that the frontend discovery controls and responsive fit.

**Preconditions:** Frontend dependencies installed; Chrome available and Playwright starts isolated Vite on port 4174; synthetic dependencies configured as below.

**Test Steps:**

1. Open /games.
2. Enter search and reviews sort.
3. Reset.
4. Inspect controls and viewport.

**Test Data:** Synthetic search; reviews

**Expected Result:** Filters reset and catalog-unavailable message fits the viewport.

**Actual Result:** All assertions passed in the recorded execution. Filters reset and catalog-unavailable message fits the viewport.

**Status:** PASS

**Test File:** [frontend/e2e/frontend.spec.js](../../e2e/frontend.spec.js)

**Dependencies:** Real Chrome and Vite; mocked auth HTTP responses; synthetic card harness.

**Notes:** Browser project tablet; viewport 768×1024. Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-BROWSER-04-TABLET

**Test Case ID:** TC-FE-BROWSER-04-TABLET

**Test Name:** card overflow and fallback layout

**Feature Area:** Game cards

**Related Sprint 1 PBI:** 11–16

**Test Type:** Integration (browser)

**Purpose:** Verify that the frontend card overflow and fallback layout.

**Preconditions:** Frontend dependencies installed; Chrome available and Playwright starts isolated Vite on port 4174; synthetic dependencies configured as below.

**Test Steps:**

1. Open real-card harness.
2. Fail artwork.
3. Measure title/metadata/card bounds.
4. Inspect unrated fallback and page width.

**Test Data:** Long unbroken synthetic title; broken/empty artwork; missing rating

**Expected Result:** No overlap or horizontal overflow; accessible artwork and rating fallbacks render.

**Actual Result:** All assertions passed in the recorded execution. No overlap or horizontal overflow; accessible artwork and rating fallbacks render.

**Status:** PASS

**Test File:** [frontend/e2e/frontend.spec.js](../../e2e/frontend.spec.js)

**Dependencies:** Real Chrome and Vite; mocked auth HTTP responses; synthetic card harness.

**Notes:** Browser project tablet; viewport 768×1024. Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-BROWSER-05-TABLET

**Test Case ID:** TC-FE-BROWSER-05-TABLET

**Test Name:** signed-in library navigation

**Feature Area:** Backlog

**Related Sprint 1 PBI:** 17–22

**Test Type:** Integration (browser)

**Purpose:** Verify that the frontend signed-in library navigation.

**Preconditions:** Frontend dependencies installed; Chrome available and Playwright starts isolated Vite on port 4174; synthetic dependencies configured as below.

**Test Steps:**

1. Mock account.
2. Open profile.
3. Navigate to Wishlist then Backlog.
4. Check page width.

**Test Data:** Synthetic Browser Player, browser@example.test

**Expected Result:** Both distinct unavailable pages are reachable and fit the viewport.

**Actual Result:** All assertions passed in the recorded execution. Both distinct unavailable pages are reachable and fit the viewport.

**Status:** PASS

**Test File:** [frontend/e2e/frontend.spec.js](../../e2e/frontend.spec.js)

**Dependencies:** Real Chrome and Vite; mocked auth HTTP responses; synthetic card harness.

**Notes:** Browser project tablet; viewport 768×1024. Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-BROWSER-06-TABLET

**Test Case ID:** TC-FE-BROWSER-06-TABLET

**Test Name:** privacy-safe public profile state

**Feature Area:** Privacy

**Related Sprint 1 PBI:** 28–29

**Test Type:** Integration (browser)

**Purpose:** Verify that the frontend privacy-safe public profile state.

**Preconditions:** Frontend dependencies installed; Chrome available and Playwright starts isolated Vite on port 4174; synthetic dependencies configured as below.

**Test Steps:**

1. Open synthetic public-profile path.
2. Inspect status.
3. Check no articles or edit/delete controls.

**Test Data:** /users/synthetic-private-player; signed out

**Expected Result:** Only unavailable information renders; no list records leak.

**Actual Result:** All assertions passed in the recorded execution. Only unavailable information renders; no list records leak.

**Status:** PASS

**Test File:** [frontend/e2e/frontend.spec.js](../../e2e/frontend.spec.js)

**Dependencies:** Real Chrome and Vite; mocked auth HTTP responses; synthetic card harness.

**Notes:** Browser project tablet; viewport 768×1024. Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-BROWSER-01-MOBILE

**Test Case ID:** TC-FE-BROWSER-01-MOBILE

**Test Name:** homepage auth navigation and viewport fit

**Feature Area:** Navigation & accessibility

**Related Sprint 1 PBI:** Cross-cutting

**Test Type:** Integration (browser)

**Purpose:** Verify that the frontend homepage auth navigation and viewport fit.

**Preconditions:** Frontend dependencies installed; Chrome available and Playwright starts isolated Vite on port 4174; synthetic dependencies configured as below.

**Test Steps:**

1. Mock signed-out session.
2. Open homepage.
3. Check horizontal fit and auth count.
4. Follow Join now and Log in links.
5. Capture page errors.

**Test Data:** 401 session; three viewport sizes

**Expected Result:** Auth navigation works, layout fits, and no uncaught page errors occur.

**Actual Result:** All assertions passed in the recorded execution. Auth navigation works, layout fits, and no uncaught page errors occur.

**Status:** PASS

**Test File:** [frontend/e2e/frontend.spec.js](../../e2e/frontend.spec.js)

**Dependencies:** Real Chrome and Vite; mocked auth HTTP responses; synthetic card harness.

**Notes:** Browser project mobile; viewport 390×844. Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-BROWSER-02-MOBILE

**Test Case ID:** TC-FE-BROWSER-02-MOBILE

**Test Name:** keyboard skip navigation

**Feature Area:** Navigation & accessibility

**Related Sprint 1 PBI:** Cross-cutting

**Test Type:** Integration (browser)

**Purpose:** Verify that the frontend keyboard skip navigation.

**Preconditions:** Frontend dependencies installed; Chrome available and Playwright starts isolated Vite on port 4174; synthetic dependencies configured as below.

**Test Steps:**

1. Open homepage.
2. Tab to skip link.
3. Verify viewport visibility.
4. Press Enter.

**Test Data:** Keyboard navigation at three sizes

**Expected Result:** Skip link is focused/visible and URL targets main-content.

**Actual Result:** All assertions passed in the recorded execution. Skip link is focused/visible and URL targets main-content.

**Status:** PASS

**Test File:** [frontend/e2e/frontend.spec.js](../../e2e/frontend.spec.js)

**Dependencies:** Real Chrome and Vite; mocked auth HTTP responses; synthetic card harness.

**Notes:** Browser project mobile; viewport 390×844. Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-BROWSER-03-MOBILE

**Test Case ID:** TC-FE-BROWSER-03-MOBILE

**Test Name:** discovery controls and responsive fit

**Feature Area:** Discovery & rankings

**Related Sprint 1 PBI:** 14–16

**Test Type:** Integration (browser)

**Purpose:** Verify that the frontend discovery controls and responsive fit.

**Preconditions:** Frontend dependencies installed; Chrome available and Playwright starts isolated Vite on port 4174; synthetic dependencies configured as below.

**Test Steps:**

1. Open /games.
2. Enter search and reviews sort.
3. Reset.
4. Inspect controls and viewport.

**Test Data:** Synthetic search; reviews

**Expected Result:** Filters reset and catalog-unavailable message fits the viewport.

**Actual Result:** All assertions passed in the recorded execution. Filters reset and catalog-unavailable message fits the viewport.

**Status:** PASS

**Test File:** [frontend/e2e/frontend.spec.js](../../e2e/frontend.spec.js)

**Dependencies:** Real Chrome and Vite; mocked auth HTTP responses; synthetic card harness.

**Notes:** Browser project mobile; viewport 390×844. Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-BROWSER-04-MOBILE

**Test Case ID:** TC-FE-BROWSER-04-MOBILE

**Test Name:** card overflow and fallback layout

**Feature Area:** Game cards

**Related Sprint 1 PBI:** 11–16

**Test Type:** Integration (browser)

**Purpose:** Verify that the frontend card overflow and fallback layout.

**Preconditions:** Frontend dependencies installed; Chrome available and Playwright starts isolated Vite on port 4174; synthetic dependencies configured as below.

**Test Steps:**

1. Open real-card harness.
2. Fail artwork.
3. Measure title/metadata/card bounds.
4. Inspect unrated fallback and page width.

**Test Data:** Long unbroken synthetic title; broken/empty artwork; missing rating

**Expected Result:** No overlap or horizontal overflow; accessible artwork and rating fallbacks render.

**Actual Result:** All assertions passed in the recorded execution. No overlap or horizontal overflow; accessible artwork and rating fallbacks render.

**Status:** PASS

**Test File:** [frontend/e2e/frontend.spec.js](../../e2e/frontend.spec.js)

**Dependencies:** Real Chrome and Vite; mocked auth HTTP responses; synthetic card harness.

**Notes:** Browser project mobile; viewport 390×844. Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-BROWSER-05-MOBILE

**Test Case ID:** TC-FE-BROWSER-05-MOBILE

**Test Name:** signed-in library navigation

**Feature Area:** Backlog

**Related Sprint 1 PBI:** 17–22

**Test Type:** Integration (browser)

**Purpose:** Verify that the frontend signed-in library navigation.

**Preconditions:** Frontend dependencies installed; Chrome available and Playwright starts isolated Vite on port 4174; synthetic dependencies configured as below.

**Test Steps:**

1. Mock account.
2. Open profile.
3. Navigate to Wishlist then Backlog.
4. Check page width.

**Test Data:** Synthetic Browser Player, browser@example.test

**Expected Result:** Both distinct unavailable pages are reachable and fit the viewport.

**Actual Result:** All assertions passed in the recorded execution. Both distinct unavailable pages are reachable and fit the viewport.

**Status:** PASS

**Test File:** [frontend/e2e/frontend.spec.js](../../e2e/frontend.spec.js)

**Dependencies:** Real Chrome and Vite; mocked auth HTTP responses; synthetic card harness.

**Notes:** Browser project mobile; viewport 390×844. Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-BROWSER-06-MOBILE

**Test Case ID:** TC-FE-BROWSER-06-MOBILE

**Test Name:** privacy-safe public profile state

**Feature Area:** Privacy

**Related Sprint 1 PBI:** 28–29

**Test Type:** Integration (browser)

**Purpose:** Verify that the frontend privacy-safe public profile state.

**Preconditions:** Frontend dependencies installed; Chrome available and Playwright starts isolated Vite on port 4174; synthetic dependencies configured as below.

**Test Steps:**

1. Open synthetic public-profile path.
2. Inspect status.
3. Check no articles or edit/delete controls.

**Test Data:** /users/synthetic-private-player; signed out

**Expected Result:** Only unavailable information renders; no list records leak.

**Actual Result:** All assertions passed in the recorded execution. Only unavailable information renders; no list records leak.

**Status:** PASS

**Test File:** [frontend/e2e/frontend.spec.js](../../e2e/frontend.spec.js)

**Dependencies:** Real Chrome and Vite; mocked auth HTTP responses; synthetic card harness.

**Notes:** Browser project mobile; viewport 390×844. Additional regression/behavior coverage beyond the initial plan. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-GOOGLE-BROWSER-01-DESKTOP

**Test Case ID:** TC-FE-GOOGLE-BROWSER-01-DESKTOP

**Test Name:** completes the Google callback session flow and refresh/logout at each viewport

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Integration (browser)

**Purpose:** Verify that the frontend completes the Google callback session flow and refresh/logout at each viewport.

**Preconditions:** Frontend dependencies installed; Chrome available and Playwright starts isolated Vite on port 4174; synthetic dependencies configured as below.

**Test Steps:**

1. Intercept external SDK and auth responses.
2. Click the real component button above the password form.
3. Inspect profile and refresh.
4. Check browser storage and log out.

**Test Data:** Synthetic browser SDK and account; three viewports

**Expected Result:** Google flow, restored profile and logout work without credential storage or horizontal overflow.

**Actual Result:** All assertions passed in the recorded execution. Google flow, restored profile and logout work without credential storage or horizontal overflow.

**Status:** PASS

**Test File:** [frontend/e2e/google-auth.spec.js](../../e2e/google-auth.spec.js)

**Dependencies:** Synthetic Google SDK and controlled HTTP responses; no live Google account.

**Notes:** Browser project desktop; viewport 1280×900. Adapts TC-LOGIN-01, TC-LOGIN-02 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-GOOGLE-BROWSER-02-DESKTOP

**Test Case ID:** TC-FE-GOOGLE-BROWSER-02-DESKTOP

**Test Name:** renders rejected Google authentication without losing registration inputs

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Integration (browser)

**Purpose:** Verify that the frontend renders rejected Google authentication without losing registration inputs.

**Preconditions:** Frontend dependencies installed; Chrome available and Playwright starts isolated Vite on port 4174; synthetic dependencies configured as below.

**Test Steps:**

1. Enter a registration username.
2. Click Google sign-in.
3. Return a synthetic token rejection.
4. Inspect error and retained form.

**Test Data:** Synthetic username and INVALID_GOOGLE_TOKEN response

**Expected Result:** Accessible error appears; registration input and alternative remain available.

**Actual Result:** All assertions passed in the recorded execution. Accessible error appears; registration input and alternative remain available.

**Status:** PASS

**Test File:** [frontend/e2e/google-auth.spec.js](../../e2e/google-auth.spec.js)

**Dependencies:** Synthetic Google SDK and controlled HTTP responses; no live Google account.

**Notes:** Browser project desktop; viewport 1280×900. Adapts TC-LOGIN-01, TC-LOGIN-02 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-GOOGLE-BROWSER-03-DESKTOP

**Test Case ID:** TC-FE-GOOGLE-BROWSER-03-DESKTOP

**Test Name:** recovers from a failed Google SDK load using the in-page retry

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Integration (browser)

**Purpose:** Verify that the frontend recovers from a failed Google SDK load using the in-page retry.

**Preconditions:** Frontend dependencies installed; Chrome available and Playwright starts isolated Vite on port 4174; synthetic dependencies configured as below.

**Test Steps:**

1. Abort the first SDK script request.
2. Click Retry Google sign-in.
3. Load synthetic SDK and authenticate.

**Test Data:** One aborted SDK request then a synthetic successful load

**Expected Result:** Second attempt succeeds without navigating away.

**Actual Result:** All assertions passed in the recorded execution. Second attempt succeeds without navigating away.

**Status:** PASS

**Test File:** [frontend/e2e/google-auth.spec.js](../../e2e/google-auth.spec.js)

**Dependencies:** Synthetic Google SDK and controlled HTTP responses; no live Google account.

**Notes:** Browser project desktop; viewport 1280×900. Adapts TC-LOGIN-01, TC-LOGIN-02 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-GOOGLE-BROWSER-01-TABLET

**Test Case ID:** TC-FE-GOOGLE-BROWSER-01-TABLET

**Test Name:** completes the Google callback session flow and refresh/logout at each viewport

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Integration (browser)

**Purpose:** Verify that the frontend completes the Google callback session flow and refresh/logout at each viewport.

**Preconditions:** Frontend dependencies installed; Chrome available and Playwright starts isolated Vite on port 4174; synthetic dependencies configured as below.

**Test Steps:**

1. Intercept external SDK and auth responses.
2. Click the real component button above the password form.
3. Inspect profile and refresh.
4. Check browser storage and log out.

**Test Data:** Synthetic browser SDK and account; three viewports

**Expected Result:** Google flow, restored profile and logout work without credential storage or horizontal overflow.

**Actual Result:** All assertions passed in the recorded execution. Google flow, restored profile and logout work without credential storage or horizontal overflow.

**Status:** PASS

**Test File:** [frontend/e2e/google-auth.spec.js](../../e2e/google-auth.spec.js)

**Dependencies:** Synthetic Google SDK and controlled HTTP responses; no live Google account.

**Notes:** Browser project tablet; viewport 768×1024. Adapts TC-LOGIN-01, TC-LOGIN-02 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-GOOGLE-BROWSER-02-TABLET

**Test Case ID:** TC-FE-GOOGLE-BROWSER-02-TABLET

**Test Name:** renders rejected Google authentication without losing registration inputs

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Integration (browser)

**Purpose:** Verify that the frontend renders rejected Google authentication without losing registration inputs.

**Preconditions:** Frontend dependencies installed; Chrome available and Playwright starts isolated Vite on port 4174; synthetic dependencies configured as below.

**Test Steps:**

1. Enter a registration username.
2. Click Google sign-in.
3. Return a synthetic token rejection.
4. Inspect error and retained form.

**Test Data:** Synthetic username and INVALID_GOOGLE_TOKEN response

**Expected Result:** Accessible error appears; registration input and alternative remain available.

**Actual Result:** All assertions passed in the recorded execution. Accessible error appears; registration input and alternative remain available.

**Status:** PASS

**Test File:** [frontend/e2e/google-auth.spec.js](../../e2e/google-auth.spec.js)

**Dependencies:** Synthetic Google SDK and controlled HTTP responses; no live Google account.

**Notes:** Browser project tablet; viewport 768×1024. Adapts TC-LOGIN-01, TC-LOGIN-02 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-GOOGLE-BROWSER-03-TABLET

**Test Case ID:** TC-FE-GOOGLE-BROWSER-03-TABLET

**Test Name:** recovers from a failed Google SDK load using the in-page retry

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Integration (browser)

**Purpose:** Verify that the frontend recovers from a failed Google SDK load using the in-page retry.

**Preconditions:** Frontend dependencies installed; Chrome available and Playwright starts isolated Vite on port 4174; synthetic dependencies configured as below.

**Test Steps:**

1. Abort the first SDK script request.
2. Click Retry Google sign-in.
3. Load synthetic SDK and authenticate.

**Test Data:** One aborted SDK request then a synthetic successful load

**Expected Result:** Second attempt succeeds without navigating away.

**Actual Result:** All assertions passed in the recorded execution. Second attempt succeeds without navigating away.

**Status:** PASS

**Test File:** [frontend/e2e/google-auth.spec.js](../../e2e/google-auth.spec.js)

**Dependencies:** Synthetic Google SDK and controlled HTTP responses; no live Google account.

**Notes:** Browser project tablet; viewport 768×1024. Adapts TC-LOGIN-01, TC-LOGIN-02 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-GOOGLE-BROWSER-01-MOBILE

**Test Case ID:** TC-FE-GOOGLE-BROWSER-01-MOBILE

**Test Name:** completes the Google callback session flow and refresh/logout at each viewport

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Integration (browser)

**Purpose:** Verify that the frontend completes the Google callback session flow and refresh/logout at each viewport.

**Preconditions:** Frontend dependencies installed; Chrome available and Playwright starts isolated Vite on port 4174; synthetic dependencies configured as below.

**Test Steps:**

1. Intercept external SDK and auth responses.
2. Click the real component button above the password form.
3. Inspect profile and refresh.
4. Check browser storage and log out.

**Test Data:** Synthetic browser SDK and account; three viewports

**Expected Result:** Google flow, restored profile and logout work without credential storage or horizontal overflow.

**Actual Result:** All assertions passed in the recorded execution. Google flow, restored profile and logout work without credential storage or horizontal overflow.

**Status:** PASS

**Test File:** [frontend/e2e/google-auth.spec.js](../../e2e/google-auth.spec.js)

**Dependencies:** Synthetic Google SDK and controlled HTTP responses; no live Google account.

**Notes:** Browser project mobile; viewport 390×844. Adapts TC-LOGIN-01, TC-LOGIN-02 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-GOOGLE-BROWSER-02-MOBILE

**Test Case ID:** TC-FE-GOOGLE-BROWSER-02-MOBILE

**Test Name:** renders rejected Google authentication without losing registration inputs

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Integration (browser)

**Purpose:** Verify that the frontend renders rejected Google authentication without losing registration inputs.

**Preconditions:** Frontend dependencies installed; Chrome available and Playwright starts isolated Vite on port 4174; synthetic dependencies configured as below.

**Test Steps:**

1. Enter a registration username.
2. Click Google sign-in.
3. Return a synthetic token rejection.
4. Inspect error and retained form.

**Test Data:** Synthetic username and INVALID_GOOGLE_TOKEN response

**Expected Result:** Accessible error appears; registration input and alternative remain available.

**Actual Result:** All assertions passed in the recorded execution. Accessible error appears; registration input and alternative remain available.

**Status:** PASS

**Test File:** [frontend/e2e/google-auth.spec.js](../../e2e/google-auth.spec.js)

**Dependencies:** Synthetic Google SDK and controlled HTTP responses; no live Google account.

**Notes:** Browser project mobile; viewport 390×844. Adapts TC-LOGIN-01, TC-LOGIN-02 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.

### TC-FE-GOOGLE-BROWSER-03-MOBILE

**Test Case ID:** TC-FE-GOOGLE-BROWSER-03-MOBILE

**Test Name:** recovers from a failed Google SDK load using the in-page retry

**Feature Area:** Authentication

**Related Sprint 1 PBI:** 1–4

**Test Type:** Integration (browser)

**Purpose:** Verify that the frontend recovers from a failed Google SDK load using the in-page retry.

**Preconditions:** Frontend dependencies installed; Chrome available and Playwright starts isolated Vite on port 4174; synthetic dependencies configured as below.

**Test Steps:**

1. Abort the first SDK script request.
2. Click Retry Google sign-in.
3. Load synthetic SDK and authenticate.

**Test Data:** One aborted SDK request then a synthetic successful load

**Expected Result:** Second attempt succeeds without navigating away.

**Actual Result:** All assertions passed in the recorded execution. Second attempt succeeds without navigating away.

**Status:** PASS

**Test File:** [frontend/e2e/google-auth.spec.js](../../e2e/google-auth.spec.js)

**Dependencies:** Synthetic Google SDK and controlled HTTP responses; no live Google account.

**Notes:** Browser project mobile; viewport 390×844. Adapts TC-LOGIN-01, TC-LOGIN-02 in the limited scope documented above. No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.


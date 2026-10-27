# Frontend testing guide

Run the commands below from the repository root. Frontend tests do **not** need Docker, MongoDB, a running backend, Google credentials, or any spreadsheet account data.

## Install and run

Use Node 22.9+ (this execution used Node 24.16.0) and the committed frontend lockfile:

```bash
npm ci --prefix frontend
npm test --prefix frontend
```

Vitest, React Testing Library, user-event and jsdom are the established unit/component tools. Only `@vitest/coverage-v8` matching Vitest 5.0.5 and `@playwright/test` were added. There is no MSW requirement: service tests stub fetch, App tests mock the service, and browser tests intercept requests in Playwright.

## Run one test or component

```bash
# Exact spreadsheet-adapted case
npm test --prefix frontend -- -t 'TC-RATE-02'

# One component file
npm test --prefix frontend -- src/components/GameCard.test.jsx

# All review/validation test files
npm test --prefix frontend -- src/components/ReviewForm.test.jsx src/utils/reviews.test.js

# Real frontend service + UI, with controlled fetch responses
npm test --prefix frontend -- src/services/auth-ui.test.jsx

# Watch a component while developing
npm run test:watch --prefix frontend -- src/components/ReviewForm.test.jsx
```

IDs in square brackets form the documentation link between tests and `test-catalog.json`. Five original spreadsheet IDs appear directly on adapted executable cases. The other original cases remain traceable through the scope matrix and catalog's `spreadsheetIds`. They are not mislabeled as complete full-stack tests.

## Browser checks

The recorded execution used installed Google Chrome:

```bash
PLAYWRIGHT_CHANNEL=chrome npm run test:browser --prefix frontend

# One responsive project or one scenario
PLAYWRIGHT_CHANNEL=chrome npm run test:browser --prefix frontend -- --project=mobile
PLAYWRIGHT_CHANNEL=chrome npm run test:browser --prefix frontend -- -g TC-FE-BROWSER-04

# Interactive test UI, when useful locally
PLAYWRIGHT_CHANNEL=chrome npm run test:browser:ui --prefix frontend
```

If Chrome is not installed, use Playwright's bundled Chromium instead:

```bash
cd frontend
npx playwright install chromium
npm run test:browser
```

The bundled-browser installation command is an alternative for teammates; this run used Chrome and did not download a browser. Return to the root for other commands in this guide.

Playwright starts a separate Vite server on `127.0.0.1:4174` with Google client ID and API base cleared in the child process. Keep that port free; it deliberately does not reuse another server. Six scenarios run at desktop 1280×900, tablet 768×1024 and mobile 390×844, yielding 18 executions. Desktop/tablet/mobile labels are emulated viewports in Chromium, not physical-device tests or three browser engines.

Auth responses are intercepted; no backend is contacted. `e2e/fixtures/cards.html` renders the actual GameCard and production styles using synthetic long titles, missing metadata and intentionally failed artwork. It is a browser-only test fixture, not a production catalog or application route. Tests measure bounding boxes and horizontal overflow, inspect keyboard behavior and capture uncaught page errors in the homepage navigation scenario. These checks are not a complete visual or accessibility audit.

Failures retain screenshots/traces under ignored `frontend/test-results/`. To view a trace:

```bash
cd frontend
npx playwright show-trace test-results/<failed-test>/trace.zip
```

Browser tests are frontend integration checks with mocked HTTP, not live Google/backend E2E.

## Coverage, lint and build

```bash
npm run test:coverage --prefix frontend
npm run lint --prefix frontend
npm run build --prefix frontend
```

Coverage is written to `frontend/coverage/index.html` and `frontend/coverage/coverage-summary.json`. It measures production JavaScript/JSX, excludes test/setup files, unused mock fixtures and `main.jsx` bootstrap, and does not combine Playwright execution. See `FRONTEND_COVERAGE_REPORT.md` for the measured denominator and gaps. No blanket threshold claims that unavailable features are tested.

## Reproduce the documented reports

```bash
npm run test:coverage --prefix frontend -- --reporter=default --reporter=json --outputFile=docs/testing/artifacts/unit-results.json
PLAYWRIGHT_CHANNEL=chrome npm run test:browser --prefix frontend
npm run lint --prefix frontend
npm run build --prefix frontend
```

The output-file option is relative to the frontend working directory. To retain terminal evidence too, redirect output to `frontend/docs/testing/artifacts/unit-output.txt`, `browser-output.txt`, `lint-output.txt` and `build-output.txt` as appropriate. Copy the measured summary before regenerating documents:

```bash
cp frontend/coverage/coverage-summary.json frontend/docs/testing/artifacts/coverage-summary.json
node frontend/scripts/generate-testing-docs.mjs
```

The generator reads machine results plus per-case metadata, expands browser viewport IDs and fails for missing/duplicate IDs. It does not run tests or invent results. `artifacts/execution-info.json` pins the validated code revision and baseline for this delivery. For a new execution/revision, update that record accurately, then regenerate the documents from fresh reports; do not imply that old reports validate new code.

## Interpret failures

- Assertion failure: reproduce the individual case, inspect expected UI behavior, and fix either the implementation or an incorrect test. Do not weaken assertions merely to make the suite green.
- Frontend HTTP mocks: a passing test demonstrates response handling, not the existence of a backend endpoint. Check request payload/response shape against the merged contract when integration becomes available.
- Browser launch failure: install Chromium or select installed Chrome. Report unavailable browser dependencies as blocked; do not quietly skip.
- Browser server failure: check port 4174, Node version, and Vite logs. No Docker is needed for this suite.
- Missing Google configuration in the live app: expected; tests use synthetic SDK callbacks. Never copy actual Google tokens, workbook credentials, usernames or passwords into fixtures.
- Unavailable wishlist/backlog/catalog pages: currently intentional. This is different from an empty successfully loaded list. Add/remove/edit/delete scenarios are NOT IMPLEMENTED, not passing mutation tests.

## Add tests

1. Use synthetic identifiers, `example.test` email addresses and callback spies. Do not reuse spreadsheet credential values.
2. Add a substantive behavior test next to the component/service/helper. Use role/label queries and user-event; use controlled promises for loading and failure transitions.
3. Give it a unique `[TC-FE-AREA-NN]` ID. Preserve original spreadsheet IDs for corresponding adaptations and document partial scope. Do not reuse an ID for unrelated behavior.
4. Add its purpose, steps, synthetic data, expected result, PBI, dependencies and related spreadsheet IDs to `test-catalog.json`.
5. Add browser scenarios under `e2e/` when actual dimensions, CSS, keyboard or browser behavior matter. Vitest excludes that directory.
6. Run the affected tests, full suite, lint, build and relevant browser checks. Regenerate reports from actual outputs.

## After backend integration

Confirm the actual merged endpoint, method, payload, response fields, authorization, status transition semantics, count definitions and pagination. Add controlled response tests through real frontend services before adding configured live E2E. Cover populated catalog/profile/list states, failed mutations, confirmed updates, duplicates, edit/delete ownership and public/private responses. Keep service-mock tests clearly separate from live integration evidence.

Do not implement missing backend endpoints to make these tests pass. Open PR #14 supplies database search helpers only; #10 and #11 are also unmerged groundwork. Privacy rendering tests do not replace server authorization tests. Steam, friendship and developer moderation remain outside this assignment.

## Google-specific UI checks

```bash
PLAYWRIGHT_CHANNEL=chrome npm run test:google-browser --prefix frontend
```

This runs three additional Google authentication scenarios at desktop/tablet/mobile sizes (nine executions) using a synthetic external SDK and controlled HTTP responses. The real App, GoogleSignIn component, routing, and frontend API service execute. It verifies Google-first placement, confirmed profile/session display, reload, logout, rejection, input retention and in-page SDK retry. It does not authenticate a real Google account. Normal `test:browser` continues to run the original six scenarios (18 executions). Run both suites for all 27 browser checks.

Vite may reuse the public root `GOOGLE_CLIENT_ID` if the explicit frontend `VITE_GOOGLE_CLIENT_ID` is absent. Tests isolate unit configuration from local OAuth settings, and Google browser tests set a synthetic public ID. No client secret, session secret or actual Google token belongs in frontend settings or test fixtures.

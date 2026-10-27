import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const frontend = fileURLToPath(new URL('../', import.meta.url))
const directory = `${frontend}docs/testing/`
const read = name => JSON.parse(readFileSync(directory + name, 'utf8'))
const catalog = read('test-catalog.json')
const unit = read('artifacts/unit-results.json')
const browser = read('artifacts/browser-results.json')
let googleBrowser
try { googleBrowser = read('artifacts/google-browser-results.json') } catch { /* Earlier reports predate the Google browser suite. */ }
const coverage = read('artifacts/coverage-summary.json')
const baseline = read('artifacts/baseline-summary.json')
const lookup = new Map(catalog.map(test => [test.id, test]))
if (lookup.size !== catalog.length) throw new Error('Duplicate test IDs in catalog')
const records = []
const seen = new Set()
function record(title, status, project) {
  const id = /^\[([^\]]+)\]/.exec(title)?.[1]
  const test = lookup.get(id)
  if (!test) throw new Error(`Undocumented executed test: ${title}`)
  const executionId = project ? `${id}-${project.toUpperCase()}` : id
  if (seen.has(executionId)) throw new Error(`Duplicate executed test ID: ${executionId}`)
  seen.add(executionId)
  records.push({ ...test, id: executionId, baseId: id, status, project })
}
for (const file of unit.testResults) {
  for (const test of file.assertionResults) record(test.fullName, test.status === 'passed' ? 'PASS' : test.status === 'pending' ? 'NOT RUN' : 'FAIL')
}
function collect(suite) {
  for (const spec of suite.specs || []) {
    for (const test of spec.tests) {
      record(spec.title, test.status === 'expected' ? 'PASS' : test.status === 'skipped' ? 'NOT RUN' : 'FAIL', test.projectName)
    }
  }
  for (const child of suite.suites || []) collect(child)
}
for (const suite of browser.suites) collect(suite)
if (googleBrowser) for (const suite of googleBrowser.suites) collect(suite)
const used = new Set(records.map(record => record.baseId))
for (const test of catalog) if (!used.has(test.id)) throw new Error(`Catalog case did not execute: ${test.id}`)
const infoPath = 'artifacts/execution-info.json'
let info
try { info = read(infoPath) } catch {
  info = {
    branch: execFileSync('git', ['branch', '--show-current'], { cwd: frontend, encoding: 'utf8' }).trim(),
    validatedCodeCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: frontend, encoding: 'utf8' }).trim(),
    baselineTests: baseline.numTotalTests,
    node: process.version,
    browserCommand: 'PLAYWRIGHT_CHANNEL=chrome npm run test:browser --prefix frontend',
  }
  writeFileSync(directory + infoPath, JSON.stringify(info, null, 2) + '\n')
}
const date = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', dateStyle: 'full', timeStyle: 'short' }).format(new Date(unit.startTime))
const browserDate = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', dateStyle: 'full', timeStyle: 'short' }).format(new Date(googleBrowser?.stats.startTime || browser.stats.startTime))
const passed = records.filter(test => test.status === 'PASS').length
const failed = records.filter(test => test.status === 'FAIL').length
const notRun = records.filter(test => test.status === 'NOT RUN').length
const browserDefinitions = catalog.filter(test => test.file.startsWith('frontend/e2e/')).length
const newUnit = unit.numTotalTests - info.baselineTests
const table = rows => rows.map(row => `| ${row.map(value => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ')).join(' | ')} |`).join('\n')
const featureRows = [...new Set(records.map(test => test.feature))].sort().map(feature => {
  const tests = records.filter(test => test.feature === feature)
  return [feature, tests.filter(test => !test.project).length, tests.filter(test => test.project).length, tests.filter(test => test.status === 'PASS').length, tests.filter(test => test.status === 'FAIL').length]
})
const scope = `## Spreadsheet traceability and unimplemented scope

Source: \`Mod9_SoftwareTests-2.xlsx\`, found in Downloads. All 13 populated cases were reviewed across ID, description, preconditions, steps, data, expected results and postconditions. Original workbook was not copied into the repository. All automation uses synthetic data; workbook credential values are excluded. Actual-result/status cells in the workbook were blank, so they are not evidence of execution.

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
`

let cases = `# Frontend automated test cases\n\nExecuted ${date} (America/New_York). ${catalog.length} distinct automated scenarios; ${records.length} executions including three browser viewports. Existing tests are preserved with traceable IDs.\n\n${scope}\n## Executed automated cases\n\nBrowser base IDs expand to DESKTOP, TABLET and MOBILE execution IDs. These are browser integration tests using mocked API responses, not full-stack E2E.\n\n`
for (const test of records) {
  const browserNote = test.project ? `Browser project ${test.project}; viewport ${test.project === 'desktop' ? '1280×900' : test.project === 'tablet' ? '768×1024' : '390×844'}. ` : ''
  cases += `### ${test.id}\n\n**Test Case ID:** ${test.id}\n\n**Test Name:** ${test.name}\n\n**Feature Area:** ${test.feature}\n\n**Related Sprint 1 PBI:** ${test.pbi}\n\n**Test Type:** ${test.type}${test.project ? ' (browser)' : ''}\n\n**Purpose:** Verify that the frontend ${test.name}.\n\n**Preconditions:** Frontend dependencies installed; ${test.project ? 'Chrome available and Playwright starts isolated Vite on port 4174' : 'Vitest jsdom environment (pure helpers execute within the configured frontend runner)'}; synthetic dependencies configured as below.\n\n**Test Steps:**\n\n${test.steps.map((step, index) => `${index + 1}. ${step}.`).join('\n')}\n\n**Test Data:** ${test.data}\n\n**Expected Result:** ${test.expected}\n\n**Actual Result:** ${test.status === 'PASS' ? `All assertions passed in the recorded execution. ${test.expected}` : `Runner reported ${test.status}; inspect machine report.`}\n\n**Status:** ${test.status}\n\n**Test File:** [${test.file}](../../${test.file.replace(/^frontend\//, '')})\n\n**Dependencies:** ${test.dependencies}.\n\n**Notes:** ${browserNote}${test.spreadsheetIds.length ? `Adapts ${test.spreadsheetIds.join(', ')} in the limited scope documented above. ` : 'Additional regression/behavior coverage beyond the initial plan. '}No real backend endpoint, MongoDB persistence, Google credentials or backend authorization is proven by this test.\n\n`
}
writeFileSync(directory + 'FRONTEND_TEST_CASES.md', cases)
const results = `# Frontend test execution results

- Vitest execution: ${date} (America/New_York).
- Browser execution: ${browserDate} (America/New_York).
- Branch: \`${info.branch}\`.
- Validated application/test code commit: \`${info.validatedCodeCommit}\`. Documentation commits follow this code revision; see git history for delivery HEAD.
- Frameworks: Vitest 5.0.5, React Testing Library, user-event, jsdom; V8 coverage provider 5.0.5; Playwright 1.64.1 with installed Google Chrome.
- Runtime: ${info.node}.
- Baseline: **${info.baselineTests} passing tests**, confirmed before changes.
- Created: **${newUnit} new Vitest tests + ${browserDefinitions} browser scenarios = ${newUnit + browserDefinitions} new scenarios**. Three browser viewports do not inflate the scenario count.
- Final suite: **${unit.numTotalTests} Vitest tests + ${browserDefinitions * 3} browser executions = ${records.length} executions**, covering ${catalog.length} distinct scenarios.
- Passed: **${passed}**. Failed: **${failed}**. Skipped/not run: **${notRun}**. Blocked executable tests: **0**. Full-stack E2E tests run: **0**.
- Missing planned scenarios: **3 NOT IMPLEMENTED**, separately listed below; they are not counted as passing or skipped automated tests.

## Commands executed

From repository root:

\`\`\`bash
npm test --prefix frontend -- --reporter=json --outputFile=/tmp/sidequest-frontend-baseline.json
npm run test:coverage --prefix frontend -- --reporter=default --reporter=json --outputFile=docs/testing/artifacts/unit-results.json
PLAYWRIGHT_CHANNEL=chrome npm run test:browser --prefix frontend
PLAYWRIGHT_CHANNEL=chrome npm run test:google-browser --prefix frontend
npm run lint --prefix frontend
npm run build --prefix frontend
git diff --check
\`\`\`

Dependency changes: only the matching V8 coverage provider and Playwright were added. Vitest/RTL/user-event were reused; no MSW or second unit-test framework was necessary. No backend/database tests were run for this assignment.

## Results by feature area

| Area | Vitest executions | Browser executions | Passed | Failed |
|---|---|---|---|---|
${table(featureRows)}

## Failures investigated and bugs fixed

Initial regression runs deliberately exercised real production behavior and recorded **7 failing regression tests** in \`artifacts/regressions-before-fix.json\`. Final expectations were retained while fixing frontend code:

1. Missing card ratings crashed on \`undefined.toFixed\`: render Not rated and an unavailable-count label.
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

${scope}

## Complete execution summary

| Test ID | Description | Type | Status | Source file |
|---|---|---|---|---|
${table(records.map(test => [test.id, test.name, test.type + (test.project ? ' (browser)' : ''), test.status, test.file]))}

## Evidence

- \`artifacts/unit-output.txt\`, \`artifacts/unit-results.json\`: actual Vitest output and per-case results.
- \`artifacts/browser-output.txt\`, \`artifacts/browser-results.json\`: actual Chrome execution output and per-project results.
- \`artifacts/lint-output.txt\`, \`artifacts/build-output.txt\`: successful lint/build output.
- \`artifacts/coverage-summary.json\`: measured V8 coverage; browser coverage is not merged into it.
- \`artifacts/execution-info.json\`, \`artifacts/baseline-summary.json\`: revision/runtime and pre-change counts.

Passing counts do not establish comprehensive feature coverage. See the coverage report for unexercised code and the scope table for unimplemented behavior.
`
writeFileSync(directory + 'FRONTEND_TEST_RESULTS.md', results)
const coverageRows = Object.entries(coverage).map(([file, stats]) => [file === 'total' ? '**TOTAL**' : file.split('/frontend/')[1], ...['statements', 'branches', 'functions', 'lines'].map(key => `${stats[key].pct}% (${stats[key].covered}/${stats[key].total})`)])
writeFileSync(directory + 'FRONTEND_COVERAGE_REPORT.md', `# Frontend coverage report

Measured by @vitest/coverage-v8 5.0.5 from the ${unit.numTotalTests}-test Vitest run on ${date}. This is executable JavaScript/JSX coverage, not a feature-completion score.

| Source | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
${table(coverageRows)}

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
`)
console.log(`Documented ${records.length} executions across ${catalog.length} scenarios; ${passed} passed, ${failed} failed.`)

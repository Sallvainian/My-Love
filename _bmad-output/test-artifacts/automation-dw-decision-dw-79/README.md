# DW-79 automation bundle

Three new prioritized tests extend the existing native token persistence evidence:
two P1 SDK/API tests and one P0 browser characterization. The combined runner also
reuses the original five browser schedules. All 40 executions in a five-repeat,
four-worker run passed; the existing 17 auth service unit tests passed separately.

- [Definition of Done](definition-of-done.md)
- [Workflow summary](../automation-summary-dw-decision-dw-79.md)
- [Native trace](evidence/stale-resurrection.json)
- [Execution verification](evidence/verification.json)

## Files and coverage

| File | Purpose |
| --- | --- |
| `api/auth-sdk-notification-completion.spec.ts` | P1 DW79-API-001/002: actual SDK sign-in/sign-out wait for originating callbacks |
| `e2e/token-persistence-resurrection.spec.ts` | P0 DW79-E2E-006: late sign-in put restores A/v1 after a newer independent sign-out delete |
| `fixtures/auth-sdk-boundary.ts` | Private SDK client, controlled HTTP responses, callback gate, sanitized request/result metadata and cleanup |
| `fixtures/native-token-persistence.ts` | Origin guard, harness readiness, native execution and independent restoration/storage checks |
| `playwright.config.ts` | Three projects: new API, new Chromium and existing browser baseline |
| `tsconfig.json` | Explicit artifact test/fixture typecheck |

The existing `tests/support/harnesses/auth-token-persistence.ts` gains only the
`stale-resurrection` scenario and its notification branches. All native observers
and production services remain the existing implementation. The current request
places new tests/fixtures under TEA test_artifacts; the explicit runner discovers
them there. Default repository CI does not automatically discover these new specs.

## Run

From the repository root with dependencies, Playwright Chromium, and local
Supabase running. The inherited runner uses Vite test mode on port 5189, imports
the project's local environment bootstrap and disables shared account provisioning.
No production secrets are needed. Stop another process occupying port 5189 before
running; the runner requires its own fresh server.

```sh
# All eight selected scenarios (three new plus five original).
npx playwright test -c _bmad-output/test-artifacts/automation-dw-decision-dw-79/playwright.config.ts

# New P0, then P1, or select one test layer.
npx playwright test -c _bmad-output/test-artifacts/automation-dw-decision-dw-79/playwright.config.ts --grep '\[P0\]'
npx playwright test -c _bmad-output/test-artifacts/automation-dw-decision-dw-79/playwright.config.ts --grep '\[P1\]'
npx playwright test -c _bmad-output/test-artifacts/automation-dw-decision-dw-79/playwright.config.ts --project=api

# Repeat concurrent native schedules and SDK callback gates.
npx playwright test -c _bmad-output/test-artifacts/automation-dw-decision-dw-79/playwright.config.ts --repeat-each=5 --workers=4

npm run typecheck
npx tsc -p _bmad-output/test-artifacts/automation-dw-decision-dw-79/tsconfig.json
npm run lint
npx eslint _bmad-output/test-artifacts/automation-dw-decision-dw-79/api _bmad-output/test-artifacts/automation-dw-decision-dw-79/e2e _bmad-output/test-artifacts/automation-dw-decision-dw-79/fixtures tests/support/harnesses/auth-token-persistence.ts --max-warnings=0
npx vitest run src/api/auth/__tests__/authServices.test.ts
```

Specs import `test` and `expect` from the existing merged fixtures and set
`authSessionEnabled: false`. The SDK helper reuses the overridable synthetic
session factory, creates a private in-memory client, and exposes `start()`,
`notificationEntered`, `releaseNotification()` and `dispose()`. Always dispose in
`finally` so an assertion failure releases the callback and drains the operation.
No account or server row is created. Fixed A/v1 labels describe the experiment;
synthetic token values stay private and factory-generated.

The native helper accepts `(page, baseURL, scenario)` and returns redacted evidence
and cleanup verification. It waits with recurse, invokes the existing browser
bridge, then compares native method references captured outside the harness.
Browser contexts are isolated. The harness drains all work and restores its SDK
and IndexedDB instrumentation in finally. Assertions remain in the spec.

## Evidence and limits

The API layer runs the installed SDK with its HTTP transport substituted in
memory. It proves the originating callback completion assumption, including real
response parsing and action results. It does not call a live Auth server. The
browser layer runs real auth services, idb and native IndexedDB with controlled
SDK methods and notifications; it does not run the installed SDK action methods.
Taken together these tests strengthen the stated assumption without claiming an
integrated live SDK/server, multi-tab, or worker background-sync reproduction.

The new native trace records independent sign-out deletion at sequence 28, the
older sign-in action put at 32, and the actual final read of A/v1 at 42. This is
current-behavior characterization, not a persistence-coordination fix or a claim
that the restored token is accepted by a server. Native commits remain FIFO.

Raw browser trace/video/screenshots are disabled. JSON attachments contain phase
metadata and opaque owner/version labels; all 40 repeated attachments were checked
for token fields and values. The combined run retains `evidence/results.json` and
uses ignored `test-results/dw79-tea-automate` for temporary runner output. Each new
run overwrites results.json; archived p0/p1 snapshots describe this workflow run.
The original bundle's retained evidence is not overwritten by the new config.

Project/artifact test typechecks and lint pass. Playwright config files remain
outside static-check scope: including the imported root config exposed pre-existing
`crypto.JsonWebKey` and readonly `stdio` type errors. The initial diagnostic is
retained in `evidence/initial-config-typecheck.txt`; successful runner execution
validates config loading. No root-config repair is included. Three existing
EventCountdown Fast Refresh warnings, npm/color warnings and the Vitest native
config-loader warning are documented and did not fail tests.

Measured on macOS arm64, Node 24.19.0, Playwright 1.63.0, Chromium 153.0.8010.12,
Supabase SDK/Auth JS 2.116.0, idb 8.0.3 and Vite 8.2.2. No Linux CI, other browser,
production build, deployment or live-server scheduling verification is claimed.

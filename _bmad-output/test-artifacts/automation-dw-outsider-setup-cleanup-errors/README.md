# DW-71 outsider setup/cleanup automation

Five P1 tests extend the 26 existing helper unit cases: two real Supabase SDK
integration tests and three tests of the Playwright worker-to-report lifecycle.
The suite uses synthetic Auth responses and controlled rejection values. It needs
Node 24 and the repository's installed dependencies, with no Supabase service,
credentials, browser installation, or Vite server.

Run from the repository root:

```sh
npx playwright test --config _bmad-output/test-artifacts/automation-dw-outsider-setup-cleanup-errors/playwright.config.ts
npx playwright test --config _bmad-output/test-artifacts/automation-dw-outsider-setup-cleanup-errors/playwright.config.ts --repeat-each=3 --workers=3
npx tsc -p _bmad-output/test-artifacts/automation-dw-outsider-setup-cleanup-errors/tsconfig.json
npx eslint --no-ignore --global process:readonly _bmad-output/test-artifacts/automation-dw-outsider-setup-cleanup-errors/*.ts _bmad-output/test-artifacts/automation-dw-outsider-setup-cleanup-errors/probe/*.ts
npm run test:unit -- tests/unit/helpers/rls-security.test.ts
npm run typecheck
npm run lint
```

For a shared dependency installation, put that installation's `node_modules/.bin`
on `PATH` before running npm scripts. This run used the existing parent project
installation; it added no dependencies. Both artifact-specific checks are needed:
the normal project typecheck and lint do not include `_bmad-output`.

Add `api-outsider-cleanup.spec.ts` or `e2e-outsider-reporting.spec.ts` to the
Playwright command to select one level. Every outer test carries `[P1]`, so
`--grep '\[P1\]'` selects the entire suite. Default repository CI does not discover
these artifacts; use the explicit config above.

## Fixtures and isolation

- `withAuthServer('denied' | 'success', callback)` starts a loopback server on an
  ephemeral port, exposes a real Supabase admin SDK, and records method/path
  pairs. It restores environment variables and closes connections in `finally`.
  UUIDs isolate cases and satisfy SDK validation; named status/error literals are
  deliberate fault inputs. No real account is created.
- `runReporterProbe(kind, testInfo.outputPath('probe'))` awaits a child Playwright
  run using the actual helper, JSON reporter, and repository Markdown reporter.
  Each child owns its working directory. Returned error values are flattened
  from the real JSON report without constructing expected report messages.
- `nodeOnlyFixtures` preserves imports from the repository's merged fixtures and
  disables authentication and the browser-only auto monitor for this suite.
  Browser monitoring cannot observe the Node SDK requests under test.

The child in `probe/failure-probe.spec.ts` deliberately fails. Its dedicated
config is invoked only by the parent fixture; do not run it as a standalone
acceptance suite. Each parent test must observe exit code 1, exactly one failed
child, and the account ID plus both failures in JSON and `failures-ai.md`.
Those intentional child failures are not additional acceptance tests or skips.

SDK creation/sign-in must remain inside the real helper; replacing them with
`apiRequest` or an auth token fixture would bypass the behavior being tested.
There are no UI selectors or generic HTTP calls to migrate to browser utilities.

## Evidence and Definition of Done

- `validation-single-run.json`: five passing outer cases.
- `validation-repeat3.json` and `run-results.json`: 15 passes with three workers,
  zero unexpected failures, skips, or flaky outcomes.
- `reporter-evidence.json`: nine intentional child failures and their actual
  serialized dual-error messages; raw child reports remain under `test-results`.
- `unit-rls-security.junit.xml`: all 26 existing helper unit cases pass.
- `verification.json`: checks, generation corrections, and verification limits.
- [Automation summary and Definition of Done](../automation-summary-dw-outsider-setup-cleanup-errors.md).

This run verifies SDK error parsing and reporting. Existing real-backend RLS
consumers were read as compatibility context; live Supabase behavior and product
browser journeys were not exercised. Product code, shared fixtures, archived
tests, dependencies, and orchestrator bookkeeping were not edited.

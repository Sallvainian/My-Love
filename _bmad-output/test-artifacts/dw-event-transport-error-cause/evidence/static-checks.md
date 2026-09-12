---
story: dw-event-transport-error-cause
check: generated-artifact-static-checklist
date: '2026-09-11'
status: checked
runtimeVerdict: recorded-separately-by-main-agent
---

# Generated artifact static checks

Read the complete API spec, E2E spec, diagnostic factory, browser helper, and
`stage-tests.mjs`; cross-checked the existing merged fixtures and Playwright config.
Paths below are repository target paths beneath the retained bundle's `tests/`
directory. This check did not run tests. Runtime validation was pending when this
task began and is reported separately by the main agent; no runtime passing count
is inferred from these static checks.

| Check | Static result and evidence |
| --- | --- |
| Collection and priorities | Three parameterized API cases (`tests/api/event-transport-error-cause.spec.ts:28`) and one E2E case (`tests/e2e/settings/event-transport-error-cause.spec.ts:16`). All carry `[P2]` and stable DW53 IDs. Actual collection counts require runner evidence. |
| Fixture imports | Both specs import `test, expect` from project merged fixtures (API:16; E2E:3). Helper imports only the `Page` type from `@playwright/test`; it does not create a separate test fixture. Existing merged fixtures compose auth, API, interception, polling, logging, and network monitoring. |
| Production boundaries | API:14-19 imports the installed Supabase SDK and production `handleSupabaseError`/`isPostgrestError`; it does not import or invoke EventsService. Browser helper:36-44 imports the real client/service and wraps the real `createEvent` call; it rethrows the observed failure. |
| Falsifiable assertions | API:83-114 asserts request method/path/filter, status 0, exact error envelope, captured stack, and production mapper output. E2E:91-105 asserts direct cause identity/diagnostics, then exact UI text, preserved fields, absent unsaved event, and explicit retry response/store/UI observations. A removed cause assignment invalidates the browser identity assertion; the unchanged SDK compatibility cases are not themselves detectors of that assignment. |
| Visible assertions | `expect` calls remain in spec bodies, including teardown. Factory/helper code supplies input and observation only. Presence/type assertions have adjacent value assertions. No helper hides test assertions. |
| Timing | Specs inherit the repository's 60-second test timeout (`playwright.config.ts:114`); assertions/actions default to 15 seconds and navigation to 30 seconds. E2E uses bounded `recurse` calls and a 45-second interception. No `waitForTimeout`, timer sleeps, or custom polling loop appears. Actual duration/stability still depends on runtime evidence. |
| Network order | E2E registers the real retry's `interceptNetworkCall` before navigation (E2E:42), installs the one-shot query rejection before clicking submit, and restores before retry. Successful retry awaits response, store, then UI. Network monitoring is not disabled. |
| Deterministic paths | API method branches are fixed by the parameterized scenario. E2E guards throw on missing prerequisites/observations instead of skipping assertions. The body uses `try/finally` for cleanup; the helper's catch records then rethrows. No silent catch or optional assertion changes the expected path. |
| Data and isolation | Diagnostic factory returns a fresh TypeError per invocation with explicit message/code overrides. Those fixed values encode expected diagnostic behavior and need no randomization. API identifiers and synthetic key are in-memory request inputs; injected fetch does not contact the `.invalid` host. E2E label uses faker UUID and cleanup filters by both authenticated owner and that unique label. |
| Cleanup ownership | Browser helper restores only its replaced `supabase.from` and `eventsService.createEvent` methods and deletes its probe marker. E2E calls restore before retry and in `finally`; backend deletion is scoped to this test's owner/label. Once a saved ID is observed, cleanup requires that exact deleted ID. It neither clears account rows nor alters partner relationships. |
| Focus, skips, logging | No `.only`, `.skip`, `.fixme`, `fdescribe`, `fit`, `console.log`, or debug statement appears in the generated four TypeScript files. Specs use the installed `log` utility. |
| Secrets | No production key, token, password, or decrypted value is embedded. E2E reads local endpoint/key environment variables and the auth fixture token only to form the existing API request. The API's `synthetic-test-key` is explicitly non-authenticating input to a controlled transport. |
| Test structure | API cases are grouped under one describe. E2E covers one failed-create/retry concern with multiple response/store/UI assertions required by the repository's sequencing convention. Given/When/Then phases are discernible; E2E logs use these labels, while API logs name rejection and mapping operations. |
| Artifact staging | `stage-tests.mjs:7-12` enumerates exactly the four generated paths. It reads/checks the complete set before writes, rejects existing targets on stage, uses exclusive `wx` creation, and refuses cleanup of a target whose current text differs from the retained artifact. Cleanup unlinks only enumerated existing targets. It does not touch the sprint board, ledger, generated database types, or E2E archive. Runtime stage/clean behavior requires separate evidence. |

## Playwright Utils deviations

- `tests/api/event-transport-error-cause.spec.ts:56`: injected SDK fetch exercises
  installed-SDK normalization; `apiRequest` would bypass that boundary.
- `tests/support/helpers/event-transport-error.ts:29`: inject a JavaScript Error at
  the query boundary because HTTP interception cannot preserve its object identity
  across SDK normalization. The real successful retry uses `interceptNetworkCall`.

These are the two explicit deviation markers found. Auth/API/polling/interception
for the real browser path use existing merged fixtures. This bundle needs no new
auth provider, HAR recorder, download helper, or Pact wiring; broader changed-file
burn-in wiring is not delivered by its targeted repetition command.

## Cleanup observation resolved

The final cleanup was reread after the main agent strengthened it. The test captures
the successful response's ID at E2E:141, then requires the returned deletion IDs to
equal `[createdId]` at E2E:176-177. HTTP 200, bounded deletion count, and owner/label
checks remain. A zero-row deletion after an observed successful create now fails.
The conditional handles failure-path cleanup where no created ID was observed; it
does not waive the successful-path deletion assertion. Runtime verification of this
change is owned by the main agent. No static concern remains in the inspected scope.

The draft DoD's API wording was corrected: the API cases exercise installed SDK
plus production mapper, not the production EventsService. Final runtime counts,
TypeScript/lint outcomes, repeated-run evidence, and temporary-copy cleanup belong
in the main agent's consolidated result.

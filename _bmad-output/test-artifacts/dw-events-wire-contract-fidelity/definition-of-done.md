# Definition of Done — dw-events-wire-contract-fidelity

Validation against `.agents/skills/bmad-testarch-automate/checklist.md`.
Workflow complete. Static validation, final unmutated execution, mutation controls, and preservation checks passed. Fresh measurements are recorded under `evidence/`.

## Coverage and deliverables

- [x] Selective coverage is mapped in `coverage-plan.md`: five existing API cases and one new browser case; P0 = 1, P1 = 4, P2 = 1, P3 = 0.
- [x] `DE.5-API-007` (P0) covers anonymous denial, a unique owner-scoped attempt, surviving historical/prior/partner witnesses, and a positive control that the same query detects.
- [x] `DE.5-API-004` (P1) covers the real POST representation and strict rejection of an undeclared key by both the row and array schema. `005`, `006`, and `008` retain ordering, label-boundary, and outsider-isolation coverage.
- [x] The API artifact is a snapshot of `tests/api/events-wire-contract.spec.ts`; its five IDs are reused, not counted as five new scenarios. ATDD's `DE.5-API-001..003` are not regenerated.
- [x] New `DW.WIRE-E2E-001` (P2) checks that two same-label events retain distinct IDs, owner controls, dates, and null/calendar mapping through Settings reload. This supplements the API fixes without claiming a new product requirement. Generic reload and partner-read-only checks already exist.
- [x] The new browser case does not reuse ATDD E2E IDs: `001` owns accessibility, `002` rejected-write messages, and `003` offline save.
- [x] Artifacts comprise one API snapshot (749 lines), one new E2E spec (114 lines), one pure factory (25 lines), a staging runner, a manifest, and coverage documentation. Each file is below the knowledge fragment's 1,000-line limit.

## Fixture lifecycle and test structure

- [x] Specs import `test` and `expect` from the existing merged fixtures. They reuse `apiRequest`, `interceptNetworkCall`, `recurse`, and the package's `log` value; no new authentication or polling framework is introduced.
- [x] The anonymous case retains direct `resolveOwnPair`/`seedEvent` setup with no pre-clear. On a successful test, witness-survival assertions precede checked `afterEach` cleanup; teardown also runs when an assertion fails. It must not adopt `coupleEvents`, whose pre-clear would remove the stale-data premise.
- [x] The browser case reuses `coupleEvents`: resolve this worker's pair, capture one date anchor, clear that pair before use, seed via the admin helper, and clear that pair after use. Setup and cleanup errors propagate. Worker ownership is keyed by `TEST_WORKER_INDEX`.
- [x] Same-label own/partner seeds use two calls because the shared batch seeder rejects duplicate labels within one call. The pure factory takes the anchor and a fresh UUID; its label is unique per execution. Shared seeding explicitly materializes null/calendar, so this E2E is not presented as evidence of database defaults.
- [x] The API outsider is a self-provisioned account, never another pool account; its `finally` cleanup preserves both test and cleanup failures through rethrow/aggregation.
- [x] The browser read observer is registered before each navigation. Assertions wait for the HTTP response, then the exact store snapshot, then the rendered rows and controls. UUID-based test IDs avoid label ambiguity.
- [x] Assertions remain visible in test bodies or their inline retry predicates. No hard sleeps, page objects, focused tests, skipped tests, or swallowed assertion failures were found in the inspected pack.
- [x] The fixed `cold load`/`reload` loop always executes both phases; its branch selects the navigation action rather than responding to optional UI state. Store absence returns `null` only as a retry-readiness signal. These are documented exceptions to a literal ban on every conditional.

## Preserved API snapshot deviations

The API snapshot remains byte-for-byte source material by design. Its existing patterns are recorded rather than silently described as newly compliant:

- Admin-client seeding, independent database reads, and checked cleanup use the established Supabase helpers instead of `apiRequest`. Authenticated API calls obtain real tokens through `getUserAccessToken`; anonymous calls intentionally have no bearer.
- Fixed fixture labels and exact boundary/date literals remain in the inherited cases. Pair-scoped setup/teardown supplies isolation; the anonymous attempt and the new browser label use fresh UUIDs. The new test obtains a UUID from `node:crypto` rather than Faker, and accepts explicit identity/anchor inputs rather than a generic override bag.
- The outsider's `try`/`catch`/`finally` and final conditionals preserve dual failures during resource cleanup; they do not convert failures into passes.
- Error responses have a TypeScript envelope plus direct status/code/message assertions rather than a separate runtime error schema. Server-generated timestamps retain presence checks because their exact values are not predetermined.
- The source header contains historical commands and measurements. They describe the active source and its earlier run, not fresh evidence for this artifact snapshot. Run this pack through `run.py`.

## Execution, discovery, and preservation

The pack is outside normal Playwright and TypeScript discovery until staged. No permanent CI job, package script, or active-test duplicate is added. Run from the project root with local Supabase and the existing worker pool available:

```bash
python3 _bmad-output/test-artifacts/dw-events-wire-contract-fidelity/run.py
```

The runner checks manifest/source hashes, refuses existing destination files, stages only manifest paths under `tests/`, and invokes the existing API/Chromium projects with two workers. Its `finally` deletes only staged files whose bytes remain unchanged; a concurrently modified file is preserved and reported. The default command selects the two artifact specs explicitly, avoiding an additional run of the original API suite. Custom broad commands may collect both API copies while staging is active.

| Required evidence | Status |
| --- | --- |
| Active source and artifact snapshot hashes agree | Passed: SHA-256 manifest matches; `evidence/hygiene.json` |
| Discovery finds five API cases and one E2E case | Passed: 6 cases; `evidence/discovery.txt` |
| Existing API suite, two workers | Passed via the exact source snapshot: all five cases; no additional active-source run was counted |
| Staged API + E2E, two workers, counts and durations | Passed: 6/6, no skips, flakes, or retries; 7.282s reporter duration; `evidence/playwright.json` |
| Staged TypeScript and ESLint checks | Passed: typecheck exit 0 (6.06s), lint exit 0 (4.96s); lint reports three pre-existing EventCountdown Fast Refresh warnings; `evidence/typecheck.txt`, `evidence/lint.txt` |
| Five repetitions of changed API cases `004` and `007` | Passed: 10/10; 10.307s reporter duration; `evidence/repeat.json` |
| Loose-schema mutation is detected | Passed: expected assertion failure, `false` expected versus `true` at line 376; `evidence/mutation-loose-schema.json` |
| Missing-owner mutation is detected | Passed: expected assertion failure, zero rows expected versus one at line 274; `evidence/mutation-missing-owner.json` |
| Historical-fixed-label mutation is detected | Passed: expected assertion failure, zero rows expected versus one at line 275; `evidence/mutation-fixed-label.json` |
| Final unmutated staged run after mutation checks | Passed: 6/6, no skips/flakes/retries; 6.850s; `evidence/final-playwright.json` |
| Staged files are removed and test-created resources are cleaned up | Passed: all three copies removed; 20 worker users across ten pairs have zero event rows; outsider cleanup completed in passing API case; `evidence/hygiene.json`, `evidence/resource-cleanup.json` |
| Existing source/generated files and orchestrator state are preserved | Passed: only the pre-existing ledger diff remains; its initial hash matches. No local sprint board existed and none was written; `evidence/hygiene.json` |
| Automation summary contains final evidence and limitations | Passed: `../automation-summary-dw-events-wire-contract-fidelity.md` |

The runner mutates only a staged copy; each mutation must leave the artifact and active source unchanged. The complete six-case run finished within 90 seconds. Two-worker success does not establish four-worker behavior; focused API repetitions do not establish repeated browser stability. Protected-file checks compare with the session's starting bytes; the pre-existing ledger diff was preserved. No local sprint board existed.

## Checklist items outside this run

- N/A: new unit/component/pgTAP suites, other HTTP status families, JWT-format tests, load/performance testing, or unrelated accessibility/reconnect work. The bundle changes test-local wire assertions; existing layers own those other behaviors.
- N/A: Pact/CDC interactions, provider-state files, and broker deployment checks. The project has no applicable consumer/provider Pact boundary; the cached capability result is recorded in the workflow summary.
- N/A: new user/product/order fixtures, generic retry/assertion helpers, download assertions, or new fixture composition. Existing event/auth fixtures already provide the required lifecycle; there are no commerce or download scenarios.
- N/A: production schema changes, dependency changes, `tests/README.md`, package scripts, and CI configuration edits. The requested deliverable is an artifact pack; its runner and summary provide execution instructions.
- N/A: healing report or `test.fixme` handling. The unmutated execution passed; the three deliberate mutation failures are regression-detection evidence and must not be healed or skipped.
- The checklist's literal "one assertion" is applied as one behavioral concern, following `test-quality.md`; multiple exact assertions establish that concern and its positive controls.

- [x] Required orchestrator completion signal written with `status: done`: `bmad-build-auto-result-dw-events-wire-contract-fidelity-tea.automate-1.md`.

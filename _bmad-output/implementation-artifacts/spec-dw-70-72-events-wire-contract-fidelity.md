---
title: 'DW-70/72 Events wire-contract fidelity'
type: 'bugfix'
created: '2026-09-12'
status: 'done'
baseline_revision: '07335c0da9f77ab2f70e1a00223630288592aadb'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [multiple-goals, oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** The anonymous events probe can mistake abandoned test rows for a successful anonymous write because its admin query uses a fixed label without ownership. Its test-local response schema also strips undeclared columns despite claiming an exact table contract.

**Approach:** Give every anonymous attempt a fresh identity, constrain its verification and cleanup to its worker, and make event row validation reject unknown columns. Exercise both fixes through the existing PostgREST suite with stale-row and extra-column regression controls.

## Boundaries & Constraints

**Always:** Resolve identities through the existing `TEST_WORKER_INDEX` worker pair helper; use checked, pair-scoped cleanup; retain the anonymous GET/POST status and error assertions; import Playwright test/expect from merged fixtures; keep schema validation on real response paths.

**Never:** Edit the deferred-work ledger; change production code, database schema, generated files, runner configuration, or archived tests; mutate another worker's accounts or rows; link/unlink partners; rely only on pre-clearing stale rows to fix identity collisions.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Interrupted prior attempt | Worker-owned rows retain historical or prior-attempt labels | A fresh anonymous POST remains rejected and its admin check reports no inserted row | Seed/read/cleanup errors fail the test |
| Same label, different owner | Partner-owned witness shares the current attempt label | Creator-scoped verification excludes the witness; it remains until pair cleanup | Owner-filter regression must fail |
| Current attempt exists | A controlled admin insert matches the current attempt identity and owner after the denial check | The same verification query detects the row | Prevent an always-empty verifier from passing |
| Normal response | Real PostgREST response with declared event columns | Row and array schema validation pass | Existing status/field assertions remain |
| Added response column | Copy of the real row with an undeclared property | The same row and array schemas reject it | Assert rejection is caused by the unknown column |

</intent-contract>

## Code Map

- `tests/api/events-wire-contract.spec.ts:141` — `EventRowSchema` currently uses non-strict `z.object`; `EventRowsSchema` wraps it. All successful wire responses use this shared schema.
- `tests/api/events-wire-contract.spec.ts:196` — DE.5-API-007 resolves its own creator but uses the fixed `ANON_ATTEMPT_LABEL` for both POST and global label-only verification. The describe-level `afterEach` already calls checked `clearOwnPairEvents`.
- `tests/api/events-wire-contract.spec.ts:270` — DE.5-API-004 receives a real defaulted row via `return=representation`; use this response as the valid schema control and derive the unknown-column rejection case from it.
- `tests/api/events-wire-contract.spec.ts:467` — existing outsider test proves shared pair cleanup preserves a non-pool user's event, with checked account deletion and failure aggregation. Preserve this isolation coverage.
- `tests/support/helpers/events.ts:70,97,112,143` — read-only reuse points: `resolveOwnPair`, `clearPairEvents`, `clearOwnPairEvents`, and `seedEvent` check errors and preserve worker ownership.
- `playwright.config.ts` — read-only API runner config loads local Supabase credentials without printing them and starts Vite in test mode; API specs run under the `api` project.
- `package.json` — `typecheck` covers all TS projects; `lint` covers active tests. Local API execution requires running Supabase and installed dependencies.

## Tasks & Acceptance

**Execution:**
- [x] `tests/api/events-wire-contract.spec.ts` — generate a fresh per-execution anonymous identity, use it in the POST and owner-scoped admin verification, and preserve checked worker cleanup.
- [x] `tests/api/events-wire-contract.spec.ts` — extend the anonymous case with abandoned-row witnesses, a different-owner same-label witness within its own pair, and a positive control that proves the current-attempt query detects an actual row. Check witnesses before cleanup so deletion cannot explain isolation success.
- [x] `tests/api/events-wire-contract.spec.ts` — make `EventRowSchema` strict and exercise normal and extra-column row/array parsing using an actual successful response. Keep production schema and all unrelated wire tests unchanged.

**Acceptance Criteria:**
- Given abandoned rows belonging to the worker and a same-label partner witness, when the anonymous probe runs with its fresh identity, then GET and POST still return 401/42501, the current creator attempt has no row, and the witnesses still exist before checked pair cleanup.
- Given an admin-inserted positive control with the current attempt's identity and owner, when the same verification query runs, then it finds that row.
- Given a normal event representation returned by PostgREST, when row and array validation run, then both accept it; when an undeclared column is added, then both reject it with an unknown-key issue.
- Given the modified suite and local Supabase, when the API suite runs with multiple workers, then all cases pass with no skips and existing outsider-cleanup isolation remains passing.
- Given the final change, when lint and typecheck run, then both exit successfully and the deferred-work ledger has no change from the baseline.

## Spec Change Log

## Review Triage Log

### 2026-09-12 — Review pass
- verdicts: 8 findings — high 0, medium 0, low 1, false 7, maybe-false 0
- findings:
  - `[false]` `[reject]` POST identity could diverge from verifier and positive control — the current POST, query, and control all read the same `attemptLabel` and `userId` constants. The proposed bad outcome requires a later independent edit; no mismatch exists in the reviewed code.
  - `[false]` `[reject]` The prior witness does not prove identity generation across attempts — both current and prior labels invoke `randomUUID()` inside the executing test, and the seed remains present during verification. No constant or cached current identity exists; substituting an unrelated fixed label describes hypothetical future code rather than a present uniqueness defect.
  - `[false]` `[reject]` Emoji labels accepted by PostgreSQL are rejected by Zod's length limit — a local probe with 51 heart emoji (102 UTF-16 units) was accepted by `z.string().max(100)`. Installed Zod 4.5.4 uses `codePointLength` for string maximum checks in `zod/v4/core/checks.js:330-333`, consistent with the database's character counting.
  - `[low]` `[reject]` The documented ledger command omits the baseline and would miss staged changes — true of that command, but the fix edits this build's spec, which this workflow explicitly rejects during review. Actual parent verification compared the ledger against `07335c0da9f77ab2f70e1a00223630288592aadb` and returned an empty diff.
  - `[false]` `[reject]` Interrupted-run state is seeded in the current run rather than produced by killing a prior process — the relevant observable is abandoned database rows, and the worker-owned historical and prior-UUID witnesses establish that state without clearing it. The intent does not require process termination.
  - `[false]` `[reject]` The ownership witness is inside the same worker pair and cleanup relies on existing coverage — this exercises the exact creator filter without touching another worker. The unchanged DE.5-API-008 ran and proved a non-pool outsider row survives real pair cleanup.
  - `[false]` `[reject]` The extra column is added in memory rather than transported through HTTP — the requested defect is test-local schema acceptance, and the negative control uses the exact shared row/array schemas derived from a real response. Those same schemas remain attached to raw `apiRequest(...).validateSchema(...)` paths.
  - `[false]` `[reject]` Executable changes are limited to the test suite — this matches both verbatim ledger entries; neither requests production or database behavior changes.

Blind hunter supplied four issues (its arithmetic line is not an issue). Intent alignment supplied
four surface observations with no material divergence, each recorded above. Edge-case review
returned no findings; verification-gap review reported no gaps. All layers were completed before
triage. No patch or deferred entries survived.

## Verification

**Commands:**
- `npx playwright test tests/api/events-wire-contract.spec.ts --project=api --workers=2` — all five existing cases pass with expanded regressions and no skips.
- `npm run typecheck` — exit 0.
- `npm run lint` — exit 0; report any existing warnings.
- `git diff --check` — no whitespace errors.
- `git diff -- _bmad-output/implementation-artifacts/deferred-work.md` — empty.

Temporarily removing strictness must fail the added-column control; temporarily removing ownership from the anonymous verification must fail on the partner witness; reverting to the historical fixed label must fail on the stale creator row. Restore each mutation before final verification and record measured results.


### Implementation verification — 2026-09-12

Parent verification passed: API suite 5/5 with two workers (6.8 seconds), typecheck exit 0,
lint exit 0 with three existing Fast Refresh warnings in `EventCountdown.tsx:68,91,132`,
and whitespace checks clean. The ledger diff against the full baseline revision is empty.

Matrix audit: DE.5-API-007 covers abandoned attempts, the same-label partner witness,
and the matching creator positive control. DE.5-API-004 covers both valid response schemas
and extra-column rejection with exact unknown-key issues. Both cases ran and passed.
Existing DE.5-API-008 also passed its outsider cleanup isolation control.

Measured mutation checks each exited 1 at the intended assertion and were restored before
final verification: replacing `z.strictObject` with `z.object` accepted the extra column;
removing the creator filter returned one partner row instead of zero; using the historical
fixed label returned one stale creator row instead of zero.


## Auto Run Result

Status: done

Implemented DW-70 and DW-72 in the active events API suite. Anonymous attempts now use fresh
UUID labels, and admin verification filters by creator plus attempt identity. Historical and
prior-attempt rows and a same-label partner witness remain present while the denial check passes;
a creator positive control proves the query detects a matching row. Strict row/array validation
accepts real event representations and rejects a copied response with an undeclared column.

Files changed:
- `tests/api/events-wire-contract.spec.ts` — strict response schema and worker-scoped anonymous
  regression controls; existing checked cleanup and other API scenarios preserved.
- This spec — intent, implementation checklist, verification evidence, review triage, and completion.

Review breakdown: zero patches, zero deferred items, eight rejected observations. Rejected
reasons: shared identity constants already agree; fresh UUID generation already occurs per test;
installed Zod counts Unicode code points; the ledger-command suggestion would edit the build spec
and actual verification already used the baseline; seeded rows represent abandoned state;
partner and outsider controls establish the required ownership boundaries; schema negatives
exercise the exact test-local contract; and a test-only diff matches the bundle intent.

Follow-up review recommended: false. Patched entry counts: high 0, medium 0, low 0.
No unverified risk requiring another review pass was identified.

Verification performed:
- `npx playwright test tests/api/events-wire-contract.spec.ts --project=api --workers=2` — parent
  run passed all 5 cases, no skips, in 6.8 seconds; implementer runs also passed before/after mutations.
- `npm run typecheck` — passed, exit 0.
- `npm run lint` — passed, exit 0, with three existing Fast Refresh warnings in
  `src/components/RelationshipTimers/EventCountdown.tsx:68,91,132`.
- `git diff --check` and staged whitespace check — passed.
- Ledger diff against the full baseline revision — empty.
- Matrix audit — all five matrix rows covered by DE.5-API-007 and DE.5-API-004, both executed.
- Three intentional mutations — each failed at the expected assertion, then restored before
  final passing verification: non-strict schema, missing creator filter, and historical fixed label.

Residual risks: no new unresolved findings. Existing lint and test-runner environment warnings
remain unrelated to this change. The deferred-work ledger was not edited, staged, or committed.

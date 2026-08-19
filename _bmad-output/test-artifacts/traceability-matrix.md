---
stepsCompleted:
  [
    'step-01-load-context',
    'step-02-discover-tests',
    'step-03-map-criteria',
    'step-04-analyze-gaps',
    'step-05-gate-decision',
  ]
lastStep: 'step-05-gate-decision'
lastSaved: '2026-08-19'
workflowType: 'testarch-trace'
runScope: 'story-level'
runKey: 'dw-events-offline-message-honesty'
coverageBasis: 'acceptance_criteria'
oracleConfidence: 'high'
oracleResolutionMode: 'formal_requirements'
oracleSources:
  - '_bmad-output/implementation-artifacts/spec-dw-7-18-events-offline-message-honesty.md'
  - '_bmad-output/test-artifacts/test-design-epic-dw-events-offline-message-honesty.md'
  - '_bmad-output/test-artifacts/automation-summary-epic-dw-events-offline-message-honesty.md'
  - '_bmad-output/implementation-artifacts/deferred-work.md'
externalPointerStatus: 'not_used'
collectionMode: 'contract_static'
collectionStatus: 'COLLECTED'
sourceSha: 'f486587f658fa812987a277ee1e416949f4f2fbc'
tempCoverageMatrixPath: '/private/tmp/claude-501/-Users-sallvain-Projects-My-Love--bmad-loop-runs-20260819-133049-ee65-worktrees-dw-events-offline-message-honesty/43aafe94-571e-4f57-816c-0f5608860380/scratchpad/tea-trace-coverage-matrix-2026-08-19T19-41-42Z.json'
gateStatus: 'PASS'
inputDocuments:
  - '_bmad-output/implementation-artifacts/spec-dw-7-18-events-offline-message-honesty.md'
  - '_bmad-output/test-artifacts/test-design-epic-dw-events-offline-message-honesty.md'
  - '_bmad-output/test-artifacts/automation-summary-epic-dw-events-offline-message-honesty.md'
  - '_bmad-output/implementation-artifacts/deferred-work.md'
  - 'tests/unit/api/interactionService.test.ts'
  - 'tests/unit/api/offlineMessageHonesty.test.ts'
  - 'tests/unit/api/fakeInteractionsBackend.ts'
  - 'tests/unit/stores/loaderIdentityGuards.test.ts'
  - 'src/api/interactionService.ts'
  - 'src/api/errorHandlers.ts'
  - 'src/api/moodApi.ts'
  - 'src/api/moodSyncService.ts'
  - 'src/api/partnerService.ts'
  - 'src/services/eventsService.ts'
  - 'src/services/loveNoteImageService.ts'
  - 'src/stores/slices/photosSlice.ts'
  - '_bmad/tea/config.yaml'
---

# Traceability Matrix & Gate Decision — dw-events-offline-message-honesty

**Target:** DW-7 / DW-18 — stop `interactionService` promising an offline sync that cannot happen
**Date:** 2026-08-19
**Evaluator:** Sallvain (TEA Agent — Master Test Architect)
**Coverage Oracle:** acceptance_criteria (formal requirements)
**Oracle Confidence:** high
**Oracle Sources:** `spec-dw-7-18-events-offline-message-honesty.md` § Tasks & Acceptance + § I/O & Edge-Case Matrix; `test-design-epic-dw-events-offline-message-honesty.md` § Test Coverage Plan; `automation-summary-epic-dw-events-offline-message-honesty.md` § coverage plan → what was built
**Commit under trace:** `f486587f658fa812987a277ee1e416949f4f2fbc`

> **What is being traced.** The tests under trace are **uncommitted working-tree changes** at `f486587`: `tests/unit/api/interactionService.test.ts` (modified, 15 → 33 tests), `tests/unit/api/offlineMessageHonesty.test.ts` (new, 11 tests) and `tests/unit/api/fakeInteractionsBackend.ts` (new fixture). `src/` is clean — `git status --porcelain` lists no source file, so no production code was changed to produce this coverage. Re-run this workflow after those files are committed if the gate signal is consumed by CI.

Note: this workflow does not generate tests. Where gaps exist, `/bmad-testarch-atdd` or `/bmad-testarch-automate` create the coverage.

---

## PHASE 1: REQUIREMENTS TRACEABILITY

### Coverage Summary

| Priority  | Total Criteria | FULL Coverage | Coverage % | Status                          |
| --------- | -------------- | ------------- | ---------- | ------------------------------- |
| P0        | 0              | 0             | 100%       | ✅ PASS (vacuous — see note)    |
| P1        | 15             | 14            | 93%        | ✅ PASS                          |
| P2        | 2              | 2             | 100%       | ✅ PASS                          |
| P3        | 2              | 0             | 0%         | ℹ️ Deliberately deferred        |
| **Total** | **19**         | **16**        | **84%**    | **✅ PASS**                      |

**Legend:** ✅ PASS — meets gate threshold · ⚠️ WARN — below threshold, not critical · ❌ FAIL — below minimum (blocker)

**On the P0 row.** There are **no P0 requirements in this register**, so the 100% is `safePct(0, 0)`, not evidence of anything. The test design assigned no P0 by running `test-priorities-matrix.md`'s decision tree: no revenue impact, no security-critical path, no data-integrity operation, no compliance requirement, and every failure has a trivial workaround (press the button again). Regression prevention applies — DW-7 and DW-18 are previously-identified defects — which sets the ceiling at P1. This trace does not second-guess that assignment, but the gate's strongest rule (P0 = 100%) therefore carries no weight here, and the decision rests entirely on the P1 and overall thresholds.

**Register composition, and how much the gate depends on it.** The register is the complete union of the three formal sources: 5 acceptance criteria (`AC-1`…`AC-5`), 6 I/O matrix rows (`IO-1`…`IO-6`), and 8 test-design coverage-plan items (`TEST-01`…`TEST-07` plus `TEST-01a`). Nothing was dropped. The AC and I/O sets overlap in subject — `AC-3` states the honesty property that `IO-2`, `IO-3`, `IO-4` and `IO-6` each realise for one scenario — and that overlap materially moves the number: folding the six I/O rows into `AC-3` yields a 13-item register at 77% overall, which trips the ≥80% rule and reads **FAIL** rather than PASS. This is disclosed rather than resolved, because the completeness rule ("all oracle items accounted for, none skipped") is the one that determined the register, not the outcome. A reader who prefers the leaner register should read the gate as CONCERNS/FAIL on overall coverage and act on the same two P3 gaps either way.

---

### Detailed Mapping

Test IDs of the form `DW-UNIT-NNN` are **assigned by this trace for reference**. They do not appear in the test sources: the automation run deliberately kept priority/ID tags out of test names (only 10 of 48 unit files use them, and `test-quality.md` requires one dialect per file), so every ID below is resolved to `file:line` instead.

#### AC-1: `grep -n handleNetworkError src/api/interactionService.ts` prints only comment lines — no import, no call site (P1)

- **Coverage:** FULL ✅
- **Tests:**
  - `DW-UNIT-039` — tests/unit/api/offlineMessageHonesty.test.ts:154 (`it.each` case `src/api/interactionService.ts`)
    - **Given:** the module list of Supabase-only features
    - **When:** its import statements are read with comments stripped
    - **Then:** neither `handleNetworkError` nor `OFFLINE_ERROR_MESSAGE` is among the imported local names
  - `DW-UNIT-038` — tests/unit/api/offlineMessageHonesty.test.ts:142 — proves the detector ignores a symbol that appears only in a comment, which is load-bearing here: this file names `handleNetworkError` four times in prose explaining the omission
  - `DW-UNIT-034` — tests/unit/api/offlineMessageHonesty.test.ts:130 — proves the `it.each` list is non-empty, so the check cannot pass by iterating zero cases
- **Command evidence (run this session):** `grep -n handleNetworkError src/api/interactionService.ts` → 4 matches at lines 9, 58, 71, 157; all four are comment lines (` * ` prose or `// NOT handleNetworkError:`).

#### AC-2: repo-wide, `src/api/errorHandlers.ts:95` is the only non-comment source of "will be synced when you're back online", and no `interactionService` throw can produce it (P1)

- **Coverage:** FULL ✅
- **Tests:**
  - `DW-UNIT-039`…`DW-UNIT-044` — offlineMessageHonesty.test.ts:154 — all six listed Supabase-only modules assert non-import
  - `DW-UNIT-008` — interactionService.test.ts:150 — offline rejection message `.not.toContain(SYNC_PROMISE)`
  - `DW-UNIT-010` — interactionService.test.ts:174 — PostgREST no-row path carries no sync promise
  - `DW-UNIT-011` — interactionService.test.ts:182 — empty-body path carries no sync promise
  - `DW-UNIT-019` — interactionService.test.ts:273 — the sweep across every mid-flight rejection
- **Command evidence:** `grep -rn "will be synced when you're back online" src` → 3 matches. `src/api/errorHandlers.ts:95` is the only code; `src/api/interactionService.ts:10` and `src/services/eventsService.ts:118` are doc comments explaining why the helper is not used.

#### AC-3: every rejection message describes an offline device, a mid-flight failure, a write that changed nothing, or a PostgREST error — never a future sync (P1)

- **Coverage:** FULL ✅
- **Tests:** 16 mapped — `DW-UNIT-006`…`008` (offline, :133/:142/:150), `DW-UNIT-009`…`011` (zero-row, :166/:174/:182), `DW-UNIT-014`…`019` (mid-flight, :218/:229/:239/:249/:259/:273), `DW-UNIT-020`…`023` (PostgREST, :294/:304/:314/:324)
  - **Given:** each of the four failure kinds the spec enumerates, on each method that can raise it
  - **When:** the caller awaits the rejection and reads `.message`
  - **Then:** the message is pinned with `toBe`, not `toContain` — the regression this change prevents is an *appended sentence*, and a substring assertion would pass with the promise re-attached
- **Note:** all four failure kinds are exercised against all four public methods that can raise them, which is why this criterion is FULL rather than PARTIAL.

#### AC-4: with `navigator.onLine` false, `sendPoke` / `sendKiss` reject without issuing any `supabase.from()` call (P1)

- **Coverage:** FULL ✅
- **Tests:**
  - `DW-UNIT-006` — interactionService.test.ts:133 — asserts both halves: `failure?.message` is `'You are offline. A poke needs a connection to send.'` **and** `backend.fromCalls` is `0`
  - `DW-UNIT-007` — interactionService.test.ts:142 — the kiss path, message only
- **Precision note:** `fromCalls === 0` is asserted on the poke path only. The kiss path is established transitively: both entry points funnel through one `isOnline()` guard that sits *before* the `try`, and the pinned kiss message can only be constructed inside that guard, so a kiss that reached `supabase.from()` could not produce it. Recorded rather than glossed, because it is the one place the register leans on a shared-code argument instead of a direct assertion.

#### AC-5: `errorHandlers.ts`, `moodApi.ts` and `moodSyncService.ts` keep their `handleNetworkError` call sites byte-identical to HEAD (P1)

- **Coverage:** FULL ✅
- **Tests (positive control):**
  - `DW-UNIT-035` — offlineMessageHonesty.test.ts:135 — `src/api/moodApi.ts` still imports `handleNetworkError`
  - `DW-UNIT-036` — same line — `src/api/moodSyncService.ts` still imports it
  - `DW-UNIT-037` — same line — `src/components/MoodTracker/MoodTracker.tsx` still imports `OFFLINE_ERROR_MESSAGE`
- **Command evidence:** `git diff --stat HEAD -- src/api/errorHandlers.ts src/api/moodApi.ts src/api/moodSyncService.ts` → empty. `git diff --stat main...HEAD --` the same three files → empty. Byte-identity is a property of the diff and is verified by command; no test can or should assert it.
- **Behavioural regression scope:** `tests/unit/api/moodApi.test.ts`, `moodSyncService.test.ts`, `moodSyncSubscription.test.ts` — all green in this session's 90-file run.

#### IO-1: send succeeds — online, insert returns a row → resolves with the interaction record (P1)

- **Coverage:** FULL ✅
- **Tests:** `DW-UNIT-004` (:114, returns the inserted record), `DW-UNIT-005` (:124, sends the requested interaction type)

#### IO-2: send while offline → rejects before any request; names the offline state and that it was not sent; no sync promise (P1)

- **Coverage:** FULL ✅
- **Tests:** `DW-UNIT-006` (:133), `DW-UNIT-007` (:142), `DW-UNIT-008` (:150) — all three clauses of the row are separately asserted

#### IO-3: insert returns no row → rejects saying the interaction was not sent, not dressed as a network error, no sync promise (P1)

- **Coverage:** FULL ✅
- **Tests:** `DW-UNIT-009` (:166, `PGRST116` → `'[InteractionService.sendInteraction] No rows found'`), `DW-UNIT-010` (:174), `DW-UNIT-011` (:182, empty body → `'The poke was not sent'`), `DW-UNIT-012` (:197, the `instanceof` re-throw sits above `logSupabaseError` — `console.error` **not** called), `DW-UNIT-013` (:208, the contrasting case — `console.error` **is** called on a genuine mid-flight failure), plus fixture fidelity `DW-UNIT-001` (:76) and `DW-UNIT-002` (:90)
- **Why this row is the strongest in the register:** both client realisations of "no row" are modelled and asserted separately, and the pair at :197/:208 is a two-sided observability assertion — a single-sided one would be satisfied by a test that simply never triggers logging.

#### IO-4: send fails mid-flight → `[InteractionService.sendInteraction] Network error: <detail>. Check your internet connection.` (P1)

- **Coverage:** FULL ✅
- **Tests:** `DW-UNIT-014` (:218), `DW-UNIT-013` (:208), `DW-UNIT-019` (:273)

#### IO-5: send rejected by PostgREST → `handleSupabaseError` message unchanged (P1)

- **Coverage:** FULL ✅
- **Tests:** `DW-UNIT-020` (:294) — `42501` → `'[InteractionService.sendInteraction] Permission denied - check Row Level Security policies'`. The `RLS_DENIED` envelope in `fakeInteractionsBackend.ts:84-89` was measured against local PostgREST, and `DW-UNIT-002` pins that it is recognised by `isPostgrestError` — without which every rejection would silently route down the network branch and this test would pass for the wrong reason.

#### IO-6: read/update fails mid-flight on all three remaining methods (P1)

- **Coverage:** FULL ✅
- **Tests:** `DW-UNIT-015` (:229, history), `DW-UNIT-016` (:239, unviewed), `DW-UNIT-017` (:249, mark-as-viewed), `DW-UNIT-018` (:259, the non-`Error` rejection arm), `DW-UNIT-019` (:273)

#### TEST-01: a zero-row insert reported as `PGRST116` rejects with `'… No rows found'`, no sync promise (P1)

- **Coverage:** FULL ✅
- **Tests:** `DW-UNIT-009` (:166), `DW-UNIT-010` (:174)
- **Evidence note:** the test design predicted the message `"JSON object requested, multiple (or no) rows returned"`; the automation run measured the live local PostgREST response and found `{"code":"PGRST116","details":"The result contains 0 rows","message":"Cannot coerce the result to a single JSON object"}`. The predicted string was the *client's* `maybeSingle` text and never reaches a `.single()` call. The design's own contingency ("run the integration variant before pinning the message string") was followed, and the assumption is now measured rather than inferred.

#### TEST-01a: fixture correction — `single()` models the Accept-header coercion; the two zero-row realisations are separated (P1)

- **Coverage:** FULL ✅
- **Tests:** `DW-UNIT-001` (:76), `DW-UNIT-002` (:90), `DW-UNIT-003` (:106)
- **Artifact:** `tests/unit/api/fakeInteractionsBackend.ts` (336 lines), extracted following the existing `tests/unit/api/fakeMoodsBackend.ts` precedent. `.or()` models only the `column.eq.value` form the service sends and **throws** on anything else rather than silently matching everything — `DW-UNIT-003` pins that.

#### TEST-02: `getInteractionHistory` and `markAsViewed` map a `PostgrestError` through `handleSupabaseError`, unchanged (P1)

- **Coverage:** FULL ✅
- **Tests:** `DW-UNIT-021` (:304), `DW-UNIT-023` (:324); the sibling cases `DW-UNIT-020` (:294) and `DW-UNIT-022` (:314) complete the set across all four methods
- **Closes:** the one-sided branches the test design measured as `if@314 = [0,2]` and `if@394 = [0,2]`

#### TEST-03: no Supabase-only module may import `handleNetworkError` or `OFFLINE_ERROR_MESSAGE` (P1)

- **Coverage:** PARTIAL ⚠️
- **Tests:** all 11 in `tests/unit/api/offlineMessageHonesty.test.ts` — `DW-UNIT-034` (list non-empty), `DW-UNIT-035`…`037` (positive control on the three legitimate importers), `DW-UNIT-038` (comment-only symbols not counted), `DW-UNIT-039`…`044` (the six listed Supabase-only modules)
- **Gaps:**
  - **The enforcement list covers 6 modules; the Supabase-only population is at least 9.** Verified this session: `src/stores/slices/photosSlice.ts:15-17` declares "Persistence: — Supabase: photos stored in photos table + storage bucket — No local persistence (photos loaded on demand)"; `src/services/loveNoteImageService.ts` imports `supabase`, `IMAGE_STORAGE`, `logger` and `imageCompressionService` with zero IndexedDB references; `src/api/partnerService.ts` imports only `logger` and `supabase`, likewise zero. None of the three is in `SUPABASE_ONLY_MODULES` (`offlineMessageHonesty.test.ts:73-80`), so an import of either symbol into any of them would go undetected. The asymmetry is visible in the list itself: for love notes, events and interactions the *slice* is listed, but for photos only the *service* is.
  - **Detection is a static string scan of import statements, not module resolution.** The test design ranked the ESLint `no-restricted-imports` override higher and the automation run recorded the downgrade as an operator decision, because promoting it edits `eslint.config.js`.
- **Recommendation:** confirm each of `photosSlice.ts`, `loveNoteImageService.ts` and `partnerService.ts` against `AGENTS.md`'s data-model paragraph and add them to `SUPABASE_ONLY_MODULES`; then promote the check to the ESLint override, keeping the vitest positive-control block either way — ESLint cannot express "these three modules must *still* import it". Suggested new coverage: extend the existing `it.each` (no new test ID needed) — **Given** the widened module list, **When** each module's imports are read, **Then** neither sync-promising symbol appears.
- **Not a gap:** the invariant holds *today*. The only importers of either symbol anywhere in `src` are `moodApi.ts`, `moodSyncService.ts` and `MoodTracker.tsx` — verified by grepping `src` for both symbols (7 files reference them; two are the definitions, two more are comment-only in `interactionService.ts` and `eventsService.ts`). The gap is forward-looking: it is about what the guard would *catch*, not about a live violation.

#### TEST-04: `networkFailure` produces "Unknown network error" for a non-`Error` rejection, still with no sync promise (P2)

- **Coverage:** FULL ✅
- **Tests:** `DW-UNIT-018` (:259) — closes `cond-expr@77`, measured `[9,0]` before this working tree

#### TEST-05: success paths of the three read/update methods, including the `.or()` / `.order()` / `.range()` predicate (P2)

- **Coverage:** FULL ✅
- **Tests:** `DW-UNIT-024`…`029` (history: both directions and nobody else's, newest first, offset/limit window, record mapping, null `viewed`, null `created_at`), `DW-UNIT-030`…`032` (unviewed), `DW-UNIT-033` (:472, `markAsViewed` sets `viewed` on the named row and leaves the others alone)
- **Note:** this closes ledger entry **DW-34**, which is still recorded `status: open` in `deferred-work.md`. Trace does not edit the ledger; see *Observations*.

#### TEST-06: `markAsViewed` surfaces a zero-row UPDATE instead of resolving successfully (P3)

- **Coverage:** NONE ❌ (deliberately deferred)
- **Gap:** DW-31. `src/api/interactionService.ts:379-400` checks only `error`, never the row count, and the UPDATE policy `USING (auth.uid() = to_user_id)` (`supabase/migrations/20251206024345_remote_schema.sql:316-321`) turns a non-recipient's update into a zero-row success. Closing it needs a production change the spec's Never list excludes, so no test-only change can cover it.
- **Reachability:** not reachable through today's UI — `handleAnimationComplete` only passes rows from `getUnviewedInteractions`, which already filters `toUserId === userId`.

#### TEST-07: `subscribeInteractions` surfaces `CHANNEL_ERROR` / `TIMED_OUT` to its caller (P3)

- **Coverage:** NONE ❌ (deliberately deferred)
- **Gap:** DW-35. `src/api/interactionService.ts:253-255` passes a logger into `.subscribe()` and never surfaces either status. Also entangled with the direct `supabase.channel()` call that `AGENTS.md` records as a repo-wide teardown pitfall. This is the **entire** remaining statement-coverage gap in the changed file (uncovered lines 238-262).

---

### Gap Analysis

#### Critical Gaps (BLOCKER) ❌

**0 gaps.** No P0 requirement exists in this register, so none can be uncovered. See the P0 note under *Coverage Summary* — this row is vacuous, not reassuring.

#### High Priority Gaps (PR BLOCKER) ⚠️

**0 uncovered P1 requirements. 1 partially covered.**

1. **TEST-03: no Supabase-only module may import a sync-promising symbol** (P1)
   - Current coverage: PARTIAL — 11 tests, enforcement list covers 6 of ≥9 Supabase-only modules
   - Missing: `photosSlice.ts`, `loveNoteImageService.ts`, `partnerService.ts` in `SUPABASE_ONLY_MODULES`; module resolution rather than string scanning
   - Recommend: extend the existing `it.each` list (Unit), then promote to an ESLint `no-restricted-imports` override
   - Impact: a future Supabase-only feature importing `handleNetworkError` in one of the three unlisted modules reintroduces DW-7/DW-18 silently. This is the exact failure the requirement exists to prevent, one module along.

#### Medium Priority Gaps (Nightly) ⚠️

**0 gaps.** Both P2 requirements are FULL.

#### Low Priority Gaps (Optional) ℹ️

**2 gaps, both deliberate.**

1. **TEST-06: `markAsViewed` zero-row UPDATE** (P3) — NONE. Blocked on a production change (DW-31).
2. **TEST-07: `subscribeInteractions` error surfacing** (P3) — NONE. Blocked on a production change (DW-35).

Both are recorded in the ledger, both were excluded by the spec's Never list, and the test design's own operator note says listing them as planned coverage while the code they would test cannot change is not defensible. They are counted as uncovered here rather than dropped, because dropping them would improve the coverage percentage without improving coverage.

---

### Coverage Heuristics Findings

#### Endpoint Coverage Gaps

- **Operations with no test at any level: 1**
  - `supabase.channel('interactions-<userId>')` — the `subscribeInteractions` realtime subscription (TEST-07 / DW-35)
- **Operations with no *API-level* test: 5** — the four PostgREST operations (`insert` into `interactions`, the history `select`, the unviewed `select`, the `viewed` `update`) plus the realtime channel. This is a deliberate, justified level choice, not an oversight: `test-levels-framework.md` marks *"Error handling (logic) → Unit: Primary, E2E: Overkill"*, and the four PostgREST operations are exercised at unit level against a fixture whose `PGRST116` and `42501` envelopes were **measured against this repo's running local PostgREST**, with three fidelity tests pinning that the fake still matches the client contract. The single-integer heuristic in `e2e-trace-summary.json` reports **1** — operations with no coverage at any level. Both numbers are stated here so neither reading is hidden.

#### Auth/Authz Negative-Path Gaps

- **Criteria missing denied/invalid-path tests: 0** → status `present`
- The RLS rejection (`42501`, "new row violates row-level security policy for table \"interactions\"") is asserted on all four public methods: `DW-UNIT-020`…`023`.

#### Happy-Path-Only Criteria

- **Criteria missing error/edge scenarios: 0** → status `present`
- The register is the inverse of the usual shape: the failure surface is the requirement, and the happy paths (`IO-1`, TEST-05) were the later addition.

#### UI Journey / UI State Coverage

- **Not applicable.** The oracle is formal, not source-derived, and the change is unobservable above the service layer: `PokeKissInterface.tsx:184-186` and `:217-220` render the constants `'Failed to send poke. Try again.'` / `'Failed to send kiss. Try again.'`, never `error.message`. An E2E asserting a toast would pass identically before and after the change — a check that cannot fail for the reason it claims to.

---

### Quality Assessment

Assessed against `test-quality.md`'s Core Quality Checklist, measured in this session.

**BLOCKER Issues** ❌ — none.

**WARNING Issues** ⚠️ — none. File sizes 484 / 167 / 336 lines (limit 1000); runtime 5 ms and 3 ms (limit 90 s); no `.skip`, `.only`, `.todo` or `fixme` anywhere in the three files (grep returned no matches).

**INFO Issues** ℹ️

- Neither traced file carries `[P0]`-style priority tags in test names. Recorded as a **stated deviation** by the automation run, not a defect: only 10 of 48 unit test files use them (measured this session: `find tests -name "*.test.ts*" -not -path "*/e2e-archive/*" | wc -l` → 48; `grep -rl "\[P[0-3]\]"` over the same set → 10), `test-quality.md` Example 8 requires one dialect per file, and the whole Vitest suite runs in ~5.5 s so no selective-execution need exists. The priority mapping lives in this document instead.

#### Tests Passing Quality Gates

**44/44 mapped tests (100%) meet all quality criteria** ✅

- Explicit assertions in every test body; rejections go through a `rejection()` helper using the `rejects`-style form rather than `try`/`catch`
- No hard waits or timers — the suite is synchronous over an in-memory fake
- Self-cleaning: `backend.reset()` and `setOnline(true)` in `beforeEach`, `vi.restoreAllMocks()` in `afterEach`
- Parallel-safe: **5/5 clean burn-in** of both files measured in this session

---

### Duplicate Coverage Analysis

#### Acceptable Overlap (Defense in Depth)

- `AC-3` and `IO-2`/`IO-3`/`IO-4`/`IO-6` share tests by construction: the AC states the property, each I/O row states one scenario that realises it. Same tests, different oracle items — this is register overlap, not duplicated test code.
- `AC-1`/`AC-2` and `TEST-03` share the guard file for the same reason: `AC-1` is the single-module instance, `TEST-03` the repo-wide invariant.

#### Unacceptable Duplication ⚠️

**None found.** Checked across the whole suite: the only other test file touching this surface is `tests/unit/stores/loaderIdentityGuards.test.ts:420-421`, which mocks `InteractionService` entirely (`:87-93`) to test the slice's account-identity guard — adjacent, not overlapping. `tests/e2e/partner/partner-mood.spec.ts:35` (`[P0] 4.5-E2E-002`) asserts poke/kiss button presence and never reads an error message, so it duplicates nothing here.

---

### Coverage by Test Level

| Test Level | Tests  | Criteria Covered | Coverage %      |
| ---------- | ------ | ---------------- | --------------- |
| E2E        | 0      | 0                | 0%              |
| API        | 0      | 0                | 0%              |
| Component  | 0      | 0                | 0%              |
| Unit       | 44     | 17               | 89% (17 / 19)   |
| Live       | 0      | 0                | 0%              |
| **Total**  | **44** | **17**           | **89%**         |

"Criteria Covered" counts every coverage-eligible requirement (FULL, PARTIAL, UNIT-ONLY, INTEGRATION-ONLY) with at least one test at that level: 16 FULL + 1 PARTIAL. The two NONE items are not eligible.

**Every requirement in this register is UNIT-only by design, and that is the correct level** — not a coverage shortfall. `test-levels-framework.md` marks error-handling logic in an isolated class with a single mockable dependency as Unit-primary and E2E-overkill, and the *Not in Scope* table in the test design records the falsifiability argument for excluding E2E and component tests.

---

### Live Verification Evidence

**Not present.** `coverage_levels` includes `live`, and `_bmad-output/test-artifacts/live-verification-results.json` was checked and does not exist. No requirement in this register rests on recorded runtime verification, so `requirements_live_only` is **0** and the CONCERNS cap for live-only coverage does not apply. Freshness: `not_present`. No live blockers.

---

### Traceability Recommendations

#### Immediate Actions (Before PR Merge)

1. **Commit the working-tree test files.** `tests/unit/api/interactionService.test.ts`, `offlineMessageHonesty.test.ts` and `fakeInteractionsBackend.ts` are uncommitted. Every number in this document describes a tree that does not yet exist in git history.
2. **Widen the honesty guard's module list** — add `src/stores/slices/photosSlice.ts`, `src/services/loveNoteImageService.ts` and `src/api/partnerService.ts` to `SUPABASE_ONLY_MODULES` after confirming each against `AGENTS.md`'s data-model paragraph. This is the only P1 item not at FULL.

#### Short-term Actions (This Milestone)

1. **Promote TEST-03 to the ESLint `no-restricted-imports` override** the test design specified, keeping the vitest positive-control block. Operator decision — it edits `eslint.config.js`.
2. **Add a per-file coverage threshold for `src/api/interactionService.ts`.** Measured today at 82.53% statements / 87.5% branches; `vitest.config.ts:52-57` sets only global 25% thresholds, so a regression from 82% to 30% in this file would not fail CI.
3. **Decide `src/utils/offlineErrorHandler.ts:74`.** `OFFLINE_ERROR_MESSAGE` still reads "Changes will sync when reconnected." Its one consumer (`MoodTracker.tsx`) is offline-first, so it is true today; the guard stops it spreading but does not resolve the contradiction with that file's own header ("No offline queue for writes - fail immediately with retry option").

#### Long-term Actions (Backlog)

1. **Schedule DW-31 (TEST-06) and DW-35 (TEST-07)** or consciously accept them. Both need production changes; together they are the entire remaining statement-coverage gap.

---

## PHASE 2: QUALITY GATE DECISION

**Gate Type:** story
**Decision Mode:** deterministic
**Collection Mode:** contract_static → **Collection Status: COLLECTED** → gate-eligible (`allow_gate: true`)

---

### Evidence Summary

#### Test Execution Results

Measured in this worktree at `f486587` plus the uncommitted working tree.

- **Traced files:** 44 tests — **44 passed, 0 failed, 0 skipped**, 10 ms of test time (449 ms wall)
- **Full unit suite:** 90 files / **1345 tests — all passed**, 5.46 s
- **Overall pass rate: 100%**

**Priority Breakdown (test execution):** every mapped test is P1/P2 by requirement association; all pass. No P0 tests exist in this register.

**Test Results Source:** local run — `npx --no-install vitest run` and `npx --no-install vitest run tests/unit/api/interactionService.test.ts tests/unit/api/offlineMessageHonesty.test.ts`, this session.

#### Coverage Summary (from Phase 1)

- **P0 acceptance criteria:** 0/0 (100%, vacuous) ✅
- **P1 acceptance criteria:** 14/15 covered (93%) ✅
- **P2 acceptance criteria:** 2/2 covered (100%) ✅
- **P3 acceptance criteria:** 0/2 covered (0%) — both deliberately deferred
- **Overall requirement coverage:** 16/19 FULL (84%)

**Code coverage of the changed file** — `npx --no-install vitest run tests/unit/api/interactionService.test.ts --coverage --coverage.include='src/api/interactionService.ts'`:

- **Statements: 82.53%** — against the design's proposed ≥85% target: **2.5 points short**, and the entire remaining gap is lines 238-262, which is `subscribeInteractions` in full (TEST-07 / DW-35). Reaching 85% is not available to a test-only change.
- **Branches: 87.5%** — against the proposed ≥75%: met with margin
- **Functions: 71.42%** · **Lines: 83.87%**
- Enforced thresholds are global 25% (`vitest.config.ts:52-57`); these targets are review-time only.

#### Non-Functional Requirements (NFRs)

**NOT_ASSESSED.** No `/bmad-testarch-nfr` run exists for this target. The test design recorded every NFR threshold as UNKNOWN — no PRD or ADR exists in this repository — and explicitly declined to invent values.

- **Security:** no assessment. The change adds no query, no policy and no exported symbol (`InteractionWriteError` is deliberately unexported). `supabase/tests/database/02_rls_policies.sql` continues to assert the policy set, untouched. **Security issue count: 0 known**, from the absence of a security surface rather than from a security review.
- **Performance:** N/A — no code path gained work; `networkFailure` runs only on a rejection.
- **Reliability:** the qualitative bar is the spec's own sentence, "Every message a caller can read must describe what actually happened." Traced above as `AC-3`, FULL.
- **Maintainability:** duplication is a known open item — DW-33 records that the error class and `networkFailure` builder now exist in two copies. No duplication check runs in this repo.

**NFR Source:** not assessed. This is a gap in the evidence, recorded rather than papered over; it does not affect the deterministic gate, which evaluates coverage only.

#### Flakiness Validation

- **Burn-in iterations:** 5 (both traced files), run in this session
- **Flaky tests detected:** 0
- **Stability score:** 100%
- **Burn-in source:** local — 5 sequential `vitest run` invocations, all exit 0, 44/44 each time

---

### Decision Criteria Evaluation

#### P0 Criteria (Must ALL Pass)

| Criterion             | Threshold | Actual        | Status  |
| --------------------- | --------- | ------------- | ------- |
| P0 Coverage           | 100%      | 100% (of 0)   | ✅ PASS |
| P0 Test Pass Rate     | 100%      | n/a (0 tests) | ✅ PASS |
| Security Issues       | 0         | 0 known       | ✅ PASS |
| Critical NFR Failures | 0         | 0 (not assessed) | ⚠️ see note |
| Flaky Tests           | 0         | 0 (5× burn-in) | ✅ PASS |

**P0 Evaluation:** ✅ ALL PASS — with the caveat that two of the five rows are satisfied vacuously (no P0 requirements exist) and one rests on an assessment that was never run.

#### P1 Criteria (Required for PASS, May Accept for CONCERNS)

| Criterion              | Threshold | Actual | Status  |
| ---------------------- | --------- | ------ | ------- |
| P1 Coverage            | ≥90%      | 93%    | ✅ PASS |
| P1 Test Pass Rate      | ≥90%      | 100%   | ✅ PASS |
| Overall Test Pass Rate | ≥90%      | 100%   | ✅ PASS |
| Overall Coverage       | ≥80%      | 84%    | ✅ PASS |

**P1 Evaluation:** ✅ ALL PASS

#### P2/P3 Criteria (Informational, Don't Block)

| Criterion         | Actual | Notes                                                                    |
| ----------------- | ------ | ------------------------------------------------------------------------ |
| P2 Coverage       | 100%   | TEST-04 and TEST-05 both FULL                                            |
| P3 Coverage       | 0%     | TEST-06 / TEST-07 — both blocked on production changes the spec excludes |
| P2/P3 Pass Rate   | 100%   | Every P2-mapped test passes; no P3 tests exist to run                    |

---

### GATE DECISION: ✅ PASS

---

### Rationale

**Deterministic result:** P0 coverage is 100%, P1 coverage is 93% (target: 90%), and overall coverage is 84% (minimum: 80%). Rule 4 of the coverage gate applies; no overlay modifies it — the oracle is formal rather than synthetic, and no requirement rests on recorded live verification, so neither the confidence cap nor the live-evidence cap fires.

**The evidence that drove it.** Every acceptance criterion in the spec is covered at the level `test-levels-framework.md` prescribes, and every one of the four rejection kinds is asserted against every method that can raise it, with messages pinned by `toBe` so a re-attached sync promise cannot pass. The four command-verifiable acceptance criteria were re-run in this session rather than read from the prior artifacts: the `handleNetworkError` grep returns comment lines only, the repo-wide sync-promise grep returns `errorHandlers.ts:95` as the sole code match, and both `git diff` checks on `errorHandlers.ts` / `moodApi.ts` / `moodSyncService.ts` are empty against HEAD and against `main`. The suite is green at 1345/1345 with a 5/5 burn-in.

**Three caveats a reader should carry with this PASS.**

1. **The P0 rule did no work.** No P0 requirement exists, so the gate's strongest criterion is satisfied by an empty set. The decision rests entirely on the P1 (93%) and overall (84%) thresholds, and the P1 margin is one requirement wide: if TEST-03 were the only P1 item to slip further, P1 would fall to 87% and this would read CONCERNS.
2. **The register composition moves the result.** Folding the six I/O matrix rows into `AC-3` gives a 13-item register at 77% overall, which reads FAIL on the ≥80% rule. The complete-union register was chosen on the completeness rule before the numbers were computed, but the sensitivity is real and is disclosed rather than smoothed over.
3. **NFR evidence was never gathered.** Security, reliability and maintainability are NOT_ASSESSED. Nothing in the change suggests an NFR problem, but "no assessment" is not "no issues".

**What this PASS does not say.** It does not say the interaction service is fully tested — `subscribeInteractions` has no test at any level, and `markAsViewed` still reports success for an UPDATE that changed nothing. It says the requirements this change was written against are covered, and the honesty property it exists to establish holds on every path a test can reach.

---

### Residual Risks

Recorded despite the PASS, because three of the four survive the change by design.

1. **A future Supabase-only module imports a sync-promising symbol without the guard noticing**
   - **Priority:** P1 · **Probability:** Medium · **Impact:** Medium · **Score:** 4
   - **Mitigation:** the guard covers the six confirmed modules today, and no module anywhere in `src` currently violates the invariant
   - **Remediation:** widen `SUPABASE_ONLY_MODULES` to `photosSlice.ts`, `loveNoteImageService.ts` and `partnerService.ts`; promote to ESLint

2. **`markAsViewed` resolves successfully on a zero-row UPDATE, and `interactionsSlice` decrements `unviewedCount` regardless (DW-31)**
   - **Priority:** P3 · **Probability:** Low · **Impact:** High · **Score:** 3
   - **Mitigation:** not reachable through today's UI — `handleAnimationComplete` only passes rows already filtered to this user
   - **Remediation:** DW-31, needs a production change

3. **`subscribeInteractions` surfaces neither `CHANNEL_ERROR` nor `TIMED_OUT`, and calls `supabase.channel()` directly (DW-35)**
   - **Priority:** P3 · **Probability:** Medium · **Impact:** Medium · **Score:** 4
   - **Mitigation:** none in place; the returned unsubscribe still looks healthy after a failed subscribe
   - **Remediation:** DW-35, needs a production change; route through `moodSyncService`'s refcounted registry per `AGENTS.md`

4. **The three read/update methods still have no `isOnline()` guard (DW-32)**
   - **Priority:** P3 · **Probability:** Medium · **Impact:** Low · **Score:** 2
   - **Mitigation:** truthful either way after this change — an offline caller gets the mid-flight message, which is accurate if less specific
   - **Remediation:** DW-32; excluded by the spec's Never list as new behaviour rather than honesty repair

**Overall Residual Risk: LOW.** No open item scores above 4, and the two highest are forward-looking rather than live defects.

---

### Gate Recommendations (PASS)

1. **Proceed** — commit the three working-tree test files, then merge. No production code changed, so there is nothing to deploy from this trace's scope; the behavioural change it covers already shipped in `f486587`.
2. **Before the next Supabase-only feature lands**, widen the honesty guard's module list. That is the one action that converts this PASS from "the six known modules are protected" into "the invariant is enforced".
3. **Monitoring** — none applicable. The change is unobservable in production telemetry: `PokeKissInterface` renders fixed toast text, so the corrected messages appear only in logs and to future callers that read `error.message`.

---

### Next Steps

**Immediate (next 24-48 hours)**

1. Commit `tests/unit/api/interactionService.test.ts`, `tests/unit/api/offlineMessageHonesty.test.ts`, `tests/unit/api/fakeInteractionsBackend.ts`.
2. Add the three unlisted Supabase-only modules to `SUPABASE_ONLY_MODULES`.
3. Decide whether DW-34 should be closed in the ledger now that TEST-05 covers the read/update success paths (see *Observations*).

**Follow-up (next milestone)**

1. Promote TEST-03 to the ESLint `no-restricted-imports` override.
2. Add a per-file coverage threshold for `src/api/interactionService.ts`.
3. Run `/bmad-testarch-nfr` once the reliability and maintainability thresholds above are decided — until then its verdicts would be UNKNOWN by construction.

---

## Observations (not acted on)

1. **DW-34 appears closed by this working tree but is still `status: open` in the ledger.** The entry reads "the success paths of the three read/update methods stay untested"; TEST-05 now covers all three, including the `.or()` / `.order()` / `.range()` predicate the entry names as unexercised. Trace does not edit `deferred-work.md`; flagged for the operator or the next sweep.

2. **This workflow's output paths are fixed, not run-scoped, so the next trace run overwrites this document.** `default_output_file`, `e2e_trace_summary_output` and `gate_decision_output` resolve to `traceability-matrix.md`, `e2e-trace-summary.json` and `gate-decision.json` with no run key. None existed before this run, so nothing was destroyed — but every other TEA artifact in this directory is run-scoped (`test-design-epic-*.md`, `automation-summary-epic-*.md`), and the automation run recorded hitting exactly this collision on its own fixed path. The canonical paths were used here because the workflow contract and its checklist both name them; the collision risk is recorded rather than resolved unilaterally.

3. **`_bmad/tea/config.yaml` declares `trace_output: _bmad-output/test-artifacts/traceability`, which nothing in `workflow.yaml` reads.** The workflow's own `default_output_file` is `{test_artifacts}/traceability-matrix.md`, which is what was written. The unused key is noted so a reader looking in the `traceability/` subdirectory knows why it is empty.

4. **The Phase 1 hand-off matrix was written to the session scratchpad, not `/tmp`.** `step-04`'s `tempOutputFile` names `/tmp/tea-trace-coverage-matrix-{{timestamp}}.json`; this session's harness rules require the scratchpad instead. The resolved path is recorded in this document's `tempCoverageMatrixPath` frontmatter key, which is what `step-05` reads.

---

## Integrated YAML Snippet (CI/CD)

```yaml
traceability_and_gate:
  traceability:
    story_id: 'dw-events-offline-message-honesty'
    date: '2026-08-19'
    source_sha: 'f486587f658fa812987a277ee1e416949f4f2fbc'
    coverage:
      overall: 84
      p0: 100
      p1: 93
      p2: 100
      p3: 0
    gaps:
      critical: 0
      high: 0
      medium: 0
      low: 2
    quality:
      passing_tests: 44
      total_tests: 44
      blocker_issues: 0
      warning_issues: 0
    recommendations:
      - 'Widen the honesty guard module list to photosSlice.ts, loveNoteImageService.ts, partnerService.ts'
      - 'Promote TEST-03 from the vitest guard to the ESLint no-restricted-imports override'

  gate_decision:
    decision: 'PASS'
    gate_type: 'story'
    decision_mode: 'deterministic'
    criteria:
      p0_coverage: 100
      p0_pass_rate: 100
      p1_coverage: 93
      p1_pass_rate: 100
      overall_pass_rate: 100
      overall_coverage: 84
      security_issues: 0
      critical_nfrs_fail: 0
      flaky_tests: 0
    thresholds:
      min_p0_coverage: 100
      min_p0_pass_rate: 100
      min_p1_coverage: 90
      min_p1_pass_rate: 90
      min_overall_pass_rate: 90
      min_coverage: 80
    evidence:
      test_results: 'local_run — npx vitest run (90 files / 1345 tests passed)'
      traceability: '_bmad-output/test-artifacts/traceability-matrix.md'
      nfr_assessment: 'not_assessed'
      code_coverage: 'src/api/interactionService.ts — 82.53% stmts / 87.5% branch'
    next_steps: 'Commit the three working-tree test files; widen the honesty guard module list.'
```

---

## Related Artifacts

- **Spec:** `_bmad-output/implementation-artifacts/spec-dw-7-18-events-offline-message-honesty.md`
- **Test Design:** `_bmad-output/test-artifacts/test-design-epic-dw-events-offline-message-honesty.md`
- **Automation Summary:** `_bmad-output/test-artifacts/automation-summary-epic-dw-events-offline-message-honesty.md`
- **Ledger:** `_bmad-output/implementation-artifacts/deferred-work.md` (DW-7, DW-18 closed; DW-31 … DW-35 open)
- **NFR Evidence Audit:** none — not assessed
- **Machine-readable outputs:** `_bmad-output/test-artifacts/e2e-trace-summary.json`, `_bmad-output/test-artifacts/gate-decision.json`
- **Test Files:** `tests/unit/api/interactionService.test.ts`, `tests/unit/api/offlineMessageHonesty.test.ts`, `tests/unit/api/fakeInteractionsBackend.ts`
- **PRD / ADR / Architecture:** none exist in this repository. `AGENTS.md` is the durable architecture prose, deliberately.

---

## Sign-Off

**Phase 1 — Traceability Assessment**

- Overall Coverage: 84% (16/19 FULL, 1 PARTIAL, 2 NONE)
- P0 Coverage: 100% ✅ (vacuous — 0 P0 requirements)
- P1 Coverage: 93% ✅
- Critical Gaps: 0
- High Priority Gaps: 0 uncovered, 1 partial

**Phase 2 — Gate Decision**

- **Decision:** ✅ **PASS**
- **P0 Evaluation:** ✅ ALL PASS
- **P1 Evaluation:** ✅ ALL PASS

**Overall Status:** ✅ PASS

**Confidence: 9 / 10.** Every number here was produced by a command run in this session and named beside the claim: the suite and burn-in results, the coverage percentages, the four acceptance-criteria greps, and the module-by-module check behind the TEST-03 PARTIAL. The remaining point is the register-composition sensitivity described under *Rationale* — the gate rules are deterministic given a register, and the register is a judgement about which formal items are separate requirements.

**Generated:** 2026-08-19
**Workflow:** `bmad-testarch-trace` (Create mode, sequential execution) — Phase 1 + Phase 2

---

<!-- Powered by BMAD-CORE™ -->

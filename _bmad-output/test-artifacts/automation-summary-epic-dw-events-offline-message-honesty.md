---
workflowStatus: 'completed'
totalSteps: 5
stepsCompleted:
  [
    'step-01-preflight-and-context',
    'step-02-identify-targets',
    'step-03-generate-tests',
    'step-03c-aggregate',
    'step-04-validate-and-summarize',
  ]
lastStep: 'step-04-validate-and-summarize'
nextStep: ''
lastSaved: '2026-08-19'
runScope: 'epic-level'
runKey: 'epic-dw-events-offline-message-honesty'
executionMode: 'BMad-Integrated'
detectedStack: 'frontend'
resolvedExecutionMode: 'sequential'
inputDocuments:
  - '_bmad-output/test-artifacts/test-design-epic-dw-events-offline-message-honesty.md'
  - '_bmad-output/implementation-artifacts/spec-dw-7-18-events-offline-message-honesty.md'
  - '_bmad-output/implementation-artifacts/deferred-work.md'
  - 'src/api/interactionService.ts'
  - 'src/api/errorHandlers.ts'
  - 'src/utils/offlineErrorHandler.ts'
  - 'src/api/moodApi.ts'
  - 'src/api/moodSyncService.ts'
  - 'src/services/eventsService.ts'
  - 'src/services/photoService.ts'
  - 'src/services/dbSchema.ts'
  - 'src/stores/slices/notesSlice.ts'
  - 'src/stores/slices/eventsSlice.ts'
  - 'src/stores/slices/interactionsSlice.ts'
  - 'src/components/MoodTracker/MoodTracker.tsx'
  - 'tests/unit/api/interactionService.test.ts'
  - 'tests/unit/api/fakeMoodsBackend.ts'
  - 'tests/unit/api/moodApi.test.ts'
  - 'vitest.config.ts'
  - 'playwright.config.ts'
  - 'package.json'
  - 'eslint.config.js'
  - 'AGENTS.md'
  - '_bmad/tea/config.yaml'
  - 'node_modules/@supabase/postgrest-js/dist/index.mjs'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/test-levels-framework.md'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/test-priorities-matrix.md'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/test-quality.md'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/data-factories.md'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/playwright-utils-mandate.md'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/pactjs-utils-mandate.md'
---

# Test Automation Summary: dw-events-offline-message-honesty

**Date:** 2026-08-19
**Author:** Sallvain
**Mode:** BMad-Integrated (test design available)
**Scope under test:** branch `bmad-loop/20260819-133049-ee65/dw-events-offline-message-honesty` — `src/api/interactionService.ts` (+78/−14) stops promising an offline sync that cannot happen

---

## Executive Summary

Built every item the epic test design ranked P1 and P2, plus the fixture correction those items depend on. **No production code was changed** — `git status` shows `src/` untouched.

| | Before | After | Δ |
|---|---|---|---|
| Tests in `interactionService.test.ts` | 15 | **33** | +18 |
| New guard file | — | **11** | +11 |
| Full unit suite | 89 files / 1316 tests | **90 files / 1345 tests** | +1 file / +29 tests |
| `interactionService.ts` statements | 71.42% | **82.53%** | +11.11 |
| `interactionService.ts` branches | 50% | **87.5%** | +37.5 |
| `interactionService.ts` functions | 57.14% | **71.42%** | +14.28 |

**The result that matters most.** The design's one open assumption is now measured rather than inferred, and the assumed string was wrong. The design predicted a zero-row `.single()` would surface PostgREST's `"JSON object requested, multiple (or no) rows returned"`. Against this repo's running local PostgREST it is actually:

```
$ curl -i '.../rest/v1/interactions?select=*&id=eq.<no-such-id>' \
    -H 'Accept: application/vnd.pgrst.object+json'
HTTP/1.1 406 Not Acceptable
{"code":"PGRST116","details":"The result contains 0 rows","hint":null,
 "message":"Cannot coerce the result to a single JSON object"}
```

The predicted text is the **client's** `maybeSingle` string (`postgrest-js@2.112.3 dist/index.mjs:471`, inside `if (_this2.isMaybeSingle && ...)`), not the server's. It never reaches a `.single()` call. Pinning it in the fixture would have reproduced R-1 one layer along — exactly the contingency the design named. The fake now carries the measured envelope.

**Every new assertion was mutation-checked.** Five mutations to production code and to the guard's own detector each produced the expected reds, then were reverted (`git diff src/` is empty). Details under *Falsifiability evidence*.

---

## Step 1 — Preflight & Context

**Stack detection:** `frontend`. `package.json` carries react/vite, `playwright.config.ts` and `vitest.config.ts` exist; no `maestro/`, no `pyproject.toml`/`pom.xml`/`go.mod`/`Gemfile`/`Cargo.toml`. Supabase is a hosted dependency, not a backend project in this repo, so the backend worker does not apply.

**Framework verification:** passed — `playwright.config.ts` and `vitest.config.ts` both present, test dependencies installed.

**Execution mode:** `tea_execution_mode: auto` with `tea_capability_probe: true` would resolve to `subagent`. It is overridden to **`sequential`** by a project rule: `CLAUDE.md` records that in a bmad-loop worktree the work must be done in-session, because a subagent that dies sends nothing and cannot be polled, and the waiting session burns its full 90-minute timeout (it names run `20260818-230216-c22b` losing two attempts exactly this way). Both worker steps were executed inline. Recorded cost: no parallel speedup.

**Mandate gates, both checked rather than assumed:**

- **Playwright Utils** — `tea_use_playwright_utils: true` and `@seontechnologies/playwright-utils@^4.4.0` is installed, but the mandate's Scope section requires "the suite runs on the Playwright test runner". Every test in this plan runs under **Vitest**, so the mandate does not bind and no substitution is owed. Nothing generated here imports Playwright.
- **Pact.js Utils** — the relevance gate in `pactjs-utils-mandate.md` does **not** open: `grep -c pact package.json` = 0, no `pact/` or `tests/contract/` tree, no `PACT_BROKER_*`, single frontend repo with no consumer/provider boundary. Per the fragment, `tea_use_pactjs_utils: true` "means 'use these utilities when you write contract tests', not 'write contract tests everywhere'". No Pact artifacts generated; `pact_mcp_reachable` never probed because the gate closed first.

**Knowledge fragments loaded:** `test-levels-framework`, `test-priorities-matrix`, `data-factories`, `test-quality`, `selective-testing`, `ci-burn-in`, plus both mandates for their scope/relevance sections.

---

## Step 2 — Automation Targets

### Level selection

Every scenario is **Unit**, with the one repo-wide invariant also expressed as a unit test. That is `test-levels-framework.md`'s own answer, not a shortcut: its matrix marks *"Error handling (logic) → Unit: Primary, E2E: Overkill"*, and the change is error-handling logic in a class with a single mockable dependency.

### Deliberate exclusions

| Excluded | Why |
|---|---|
| **E2E for any interaction error** | `PokeKissInterface.tsx:184-186` and `:217-220` render the constants `'Failed to send poke. Try again.'` / `'Failed to send kiss. Try again.'`, never `error.message`. A toast assertion passes identically before and after the change — a hollow check. Browser exploration was skipped for the same reason: there is no candidate flow for it to find. |
| **Component test for `PokeKissInterface`** | Same reason one level down; the component is unchanged. |
| **`errorHandlers.ts`, `moodApi.ts`, `moodSyncService.ts`** | Byte-identical to `HEAD`, and their `handleNetworkError` use is *correct* — mood has a real sync queue. Testing them as if it were wrong would encode the inverse defect. |
| **Contract tests** | Relevance gate closed (above). |
| **TEST-06, TEST-07** | Both need production changes the spec's Never list excludes. The design's own operator note says listing them as planned coverage while the code cannot change is not defensible. Left deferred under DW-31 and DW-35. |

### Priority assignment

`test-priorities-matrix.md` decision tree, not read off a risk score. No revenue impact, no security path, no data-integrity operation, no compliance requirement, and every failure has a trivial workaround (press again). Regression prevention applies — DW-7 and DW-18 are previously-identified defects — which puts the ceiling at **P1**. No P0 is declared; doing so would hollow out the 100% P0 gate for paths that genuinely warrant it.

**Priority tags are deliberately not in test names.** Only 10 of 47 unit test files use `[P1]`-style tags and the file being extended is not one of them. `test-quality.md` Example 8 requires one dialect per file, and the whole Vitest suite runs in 6.8 s so there is no selective-execution need that tags would serve. The mapping lives in the table below instead. This is a stated deviation from `checklist.md`'s "priority tags added to all test names".

---

## Step 3 — Tests Generated

### Files

| File | Status | Lines | Tests |
|---|---|---|---|
| `tests/unit/api/fakeInteractionsBackend.ts` | **new** (fixture) | 336 | — |
| `tests/unit/api/interactionService.test.ts` | **updated** | 484 | 33 |
| `tests/unit/api/offlineMessageHonesty.test.ts` | **new** | 166 | 11 |

### Coverage plan → what was built

| Test ID | Priority | Requirement | Planned | Built | Where |
|---|---|---|---|---|---|
| TEST-01 | P1 | Zero-row insert reported as `PGRST116` rejects with `'[InteractionService.sendInteraction] No rows found'`, no sync promise | 2 | **2** | `interactionService.test.ts` › *an insert that creates no row* |
| TEST-01a | P1 | Fixture correction: `single()` models the Accept-header coercion; the two zero-row realizations are separated | fixture | **done** | `fakeInteractionsBackend.ts` |
| TEST-02 | P1 | `getInteractionHistory` and `markAsViewed` map a `PostgrestError` through `handleSupabaseError` | 2 | **2** | › *a PostgREST rejection* |
| TEST-03 | P1 | No Supabase-only module imports `handleNetworkError` or `OFFLINE_ERROR_MESSAGE` | 1 | **11** | `offlineMessageHonesty.test.ts` |
| TEST-04 | P2 | `networkFailure` produces `'Unknown network error'` for a non-`Error` rejection | 1 | **1** | › *a failure mid-flight* |
| TEST-05 | P2 | Success paths of the three read/update methods, including the `.or()` / `.order()` / `.range()` predicate | 4 | **9** | › *what the read/write actually returns* |
| — | — | Fake fidelity self-checks (house idiom from `moodApi.test.ts`) | — | **3** | › *fake fidelity* |
| TEST-06 | P3 | `markAsViewed` surfaces a zero-row UPDATE | 2 | **deferred** | DW-31 — needs a production change |
| TEST-07 | P3 | `subscribeInteractions` surfaces `CHANNEL_ERROR` / `TIMED_OUT` | 3 | **deferred** | DW-35 — needs a production change |

TEST-03 expanded from 1 to 11 because a one-sided absence check is not falsifiable on its own — see below. TEST-05 expanded from 4 to 9 to close the `??` column fallbacks in both read mappings.

### The fixture: `FakeInteractionsBackend`

Extracted from the inline fake, following the repo's existing precedent (`tests/unit/api/fakeMoodsBackend.ts`, imported by three specs). Three behaviours are now modelled rather than assumed:

1. **`.single()` is an Accept header, not an array index.** `single()` sets `Accept: application/vnd.pgrst.object+json` (`postgrest-js dist/index.mjs:1162`) and PostgREST coerces anything other than exactly one row to 406/`PGRST116`. The old fake returned `{ data: null, error: null }` for *every* zero-row result, conflating that with a much rarer outcome and leaving the reachable path untested.
2. **`{ data: null, error: null }` is producible, but only one way** — a 2xx with an empty body, via `PostgrestBuilder`'s `if (body === "")` branch. It gets its own switch (`insertReturnsEmptyBody`) instead of standing in for both.
3. **`.or()`, `.order()` and `.range()` are the history read's real predicate.** All three were previously no-ops, so `getInteractionHistory` could return the wrong rows in the wrong order and every test still passed. `.or()` models only the `column.eq.value` form the service sends and **throws** on anything else, rather than silently matching everything.

The error envelopes are measured, not invented. `details`/`hint` are typed nullable because PostgREST sends them that way — and that shape is load-bearing: `isPostgrestError` (`errorHandlers.ts:109-117`) keys on `details` being present, so a fake omitting it routes every rejection down the network branch and the PostgREST tests would pass for the wrong reason. One of the three fidelity tests pins exactly that.

### The guard: `offlineMessageHonesty.test.ts`

**Mechanism: Vitest guard, not the ESLint rule.** The design ranked ESLint `no-restricted-imports` higher and flagged the choice as an operator decision. It edits `eslint.config.js`, which is tooling this run was not asked to change, so the fallback was built and the ESLint upgrade is recorded under *Operator decisions* with the exact rule to paste.

**Scope list — six modules, each confirmed against the file, not copied:**

| Module | Evidence it has no queue |
|---|---|
| `src/api/interactionService.ts` | header, lines 8-16: "no offline queue, no IndexedDB mirror, no retry" |
| `src/services/eventsService.ts` | `:32` "No realtime, no IndexedDB mirror: events are Supabase-only" |
| `src/services/photoService.ts` | imports exactly `supabase` and `logger`; the IndexedDB `photos` store (`dbSchema.ts:268`) belongs to the separate legacy `storage.ts` layer this module never touches |
| `src/stores/slices/notesSlice.ts` | no IndexedDB reference at all |
| `src/stores/slices/eventsSlice.ts` | `:12` "Supabase only. NOT persisted to localStorage and NOT mirrored to IndexedDB" |
| `src/stores/slices/interactionsSlice.ts` | `:14` "Interactions are ephemeral (not persisted to LocalStorage/IndexedDB)" |

**`moodApi.ts` is the trap, and it is excluded.** It imports supabase and *no* persistence module of its own, so any rule that derives the list from imports flags it — but mood is offline-first at the feature level through `moodSyncService` and `moodService`, and its sync promise is true. `moodSyncService.ts` and `MoodTracker.tsx` are excluded on the same grounds. All three appear instead as the guard's **positive control**.

**Why 11 tests for one invariant.** A guard that only asserts absence passes just as happily when its detector is broken. Three tests assert the three legitimate importers *are* still detected, one asserts a symbol named only in a comment is not counted — load-bearing, because `interactionService.ts` names `handleNetworkError` four times in prose explaining why it does not use it, and a substring search would report the very file the invariant was written for — and one asserts the lists are non-empty so `it.each` cannot silently iterate zero cases. Each listed path is also asserted to exist, so a moved file fails loudly instead of going vacuously green.

**Current state: zero violations.** Only `moodApi.ts`, `moodSyncService.ts` and `MoodTracker.tsx` import either symbol today, and all three are correct. The guard's value is entirely forward-looking — it is the only item here that protects features not yet written.

---

## Step 4 — Validation

### Commands run, in this worktree, at `f486587`

| Result | Command |
|---|---|
| **90 files / 1345 tests passed**, 6.77 s | `npx --no-install vitest run` |
| 33 passed (`interactionService`), 11 passed (`offlineMessageHonesty`) | `npx --no-install vitest run tests/unit/api/interactionService.test.ts tests/unit/api/offlineMessageHonesty.test.ts` |
| **82.53% stmts / 87.5% branch / 71.42% funcs / 83.87% lines** | `... --coverage --coverage.include='src/api/interactionService.ts'` |
| per-branch and per-function counts | the same run with `--coverage.reporter=json`, read from `coverage-final.json` |
| **exit 0**, 2 pre-existing warnings in an untouched file | `npm run lint` |
| **exit 2, 6 × TS2883**, all in `tests/support/merged-fixtures.ts` — the known worktree-only baseline, zero new | `npx --no-install tsc -b --force` |
| **10 / 10 clean** | 10× burn-in of both files |
| 406 / `PGRST116` observed | `curl` against the running local PostgREST (quoted above) |

### Falsifiability evidence

`test-quality.md` Example 7 rejects assertions that cannot fail, and a green suite is not evidence that a new test guards anything. Each mutation below was applied, run, and reverted; `git diff src/` is empty and `git status` shows `src/` clean.

| Mutation | Expected | Observed |
|---|---|---|
| **A.** `throw networkFailure(...)` → `throw handleNetworkError(error, ...)` in `sendInteraction` — the exact regression the change exists to prevent | the sync-promise tests go red | **3 failed**, incl. TEST-04 and *promises no sync on any of them* |
| **B.** drop `.or(...)` from `getInteractionHistory` | the predicate test goes red | **1 failed** — *returns interactions in both directions and nobody else's* |
| **C.** drop the `isPostgrestError` branch from the `getInteractionHistory` and `markAsViewed` catch tails | TEST-02 goes red, and only TEST-02 | **2 failed**, exactly those two |
| **D.** add `handleNetworkError` to `interactionService.ts`'s imports | the guard names the offending file | **1 failed** — `src/api/interactionService.ts imports neither symbol...` |
| **E.** break the guard's own import detector | the positive control catches it | **4 failed** — the guard cannot pass vacuously |

### Branch closure

Every branch the test design measured as one-sided is now exercised in both directions:

| Branch | Before | After |
|---|---|---|
| `cond-expr@77` (`networkFailure`'s unknown-error arm) | `[9,0]` | **`[9,1]`** |
| `if@296` (`getInteractionHistory` error) | `[2,0]` | **`[3,5]`** |
| `if@314` (`getInteractionHistory` PostgREST) | `[0,2]` | **`[1,2]`** |
| `if@344` (`getUnviewedInteractions` error) | `[3,0]` | **`[3,1]`** |
| `if@386` (`markAsViewed` error) | `[2,0]` | **`[3,1]`** |
| `if@394` (`markAsViewed` PostgREST) | `[0,2]` | **`[1,2]`** |

Four one-sided branches remain, all with a stated reason:

- `if@259` `[0,0]` — inside `subscribeInteractions`; the deferred TEST-07 (DW-35).
- `binary-expr@302`, `@349` — the `data?.map(...) || []` arm. A successful PostgREST select returns `[]`, never `null`, so reaching it requires making the fake *less* faithful. Left uncovered on purpose.
- `binary-expr@354` — `record.viewed ?? false` in `getUnviewedInteractions`, behind `.eq('viewed', false)`. In Postgres `NULL = false` is NULL rather than true, so a null-viewed row can never reach that mapping. Defensive.

### Coverage target

The design proposed **≥85% statements, ≥75% branches**.

- Branches: **87.5%** — met, with margin.
- Statements: **82.53%** — 2.5 points short, and the entire remaining gap is lines **238-262**, which is `subscribeInteractions` in full. That is TEST-07, deferred because closing it needs a production change the spec's Never list excludes. Reaching 85% is not available to a test-only change.

This target still **cannot be enforced by CI**: `vitest.config.ts:52-57` sets global thresholds of 25% and no per-file rule, so a regression from 82% to 30% in this file would not fail. Adding one is an operator decision, below.

---

## Definition of Done

Against `test-quality.md`'s Core Quality Checklist:

- [x] **No hard waits** — no timers anywhere; the suite is synchronous over an in-memory fake
- [x] **No conditionals** — no `if`/`try` controlling flow in any test; rejections go through the `rejection()` helper, which is the `rejects`-style form the fragment prefers over `try`/`catch`
- [x] **≤ 1000 lines** — 484 and 166
- [x] **< 1.5 minutes** — 5 ms and 3 ms
- [x] **Self-cleaning** — `backend.reset()` and `setOnline(true)` in `beforeEach`, `vi.restoreAllMocks()` in `afterEach`
- [x] **Explicit assertions** — every `expect` is in a test body
- [x] **Parallel-safe** — no shared state across files; Vitest isolates files per worker, and 10/10 burn-in confirms it
- [x] **No committed focus** — no `.only`, `fdescribe`, or `fit`
- [x] **No skips** — none committed, so none need a reason
- [x] **Assertions can fail** — proven by five mutations, not asserted
- [x] **One concern per test** — counted by subject; the multi-`expect` cases (`toEqual` on one mapped record, the sync-promise loop) are one subject each
- [x] **Grouped and shallow** — `describe` nesting is two levels throughout
- [x] **Behavioural names, one dialect** — names state behaviour; `expect` only, matching the repo
- [~] **Unique data via faker** — **deliberately not applied.** These assertions are on literal message strings; `data-factories.md` says the fix for a meaningful literal is a name at the point of use, which `SYNC_PROMISE`, `USER_ID`, `PARTNER_ID` and `STRANGER_ID` already provide. Faker would make the pinned messages unassertable.
- [x] **Priority tags** — **deviation, stated above**: recorded in this document instead of in test names, to keep one dialect per file.

---

## Operator decisions

These change what gets built and are not this workflow's to make.

1. **Promote TEST-03 from the Vitest guard to the ESLint rule.** Recommended. It resolves modules instead of matching text and fails in the job that already lints `src`. The scope list in `offlineMessageHonesty.test.ts` is confirmed and can be pasted straight into an `eslint.config.js` override with `no-restricted-imports`, `importNames: ['handleNetworkError']` on `./errorHandlers` / `../api/errorHandlers` and `importNames: ['OFFLINE_ERROR_MESSAGE']` on `../utils/offlineErrorHandler`. Keep the Vitest guard's positive-control block either way — ESLint cannot express "these three modules must *still* import it".
2. **A per-file coverage threshold for `src/api/interactionService.ts`.** Without one, 82.53%/87.5% is a review-time observation, not a gate.
3. **Whether to fix `src/utils/offlineErrorHandler.ts:74`.** `OFFLINE_ERROR_MESSAGE` still reads "Changes will sync when reconnected." Its one consumer (`MoodTracker.tsx`) is offline-first, so it is true today — but the file's own header says "No offline queue for writes - fail immediately with retry option", which contradicts the constant sitting under it. The guard stops it spreading; it does not resolve that.
4. **Whether TEST-06 / TEST-07 (DW-31, DW-35) get scheduled.** Both need production changes. They are the whole remaining statement-coverage gap.

## Observations (not acted on)

- **`workflow.yaml`'s `default_output_file` collides across runs.** It resolves to the single fixed path `{test_artifacts}/automation-summary.md`, which is already occupied by the completed run for `runKey: '5-manage-events-in-settings'`. Writing this run's summary there destroys the previous one. It happened in this session and was caught by `git status` reporting the file as modified rather than new; the previous version was restored from `HEAD` (`git diff` against it is empty) and this document was written to a run-scoped filename instead, matching how `test-design-epic-*.md` already names its output. **Any future `automate` run in this repo will hit the same collision.** Every other TEA artifact in the directory is run-scoped; only this one is not.
- **This run's tests live in `tests/`, not in `_bmad-output/`.** The story-5 run wrote its generated specs to `_bmad-output/test-artifacts/automation-5-manage-events-in-settings/`, where nothing executes them. These are real Vitest tests that the suite picks up via `vitest.config.ts:40`, so they belong in `tests/unit/api/` and are counted in the 1345 above. Noting the difference so the two runs' summaries are not read as describing the same convention.
- `tests/unit/api/fakeMoodsBackend.ts:261` returns `{ code: 'PGRST116', message: 'No rows found' }` for a zero-row `single()` — no `details` key, and a message PostgREST does not send. Because `isPostgrestError` requires `details`, any mood test relying on that envelope routes down the network branch instead of the PostgREST one. Same class of fidelity gap as the one corrected here, in a file outside this change's scope. Not touched.

---

## Next steps

```bash
npx vitest run tests/unit/api/interactionService.test.ts tests/unit/api/offlineMessageHonesty.test.ts
npx vitest run                                    # full suite: 90 files, 1345 tests
npm run lint                                      # exit 0
```

**Recommended follow-on workflow:** `/bmad-testarch-trace` — the register in the epic test design now has real coverage to trace against, and a gate decision can be computed from it. `/bmad-testarch-nfr` only becomes meaningful once decisions 1 and 2 above are taken; until then its reliability and maintainability thresholds stay UNKNOWN.

## Playwright Utils deviations

**None** — and none were possible. The mandate's Scope section requires the Playwright test runner; every test generated in this run is Vitest, so no substitution applied and no RECOMMENDED utility went unwired. Nothing here imports `@playwright/test`.

## Pact.js Utils deviations

**None** — no Pact artifacts were generated. The relevance gate did not open: 0 `pact` matches in `package.json`, no `pact/` or `tests/contract/` tree, no `PACT_BROKER_*`, and a single frontend repo with no consumer/provider boundary.

## Confidence

**9 / 10.**

*Rationale:* every number came from a command run in this session and quoted above; the PostgREST contract is observed against a live local server rather than inferred; and every new assertion was shown to fail under a targeted mutation before being accepted.

*Unknowns:*
- The measured 406 was observed on a zero-row **GET** under `Accept: application/vnd.pgrst.object+json`. The service's path is an **INSERT** with `Prefer: return=representation` under the same Accept header; forcing a genuinely zero-row insert server-side needs an INSERT policy that passes while the SELECT policy hides the row, which was not constructed. The coercion layer is the same one, and the client-side handling is identical either way, but the insert-specific realization is inferred from that shared layer rather than observed.
- Whether `photoService.ts` should count as Supabase-only rests on it importing no persistence module and on `AGENTS.md`'s data-model paragraph. It is the least certain of the six, and the one to revisit first if the guard ever blocks a legitimate import.

---

**Generated by:** BMad TEA Agent — Test Architect Module
**Workflow:** `bmad-testarch-automate` (Create mode, sequential execution)
**Version:** 5.0 (Step-File Architecture)

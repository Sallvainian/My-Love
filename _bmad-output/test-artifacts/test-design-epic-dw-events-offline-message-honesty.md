---
workflowStatus: 'completed'
totalSteps: 5
stepsCompleted:
  [
    'step-01-detect-mode',
    'step-02-load-context',
    'step-03-risk-and-testability',
    'step-04-coverage-plan',
    'step-05-generate-output',
  ]
lastStep: 'step-05-generate-output'
nextStep: ''
lastSaved: '2026-08-19'
runScope: 'epic-level'
runKey: 'epic-dw-events-offline-message-honesty'
inputDocuments:
  - '_bmad-output/implementation-artifacts/spec-dw-7-18-events-offline-message-honesty.md'
  - '_bmad-output/implementation-artifacts/deferred-work.md'
  - 'src/api/interactionService.ts'
  - 'src/api/errorHandlers.ts'
  - 'src/services/eventsService.ts'
  - 'src/stores/slices/interactionsSlice.ts'
  - 'src/components/PokeKissInterface/PokeKissInterface.tsx'
  - 'src/utils/offlineErrorHandler.ts'
  - 'tests/unit/api/interactionService.test.ts'
  - 'tests/support/merged-fixtures.ts'
  - 'supabase/migrations/20251206024345_remote_schema.sql'
  - 'vitest.config.ts'
  - 'playwright.config.ts'
  - 'package.json'
  - 'AGENTS.md'
  - '_bmad/tea/config.yaml'
  - '.claude/skills/bmad-testarch-test-design/resources/knowledge/risk-governance.md'
  - '.claude/skills/bmad-testarch-test-design/resources/knowledge/probability-impact.md'
  - '.claude/skills/bmad-testarch-test-design/resources/knowledge/test-levels-framework.md'
  - '.claude/skills/bmad-testarch-test-design/resources/knowledge/test-priorities-matrix.md'
  - '.claude/skills/bmad-testarch-test-design/resources/knowledge/nfr-criteria.md'
  - '.claude/skills/bmad-testarch-test-design/resources/knowledge/evidence-integrity.md'
  - '.claude/skills/bmad-testarch-test-design/resources/knowledge/confidence-gate.md'
  - '.claude/skills/bmad-testarch-test-design/resources/knowledge/library-integration-mandate.md'
  - '.claude/skills/bmad-testarch-test-design/resources/knowledge/playwright-utils-mandate.md'
---

# Test Design: dw-events-offline-message-honesty — stop `interactionService` promising an offline sync that cannot happen

**Date:** 2026-08-19
**Author:** Sallvain
**Status:** Draft
**Mode:** Epic-Level (Phase 4)
**Scope under test:** the changes on branch `bmad-loop/20260819-133049-ee65/dw-events-offline-message-honesty`

---

## Executive Summary

**Scope.** Full test design for one behavioral change. `src/api/interactionService.ts` (+78/−14) removed `handleNetworkError` from all five of its failure paths, replacing them with a module-local `InteractionWriteError` (offline guard, zero-row insert) and a module-local `networkFailure` builder (four catch tails). `tests/unit/api/interactionService.test.ts` is new (350 lines, 15 tests). `src/api/errorHandlers.ts`, `src/api/moodApi.ts` and `src/api/moodSyncService.ts` are untouched — the sync promise stays true for their 16 combined throw sites, which do have a service-worker queue.

The only uncommitted working-tree change is `_bmad-output/implementation-artifacts/deferred-work.md` (+46/−2): it closes DW-7 and DW-18 and opens DW-31 … DW-35. A ledger carries no executable behavior, so it is not a test target — but those five new entries are the source of four rows in the register below.

**Risk summary**

- Total risks identified: **10**
- High-priority (score ≥ 6): **1** — R-1, a test-integrity risk, not a product defect
- Score 9 (BLOCK): **0**
- Dominant categories: TECH (6 of 10), then DATA, BUS, OPS

**Coverage summary**

| | Scenarios | Tests | Effort |
|---|---|---|---|
| P0 | 0 | 0 | — |
| P1 | 3 | 5 | ~4–8 h |
| P2 | 2 | 5 | ~2–4 h |
| P3 | 2 | 5 | ~3–6 h |
| **Total** | **7** | **15** | **~9–18 h (~1.5–3 days)** |

**The finding that matters most.** The shipped code is correct on every reachable path this design could find, and the change's headline acceptance criterion holds: no `interactionService` throw can produce the sentence "will be synced when you're back online". What is *not* solid is the evidence. A zero-row insert has two possible client outcomes and the suite tests only the less likely one; two of the four edited catch tails have no test for their PostgREST branch; the new `networkFailure` builder has an arm that never executes; and the honesty property the whole change exists to establish is enforced repo-wide by nothing but comments and reviewer attention, while a second false sync promise sits live in `src/utils/offlineErrorHandler.ts:74`.

**Verification performed for this design** (not taken from the spec's own report):

- `npx --no-install vitest run tests/unit/api/interactionService.test.ts` → **15 passed**, 4 ms
- `npx --no-install vitest run` → **89 files, 1316 tests passed**, 6.24 s
- Coverage of the changed file → **71.42% statements, 50% branches, 57.14% functions, 72.58% lines**, with the per-branch counts in the table below

---

## Not in Scope

| Item | Reasoning | Mitigation |
|---|---|---|
| **E2E for any interaction error message** | `PokeKissInterface.tsx:184-186` and `:217-220` render the constants `'Failed to send poke. Try again.'` and `'Failed to send kiss. Try again.'`, never `error.message`. An E2E asserting a toast would pass identically before and after the change — a check that cannot fail for the reason it claims to (R-6; `evidence-integrity.md` Shape 5). | Unit tests pin the message where it exists. `tests/e2e/partner/partner-mood.spec.ts:35` continues to cover button presence. |
| **Component test for `PokeKissInterface`** | Same reason one level down: the component's error branch has no dependency on the message text. | The component is unchanged; nothing to mitigate. |
| **Contract testing (Pact)** | The relevance gate in `pactjs-utils-mandate.md` does not open: detected stack is `frontend`, `grep -c pact package.json` = 0, no `pact/` or `tests/contract/` tree, no `*.pacttest.ts`, no microservices. `tea_use_pactjs_utils: true` "never means 'add contract tests to this project'". | n/a |
| **`errorHandlers.ts`, `moodApi.ts`, `moodSyncService.ts`** | Byte-identical to `HEAD`, and their `handleNetworkError` usage is *correct* — those callers have a real sync queue. Changing them would introduce the inverse defect. | Their existing suites are the regression guard (see Interworking). TEST-03's scope list must exclude them. |
| **Performance / load** | No code path gained work; `networkFailure` runs only on a rejection. | n/a |
| **`eventsService`'s copy of the convention** | Outside this change; already covered. | `tests/unit/services/eventsService.test.ts` runs in the same PR suite. |
| **`src/api/errorHandlers.ts` message rewording** | Explicitly on the spec's Never list, and correct as-is for its remaining callers. | R-4 addresses the *class* without touching the helper. |

---

## Risk Assessment

Scored per `probability-impact.md`: probability 1 = unlikely / 2 = possible / 3 = likely-or-already-true; impact 1 = minor / 2 = degraded / 3 = critical. Actions: 1–3 DOCUMENT, 4–5 MONITOR, 6–8 MITIGATE, 9 BLOCK.

### High-Priority Risks (Score ≥ 6)

| Risk ID | Category | Description | P | I | Score | Mitigation | Owner | Timeline |
|---|---|---|---|---|---|---|---|---|
| **R-1** | TECH | A zero-row insert has two possible client outcomes and the suite tests only the less likely one. The reachable path yields `'[InteractionService.sendInteraction] No rows found'`, which the spec's I/O matrix does not contain and no test pins. | 3 | 2 | **6** | TEST-01 — teach the fake the `PGRST116` outcome and assert it; keep the existing empty-body tests | DEV | Next edit to `interactionService.ts` |

### Medium-Priority Risks (Score 3–5)

| Risk ID | Category | Description | P | I | Score | Mitigation | Owner |
|---|---|---|---|---|---|---|---|
| **R-2** | TECH | `getInteractionHistory` and `markAsViewed` have no test for their `handleSupabaseError` branch, though the change edited both catch tails. Measured: `if@314` = `[0,2]`, `if@394` = `[0,2]`. | 2 | 2 | 4 | TEST-02 | DEV |
| **R-3** | TECH | `networkFailure`'s `'Unknown network error'` arm is new code with zero coverage. Measured: `cond-expr@77` = `[9,0]`. | 2 | 2 | 4 | TEST-04 | DEV |
| **R-4** | TECH | A second, still-false sync promise is live at `src/utils/offlineErrorHandler.ts:74`, and nothing at repo level stops the next Supabase-only feature from importing it or `handleNetworkError`. | 2 | 2 | 4 | TEST-03 | DEV |
| **R-10** | TECH | `subscribeInteractions` is wholly untested and surfaces neither `CHANNEL_ERROR` nor `TIMED_OUT` (DW-35). It calls `supabase.channel()` directly, which `AGENTS.md` records as a repo-wide teardown pitfall. | 2 | 2 | 4 | TEST-07 (deferred) | DEV |
| **R-5** | DATA | `markAsViewed` resolves successfully on a zero-row UPDATE (DW-31), and `interactionsSlice.ts:142` decrements `unviewedCount` regardless, so the badge drifts silently. | 1 | 3 | 3 | TEST-06 (deferred) | DEV |
| **R-6** | BUS | No user sees any of this. `PokeKissInterface` renders constants, so the offline user still reads "Failed to send poke. Try again." | 3 | 1 | 3 | None — recorded as a scope exclusion, not a defect | — |

### Low-Priority Risks (Score 1–2)

| Risk ID | Category | Description | P | I | Score | Action |
|---|---|---|---|---|---|---|
| **R-7** | TECH | `navigator.onLine` (`errorHandlers.ts:44-46`) is the sole offline signal; a captive-portal device passes the guard and receives the mid-flight message instead. Truthful either way. | 2 | 1 | 2 | Document |
| **R-8** | TECH | The three read/update methods still have no `isOnline()` guard (DW-32) — specificity, not honesty. Excluded by the spec's Never list. | 2 | 1 | 2 | Document |
| **R-9** | OPS | The `logSupabaseError` bypass has **zero** production effect. The offline path throws before the `try` and never reached the logger before this change either; the zero-row path is R-1's defensive branch. Both are still logged at `interactionsSlice.ts:94`/`:127` and `PokeKissInterface.tsx:183`. | 1 | 1 | 1 | Document — this corrects the spec's own Residual Risks entry, which overstates it |

### Risk Category Legend

- **TECH** — Technical/architecture (flaws, integration, test-integrity)
- **SEC** — Security (access controls, auth, data exposure)
- **PERF** — Performance (SLA violations, degradation, resource limits)
- **DATA** — Data integrity (loss, corruption, inconsistency)
- **BUS** — Business impact (UX harm, logic errors, revenue)
- **OPS** — Operations (deployment, config, monitoring)

### Residual risk

After TEST-01 through TEST-05 land, what remains is R-5, R-7, R-8 and R-10 — all four of which need production changes this spec's Never list excludes, and all four of which already have ledger entries (DW-31, DW-32, DW-35). None scores above 4. The honest statement of residual risk is: *the interaction service tells the truth on every path a test can reach, three of its methods say less than they could when the device is offline, and one of them still reports success for an update that changed nothing.*

---

## Testability Assessment

### Concerns

- **TEST-A (feeds R-1) — the fake's `single()` diverges from the client's on the branch that matters.** `tests/unit/api/interactionService.test.ts:132-135` returns `{ data: null, error: null }` for every zero-row result. The real client returns that shape only for a 2xx with an empty body; for a zero-row `application/vnd.pgrst.object+json` request it returns a `PGRST116` PostgrestError, which the fake cannot produce at all. The fake is this file's only boundary model, so the gap is inherited by anything written against it.
- **TEST-B (feeds R-2, R-3) — coverage is asymmetric in a way the headline number hides.** 71.42% statements looks healthy against a 25% floor, but all three uncovered clusters are failure-mode branches inside the code that changed. `vitest.config.ts` has no per-file rule, so nothing can see this.
- **TEST-C (feeds R-4) — the honesty property has no repo-level guard.** It is held up today by two module headers, four `// NOT handleNetworkError:` comments, and a `SYNC_PROMISE` constant duplicated across two test files. Nothing fails when a third service imports either false-promise symbol. `AGENTS.md` records photos, love notes and partner interactions as Supabase-only, so the exposed population is already larger than the two files that have been fixed.
- **TEST-D (feeds R-6) — the property is unobservable above the service.** No component or E2E test can distinguish the pre- and post-change build.
- **TEST-E — no live-stack verification was possible in this session.** E2E and the `integration` project need `supabase start`, which is not running, so R-1's PostgREST claim rests on the client's shipped source rather than an observed 406. TEST-01's optional variant closes that gap.
- **TEST-F — `.or()`, `.order()` and `.range()` are no-ops in the fake** (`:127-131`, with a comment saying so), so the history read's predicate, ordering and pagination are unexercised. Correct for a failure-surface file; it is what TEST-05 is scoped against.

### What is already strong

- **The failure surface is directly addressable.** `InteractionService` has no constructor dependencies and `tests/setup.ts` installs no Supabase mock, so a per-file `vi.mock('@/api/supabaseClient', …)` gives complete control. Fifteen tests run in 4 ms.
- **Offline is controllable in a unit test.** `setOnline()` (`:156-158`) redefines `navigator.onLine` with `configurable: true` and `afterEach` restores it — no fixture, no browser.
- **The regression is pinned the right way.** Messages are compared with `toBe`, not `toContain`, and the file's header explains why in one paragraph: the regression is an *extra sentence*, and a substring assertion would pass with the promise re-attached. Preserve this in anything added later.
- **The offline guard's central claim is falsifiable.** `backend.fromCalls` (`:52`), asserted `toBe(0)` at `:208`, proves the guard returns before any request — the one property a message assertion cannot establish.
- **Observability is asserted by contrast, not in isolation.** `:241-250` asserts `console.error` was *not* called and `:252-258` asserts it *was* on the neighbouring path. A single-sided assertion would be satisfied by a test that simply never triggers logging.

---

## NFR Planning

Capturing thresholds, planned validation and the evidence a later `nfr-assess` should consume. Not an evidence audit; no PASS/CONCERNS/FAIL is assigned here.

| NFR Category | Requirement / Threshold | Risk Link | Planned Validation | Evidence Needed |
|---|---|---|---|---|
| **Reliability** | **UNKNOWN.** No PRD or ADR exists in this repository. The spec states a qualitative bar only: "Every message a caller can read must describe what actually happened." | R-1, R-2, R-3 | TEST-01, TEST-02, TEST-04 — one pinned message per reachable failure mode | `npx vitest run tests/unit/api/interactionService.test.ts` output; the file's v8 branch report |
| **Maintainability (coverage)** | **UNKNOWN per file.** Repo global is 25% (`vitest.config.ts:52-57`); `test-priorities-matrix.md` would put a P1 unit target at >80%. Measured today: 71.42% statements, 50% branches. | R-3, R-10 | TEST-04, TEST-05, TEST-07 | `--coverage.include='src/api/interactionService.ts'` report |
| **Maintainability (invariant)** | Binary: zero Supabase-only modules importing a sync-promising symbol | R-4 | TEST-03 | `npm run lint` exit code, or the guard test's result |
| **Maintainability (duplication)** | **UNKNOWN.** DW-33 records that the error class and `networkFailure` builder now exist in two copies. This repo runs no duplication check, and `nfr-criteria.md` puts duplication under CI tooling rather than a test. | — (DW-33) | None planned — a third Supabase-only feature is the trigger for extraction, per DW-33's own reasoning | n/a |
| **Security** | No new surface. The change adds no query, no policy, and no exported symbol (`InteractionWriteError` is deliberately unexported, `:62`). | — | None planned | `supabase/tests/database/02_rls_policies.sql` continues to assert the policy set; untouched |
| **Performance** | N/A | — | None planned | — |
| **Observability** | **UNKNOWN** | R-9 | Already measured: production delta is zero | Reasoning recorded under R-9 |

**Unknown thresholds.** Reliability has no numeric bar, maintainability has no per-file coverage bar, duplication has no measurement, and observability has no stated requirement. **No value is invented for any of them.** Two of the four are operator decisions, recorded under *Assumptions and Dependencies* below.

---

## Entry Criteria

- [x] The change under test is committed (`f486587`) and its suite is green — verified in this session
- [x] Requirements available with acceptance criteria — `spec-dw-7-18-events-offline-message-honesty.md` `## Tasks & Acceptance` (5 Given/When/Then) and `## I/O & Edge-Case Matrix` (6 rows)
- [x] Unit test environment works in this worktree — `npx --no-install vitest run` succeeds despite the worktree carrying no local `node_modules`
- [ ] Decision taken on TEST-03's mechanism (ESLint override vs vitest guard) and on its scope list
- [ ] **For TEST-01's optional integration variant only:** `npm run supabase:up` running. Not required by any P1 unit item.

## Exit Criteria

- [ ] TEST-01, TEST-02 and TEST-03 written and passing
- [ ] R-1 closed: both realisations of "insert returns no row" asserted, and the fake's `single()` no longer conflates them
- [ ] Branch counts `if@314` and `if@394` in `src/api/interactionService.ts` are no longer one-sided
- [ ] `npx vitest run` still reports 89+ files green; `npm run lint` still exits 0 for `src` and `tests`
- [ ] `npm run typecheck` shows no new errors beyond the worktree's known `TS2883` baseline in `tests/support/merged-fixtures.ts`
- [ ] No open risk scores ≥ 6
- [ ] DW-31, DW-32, DW-33, DW-34 and DW-35 either remain open with the scores recorded here, or are consciously bundled into a follow-up

---

## Test Coverage Plan

> **P0/P1/P2/P3 denote priority, not execution timing.** Every scenario below runs in the PR tier; see *Execution Strategy*.

**Why nothing here is P0.** Applying the `test-priorities-matrix.md` decision tree rather than reading a priority off a risk score — the fragment is explicit that the two axes are separate and that the score is a sanity check on a priority already assigned. There is no revenue impact (pokes and kisses are free affordances in a two-person app), no security-critical path, no data-integrity operation (nothing is written differently; only the text of a rejection changed), and no compliance requirement. Every failure this code reports has a trivial workaround: press the button again. Regression prevention *does* apply — DW-7 and DW-18 are previously-identified defects, which the matrix says raises priority — and that puts the ceiling at P1. Declaring a P0 here would hollow out the 100% P0 gate for the paths that genuinely warrant it.

Every scenario is **Unit**, with one **Lint** row. That is `test-levels-framework.md`'s own answer rather than a shortcut: the change is error-handling logic in an isolated class with a single mockable dependency, which its matrix marks *"Error handling (logic) → Unit: Primary, E2E: Overkill"*. An E2E for any of it would be duplicate coverage at best and, per R-6, a hollow check at worst.

### P1 (High)

**Criteria**: Core, frequent, or complex behavior with material user reach and a limited workaround. Risk score is supporting evidence, not a required condition.

| Test ID | Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
|---|---|---|---|---|---|---|
| TEST-01 | A zero-row insert reported by PostgREST as `PGRST116` rejects with `'[InteractionService.sendInteraction] No rows found'`, carrying no sync promise | Unit | R-1 | 2 | DEV | Includes correcting the fixture; see detail below |
| TEST-02 | `getInteractionHistory` and `markAsViewed` map a `PostgrestError` through `handleSupabaseError`, unchanged | Unit | R-2 | 2 | DEV | One test per method; mirrors the two that exist for `sendInteraction` and `getUnviewedInteractions` |
| TEST-03 | No Supabase-only module may import `handleNetworkError` or `OFFLINE_ERROR_MESSAGE` | Lint (preferred) or Unit | R-4 | 1 | DEV | The only item here that protects features not yet written |

**Total P1**: 3 scenarios, 5 tests, **~4–8 hours**

### P2 (Medium)

**Criteria**: Secondary behavior with narrower user reach and an acceptable workaround.

| Test ID | Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
|---|---|---|---|---|---|---|
| TEST-04 | `networkFailure` produces `'… Network error: Unknown network error. Check your internet connection.'` for a non-`Error` rejection, still with no sync promise | Unit | R-3 | 1 | DEV | Reject with a bare string; closes `cond-expr@77` |
| TEST-05 | Success paths of `getInteractionHistory`, `getUnviewedInteractions` and `markAsViewed`, including the `.or()` / `.order()` / `.range()` predicate the fake currently no-ops | Unit | — (DW-34) | 4 | DEV | Closes `if@296`, `if@344`, `if@386` and statements 301-310, 348-357, 390 |

**Total P2**: 2 scenarios, 5 tests, **~2–4 hours**

### P3 (Low)

**Criteria**: Rare behavior with minimal impact and an easy workaround.

| Test ID | Requirement | Test Level | Test Count | Owner | Notes |
|---|---|---|---|---|---|
| TEST-06 | `markAsViewed` surfaces a zero-row UPDATE instead of resolving successfully | Unit | 2 | DEV | R-5 / DW-31. **Requires a production change** the current spec's Never list excludes — not a test-only task |
| TEST-07 | `subscribeInteractions` surfaces `CHANNEL_ERROR` / `TIMED_OUT` to its caller | Unit | 3 | DEV | R-10 / DW-35. Same caveat; also entangled with the direct `supabase.channel()` pitfall in `AGENTS.md` |

**Total P3**: 2 scenarios, 5 tests, **~3–6 hours**

### TEST-01 — detail

Two pieces of work, one of them to the fixture rather than to a test.

1. **Teach `interactionsQuery()`'s `single()` the client's real contract.** Today `:132-135` returns `{ data: result.data?.[0] ?? null, error: result.error }`, silently turning any zero-row result into `{ data: null, error: null }`. In `postgrest-js@2.112.3`, `select()` appends `Prefer: return=representation` and `single()` sets `Accept: application/vnd.pgrst.object+json`; under those headers a zero-row result is a `PGRST116` PostgrestError (`status: 406`, `"JSON object requested, multiple (or no) rows returned"`). The `{ data: null, error: null }` shape *is* producible — `PostgrestBuilder`'s handler contains `if (body === "") {}` on the `res.ok` path — but only from a 2xx with an empty body, which with `return=representation` requires an intermediary or a server configuration that drops the representation. Model both, and split the single boolean into two: rename `insertReturnsNothing` to `insertReturnsEmptyBody`, and add `insertMatchesNoRow` for the PostgREST outcome.
2. **Assert the reachable path.** `sendPoke` rejects with exactly `'[InteractionService.sendInteraction] No rows found'`, and `expect(failure?.message).not.toContain(SYNC_PROMISE)`.

Keep the two existing tests. The branch they cover is real defensive code, its message (`'The poke was not sent'`) is the better of the two, and deleting them would remove the only assertion on `InteractionWriteError`'s second construction site.

**Optional higher-evidence variant.** Run the same assertion once against local Supabase (`npm run supabase:up`, then the `integration` Playwright project at `playwright.config.ts:157-158`) to observe a real 406 rather than inferring it from the client's source. This is what moves R-1's remaining Unknown from *inferred* to *measured*. It is optional because the unit assertion is what guards the regression; the integration run is what proves the premise.

### TEST-03 — detail, and why it is the highest-leverage item here

The honesty property is repo-wide; its enforcement is not.

**Preferred mechanism — ESLint.** `eslint.config.js` already runs over `src` in CI. A `no-restricted-imports` rule with `importNames`, scoped by an override to the Supabase-only modules, names both symbols and the reason:

```js
// Supabase-only features have no offline queue, so any message promising a
// later sync is false there. Mood and messages are offline-first and keep both.
{
  files: [
    'src/api/interactionService.ts',
    'src/services/eventsService.ts',
    // confirm each of these is Supabase-only before adding it:
    'src/services/photoService.ts',
    'src/stores/slices/notesSlice.ts',
  ],
  rules: {
    'no-restricted-imports': ['error', {
      paths: [
        {
          name: './errorHandlers',
          importNames: ['handleNetworkError'],
          message: 'No offline queue here — build a local message. See interactionService.ts:8-16.',
        },
        {
          name: '../api/errorHandlers',
          importNames: ['handleNetworkError'],
          message: 'No offline queue here — build a local message. See interactionService.ts:8-16.',
        },
        {
          name: '../utils/offlineErrorHandler',
          importNames: ['OFFLINE_ERROR_MESSAGE'],
          message: 'Promises a sync. Use OFFLINE_RETRY_MESSAGE.',
        },
      ],
    }],
  },
}
```

The `files` list is the part to get right and it is a judgement call: `AGENTS.md` names photos, love notes and partner interactions as Supabase-only, plus events. Confirm each path before adding it — a wrong entry either blocks a legitimate import or silently protects nothing. The list must exclude `moodApi.ts`, `moodSyncService.ts` and `MoodTracker.tsx`, where both symbols are correct.

**Fallback — a vitest guard.** If touching `eslint.config.js` is unwanted, one test that reads each file with `fs.readFileSync` and asserts neither symbol appears in an import gives the same signal from the suite that already runs. It is weaker — string matching rather than module resolution — and the test should say so in a comment.

---

## Execution Strategy

**Philosophy: run everything in PRs.** The measured cost of the entire unit suite in this worktree is 6.24 s across 89 files and 1316 tests; the interactionService file alone is 4 ms. Nothing in this plan approaches the 15-minute threshold that would justify deferring anything, and Playwright's parallelization means even the existing E2E projects fit the PR tier comfortably.

| Tier | What runs | Cost |
|---|---|---|
| **Every PR** | All seven scenarios (six unit, one lint), plus the existing unit suite and `npm run lint` | seconds |
| **Nightly** | Nothing from this plan. | — |
| **Weekly** | Nothing from this plan. | — |

**The one exception.** TEST-01's optional integration variant needs `supabase start`. If written, it belongs in the existing `integration` Playwright project and runs wherever E2E already runs — not in the PR unit job.

---

## Resource Estimates

| Priority | Scenarios | Tests | Effort | Notes |
|---|---|---|---|---|
| P0 | 0 | 0 | — | None; see the priority reasoning above |
| P1 | 3 | 5 | **~4–8 h** | TEST-03 is most of it — each path in the scope list must be confirmed Supabase-only, and the rule verified not to fire on `moodApi` / `moodSyncService` / `MoodTracker`. TEST-01 includes the fixture correction. |
| P2 | 2 | 5 | **~2–4 h** | TEST-05 needs the fake to stop no-op'ing `.or()`, `.order()` and `.range()` |
| P3 | 2 | 5 | **~3–6 h** | Widest range: both depend on a production change the current spec excludes |
| **Total** | **7** | **15** | **~9–18 h** | **~1.5–3 days** |

Ranges, not points. P3 is widest because neither of its items is a test-only task.

### Prerequisites

**Test data.** None new. The existing `row()` factory (`tests/unit/api/interactionService.test.ts:63-73`) and the in-memory `backend` object (`:42-61`) cover every planned scenario. No `@faker-js/faker` usage is needed — the assertions are on literal message strings, and `data-factories.md`'s guidance on naming hardcoded domain literals is already satisfied by the `SYNC_PROMISE`, `USER_ID` and `PARTNER_ID` constants.

**Tooling.** Vitest 4.1.10 with the v8 coverage provider, already configured. ESLint 10.8.1 for TEST-03's preferred mechanism. No new dependency.

**Environment.** Unit scenarios need nothing beyond the repo — confirmed by running them here. TEST-01's optional variant needs `npm run supabase:up`.

### Playwright Utils note

`tea_use_playwright_utils` is `true` and `@seontechnologies/playwright-utils@^4.4.0` is installed, so the mandate binds — but it binds to the **Playwright runner**, and every scenario in this plan runs under **Vitest**. Per `playwright-utils-mandate.md` §Scope ("Applies when … the suite runs on the Playwright test runner"), none of its substitutions apply to the code above, and no deviation note is owed. Should TEST-01's optional integration variant be written, it runs under Playwright and must then import `test` from `tests/support/merged-fixtures.ts` and use `apiRequest` rather than the raw `request` fixture.

---

## Quality Gate Criteria

### Pass/fail thresholds

- **P0 pass rate** — n/a; no P0 scenarios exist.
- **P1 pass rate** — **100%**. Three items, all cheap; a waiver would cost more to write than the test.
- **P2/P3 pass rate** — ≥90%, informational.
- **High-risk mitigation** — R-1 is the only item at or above the mitigation threshold, and TEST-01 closes it. No score-9 item exists, so nothing in this design implies a gate FAIL.

### Coverage targets

- **`src/api/interactionService.ts`** — proposed **≥85% statements, ≥75% branches** after TEST-01/02/04/05, up from the measured 71.42% / 50%. This target **cannot be enforced by the current config**: the only thresholds are global and set to 25%, so a regression from 71% to 30% in this file would not fail CI. Adding a per-file threshold is an operator decision (see below).
- **The changed failure paths** — 100%. Every branch the diff touched must be exercised in both directions.

### Non-negotiable

- [ ] All P1 tests pass
- [ ] No unmitigated risk with score ≥ 6
- [ ] SEC category: n/a — no security scenarios, because the change adds no security surface
- [ ] PERF category: n/a
- [ ] Reliability and maintainability evidence exists as named in *NFR Planning*, or `nfr-assess` records documented CONCERNS

---

## Mitigation Plans

### R-1: A zero-row insert has two possible client outcomes and the suite tests only the less likely one (Score 6)

**Strategy**

1. Split `insertReturnsNothing` into `insertReturnsEmptyBody` (2xx, empty body → `{ data: null, error: null }`) and `insertMatchesNoRow` (zero rows under `Accept: application/vnd.pgrst.object+json` → a `PGRST116` PostgrestError).
2. Make `single()` in the fake honor the distinction instead of collapsing both to null.
3. Add the assertion for the PostgREST path: `'[InteractionService.sendInteraction] No rows found'`, with `not.toContain(SYNC_PROMISE)`.
4. Keep the two existing empty-body tests, and add a one-line comment to each recording that the branch is defensive and why it is kept.
5. Optionally observe a real 406 once against local Supabase, to convert the inference into a measurement.

**Owner:** DEV **Timeline:** next edit to `src/api/interactionService.ts` **Status:** Planned

**Verification:** `npx vitest run tests/unit/api/interactionService.test.ts` passes with 17+ tests; the fake contains no code path that produces `{ data: null, error: null }` for a row-count mismatch; and re-running the coverage command shows the `sendInteraction` catch tail exercised through all three of its exits.

---

## Assumptions and Dependencies

### Assumptions

1. **PostgREST returns 406/`PGRST116` for a zero-row `application/vnd.pgrst.object+json` request.** Established from `postgrest-js@2.112.3`'s own error construction and from `maybeSingle()` existing specifically to avoid that Accept header — not from an observed server response. TEST-01's optional variant is the measurement that would settle it.
2. **No consumer branches on the old thrown shape.** The offline path changed from `SupabaseServiceError` (`isNetworkError: true`, `code: 'NETWORK_ERROR'`) to `InteractionWriteError`. `grep -rn "isNetworkError\|NETWORK_ERROR\|SupabaseServiceError" src/ tests/` returns `errorHandlers.ts` itself, JSDoc `@throws` lines in four services, and exactly two hits on an unrelated symbol: the validation-layer constant `INTERACTION_ERRORS.NETWORK_ERROR` (`src/utils/interactionValidation.ts:116`) and the test asserting it exists (`tests/unit/utils/interactionValidation.test.ts:122`). No consumer reads `.isNetworkError` or `.code` off anything this service throws.
3. **`fart` never reaches this service.** `PokeKissInterface` offers a third button, but `grep -rn "fart" src/stores/slices/interactionsSlice.ts src/api/interactionService.ts` returns nothing, and `interactions_type_check` (`supabase/migrations/20251206024345_remote_schema.sql:89`) allows only `'poke'` and `'kiss'`. It is a local animation, outside this design's scope.
4. **The ledger edit ships with the code.** `deferred-work.md` is uncommitted; the design treats DW-31 … DW-35 as open regardless of when that lands.

### Dependencies

1. **A decision on TEST-03's mechanism and scope list** — blocks TEST-03 only.
2. **`supabase start`** — blocks TEST-01's optional variant only. No P1 unit item depends on it.

### Decisions for the operator

These change what gets built and are not this workflow's to make:

1. **TEST-03's mechanism.** ESLint `no-restricted-imports` override (stronger; touches `eslint.config.js`) or a vitest guard test (weaker; touches only `tests/`). *Recommendation: ESLint* — it fails in the job that already runs, and module resolution beats string matching.
2. **TEST-03's scope list.** Which modules count as Supabase-only. Confirm each path rather than copying the illustrative list above.
3. **A per-file coverage threshold** for `src/api/interactionService.ts`, and its value. Without one, the ≥85%/≥75% target is a review-time check only.
4. **Whether TEST-06 and TEST-07 belong in this bundle at all.** Both need production changes the spec's Never list excludes, and both already have ledger entries. Leaving them deferred is defensible; listing them as planned coverage while the code they would test cannot change is not.

### Risks to the plan

- **Risk:** TEST-03's scope list is drawn too wide and blocks a legitimate import in a module that *is* offline-first.
  **Impact:** A red lint job on unrelated work, and pressure to weaken or delete the rule.
  **Contingency:** Start the list at the two modules already proven Supabase-only (`interactionService.ts`, `eventsService.ts`), confirm each addition against `AGENTS.md`'s data-model paragraph, and add the rest in a follow-up.
- **Risk:** Assumption 1 turns out to be wrong and a live zero-row insert produces something else again.
  **Impact:** TEST-01 asserts a third message that never occurs, reproducing R-1 one layer along.
  **Contingency:** Run the optional integration variant *before* pinning the message string, not after.

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
|---|---|---|
| **`src/api/moodApi.ts`, `src/api/moodSyncService.ts`** | None — 16 `handleNetworkError` call sites keep the sync promise, which is true for them | `tests/unit/api/moodApi.test.ts`, `tests/unit/api/moodSyncService.test.ts`, `tests/unit/api/moodSyncSubscription.test.ts` must pass unchanged |
| **`src/api/errorHandlers.ts`** | Untouched; loses one consumer | Covered transitively by the mood suites |
| **`src/services/eventsService.ts`** | Untouched; is the reference idiom this change copied | `tests/unit/services/eventsService.test.ts` |
| **`src/stores/slices/interactionsSlice.ts`** | Re-throws the service error unchanged (`:94`, `:127`, `:147`), so the new message is what a caller sees | `tests/unit/stores/loaderIdentityGuards.test.ts` (covers `loadInteractionHistory`) |
| **`src/components/PokeKissInterface/PokeKissInterface.tsx`** | No behavioral change — renders constants, not `error.message` | `tests/e2e/partner/partner-mood.spec.ts:35` `[P0] 4.5-E2E-002` |
| **`src/components/MoodTracker/MoodTracker.tsx`** | Unaffected, but it is the sole consumer of `OFFLINE_ERROR_MESSAGE` (`:31`, rendered at `:432`) — TEST-03's scope must not include it | The mood suites, plus `npm run lint` |

No cross-team coordination is needed; this is a single-repo, single-maintainer change.

---

## Follow-on Workflows (Manual)

- `/bmad-testarch-atdd` — normally used to generate failing P0 tests. **There are no P0 scenarios here**, so if it is run at all, point it at the P1 rows. Not auto-run.
- `/bmad-testarch-automate` — for broader coverage once TEST-01 … TEST-05 exist.
- `/bmad-testarch-trace` — to build the traceability matrix and a gate decision from this register.
- `/bmad-testarch-nfr` — only once the reliability and maintainability evidence named above actually exists.

---

## Approval

**Test Design Approved By:**

- [ ] Tech Lead: Sallvain — Date: ______

**Comments:**

---

## Appendix

### Measured evidence

Every number in this document came from a command run in this session, in this worktree, at `f486587` plus the uncommitted ledger edit.

| Claim | Command |
|---|---|
| 15 tests pass, 4 ms | `npx --no-install vitest run tests/unit/api/interactionService.test.ts` |
| 89 files / 1316 tests pass, 6.24 s | `npx --no-install vitest run` |
| 71.42% / 50% / 57.14% / 72.58% | `npx --no-install vitest run tests/unit/api/interactionService.test.ts --coverage --coverage.include='src/api/interactionService.ts'` |
| Per-branch and per-function counts | the same run with `--coverage.reporter=json`, read from `coverage-final.json`'s `branchMap` / `fnMap` / `s` / `b` / `f` |
| 47 unit-style test files, 36 spec files | `find tests -name "*.test.ts*" -not -path "*/e2e-archive/*" \| wc -l`; same with `-name "*.spec.ts"` |
| Branch diff: 4 files, +656/−21 | `git diff --stat main...HEAD` |
| Working-tree diff: 1 file, +46/−2 | `git status --porcelain`; `git diff --stat` |
| `single()` / `select()` / empty-body contracts | read from `/Users/sallvain/Projects/My-Love/node_modules/@supabase/postgrest-js/dist/index.mjs` (v2.112.3) |

Uncovered statement lines in `src/api/interactionService.ts`: `238, 249, 250, 254, 257–262, 301, 302, 315, 348, 349, 390, 395`.
Uncovered functions: `subscribeInteractions@225` plus its five inner callbacks.
One-sided branches: `cond-expr@77` `[9,0]`, `if@296` `[2,0]`, `if@314` `[0,2]`, `if@344` `[3,0]`, `if@386` `[2,0]`, `if@394` `[0,2]`.

### Knowledge Base References

- `risk-governance.md` — risk classification framework and gate rules
- `probability-impact.md` — the 1–3 × 1–3 scale and the DOCUMENT/MONITOR/MITIGATE/BLOCK thresholds
- `test-levels-framework.md` — level selection and the duplicate-coverage guard
- `test-priorities-matrix.md` — P0–P3 criteria, and the rule that priority is assigned by decision tree rather than derived from a risk score
- `nfr-criteria.md` — NFR categories and the "ambiguous defaults to CONCERNS" principle
- `evidence-integrity.md` — falsifiability, and the hollow-check shapes that shaped the Not-in-Scope table
- `confidence-gate.md` — the confidence declaration below
- `library-integration-mandate.md`, `playwright-utils-mandate.md` — the two gates, and the runner-scoped applicability note above

### Related Documents

- Spec: `_bmad-output/implementation-artifacts/spec-dw-7-18-events-offline-message-honesty.md`
- Ledger: `_bmad-output/implementation-artifacts/deferred-work.md` (DW-7, DW-18 closed; DW-31 … DW-35 open)
- Progress checkpoint: `_bmad-output/test-artifacts/test-design-progress-epic-dw-events-offline-message-honesty.md`
- PRD / ADR / Architecture: **none exist in this repository.** `AGENTS.md` is the durable architecture prose, deliberately, and a `docs/` tree must not be recreated.

### Confidence

**8 / 10.**

*Rationale:* every claim cites something read in this session — `postgrest-js@2.112.3 dist/index.mjs` for the `single()`, `select()` and empty-body contracts; measured v8 `branchMap` / `fnMap` output for every coverage number; `supabase/migrations/20251206024345_remote_schema.sql:316-321` for the UPDATE policy behind R-5; and two executed `vitest run` invocations for the suite's state.

*Unknowns:*
- PostgREST's server-side response to a zero-row `application/vnd.pgrst.object+json` insert is inferred from the client's own error construction, not observed. `supabase start` is not running in this session. TEST-01's optional variant exists to observe it.
- No PRD or ADR exists, so every NFR threshold is recorded UNKNOWN rather than guessed.
- The precise membership of "Supabase-only modules" for TEST-03's scope list is a judgement call flagged for the operator rather than resolved here.

---

**Generated by:** BMad TEA Agent — Test Architect Module
**Workflow:** `bmad-testarch-test-design` (Epic-Level, Phase 4)
**Version:** 5.0 (Step-File Architecture)

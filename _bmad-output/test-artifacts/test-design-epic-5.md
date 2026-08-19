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
runKey: 'epic-5'
inputDocuments:
  - '_bmad/tea/config.yaml'
  - '_bmad-output/specs/spec-dynamic-events/SPEC.md'
  - '_bmad-output/specs/spec-dynamic-events/stories.yaml'
  - '_bmad-output/specs/spec-dynamic-events/stories/5-manage-events-in-settings.md'
  - '_bmad-output/implementation-artifacts/deferred-work.md'
  - 'src/components/Settings/EventsSettings.tsx'
  - 'src/components/Settings/Settings.tsx'
  - 'src/stores/slices/eventsSlice.ts'
  - 'src/stores/slices/authSlice.ts'
  - 'supabase/tests/database/20_events.sql'
  - 'vitest.config.ts'
  - 'playwright.config.ts'
  - '.github/workflows/test.yml'
  - 'knowledge/risk-governance.md'
  - 'knowledge/probability-impact.md'
  - 'knowledge/test-levels-framework.md'
  - 'knowledge/test-priorities-matrix.md'
  - 'knowledge/nfr-criteria.md'
  - 'knowledge/playwright-utils-mandate.md'
---

# Test Design: Epic 5 - Manage events in Settings

**Date:** 2026-08-19
**Author:** Sallvain
**Status:** Draft
**Scope under test:** the story-5 change set in this worktree — `git diff HEAD~1 HEAD`, 6 files,
3013 insertions, 0 deletions. The only uncommitted change is
`_bmad-output/implementation-artifacts/deferred-work.md` (+16 lines: DW-26, DW-27).

---

## Executive Summary

This is a **post-implementation** risk-based test design. The change already ships with 50 new
tests, so the deliverable is not "what to write from nothing" but two things: an evidence-backed
risk register for what this diff introduced, and a coverage strategy that names the gaps those 50
tests do not close.

**Change set:**

| File | Lines | Kind |
|---|---|---|
| `src/components/Settings/EventsSettings.tsx` | 1001 | new — the whole feature |
| `src/components/Settings/Settings.tsx` | +10 | mount point |
| `src/components/Settings/__tests__/EventsSettings.test.tsx` | 851 | new — 34 tests |
| `src/components/Settings/__tests__/EventsSettings.focus.test.tsx` | 391 | new — 11 tests |
| `tests/e2e/settings/events-crud.spec.ts` | 446 | new — 5 `[P0]` tests |
| `_bmad-output/specs/.../5-manage-events-in-settings.md` | 314 | the story |

**Risk summary:**

- Total risks identified: **13**
- High-priority risks (score >= 6): **0**
- Distribution: BLOCK (9) = 0 · MITIGATE (6-8) = 0 · MONITOR (4-5) = 5 · DOCUMENT (1-3) = 8
- Categories represented: SEC (3), DATA (2), TECH (4), BUS (2), OPS (2), PERF (1)

**Coverage summary:**

- Existing coverage: all 13 rows of the story's I/O & Edge-Case Matrix
  (`5-manage-events-in-settings.md:88-102`) have at least one passing test.
- New scenarios planned: **8** — P0: 0, P1: 3, P2: 4, P3: 1
- Total new effort: **~10-21 hours (~1.5-3 days, ~0.5-1 week elapsed)**, of which ~3-6 hours is
  blocked on a data-layer fix this story was forbidden to make.

**Verification measured this session**, not taken from the story's report:

```
npx vitest run src/components/Settings/__tests__
 ✓ EventsSettings.focus.test.tsx (11 tests) 106ms
 ✓ EventsSettings.test.tsx      (34 tests) 205ms
 Test Files  2 passed (2)
      Tests  45 passed (45)
```

One warning accompanied that run and is carried into the register as R-010: on
`EventsSettings list states > does not paint the load banner when the shared error key holds a save
failure`, React reported "An update to EventsSettings inside a test was not wrapped in act(...)".

---

## Not in Scope

| Item | Reasoning | Mitigation |
|---|---|---|
| **`eventsService.ts` and `eventsSlice.ts` behaviour** | Story 2's contract; this story's Never list forbids editing either (`5-manage-events-in-settings.md:78`). Re-asserting slice behaviour from a component test would be duplicate coverage across levels. | 54 unit tests already own it — 32 in `tests/unit/services/eventsService.test.ts`, 22 in `tests/unit/stores/eventsSlice.test.ts`. |
| **RLS policy definitions for `public.events`** | Story 1's contract. `supabase/tests/database/20_events.sql` (404 lines) already pins the exact policy set with `policies_are` at `:110`. | Runs in CI as the "Database Tests" job (`.github/workflows/test.yml:140`). |
| **`AnniversarySettings.tsx` and the other Settings sections** | Outside the diff. `AnniversarySettings.tsx:103` carries a known UTC off-by-one that this story deliberately did not copy and equally did not fix. | Recorded here as a standing untested surface; needs its own story. Not silently absorbed into this plan. |
| **Load / stress testing (k6)** | No load profile exists. This is a two-person application; `public.events` holds a handful of rows per couple. `nfr-criteria.md` prescribes k6 for system throughput, which is not a question this system asks. | None needed. |
| **Contract testing (Pact)** | No consumer/provider split. Relevance probe found no `pact/` directory, no `tests/contract/`, no `*.pacttest.ts`, no `pact` dependency, no `PACT_BROKER_*`. Per `pactjs-utils-mandate.md`, the `true` flag "never means 'add contract tests to this project'". | None needed. |
| **The icon-validation branch** (`EventsSettings.tsx:525-527`) | Unreachable through the UI: `icon` is typed `EventIcon` and written only from `ICON_OPTIONS`, so `!ICON_VALUES.includes(icon)` cannot be true. Same class as the `ISO_DATE_PATTERN` finding the review dismissed on the grounds that `<input type="date">` "cannot emit an unparseable value". | Left uncovered deliberately; documented so the coverage number is not read as an oversight. |
| **Realtime / partner live-update behaviour** | `SPEC.md:122`: "No live partner updates in this spec"; the design moved to `../spec-partner-activity/`. | Belongs to that spec's own test design. |

---

## Risk Assessment

### High-Priority Risks (Score >= 6)

**None.** No risk in this change set scores 6 or above, so `risk-governance.md`'s
`evaluateGate` produces no BLOCK and no MITIGATE item on the risk axis. Coverage gaps are assessed
separately and are what the gate criteria below actually turn on.

### Medium-Priority Risks (Score 3-4)

| Risk ID | Category | Description | P | I | Score | Action | Mitigation | Owner |
|---|---|---|---|---|---|---|---|---|
| R-001 | DATA | Duplicate event rows from a re-attempted create. `public.events` has no unique constraint and no idempotency key, so the disabled Save button is the only guard — and it lives inside one modal instance, for the in-flight window only. | 2 | 2 | 4 | MONITOR | Accept and monitor. The structural fix is a DB `UNIQUE (user_id, label, event_date)` plus `.upsert(..., { onConflict, ignoreDuplicates: true })`, which is data-layer work. | Sallvain |
| R-003 | OPS | DW-27 — once the Settings load fails, nothing re-fires it. The effect deps are `[userId, loadEvents]` (`EventsSettings.tsx:142`); the notice tells the user to reload because nothing else will. | 2 | 2 | 4 | MONITOR | Add `isOnline` to the deps, matching App's Home effect, or add a Retry control. Both widen the intent, so this needs a spec decision first. | Sallvain |
| R-007 | DATA | Client validation mirrors drift from the DB CHECK constraints. `EventsSettings.tsx:73-75` hardcodes 100 / 500 / the icon set as "Mirrors of the CHECK constraints in `20260818000002_create_events_table.sql:19,21,22`" with nothing linking them. | 2 | 2 | 4 | MONITOR | DE.5-UNIT-001 — a drift guard that reads the migration and asserts the pairing. | Sallvain |
| R-008 | BUS | Date off-by-one in the untested direction. The feature exists to avoid one (`AnniversarySettings.tsx:103`), but `vitest.config.ts:34` pins `TZ: 'America/New_York'` — one offset, west of UTC. The UTC+ half of the failure space is unexercised. | 2 | 2 | 4 | MONITOR | DE.5-UNIT-002 — a CI leg re-running the date-sensitive suites under a UTC+ zone. | Sallvain |
| R-009 | TECH | No automated accessibility scan on either new dialog, on a change that produced four medium a11y findings during review. | 2 | 2 | 4 | MONITOR | DE.5-E2E-001 — an axe scan over Settings and both dialogs. | Sallvain |
| R-005 | SEC | The UI's creator-only gate drifting from RLS, offering a partner a control that can only fail — or one that succeeds. | 1 | 3 | 3 | DOCUMENT | Already defended at three layers; keep all three green. Priority stays **P0** for the tests despite the low score. | Sallvain |
| R-006 | SEC | A previous account's events surviving sign-out on a shared device. | 1 | 3 | 3 | DOCUMENT | Already covered: `authSlice.ts:128-130` and `tests/e2e/auth/logout.spec.ts:67`. Keep both green. | Sallvain |
| R-013 | SEC | Stored XSS through a label or description — **verified absent**, not assumed. | 1 | 3 | 3 | DOCUMENT | Recorded so a future `dangerouslySetInnerHTML` on this surface reads as a regression rather than a choice. | Sallvain |

### Low-Priority Risks (Score 1-2)

| Risk ID | Category | Description | P | I | Score | Action |
|---|---|---|---|---|---|---|
| R-002 | BUS | DW-26 — a save that fails inside the first load's flight window paints a false "we couldn't load your events" notice over a healthy list. | 2 | 1 | 2 | DOCUMENT |
| R-004 | TECH | A write whose promise never settles locks the dialog on its spinner; there is no request timeout in the Supabase client. | 1 | 2 | 2 | DOCUMENT |
| R-010 | TECH | Unwrapped async state update in the new component suite — the measured `act(...)` warning, a flake precursor. | 2 | 1 | 2 | DOCUMENT |
| R-011 | PERF | The bare `useAppStore()` subscription (`EventsSettings.tsx:100-101`) re-renders the whole section on every unrelated store write. | 2 | 1 | 2 | DOCUMENT |
| R-012 | OPS | E2E teardown deletes every event for the worker pair (`events-crud.spec.ts:85`), including rows another spec seeded for that pair. | 1 | 2 | 2 | DOCUMENT |

### Risk Category Legend

- **TECH**: Technical/Architecture (flaws, integration, scalability)
- **SEC**: Security (access controls, auth, data exposure)
- **PERF**: Performance (SLA violations, degradation, resource limits)
- **DATA**: Data Integrity (loss, corruption, inconsistency)
- **BUS**: Business Impact (UX harm, logic errors, revenue)
- **OPS**: Operations (deployment, config, monitoring)

### Evidence behind the scores

Every score below rests on a line that was read this session, not on a recollection.

**R-001.** `5-manage-events-in-settings.md:66`: "`public.events` has no unique constraint and no
idempotency key, so a disabled control is the only double-submit guard available." The guard is
real and tested (`EventsSettings.test.tsx:554`). The automatic-retry vector AGENTS.md warns about
does not exist — `eventsSlice.ts:145`: "No retry: `public.events` carries no idempotency key to make
one safe." The residual vector is user-driven: a slow create, browser Back via the `popstate`
handler at `src/App.tsx:210`, re-open, resubmit. Impact 2 rather than 3 because the duplicate is
visible and the user can delete it with the very UI this story shipped.

**R-002.** `EventsSettings.tsx:135` reads `useAppStore.getState().eventsError !== null` — the same
key `eventsSlice.ts:170` writes when `addEvent` fails. Impact 1: DW-26 itself records that "The list
itself still renders correctly; only the notice is wrong."

**R-003.** `EventsSettings.tsx:222` renders "We couldn't load your events. Check your connection and
reload the page." There is no Retry control, and DW-27 records that `clearEventsError` "still has
zero production callers."

**R-004.** Story residual risk, lines 309-311. The escape hatch was measured rather than assumed —
the Review Triage Log records "`popstate` is handled at src/App.tsx:210, so browser Back leaves
/settings and unmounts the dialog."

**R-005.** Three independent layers, each with a live assertion: `20_events.sql:247` "EV-DB-024: a
partner's UPDATE of the creator's row affects zero rows" and `:270` "EV-DB-026: a partner's DELETE
of the creator's row affects zero rows"; the service turning zero rows into a message; and
`EventsSettings.tsx:308` `const isOwn = event.userId === userId;` gating the controls at `:355`.
Probability 1 because a regression would have to defeat all three.

**R-006.** `authSlice.ts:128-130` places `events`, `eventsIsLoading` and `eventsError` inside
`signedOutState()`. `tests/e2e/auth/logout.spec.ts:67` is "[P0] should clear account state through
signedOutState on logout" and asserts `events: 0` at `:158`. The story adds no store state; its own
state is component-local, and `EventsSettings.tsx:195` compares `settledForUserId === userId` so a
different account re-arms the load rather than trusting a stale settle.

**R-007.** Measured: `grep -rn "100\b.*label\|LABEL_MAX\|char_length"` across the two new component
suites, `tests/unit/services/eventsService.test.ts` and `supabase/tests/database/20_events.sql`
returns **no hits**. Nothing anywhere asserts that the client mirror still matches the migration.

**R-008.** `vitest.config.ts:34` pins `TZ: 'America/New_York'`. The E2E defence is genuinely good —
`events-crud.spec.ts:114-130` samples the expectation and the DOM inside one `page.evaluate`,
specifically so local midnight cannot tick between the two reads — but it runs in the same single
westward zone.

**R-009.** The change produced four medium accessibility findings in review
(`5-manage-events-in-settings.md:184-187`): the Add button had no accessible name below the `sm`
breakpoint, field errors were neither announced nor associated, the sr-only icon radios had no
focus indicator, and a heading was duplicated. All four were caught by review; none by a test.
`@axe-core/playwright` is installed and its only consumer anywhere is
`tests/e2e/scripture/scripture-accessibility.spec.ts:297`.

**R-010.** Measured this session — see the Executive Summary block.

**R-011.** `EventsSettings.tsx:100-101` destructures `useAppStore()` with no selector. Dismissed in
review as "the prevailing convention at 15 sites, including the sibling AnniversarySettings.tsx:21".

**R-012.** `events-crud.spec.ts:146-149` runs `clearPairEvents` in an `afterEach`, scoped to
`resolveOwnPair` — exactly what AGENTS.md's worker-pool rule requires — and the delete is checked
rather than silent (`:86-88`). Probability 1 while Playwright runs one test at a time per worker.

**R-013.** `event.label` and `event.description` are React text children (`EventsSettings.tsx:325`,
`:338`), which React escapes, and `grep -rn "dangerouslySetInnerHTML" src/components/Settings/`
returns nothing.

---

## NFR Planning

**Purpose:** epic-specific NFR thresholds, planned validation, and evidence expected by a later
`nfr-assess`. This is planning, not an evidence audit.

| NFR Category | Requirement / Threshold | Risk Link | Planned Validation | Evidence Needed |
|---|---|---|---|---|
| Security — authorization | A non-creator's UPDATE/DELETE affects exactly zero rows; `anon` holds no privilege on `public.events` | R-005 | Existing pgTAP (`20_events.sql:153-166,247,270`) plus the partner-row E2E | CI "Database Tests" job output; Playwright chromium report |
| Security — account isolation | Sign-out leaves `events` empty | R-006 | Existing `tests/e2e/auth/logout.spec.ts:67` | Playwright report |
| Security — static analysis | No new critical/high finding | R-013 | CodeQL on push (`.github/workflows/codeql.yml`) | CodeQL alerts |
| Reliability — rejected write | The form stays open and renders the message that write returned | R-002 | Existing component + E2E coverage, extended by DE.5-E2E-002 | `test-results/vitest-junit.xml`; Playwright report |
| Reliability — retry / hung write | **UNKNOWN** | R-003, R-004 | Cannot be validated until a policy exists | — |
| Performance | **UNKNOWN** | R-011 | Deferred | — |
| Maintainability — coverage | lines 25, functions 25, branches 25 | R-010 | `npm run test:unit:coverage` in CI (`test.yml:127`) | `unit-test-coverage` artifact (`test.yml:133`) |
| Accessibility | **UNKNOWN** as an automated pass criterion; the behavioural requirements are concrete | R-009 | DE.5-E2E-001, following `scripture-accessibility.spec.ts:297` | AxeBuilder results in the Playwright report |

**Unknown thresholds — three, none invented:**

1. **Reliability, retry and timeout.** No number anywhere. The story states it directly: "There is no
   request timeout in the Supabase client, and the intent does not specify a dismissal policy for a
   hung write." Clarification item, feeding R-003 and R-004.
2. **Performance.** No SLO, SLA or budget in `SPEC.md` or the story.
   `.github/workflows/lighthouse.yml` exists, but a grep for `minScore` / `assert` / `threshold`
   over it returns nothing, and there is no `lighthouserc` file. Clarification item.
3. **Accessibility pass criterion.** The story specifies behaviours — focus trap, `role="dialog"`,
   `aria-modal`, announced field errors — but no automated bar. Clarification item; DE.5-E2E-001
   would establish one.

Per `nfr-criteria.md`: "If targets or evidence are undefined → CONCERNS". These three cannot be
signed off as PASS, and they do not fail the gate either.

---

## Entry Criteria

- [ ] Local Supabase stack running (`supabase start`) — every E2E in scope reads and writes real rows
- [ ] `npm run dev:local` available (`vite --mode test`, reads the committed `.env.test`, needs no fnox secrets)
- [ ] Worker-pool accounts seeded and `TEST_WORKER_INDEX` set — `tests/support/auth/worker-pool.ts` keys on it, and `resolveOwnPair` throws without it
- [ ] `npm run typecheck` reproduces only the six known `TS2883` errors at `tests/support/merged-fixtures.ts(53,14)` — the worktree baseline, not a regression
- [ ] `npm run lint` clean except the two pre-existing `react-refresh/only-export-components` warnings in `EventCountdown.tsx:68,91`
- [ ] A decision recorded on the two blocked scenarios (DE.5-COMP-002, DE.5-COMP-003) — they cannot be written before the DW-26 / DW-27 fix without putting red tests in CI

## Exit Criteria

- [ ] P0 pass rate 100% — all five `[P0]` tests in `tests/e2e/settings/events-crud.spec.ts`, the partner-write pgTAP assertions, and `tests/e2e/auth/logout.spec.ts:67`
- [ ] P1 pass rate >= 95%, any failure triaged with a named owner
- [ ] The three P1 gaps closed: DE.5-UNIT-001, DE.5-E2E-001, DE.5-UNIT-002
- [ ] Unit coverage at or above the configured 25/25/25 (`vitest.config.ts:52-55`)
- [ ] No open risk at score >= 6
- [ ] The `act(...)` warning (R-010) gone from the component suite output
- [ ] DW-26 and DW-27 either fixed with their regression tests, or explicitly carried in the ledger with an owner

## Project Team

| Name | Role | Testing Responsibilities |
|---|---|---|
| Sallvain | Maintainer (dev + QA) | Owns every risk and every scenario in this plan. `_bmad/tea/config.yaml` names one `user_name`; no separate QA role exists in this repository. |

---

## Test Coverage Plan

> **P0/P1/P2/P3 are priority, not execution timing.** Every scenario below runs in the same PR
> pipeline unless the Execution Strategy section says otherwise. Priority was assigned from the
> decision tree in `test-priorities-matrix.md`; risk score is supporting evidence and is not a
> condition for any level.

**Test ID convention.** `test-levels-framework.md` specifies `{EPIC}.{STORY}-{LEVEL}-{SEQ}`. The
spec carries no epic number, so `DE` (spec-dynamic-events) stands in: `DE.5-<LEVEL>-<SEQ>`, levels
`DB`, `UNIT`, `COMP`, `E2E`.

### Coverage already in place

Each of the 13 rows in the story's I/O & Edge-Case Matrix has at least one test that passed.

| # | Requirement | Test Level | Risk Link | Existing test |
|---|---|---|---|---|
| 1 | Add a valid event | COMP + E2E | R-001 | `EventsSettings.test.tsx:479`; `events-crud.spec.ts:152` |
| 2 | Blank label rejected, no request issued | COMP | R-007 | `EventsSettings.test.tsx:386` |
| 3 | Over-length label rejected, naming the limit | COMP | R-007 | `EventsSettings.test.tsx:398` |
| 4 | Rejected save keeps the form open with its own message | COMP + E2E | R-002 | `EventsSettings.test.tsx:531`; `events-crud.spec.ts:398` |
| 5 | Double submit creates exactly one row | COMP | R-001 | `EventsSettings.test.tsx:554` |
| 6 | Edit an own event; the row re-sorts | COMP + E2E | R-008 | `EventsSettings.test.tsx:613,634`; `events-crud.spec.ts:212-248` |
| 7 | A partner's event is read-only | COMP + E2E + DB | R-005 | `EventsSettings.test.tsx:271`; `events-crud.spec.ts:363`; `20_events.sql:247,270` |
| 8 | Delete confirmed; focus lands on a survivor | COMP + E2E | — | `EventsSettings.test.tsx:688`; `EventsSettings.focus.test.tsx:350`; `events-crud.spec.ts:254-266` |
| 9 | A past event is listed and editable | COMP + E2E | R-008 | `EventsSettings.test.tsx:234`; `events-crud.spec.ts:311` |
| 10 | Empty state carries its own add control | COMP + E2E | — | `EventsSettings.test.tsx:314,322`; `events-crud.spec.ts:268-270` |
| 11 | Loading indicator, never the empty state | COMP | — | `EventsSettings.test.tsx:300` |
| 12 | A failed load is explained; a failed save is not | COMP | R-002, R-003 | `EventsSettings.test.tsx:330,344,367` |
| 13 | Deep link / reload on Settings loads the list | COMP + E2E | — | `EventsSettings.test.tsx:225`; `events-crud.spec.ts:273` |

Plus 11 focus tests covering initial focus, Escape, Tab wrap, focus return after an edit, the
empty-state fallback and the post-failure return — for both dialogs.

**Duplicate-coverage check.** Validation logic lives at COMP only, never at E2E — correct per
`test-levels-framework.md`'s anti-pattern list. Ownership lives at all three levels, which the same
fragment permits for "critical paths requiring defense in depth"; the three assert different things
(UI affordance / real round trip / the database predicate). Date handling is split, not duplicated:
COMP asserts the pre-fill, E2E asserts the round trip.

### P0 (Critical)

**Criteria**: Critical business, security, data-integrity, or compliance impact with no safe
workaround.

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
|---|---|---|---|---|---|
| The Settings events round trip: add, appear on Home, edit, delete, empty state | E2E | R-001, R-008 | 1 (existing) | Sallvain | `events-crud.spec.ts:152`. Deliberately one test — the sequence carries state forward. |
| Deep link / reload on `/settings` loads the list | E2E | — | 1 (existing) | Sallvain | `events-crud.spec.ts:273`. The reason this component loads its own events. |
| A past event is listed with its controls where Home hides it | E2E | R-008 | 1 (existing) | Sallvain | `events-crud.spec.ts:311`. Grounded behind a witness card so the absence assertion cannot pass vacuously. |
| A partner's event offers no Edit and no Delete | E2E | R-005 | 1 (existing) | Sallvain | `events-crud.spec.ts:363` |
| A rejected save shows the write's own message and leaves the list untouched | E2E | R-002 | 1 (existing) | Sallvain | `events-crud.spec.ts:398`, under `skipNetworkMonitoring` |
| A partner's UPDATE/DELETE affects zero rows; `anon` has no privilege | DB | R-005 | existing pgTAP | Sallvain | `20_events.sql:153-166,247,270` |
| Sign-out clears `events` | E2E | R-006 | 1 (existing) | Sallvain | `tests/e2e/auth/logout.spec.ts:67` |

**Total P0**: 0 new. The seven above already exist and must keep passing.

### P1 (High)

**Criteria**: Core, frequent, or complex behaviour with material user reach and a limited
workaround.

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
|---|---|---|---|---|---|
| **DE.5-UNIT-001** — the client validation mirrors still match the migration's CHECK constraints | UNIT | R-007 | 1 | Sallvain | Read `20260818000002_create_events_table.sql` as text, extract `char_length(label) <= 100`, `char_length(description) <= 500` and `icon in ('ring','plane','calendar')`, assert each against what the component enforces. A drift guard, not a behaviour test. |
| **DE.5-E2E-001** — axe scan over Settings, the add/edit form, and the delete confirmation | E2E | R-009 | 3 | Sallvain | Follow `scripture-accessibility.spec.ts:297`. Three states, because the two dialogs are the surface that produced the four review findings. |
| **DE.5-UNIT-002** — the date-sensitive suites pass east of UTC as well as west | UNIT (CI leg) | R-008 | 0 new specs; 1 CI leg | Sallvain | `vitest.config.ts:34` pins TZ process-wide, so no per-file override exists. Re-run the existing suites under `TZ=Asia/Tokyo`. CI-only; no production change. |

**Total P1**: 3 scenarios, ~4-9 hours.

### P2 (Medium)

**Criteria**: Secondary behaviour with narrower user reach and an acceptable workaround.

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
|---|---|---|---|---|---|
| **DE.5-COMP-001** — remove the unwrapped async state update behind the `act(...)` warning | COMP | R-010 | 1 (repair) | Sallvain | Not a new scenario; a repair to an existing one. |
| **DE.5-E2E-002** — a rejected edit and a rejected delete carry the service's own message to the dialog | E2E | R-005 | 2 | Sallvain | Mirror `events-crud.spec.ts:392-446`. Closes the only seam where the real message (`'Event not found or not yours to edit'`) is never observed reaching a dialog — the component tests mock the store and assert a synthetic string. |
| **DE.5-COMP-002** — a save failure inside the first load's flight window leaves no false notice | COMP | R-002 | 1 | Sallvain | **Blocked** on the DW-26 fix (a per-call error token in `eventsSlice.ts`). Writing it first puts a red test in CI. |
| **DE.5-COMP-003** — a failed load re-fires on reconnect and clears its notice | COMP + E2E | R-003 | 2 | Sallvain | **Blocked** on the DW-27 fix. |

**Total P2**: 4 scenarios (6 tests), ~5-10 hours, of which ~3-6 hours is blocked.

### P3 (Low)

**Criteria**: Rare, cosmetic, or experimental behaviour with minimal impact and an easy workaround.

| Requirement | Test Level | Test Count | Owner | Notes |
|---|---|---|---|---|
| **DE.5-E2E-003** — an offline save surfaces the service's offline message inside the form | E2E | 1 | Sallvain | Low value: the generic wiring is already proven by `EventsSettings.test.tsx:531`, and the service side is pinned four times in `tests/unit/services/eventsService.test.ts:348,429,540,590`. Only the concatenation is unobserved. |

**Total P3**: 1 scenario, ~1-2 hours.

---

## Execution Strategy

**Philosophy: run everything in PRs if it finishes inside 15 minutes; defer only what is expensive
or long-running.** Nothing in this plan is expensive. Playwright parallelises hundreds of tests into
a 10-15 minute window, and the two new component suites finished in 699 ms when measured this
session.

| Stage | Contents | Budget |
|---|---|---|
| **PR** | Everything: `npm run lint`, `npm run typecheck`, `npm run test:unit:coverage`, `supabase test db`, and the Playwright `chromium`, `api` and `integration` projects. Plus the three new P1 items — the drift guard, the axe scan, and the `TZ=Asia/Tokyo` vitest leg. | < 15 min |
| **Nightly** | The full Playwright directory rather than a tag filter. `npm run test:p1` runs `--grep '\[P0\]\|\[P1\]'`, and `scripture-overview.spec.ts` is untagged, so no tag filter reaches it. | ~15-25 min |
| **Weekly** | `npm run test:burn-in` over the two new component suites, to surface the R-010 flake vector before it surfaces itself. | as configured |

CI already runs the PR row today: `.github/workflows/test.yml` defines "Lint & Type Check" (`:81`),
"Unit Tests" with coverage (`:108`), "Database Tests" running `supabase test db` (`:140`), and the
Playwright project matrix (`:171`). Only the three P1 additions are new work.

---

## Resource Estimates

| Priority | Count | Estimate | Notes |
|---|---|---|---|
| P0 | 0 new | 0 h | All seven P0 scenarios already exist and pass |
| P1 | 3 | ~4-9 h | Includes learning the AxeBuilder pattern and wiring one CI leg |
| P2 | 4 | ~5-10 h | ~3-6 h of it blocked on the DW-26 / DW-27 data-layer fix |
| P3 | 1 | ~1-2 h | |
| **Total** | **8** | **~10-21 h (~1.5-3 days, ~0.5-1 week elapsed)** | Ranges, not point estimates — the two blocked items have the widest uncertainty |

### Prerequisites

**Test data:** the per-worker account pool in `tests/support/auth/worker-pool.ts`, keyed on
`TEST_WORKER_INDEX`. Events are created through the UI, so their ids are unknown to the test;
teardown deletes by `user_id` for the worker's own pair only.

**Tooling:** `@axe-core/playwright` (already a devDependency, one existing consumer);
`@seontechnologies/playwright-utils` via `tests/support/merged-fixtures.ts`; `supabase` CLI for
pgTAP.

**Environment:** local Supabase, `vite --mode test` against the committed `.env.test`. No fnox
secrets needed for the test path.

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate**: 100%, no exceptions
- **P1 pass rate**: >= 95%, waivers required for failures
- **P2/P3 pass rate**: >= 90% (informational)
- **High-risk mitigations**: N/A — no risk scores >= 6
- **Risk gate**: no open risk at score >= 6. Currently met; the maximum in the register is 4.

### Coverage Targets

`test-design-template.md` recommends >= 80% on critical paths. **This project configures 25/25/25**
(`vitest.config.ts:52-55`), and the gate here holds to the configured number rather than the
recommended one. Raising a repository-wide threshold on the strength of one story's diff is a
project decision, not a test-design one — flagged for Sallvain, not decided here.

- Critical paths: every row of the I/O matrix has a passing test (met)
- Security scenarios: 100% (met — R-005 and R-006 are covered at three and two levels respectively)
- Unit coverage: at or above 25/25/25

### Non-Negotiable Requirements

- [ ] All P0 tests pass
- [ ] No risk at score >= 6 left unmitigated (currently vacuous — there are none)
- [ ] SEC-category coverage stays green: the pgTAP partner-write assertions, the partner-row E2E, and the logout E2E
- [ ] Each in-scope NFR category has a named evidence artifact, or is recorded as UNKNOWN
- [ ] Final NFR PASS/CONCERNS/FAIL deferred to `nfr-assess`

---

## Mitigation Plans

No risk scored >= 6, so no mitigation is mandatory under `risk-governance.md`. The five MONITOR
items (score 4) carry plans anyway, because each maps to a concrete scenario in the coverage plan.

### R-007: Client validation mirrors drift from the DB constraints (Score: 4)

**Strategy:** add DE.5-UNIT-001, a drift guard that reads
`supabase/migrations/20260818000002_create_events_table.sql` and asserts its three CHECK values
against what `EventsSettings.tsx:73-75` enforces.
**Owner:** Sallvain · **Timeline:** with the next Settings change · **Status:** Planned
**Verification:** change 100 to 90 in the migration locally; the guard must fail.
**Follow-up (production change, out of this run's scope):** one exported constants module shared by
the component and asserted against the migration, which removes the drift instead of detecting it.

### R-008: Date off-by-one in the untested direction (Score: 4)

**Strategy:** add DE.5-UNIT-002, a CI leg running the date-sensitive suites under `TZ=Asia/Tokyo`.
**Owner:** Sallvain · **Timeline:** with the next CI change · **Status:** Planned
**Verification:** re-introduce `toISOString().split('T')[0]` in the edit pre-fill locally; the Tokyo
leg must fail where the New York leg passes.

### R-009: No automated accessibility scan on either dialog (Score: 4)

**Strategy:** add DE.5-E2E-001, an axe scan over three states, following
`scripture-accessibility.spec.ts:297`.
**Owner:** Sallvain · **Timeline:** with the next Settings change · **Status:** Planned
**Verification:** remove the `aria-label` from the header Add button; the scan must flag it — that
was one of the four findings review caught by hand.

### R-003: A failed Settings load never re-fires (Score: 4)

**Strategy:** decide the intent first — `isOnline` in the effect deps, matching App's Home effect,
or a visible Retry control. Then DE.5-COMP-003.
**Owner:** Sallvain · **Timeline:** blocked on the spec decision · **Status:** Blocked
**Verification:** fail the first load, restore connectivity, assert the list populates and the
notice clears without a page reload.

### R-001: Duplicate event rows from a re-attempted create (Score: 4)

**Strategy:** accept and monitor. A `UNIQUE (user_id, label, event_date)` constraint plus
`.upsert(..., { onConflict, ignoreDuplicates: true })` is the structural fix, and it belongs to the
data layer this story was forbidden to touch.
**Owner:** Sallvain · **Timeline:** deferred to a data-layer story · **Status:** Accepted
**Verification:** if built — two creates with the same payload, one row.

---

## Assumptions and Dependencies

### Assumptions

1. The scope named by "5" is story 5 of `spec-dynamic-events`, and the changes "currently in the
   working tree" are the story-5 change set carried by commit `f52d23ee` in this worktree, since
   `git status --porcelain` shows only a documentation edit.
2. The story's recorded E2E verification (127 passed, 2 skipped, 0 failed) still holds. It was not
   re-run here — that needs a live `supabase start`. The component suites **were** re-run and
   measured.
3. `detected_stack = frontend` by the auto-detection rules, but Supabase is treated as a live server
   tier for coverage purposes; the rules only look for language manifests, and this project has none.
4. Playwright continues to run one test at a time per worker. R-012's probability of 1 depends on it.
5. No load, latency, or accessibility threshold exists to test against. Three UNKNOWNs are recorded
   rather than guessed.

### Dependencies

1. A spec decision on DW-27's retry policy — blocks DE.5-COMP-003.
2. The DW-26 per-call error token in `eventsSlice.ts` — blocks DE.5-COMP-002.
3. A running local Supabase stack — blocks every E2E in this plan.

### Risks to Plan

- **Risk**: The two blocked scenarios stay blocked indefinitely, and DW-26/DW-27 age in the ledger.
  - **Impact**: R-002 and R-003 stay uncovered; the false-notice bug can regress silently.
  - **Contingency**: both are recorded as open in `deferred-work.md` with location and evidence, so
    the next sweep can bundle them into one data-layer story.
- **Risk**: The a11y scan surfaces pre-existing violations elsewhere in the Settings view, outside
  this story's diff.
  - **Impact**: DE.5-E2E-001 lands red for reasons unrelated to story 5.
  - **Contingency**: scope the first scan to the two dialogs, and open the Settings-view scan as its
    own item against `AnniversarySettings`.

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
|---|---|---|
| **`Settings.tsx`** | A new `<section>` between Account and Anniversary (`+10` lines) | No test exists for `Settings.tsx` itself. `tests/e2e/navigation/tray.spec.ts:87-105` covers reaching Settings and surviving a reload, and it must stay green. |
| **Home (`App.tsx` events block)** | Untouched by the diff, but reads the same `events` slice a Settings write mutates | `tests/e2e/home/events.spec.ts` (6 tests) must stay green. The main Settings E2E also asserts the Home card follows an add and an edit. |
| **`eventsSlice` / `eventsService`** | First production caller of `addEvent` / `editEvent` / `removeEvent` | `tests/unit/stores/eventsSlice.test.ts` (22) and `tests/unit/services/eventsService.test.ts` (32) must stay green. |
| **`public.events` + RLS** | First UI-driven writes against the policy set | `supabase/tests/database/20_events.sql` must stay green. Note that `20_events.sql` asserts the exact policy set, so any policy added, renamed or dropped fails there. |
| **`authSlice.signedOutState()`** | No new account-scoped store state, so no widening needed | `tests/e2e/auth/logout.spec.ts:67` must stay green. |
| **`useFocusTrap`** | Two new consumers, both using the `fallbackFocusRef` + latest-ref shape | `NoteRemoveConfirmation`'s own tests and the 11 new focus tests must stay green. |

No cross-team coordination applies — the repository has a single maintainer.

---

## Follow-on Workflows (Manual)

- Run `/bmad-testarch-atdd` to generate failing tests for the P1 gaps (separate workflow; not
  auto-run here).
- Run `/bmad-testarch-automate` if the P2/P3 scenarios are picked up in bulk.
- Run `/bmad-testarch-nfr` once the three UNKNOWN thresholds have values and evidence exists.
- Run `/bmad-testarch-trace` to turn this coverage matrix into a gate decision.

---

## Approval

**Test Design Approved By:**

- [ ] Maintainer: Sallvain Date: ______

**Comments:**

---

## Appendix

### Knowledge Base References

- `risk-governance.md` — risk categories and the gate decision model
- `probability-impact.md` — 1-9 scoring; DOCUMENT / MONITOR / MITIGATE / BLOCK thresholds
- `test-levels-framework.md` — level selection, the duplicate-coverage guard, the test ID format
- `test-priorities-matrix.md` — the P0-P3 decision tree; priority assigned separately from risk score
- `nfr-criteria.md` — NFR categories, the "undefined targets default to CONCERNS" rule
- `playwright-utils-mandate.md` — the substitution table this project's specs already follow

### Related Documents

- Spec: `_bmad-output/specs/spec-dynamic-events/SPEC.md`
- Story: `_bmad-output/specs/spec-dynamic-events/stories/5-manage-events-in-settings.md`
- Deferred ledger: `_bmad-output/implementation-artifacts/deferred-work.md` (DW-26, DW-27)
- Data model: `_bmad-output/specs/spec-dynamic-events/data-model.md`
- Integration points: `_bmad-output/specs/spec-dynamic-events/integration-points.md`
- Run checkpoint: `_bmad-output/test-artifacts/test-design-progress-epic-5.md`

### Deviations from the template

1. The template's **Execution Order** section (smoke / P0 / P1 / P2-P3 tiers) is replaced by an
   **Execution Strategy** section using PR / Nightly / Weekly. `checklist.md:100-107` marks the
   tiered structure as the thing to avoid: "Simple structure: PR / Nightly / Weekly (NOT complex
   smoke/P0/P1/P2 tiers)". Where template and checklist disagree, the checklist wins.
2. A **Coverage already in place** table was added ahead of the P0-P3 sections. This is a
   post-implementation design; without it the plan would read as though nothing were tested.

---

**Generated by**: BMad TEA Agent - Test Architect Module
**Workflow**: `bmad-testarch-test-design` (Epic-Level Mode)
**Version**: 5.0 (Step-File Architecture)

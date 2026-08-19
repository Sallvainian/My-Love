---
stepsCompleted:
  [
    'step-01-preflight-and-context',
    'step-02-identify-targets',
    'step-03-generate-tests',
    'step-03a-subagent-api',
    'step-03b-subagent-e2e',
    'step-03c-aggregate',
    'step-04-validate-and-summarize',
  ]
lastStep: 'step-04-validate-and-summarize'
lastSaved: '2026-08-19'
workflowStatus: 'completed'
totalTests: 8
priorityCoverage: { P0: 1, P1: 6, P2: 1, P3: 0 }
generatedTestFiles:
  - '_bmad-output/test-artifacts/automation-5-manage-events-in-settings/api-events-wire-contract.spec.ts'
  - '_bmad-output/test-artifacts/automation-5-manage-events-in-settings/e2e-events-persistence.spec.ts'
generatedInfrastructure:
  - '_bmad-output/test-artifacts/automation-5-manage-events-in-settings/support-events.ts'
playwrightUtilsDeviations: 0
pactArtifacts: 'none — relevance gate closed'
workflowType: 'testarch-automate'
runKey: '5-manage-events-in-settings'
detectedStack: 'frontend'
executionMode: 'subagent'
coverageTarget: 'critical-paths'
inputDocuments:
  - '_bmad/tea/config.yaml'
  - '.claude/skills/bmad-testarch-automate/workflow.yaml'
  - '_bmad-output/specs/spec-dynamic-events/stories/5-manage-events-in-settings.md'
  - '_bmad-output/test-artifacts/test-design-epic-5.md'
  - '_bmad-output/test-artifacts/atdd-checklist-5-manage-events-in-settings.md'
  - 'playwright.config.ts'
  - 'vitest.config.ts'
  - 'package.json'
  - 'tests/support/merged-fixtures.ts'
  - 'tests/support/fixtures/index.ts'
  - 'tests/support/fixtures/auth.ts'
  - 'tests/support/factories/index.ts'
  - 'tests/support/helpers/supabase.ts'
  - 'tests/support/helpers/navigation.ts'
  - 'tests/support/auth/worker-pool.ts'
  - 'tests/e2e/settings/events-crud.spec.ts'
  - 'tests/api/scripture-reflection-2.2.spec.ts'
  - 'src/components/Settings/EventsSettings.tsx'
  - 'src/components/Settings/__tests__/EventsSettings.test.tsx'
  - 'src/components/Settings/__tests__/EventsSettings.focus.test.tsx'
  - 'src/components/RelationshipTimers/EventCountdown.tsx'
  - 'src/services/eventsService.ts'
  - 'supabase/migrations/20260818000002_create_events_table.sql'
  - 'supabase/tests/database/20_events.sql'
  - 'src/validation/schemas.ts'
  - 'knowledge/playwright-utils-mandate.md'
  - 'knowledge/test-levels-framework.md'
  - 'knowledge/test-priorities-matrix.md'
  - 'knowledge/data-factories.md'
  - 'knowledge/test-quality.md'
  - 'knowledge/selective-testing.md'
  - 'knowledge/ci-burn-in.md'
---

# Test Automation Expansion — Story 5: Manage events in Settings

**Date:** 2026-08-19
**Author:** Sallvain
**Workflow:** `bmad-testarch-automate` (Create mode)
**Scope under test:** the story-5 change set carried in this worktree
**Coverage target:** `critical-paths`

---

## Step 1 — Preflight & Context

### Stack detection

`test_stack_type: auto` in `_bmad/tea/config.yaml:11`, so auto-detection ran. Mobile is probed
first, per the step's own ordering rule.

| Indicator class | Probe | Result |
|---|---|---|
| Mobile | `.maestro/`, `maestro/`, `app.json`, `app.config.*`, `Podfile`, `android/`, `*.xcodeproj`, `pubspec.yaml` | none present |
| Frontend | `package.json` with react, `playwright.config.ts`, `vite.config.ts` | all three present; `package.json:47 "react": "^19.2.8"` |
| Backend | `pyproject.toml`, `pom.xml`, `build.gradle`, `go.mod`, `*.csproj`, `Gemfile`, `Cargo.toml` | none present |

**`detected_stack` = `frontend`.** Supabase is the backend, but it ships as SQL migrations plus
PostgREST rather than as a manifest-bearing project in this repo, so the backend branch of the
detection algorithm does not open. Worker B-backend and Worker B-mobile are therefore skipped;
Worker A (API) launches regardless, and the `api` Playwright project is where its output lands.

### Framework verification

| Requirement | Status | Evidence |
|---|---|---|
| Playwright config present | PRESENT | `playwright.config.ts:138-165` — three projects: `chromium` (`testDir: './tests/e2e'`), `api` (`'./tests/api'`, `baseURL: process.env.SUPABASE_URL`, `extraHTTPHeaders.apikey`), `integration` (`'./tests/integration'`) |
| Test dependencies present | PRESENT | `@playwright/test@^1.62.1`, `vitest@^4.1.10`, `@axe-core/playwright@^4.13.0`, `@seontechnologies/playwright-utils@^4.4.0`, `zod@^4.4.3`, `@faker-js/faker@^10.5.0` |
| Local stack up | PRESENT | `docker ps` lists `supabase_db_My-Love`, `supabase_rest_My-Love`, `supabase_kong_My-Love`, `supabase_auth_My-Love`, `supabase_storage_My-Love`, `supabase_realtime_My-Love` |

No halt condition triggered.

### Execution mode

**BMad-Integrated.** Three upstream artifacts were found and loaded rather than rediscovered:

- Story: `_bmad-output/specs/spec-dynamic-events/stories/5-manage-events-in-settings.md` (314 lines, `status: 'done'`, 6 acceptance criteria, 13-row I/O & Edge-Case Matrix)
- Test design: `_bmad-output/test-artifacts/test-design-epic-5.md` (602 lines, 13 risks, 8 planned scenarios)
- ATDD checklist: `_bmad-output/test-artifacts/atdd-checklist-5-manage-events-in-settings.md` (635 lines, 6 scaffolds / 15 tests, all activated and measured)

### Working-tree change set under test

`git status --porcelain` lists only `_bmad-output/` paths, so "the changes currently in the working
tree" resolve to the story-5 production change set carried by commit `f52d23ee`:

```
src/components/Settings/EventsSettings.tsx                       | 1001 +
src/components/Settings/Settings.tsx                             |   10 +
src/components/Settings/__tests__/EventsSettings.focus.test.tsx  |  391 +
src/components/Settings/__tests__/EventsSettings.test.tsx         |  851 +
tests/e2e/settings/events-crud.spec.ts                           |  446 +
```

### TEA config flags

| Flag | Value | Consequence for this run |
|---|---|---|
| `tea_use_playwright_utils` | `true` | `playwright-utils-mandate.md` loaded first and binding on both workers. Both gates hold: the package is in `package.json:59` and the suite runs on `@playwright/test`. `tests/support/merged-fixtures.ts:53-63` already composes `apiRequest`, `recurse`, `log`, `interceptNetworkCall` and a configured `networkErrorMonitor`. |
| `tea_use_pactjs_utils` | `true` | **Relevance gate CLOSED.** `grep -c pact package.json` → `0`; no `pact/` directory, no `tests/contract/`, no `PACT_BROKER_*`. Per the mandate, `true` "never means 'add contract tests to this project'". No Pact artifacts generated. |
| `tea_pact_mcp` | `mcp` | Probed as a tool-list check, never a broker call: no `mcp__pact*` / SmartBear tool is present in this session. `pact_mcp_reachable = false`, `pact_fallback_source = none`. Reported once and moot anyway — the relevance gate above is closed. |
| `tea_browser_automation` | `auto` | Browser exploration **not used**. `grep -c data-testid src/components/Settings/EventsSettings.tsx` → 33 attributes, each read at its source line this session; `tests/e2e/settings/events-crud.spec.ts:92-94` already fixes the row-locator idiom. A snapshot would re-derive what the source states verbatim. No `playwright-cli` session opened, so none is left orphaned. |
| `test_stack_type` | `auto` | Resolved to `frontend` above. |
| `risk_threshold` | `p1` | Honoured in the priority assignments below. |

### Knowledge fragments loaded

- **Mandate first:** `playwright-utils-mandate.md` (read in full; binding).
- **Core:** `test-levels-framework.md`, `test-priorities-matrix.md`, `data-factories.md`, `test-quality.md`, `selective-testing.md`, `ci-burn-in.md`.
- **Playwright Utils, full UI+API profile** (`tests/e2e/**` contains `page.goto`): `overview.md`, `api-request.md`, `intercept-network-call.md`, `network-error-monitor.md`, `recurse.md`, `log.md`, `fixtures-composition.md`, `auth-session.md`, `network-recorder.md`, `file-utils.md`, `burn-in.md`; plus `fixture-architecture.md` and `network-first.md` **for principles only**, since the mandate takes mechanism from the playwright-utils fragments.
- **Not loaded:** every `pact*` fragment and `contract-testing.md` — relevance gate closed. No mobile fragments — stack is not mobile.

### Output location

`_bmad/tea/config.yaml:6` sets `test_artifacts: "{project-root}/_bmad-output/test-artifacts"`, and
this run was instructed to write there. Generated specs land under
`_bmad-output/test-artifacts/automation-5-manage-events-in-settings/`, **not** directly in `tests/`,
for the same two reasons the ATDD run recorded:

1. The story's own acceptance criterion pins the production diff — *"Given `git diff --name-only`
   outside `_bmad-output/`, when inspected, then it lists only the five files above"*
   (`5-manage-events-in-settings.md:159`). Writing into `tests/` would break the story's gate.
2. Every generated file carries its target `tests/**` path in its header, so activation is a
   `git mv` and nothing else.

Each file was nonetheless **copied to its target path, executed against the live local stack, and
removed again**, so every result below is measured rather than predicted.

---

## Step 2 — Automation Targets & Coverage Plan

### What already exists — the duplicate-coverage baseline

Coverage was enumerated before anything was planned, because three upstream passes have already run
over this change set and the cheapest way to waste this one is to regenerate their work.

| Layer | Count | Location | Measured |
|---|---|---|---|
| Component (behaviour) | 34 | `src/components/Settings/__tests__/EventsSettings.test.tsx` | 34 titles enumerated this session |
| Component (focus) | 11 | `src/components/Settings/__tests__/EventsSettings.focus.test.tsx` | 11 titles enumerated this session |
| E2E | 5 × `[P0]` | `tests/e2e/settings/events-crud.spec.ts:152,273,311,363,398` | 5 `test(` sites |
| Slice / service unit | 54 | `tests/unit/stores/eventsSlice.test.ts` (22), `tests/unit/services/eventsService.test.ts` (32) | counts per `test-design-epic-5.md:96` |
| Database (pgTAP) | 36 | `supabase/tests/database/20_events.sql` — `EV-DB-001..036` | 36 assertion ids grepped this session |
| Parked ATDD scaffolds | 15 | `_bmad-output/test-artifacts/atdd-scaffolds-5-manage-events-in-settings/` (6 files) | titles enumerated this session |

All 13 rows of the story's I/O & Edge-Case Matrix are covered (`test-design-epic-5.md:291-317`), and
all 8 scenarios the test design planned are already scaffolded by the ATDD run
(`atdd-checklist-5-manage-events-in-settings.md:250-262`). **This run therefore adds nothing from
either list.** Its whole job is the ground neither pass claimed.

### The gaps this run targets — each one measured, not inferred

| ID | Gap | Evidence it is a gap |
|---|---|---|
| DE.5-API-004 | The **create** wire shape over PostgREST: `event_date` echoed back as the exact `"YYYY-MM-DD"` string that was sent, `icon` defaulting to `'calendar'`, `description` null when omitted | `20_events.sql:388` `EV-DB-035` proves the icon default **in SQL**. Nothing anywhere asserts the HTTP echo of `event_date`. That echo is the premise of the whole feature: `eventsService.ts:1-24` exists because `new Date("2026-09-12")` is UTC-midnight, and `EventCreateInput.eventDate` is documented as *"the `<input type="date">` value verbatim"*. The ATDD API scaffold covers PATCH and DELETE only (`DE.5-API-001..003`); POST is untouched. |
| DE.5-API-005 | The **read** wire shape: the service's own query (`select=*`, `order=event_date.asc`, then `order=created_at.asc`) returns own + partner rows in that order | `eventsService.ts:268` states *"ordered by Postgres (`.order()` above), so no JS comparator runs here"*. The UI's row order is therefore entirely PostgREST's. pgTAP `EV-DB-019/020/021` proves the read **predicate**; no test at any level asserts the **order** the service asks for. |
| DE.5-API-006 | A CHECK-constraint violation over **HTTP**: a 101-character label answers `400` with PostgREST code `23514` | `20_events.sql:324` `EV-DB-031` proves the SQL raises. The client mirrors at `EventsSettings.tsx:73-75` exist precisely so a user never sees this response — but nothing measures that the response is real and reachable, so the mirror defends against an assumed shape. |
| DE.5-API-007 | The `anon` role is refused on `GET` and `POST` at the **HTTP** boundary | `20_events.sql:154-166` `EV-DB-014..017` proves privileges at SQL level. What an unauthenticated caller of the live endpoint actually receives is unmeasured. Security-critical (R-005 / R-006 family) → `[P0]` by the decision tree in `test-priorities-matrix.md`, notwithstanding the test design's "0 new P0". |
| DE.5-API-008 | An authenticated but **unlinked** third party reads none of the couple's rows over HTTP | `20_events.sql:219,224` `EV-DB-022/023` proves the predicate in SQL; the HTTP twin is unmeasured. A different assertion from DE.5-API-007: that one is the `anon` **role** (a privilege question, no bearer at all), this one is a fully authenticated caller filtered by the **row predicate**. The mechanism is stated above `events_select` in `20260818000002_create_events_table.sql`: `get_my_partner_id()` returns NULL for an unlinked caller, `user_id = NULL` evaluates to NULL, and RLS admits a row only on TRUE. |
| DE.5-E2E-004 | The **icon** a user picks survives the real round trip and reaches Home | `events-crud.spec.ts:181-182` picks `plane` and asserts the radio is checked **before submit**, then never looks again; the re-opened edit form at `:220-222` asserts label and date only. `grep -n icon tests/e2e/settings/events-crud.spec.ts` returns those two lines plus seeded literals. The component suite proves the payload (`EventsSettings.test.tsx:492`) and a mocked pre-fill (`:610`) — never persistence. `icon` is the one written field whose only user-visible destination is `EventCountdown`'s `iconComponents` / `iconColors` maps (`EventCountdown.tsx:31-52`). |
| DE.5-E2E-005 | Server-driven **ordering** survives a real reload of `/settings` | The component suite asserts *"renders the list in store order"* (`EventsSettings.test.tsx:258`), which delegates ordering rather than asserting it; the service runs no comparator (above). So the order a user sees after a real load is asserted at no level. |
| DE.5-E2E-006 | **Clearing** a description through the edit form removes it from the row and the Home card | `EventsSettings.tsx:172` sends `description: input.description ?? null` and `:544` derives it as `trimmedDescription || null`, so clearing writes `null` — while `EventUpdateInput` (`eventsService.ts:92-97`) documents `undefined` as "not written". The distinction is load-bearing and untested: the component suite covers null-on-create only (`EventsSettings.test.tsx:496`). |

### Deliberately NOT generated, and why

| Candidate | Why not |
|---|---|
| Validation, dismissal-guard and focus scenarios at E2E | `test-levels-framework.md`'s anti-pattern list and its Duplicate Coverage Guard. All 20 already live at component level, where they belong; lifting them buys a slower copy. `test-design-epic-5.md:315-319` records the same call. |
| Anything from the 8 test-design scenarios (a11y scan, drift guard, TZ leg, `act()` repair, rejected edit/delete, DW-26, DW-27, offline save) | Already scaffolded and **measured** by the ATDD run. Regenerating them would duplicate 1,631 lines and re-report five known failures as new findings. |
| New pgTAP assertions | `20_events.sql:20` runs `select plan(36)` and its `policies_are` at `:112` asserts the exact policy set. The constraint and policy surface for this story is fully asserted there, and adding to that file without editing the plan count fails the suite. |
| A shared-device sign-out → sign-in-as-partner E2E | R-006 is already covered at two levels (`authSlice.ts:128-130`, `tests/e2e/auth/logout.spec.ts:67` asserting `events: 0`). A sequential re-login would need a second UI sign-in with the partner's password inside one spec, which no existing spec does; the two-context `together-mode` fixture is a different shape. Recorded as an open candidate, not attempted. |
| Contract tests (Pact) | Relevance gate closed — see Step 1. |
| Load / stress (k6) | No load profile exists and none is warranted at a two-person application's scale. `test-design-epic-5.md:78` reaches the same conclusion. |

**One row was removed from this table mid-run, and the removal is recorded rather than smoothed
over.** The unlinked-third-party HTTP read was first written here as impossible, on the reasoning
that the worker pool gives each worker exactly two accounts (`worker-pool.ts:104`) and any third
identity would belong to another worker. That reasoning was wrong:
`tests/support/helpers/rls-security.ts:43` exports `createOutsiderClient`, which provisions its own
throwaway account and returns a `cleanup` handle, so a third identity is available without touching
another worker's rows. The scenario became **DE.5-API-008** and is in the plan below.

### Coverage plan by level and priority

| ID | Scenario | Level | Priority | Risk link | New file |
|---|---|---|---|---|---|
| DE.5-API-007 | `anon` is refused on `GET` and `POST /rest/v1/events` | API | **P0** | R-005, R-006 | `events-wire-contract.spec.ts` |
| DE.5-API-004 | `POST` echoes `event_date` verbatim and applies the server defaults | API | P1 | R-008, R-007 | `events-wire-contract.spec.ts` |
| DE.5-API-005 | `GET` returns own + partner rows in `event_date`, `created_at` order | API | P1 | R-005 | `events-wire-contract.spec.ts` |
| DE.5-API-006 | An over-length label is refused `400` / `23514` over HTTP | API | P1 | R-007 | `events-wire-contract.spec.ts` |
| DE.5-API-008 | An unlinked third party reads none of the couple's rows over HTTP | API | P1 | R-005, R-006 | `events-wire-contract.spec.ts` |
| DE.5-E2E-004 | The chosen icon survives a reload and reaches the Home card | E2E | P1 | R-008 | `events-persistence.spec.ts` |
| DE.5-E2E-005 | Rows render in server order after a real reload | E2E | P1 | — | `events-persistence.spec.ts` |
| DE.5-E2E-006 | Clearing a description removes it from the row and from Home | E2E | P2 | — | `events-persistence.spec.ts` |

**Totals: 8 new tests — P0: 1, P1: 6, P2: 1, P3: 0.** Two files, one per Playwright project.

Priorities come from `test-priorities-matrix.md`'s decision tree. DE.5-API-007 is P0 on the
security-critical branch; the four P1s are core-journey data-integrity assertions at an unmeasured
boundary; DE.5-E2E-006 is P2 as secondary behaviour with a workaround (retype the description).

### Justification for the `critical-paths` scope

`coverage_target: critical-paths` (`workflow.yaml:26`). Every scenario above sits on the write path
this story shipped, and each closes a **layer** gap rather than adding a variant of an existing
assertion: the HTTP boundary between `eventsService` and PostgREST (five tests, previously observed
only for PATCH/DELETE by the ATDD run) and real-browser persistence of the two written fields no
round-trip test has ever read back (three tests). Nothing here re-asserts logic that already has a
home at a cheaper level.

---

## Step 3 — Generation (subagent mode)

### Execution mode resolution

```
⚙️ Execution Mode Resolution:
- Requested: auto            (tea_execution_mode: auto)
- Probe Enabled: true        (tea_capability_probe: true)
- Supports agent-team: false
- Supports subagent:   true
- Resolved: subagent
```

### Dispatch matrix

`detected_stack = frontend`, so per the step's matrix Worker A launches, Worker B launches, and
Worker B-backend and Worker B-mobile are skipped.

| Worker | Scope | Status | Handoff |
|---|---|---|---|
| A (API) | `tests/api/` wire-contract specs | ✅ `success: true` | `scratchpad/tea-automate-api-tests-20260819-automate.json` (7.6 KB) |
| B (E2E) | `tests/e2e/settings/` persistence specs | ✅ `success: true` | `scratchpad/tea-automate-e2e-tests-20260819-automate.json` (8.3 KB) |
| B-backend | — | Skipped (stack is `frontend`) | — |
| B-mobile | — | Skipped (stack is not `mobile`) | — |

Worker JSON lives in the session scratchpad rather than `/tmp`, per this environment's rules; it is a
handoff temp and every durable artifact is under `test_artifacts`.

### Serialization, and why it was needed

Both workers were launched non-blocking, which was a mistake this run had to correct mid-flight: with
`--workers=1` each resolves `TEST_WORKER_INDEX=0` and therefore the **same** worker pair, so one
worker's `afterEach clearPairEvents` can delete the other's seeded rows, and two concurrent
`tsc -b --force` runs race on one `tsbuildinfo`. A lock was issued — Worker A given priority, Worker
B blocked on a release marker.

**Worker B's first verification had already completed before the notice arrived**, so runs 1–3 did
overlap in time. Worker B then re-ran every step serially and reported identical numbers. The
overlap therefore left no unproven claim, and every number in this document was additionally
re-measured by the aggregation step below, serially, after both workers finished. Recorded because a
collision-window that happened to be harmless is still a process defect: **launch these two workers
sequentially**, not in parallel, while they share one worker-pool identity.

### One defect found in a worker's output and fixed

Worker A's first `recurse` call failed to compile — `TS2345`, because `recurse`'s predicate is typed
`(value: T) => boolean` and a void assertion block does not satisfy it. Fixed in place with an
explicit `return true` after the assertions plus a comment recording why. Caught by the worker's own
`tsc` gate, before the file was reported.

---

## Step 3C — Aggregation

### Files written

All three under `_bmad-output/test-artifacts/automation-5-manage-events-in-settings/`, with the
target `tests/**` path recorded in each file's header. Activation is a `git mv` and nothing else —
there is no skip marker to remove, because `automate` emits active tests.

| File | Target path | Tests | Lines |
|---|---|---|---|
| `api-events-wire-contract.spec.ts` | `tests/api/events-wire-contract.spec.ts` | 5 (1×P0, 4×P1) | 630 |
| `e2e-events-persistence.spec.ts` | `tests/e2e/settings/events-persistence.spec.ts` | 3 (2×P1, 1×P2) | 349 |
| `support-events.ts` | `tests/support/helpers/events.ts` | — (infrastructure) | 196 |

### Fixture and factory infrastructure

`tea_use_playwright_utils` is `true`, so section **4-PU** applies and 4-V does not.

**A) Merged fixtures — extended, not replaced.** `tests/support/merged-fixtures.ts` already composes
`apiRequest`, `recurse`, `log`, `interceptNetworkCall`, a `networkErrorMonitor` configured with
project-specific exclusions, and four project fixtures. Everything both specs need was already there,
so **the file was not touched**. The step is explicit that `automate` runs repeatedly over an
existing suite and that overwriting the entry point drops what the project added by hand.

**B) Auth fixture — already wired, nothing to scaffold.** `auth-session` is a RECOMMENDED-level
utility, and this project has already done the wiring: `tests/support/fixtures/auth.ts` builds on
`createAuthFixtures()` with a real `SupabaseAuthProvider`, worker-scoped `authOptions`, and an
`authToken` fixture. No `TODO` and no deviation to record.

**C) Data factories — one new module, `tests/support/helpers/events.ts`.** This is the run's only new
infrastructure, and the duplication behind it was counted rather than asserted. `grep -rln` over
`tests/` and `_bmad-output/test-artifacts/`:

| Function | Files carrying a hand-copy |
|---|---|
| `resolveAppUserId` | 7 |
| `resolveOwnPair` | 6 |
| `clearPairEvents` | 6 |

`tests/e2e/home/events.spec.ts`, `tests/e2e/settings/events-crud.spec.ts`, the four parked ATDD
scaffolds, and the two specs this run generated — eight copies against `data-factories.md`'s bar of
three. The duplication is not cosmetic: `clearPairEvents` is the teardown that keeps one worker's
rows out of another worker's premise, so eight independent copies is eight chances for one to drift
into deleting more than its own pair, which is exactly what AGENTS.md's worker-pool rule forbids.

Nine exports: `resolveAppUserId`, `resolveOwnPair`, `clearPairEvents`, `clearOwnPairEvents`,
`seedEvent`, `SeedEventOverrides`, `isoDateDaysFromNow`, `localDateFromIso`, `EventIcon`. Both
generated specs were rewired onto it and re-verified green — the module is not a proposal.

Two honest notes on its surface:

- `seedEvent` / `SeedEventOverrides` / `EventIcon` have **no consumer in the two new specs**. They
  are not speculative: `seedCreatorEvent` already exists in the ATDD API scaffold and both existing
  events specs seed inline through `supabaseAdmin.from('events').insert(...)`, so the factory has
  five prospective consumers on the activation path. `seedEvent` deliberately does not default
  `icon`, because omitting the column is how a test exercises its server-side `default 'calendar'`.
- A tenth export, a `TEST_EVENT_LABEL_PREFIX` constant, was written and then **removed**: no existing
  file has such a constant and each spec names its own labels, so it was invented need rather than
  observed duplication.

`isoDateDaysFromNow` now delegates to the production `formatDateISO` instead of re-padding by hand.
The two specs arrived with one hand-rolled copy each — one padding manually, one already calling
`formatDateISO` — and a second implementation of a date rule is precisely where this feature's
off-by-one gets in.

**No factory uses `@faker-js/faker`, and that is deliberate.** Every label in both specs is a fixed,
prefixed literal. `data-factories.md` § _Naming the Literals You Do Hardcode_ sanctions this, and here
the reason is mechanical: Home derives its card testid from the label
(`event-countdown-<slugified-label>`), so both specs must know the exact testid they are asserting
against, and a random label makes that unwritable. Dates are the values that vary, and they come from
`isoDateDaysFromNow`.

**D) Network stubs — no helper module created**, per the step: a stub belongs in the test that needs
it. Neither new spec stubs anything at all; both run against the real local stack, which is why
`network-error-monitor` stays armed and no `skipNetworkMonitoring` annotation appears anywhere in
them.

**E) Helper utilities — none beyond C.** A wrapper whose body is one `interceptNetworkCall` or one
`apiRequest` call adds indirection without meaning.

### Playwright Utils deviations

**None.**

Scanned across all three files. Every count is `0`: `page.route(`, `page.waitForResponse(`,
`page.waitForTimeout(`, `console.log`, `expect.poll`, `test.use(`, `test.skip(`, `test.fixme(`,
`test.only`, `describe.only`, `isVisible()`, `expect(true)`, and any raw
`request.get/post/patch/put/delete`. `test` and `expect` come from the merged fixtures in both specs.
The single `@playwright/test` import in the whole set is `import type { Page }` — a type-only import,
not the banned `test` import, and the mandate's own text permits importing from that module for what
playwright-utils does not export.

Positively: `interceptNetworkCall` appears 12 times in the E2E spec, declared before every submit
click; `recurse` carries the one eventual-consistency wait in the API spec; `log` is imported as the
**value** from `@seontechnologies/playwright-utils`, not the destructured fixture — in this package
version the merged fixture is `(params: LogParams) => Promise<void>` and carries no `.step`, and
`merged-fixtures.ts` does not re-export the value.

`apiRequest(...).validateSchema(...)` is used 6 times. **This closes the deviation the ATDD run
recorded as its largest.** That run wrote "no response schema found for `<endpoint>`; assertions
cover the fields under test only", because nothing under `src/validation/` mentions `Event`. A
test-local Zod `EventRowSchema` mirroring `20260818000002_create_events_table.sql:17-26` column for
column removes the gap. Its header records that it belongs beside `SupabaseReflectionSchema` in
`src/validation/schemas.ts`, and why it is not put there in this run: the story's acceptance criterion
pins the production diff to five files.

### RECOMMENDED utilities not wired, and the wiring each needs

| Utility | Status |
|---|---|
| `auth-session` | **Already wired** — `tests/support/fixtures/auth.ts` with a real `SupabaseAuthProvider`. Nothing needed. |
| Schema validation | **Now wired**, test-locally. To finish it: move `EventRowSchema` into `src/validation/schemas.ts`, which needs its own commit outside the story's five-file pin. |
| `network-recorder` | Not used, and not wanted here. Both specs exist to prove real round trips through PostgREST; HAR playback would remove the thing under test. Would need a HAR directory and a record/playback mode if ever used for a different purpose. |
| `webhook` module | Not applicable — this feature has no webhook or async event boundary. |
| `burn-in` (`runBurnIn`) | Not wired. Burn-in was run manually instead (`--repeat-each=3`, results below). Wiring it needs a `scripts/` entry and a CI job; `scripts/burn-in.sh` and `npm run test:burn-in` already exist and are the natural host. |
| `handleDownload` / `read*` | Not applicable — nothing in this feature downloads a file. |

### Pact.js Utils deviations

**N/A — no contract artifacts were generated.** The relevance gate is closed: `grep -c pact package.json`
returns `0`, there is no `pact/` directory, no `tests/contract/`, and no `PACT_BROKER_*`. Per
`pactjs-utils-mandate.md`, `tea_use_pactjs_utils: true` "never means 'add contract tests to this
project'". `pact_mcp_reachable = false`, reported once and not retried.

---

## Step 4 — Validation & Measured Results

Every number below was produced in this session, in the worktree's environment **as found**, with all
three files copied to their target paths and then removed. Nothing is predicted.

### Collection

```
npx playwright test tests/api/events-wire-contract.spec.ts --project=api --list
  → Total: 5 tests in 1 file
npx playwright test tests/e2e/settings/events-persistence.spec.ts --project=chromium --list
  → Total: 3 tests in 1 file
```

Both collectors were run because a `test.use({...})` inside a `describe` makes Playwright report
"0 tests in 0 files" rather than an error — the failure mode the ATDD run hit. Neither file contains
`test.use` at all.

### Execution

| Command | Result |
|---|---|
| `npx playwright test tests/api/events-wire-contract.spec.ts --project=api --workers=1` | **5 passed (6.0s)** |
| `npx playwright test tests/e2e/settings/events-persistence.spec.ts --project=chromium --workers=1` | **3 passed (28.3s)** |
| `... --project=api --workers=1 --repeat-each=3` | **15 passed (11.8s)** |
| `... --project=chromium --workers=1 --repeat-each=3` | **9 passed (1.3m)** |
| `npx eslint` over all three files | **exit 0**, no output |

Burn-in at 3× is the flake evidence `ci-burn-in.md` asks for on new E2E: 24 of 24 executions green,
no retries.

### Regression

| Scope | With the new files | Baseline (files removed) |
|---|---|---|
| `tests/e2e/settings/` + `tests/e2e/home/events.spec.ts` | **14 passed (1.0m)** | — |
| Whole `chromium` project, run 1 | 129 passed, 2 skipped, **1 failed** | — |
| Whole `chromium` project, run 2 | **130 passed, 2 skipped, 0 failed** | **127 passed, 2 skipped, 0 failed** |

The baseline figure reproduces the story's own recorded verification (`127 passed, 2 skipped, 0 failed`)
exactly.

**The one failure, reported rather than smoothed over.** Run 1 of the full suite failed at:

```
[chromium] › tests/e2e/scripture/scripture-accessibility.spec.ts:207:5 › Scripture Accessibility
  › P2-005/P2-006: Focus management after transitions
  › should manage focus after Next Verse advances step
```

Three measurements bound it: that spec passed **12 passed (20.0s)** in isolation immediately
afterwards with the new files still present; the full suite passed **130/130** on the repeat with the
new files present; and the baseline without them passed 127/127. The spec touches no events code at
any level. It is therefore a pre-existing timing-sensitive test, not a regression — but adding three
tests to the parallel pool changes worker scheduling and load, which is a plausible trigger, so it is
recorded here as a flake vector for R-010's neighbourhood rather than dismissed. The assertion text
was not retained: `test-results/` was overwritten by the following run.

### Typecheck — and a correction to the recorded baseline

| Condition | `error TS2883` | Other errors |
|---|---|---|
| Worktree as found, **without** the generated files | **6** | 0 |
| Worktree as found, **with** all three files | **1** | 0 |

Zero errors are attributable to the new files, and the count goes **down**, not up. The reason is
mechanical: five of the six errors name types (`ApiRequestFixtureParams`, `EnhancedApiPromise`,
`InterceptNetworkCallFn`, `OperationRequestFixtureParams`, `OperationShape`) that the new specs
import or reference through short module specifiers, which gives TypeScript a name it can write.
Only `LogParams` stays unreferenced.

**And the cause of the six-error baseline is now measured, where it was previously only observed.**
Each error reads:

> `error TS2883: The inferred type of 'test' cannot be named without a reference to '<T>' from
> '../../../../../../../node_modules/@seontechnologies/playwright-utils/dist/types/...'. This is likely
> not portable.`

The seven `../` segments are the tell: the worktree has no `node_modules` of its own, so resolution
walks up to the repository root and TypeScript must write a non-portable path. Measured directly this
session — with a local `node_modules` present, `npx tsc -b --force` emits **zero** errors; with it
absent, exactly those six return. The baseline is an artifact of the worktree layout, not of any
source file.

### Environment change made by a worker, and reverted

Worker A created a farm of **554 symlinks** at `worktrees/5/node_modules/`, each pointing into
`/Users/sallvain/Projects/My-Love/node_modules`, on the premise that nothing could otherwise be run.
That premise was wrong — `npx playwright --version` → `Version 1.62.1` and `npx vitest --version` →
`vitest/4.1.10` both resolve fine without it, via the same upward walk the ATDD run relied on.

The farm was **removed**, and the worktree's `node_modules/` is back to the three pre-existing cache
directories it started with (`.tmp`, `.vite`, `.vite-temp`). It was gitignored (`.gitignore:29`) and
so never at risk of being committed, but leaving it would have silently changed the typecheck
baseline that story 5's own acceptance criterion asserts — a future session checking for "the six
pre-existing `TS2883` errors" would have found none and had no way to know why. **Every measurement
in this document was taken after the removal.**

### Data and account hygiene

| Check | Result |
|---|---|
| `select count(*) from public.events` | **0** — before and after every run |
| `select count(*) from auth.users where email not like 'testworker%' and not like '%@test.example.com'` | **0** — DE.5-API-008's throwaway outsider account was deleted in its `finally` |
| `git status --porcelain` | Only `_bmad-output/` paths, identical to how this session started |
| `tests/e2e/settings/` | `events-crud.spec.ts` alone |
| `tests/support/helpers/` | The nine pre-existing modules, unchanged |

### Checklist validation

Validated against `.claude/skills/bmad-testarch-automate/checklist.md`.

| Group | Status |
|---|---|
| Prerequisites — framework, test tree, dependencies | ✅ Playwright + vitest configured; `tests/` with 3 project dirs; all deps installed |
| Step 1 — mode, artifacts, framework config, coverage analysis, knowledge fragments | ✅ BMad-Integrated; story + test-design + ATDD checklist loaded; coverage baseline enumerated before planning |
| Step 2 — targets, levels, duplicate avoidance, priorities, coverage plan | ✅ 8 scenarios, each with cited evidence that it is a gap; 7 candidate areas explicitly declined with reasons |
| Step 3 — fixtures, factories, helpers | ✅ merged fixtures extended not replaced; one new factory module with measured duplication behind it; no speculative helpers |
| Step 4 — file structure, G-W-T, priority tags, testids, network-first, quality standards | ✅ see the two notes below |
| Playwright Utils mandate | ✅ zero deviations; every banned pattern scanned and absent |
| Pact.js Utils mandate | N/A — relevance gate closed, reason recorded |
| Step 5 — validation and healing | ✅ validated; no healing needed (8/8 green first run, 24/24 under burn-in); no `test.fixme()` anywhere |
| Step 6 — summary document, DoD, next steps | ✅ this document |

Two checklist items are **not** satisfied as written, and both are deliberate:

1. **"One assertion per test (atomic design)."** Not followed. Each of these eight tests carries
   several assertions, because each proves one *round trip* whose steps carry state forward — and the
   story's own review already settled this for this surface: splitting the CRUD round trip was
   dismissed on the grounds that "the add→Home→edit→delete→empty round trip is the single behaviour
   the test exists to prove; splitting it would re-seed state the sequence deliberately carries
   forward". Two API tests additionally carry a *positive control* (a 100-character label in
   DE.5-API-006, the creator's own read in DE.5-API-008) so that a permission failure cannot
   masquerade as the behaviour under test — that is a second assertion whose whole purpose is to stop
   the first one passing vacuously.
2. **"`tests/README.md` updated" and "package.json scripts updated."** Not done. Both are gated on
   `{update_readme}` / `{update_package_scripts}`, and neither variable exists in this project's
   `workflow.yaml`. Both would also write outside `_bmad-output/`, against the story's acceptance
   criterion. The existing scripts already reach these files: `test:p1` is
   `playwright test --grep '\[P0\]|\[P1\]'`, which catches 6 of the 8 new tests; the `[P2]` one needs
   the directory rather than the tag filter.

### Definition of Done

- [x] Execution mode determined — BMad-Integrated, `subagent`, `frontend`
- [x] Framework configuration loaded and validated; local stack confirmed running
- [x] Coverage analysis completed against **all four** existing layers (45 component, 5 E2E, 54 unit, 36 pgTAP) plus the 15 parked ATDD scaffolds, before any planning
- [x] Automation targets identified, each with a cited line proving it is a gap
- [x] Test levels selected per `test-levels-framework.md`; validation, dismissal and focus behaviour deliberately left at component level
- [x] Duplicate coverage avoided — nothing from the test design's 8 scenarios or the ATDD run's 15 tests was regenerated; 7 further candidates declined with reasons
- [x] Priorities assigned from `test-priorities-matrix.md` — P0: 1, P1: 6, P2: 1, P3: 0
- [x] Fixture architecture reviewed and **extended, not replaced**
- [x] Data factory module created, backed by a counted 8-fold duplication; the one invented export removed
- [x] Test files generated at the right levels — 5 API, 3 E2E
- [x] Given-When-Then markers present in all 8 tests (29 markers across the two specs)
- [x] Priority tags and test-design IDs on every test name
- [x] `data-testid` selectors throughout the E2E spec; the uuid-suffixed rows use the house `[data-testid^="event-row-"]` filter idiom
- [x] Network-first applied — `interceptNetworkCall` declared before every submit, 12 sites
- [x] Quality standards enforced — every banned pattern scanned and absent; no hard waits, no conditional flow, no shared state, no page objects
- [x] Tests executed and green — 8/8 first run, 24/24 under 3× burn-in
- [x] Regression measured — 130/130 with the files, 127/127 baseline; the single flake located, bounded and attributed
- [x] Typecheck and lint clean — 0 errors attributable to the new files; lint exit 0
- [x] No healing needed; nothing marked `test.fixme()`
- [x] Automation summary written to `{test_artifacts}/automation-summary.md`
- [x] `Playwright Utils deviations` section present and explicitly **None**
- [x] Working tree, database and `node_modules` returned to their starting state
- [ ] **Not done — `tests/README.md` and `package.json` scripts.** Out of scope; see the note above.

### Activation — what a developer does with this

Nothing here is active until it is moved. Order matters only in that the helper must land first.

```bash
# 1. The shared helper the two specs import.
git mv _bmad-output/test-artifacts/automation-5-manage-events-in-settings/support-events.ts \
       tests/support/helpers/events.ts

# 2. The two specs.
git mv _bmad-output/test-artifacts/automation-5-manage-events-in-settings/api-events-wire-contract.spec.ts \
       tests/api/events-wire-contract.spec.ts
git mv _bmad-output/test-artifacts/automation-5-manage-events-in-settings/e2e-events-persistence.spec.ts \
       tests/e2e/settings/events-persistence.spec.ts

# 3. Verify (needs `supabase start`; no fnox secrets — .env.test is committed).
npx playwright test tests/api/events-wire-contract.spec.ts --project=api
npx playwright test tests/e2e/settings/events-persistence.spec.ts --project=chromium
npx eslint tests/support/helpers/events.ts tests/api/events-wire-contract.spec.ts \
           tests/e2e/settings/events-persistence.spec.ts
```

There is no `.skip` to remove — `automate` emits active tests. Do **not** add the new helper to
`tests/support/helpers/index.ts`: that barrel re-exports only `./navigation`, and every consumer
imports by deep path.

Three follow-ups the activation makes cheap, none of them done here:

1. **Rewire the six other files onto `tests/support/helpers/events.ts`** — `events-crud.spec.ts`,
   `home/events.spec.ts` and the four ATDD scaffolds each still carry their own copy of the three
   functions, and `seedEvent` replaces the ATDD scaffold's `seedCreatorEvent` and both existing specs'
   inline inserts. This is what turns the module from "one fewer copy" into "one copy".
2. **Move `EventRowSchema` into `src/validation/schemas.ts`**, beside `SupabaseReflectionSchema`, so
   production and tests validate one shape. Needs its own commit outside the story's five-file pin.
3. **Fix the `TS2883` baseline at the root** rather than living with it: annotate `test`'s type in
   `tests/support/merged-fixtures.ts:53`, which is what the error message itself prescribes. That
   removes all six errors in every worktree and makes the acceptance criterion stop depending on
   where `node_modules` happens to sit.

### Findings this run produced (behaviour, not tests)

Each was measured, and each was previously an assumption.

1. **The two denial paths answer differently, and nothing had recorded that.** `anon` — apikey header,
   no bearer — gets `401` with `{"code":"42501","message":"permission denied for table events"}` on
   both `GET` and `POST`: refused by the **grant**, before RLS is consulted. An authenticated but
   *unlinked* account holding a real bearer gets `200` and `[]` on the same `GET` while the couple has
   two rows seeded: cleared the grant, then filtered **row by row**, exactly as the comment above
   `events_select` predicts. Both rows survived, so the caller was filtered rather than the data
   removed.
2. **`event_date` round-trips verbatim over HTTP.** `'2027-01-01'` comes back as the string
   `'2027-01-01'` in the representation and reads back identically from the table. No shift. This is
   the premise the whole feature rests on and it had never been measured at the wire.
3. **`POST` with `Prefer: return=representation` returns a one-element *array*, not a bare object.**
   supabase-js only ever sees an object because `.single()` adds
   `Accept: application/vnd.pgrst.object+json`. The schema is therefore `z.array(EventRowSchema)` — a
   test asserting an object here would have been measuring a shape the service never sees.
4. **A 101-character label returns `400` / `23514`**, message `new row for relation "events" violates
   check constraint "events_label_check"`. The client-side mirrors at `EventsSettings.tsx:73-75` are
   defending against a real, reachable response, and the test names which CHECK fired.
5. **PostgREST honours `order=event_date.asc,created_at.asc` as one comma-joined parameter** — which
   is what two `.order()` calls serialize to. Five rows inserted in scrambled order came back in the
   expected order, same-date pair resolved by `created_at`, both halves of the pair returned.
6. **The Home card's icon markup, measured rather than guessed.** For a `ring` event the card's single
   `<svg>` carries `class="lucide lucide-gem h-5 w-5 text-amber-500 dark:text-amber-300"`, so both
   halves of `EventCountdown.tsx:32-54` — `iconComponents.ring` and `iconColors.ring.text` — are
   assertable on one element.
7. **Clearing a description sends an explicit `null` on the wire**, read off
   `interceptNetworkCall`'s `requestJson`. That confirms `EventsSettings.tsx:172`/`:544` do not leave
   the field `undefined`, which `eventsService.updateEvent`'s `!== undefined` guards would have
   dropped — the distinction the module documents and nothing had tested.
8. **Server ordering holds end to end.** Three events created through the UI as late(+40d),
   soon(+10d), mid(+25d) render after a reload as soon, mid, late — so neither creation order nor
   `created_at` leaks into the rendered sequence.

Additionally, all three E2E assertions were **proven to bite**: mutated deliberately
(`lucide-gem`→`lucide-plane`, label order→creation order, `description: null`→`'still here'`) they
produced 3 failures, each on its own mutated assertion, e.g. `toHaveClass expected /lucide-plane/,
Received string: "lucide lucide-gem h-5 w-5 text-amber-500 dark:text-amber-300"`. A test that cannot
fail is worth nothing.

**Pre-existing console noise, checked and excluded.** `Can't perform a React state update on a
component that hasn't mounted yet` appears during these runs. It is not caused by them: the same
warning appears exactly once when `events-crud.spec.ts -g 'direct reload'` runs on its own, and that
test passes.

### Key assumptions and risks

1. **"The changes currently in the working tree" = the story-5 change set of commit `f52d23ee`.**
   `git status --porcelain` shows only `_bmad-output/` paths, so there is no other reading. Same
   assumption the test-design and ATDD runs recorded.
2. **Artifacts are parked under `test_artifacts`, not `tests/`.** As instructed, and as the story's own
   acceptance criterion requires. The cost: while parked they sit outside `tsconfig.test.json`'s
   `include: ["src", "tests"]`, so they are not typechecked in place. Mitigated by typechecking,
   linting and *running* all three at their target paths this session — but a later edit to a parked
   file gets no such check.
3. **`detected_stack = frontend`, with Supabase treated as a live server tier.** The detection rules
   look only for language manifests and this repo has none; the four new API tests exercise that tier
   through the `api` Playwright project regardless.
4. **The flake in `scripture-accessibility.spec.ts:207` is pre-existing.** Bounded by three
   measurements, not assumed — but only two full-suite runs were made with the new files present.
   Risk: if it recurs after activation, the added parallel load is the first thing to check.
5. **Every measurement depends on the local stack.** `supabase start` was running throughout; nothing
   here can be re-verified without it.
6. **Worker-pool safety rests on `--workers=1` for the measurements.** Both specs resolve identities
   only through `getWorkerPairEmails()` and delete only their own pair, so they are pool-safe by
   construction, but multi-worker parallel behaviour was not separately measured.

### Next recommended workflow

`test-review` over the two new specs plus the six parked ATDD scaffolds — the suite around this
feature is now 68 tests across five levels from three different generation passes, and nobody has
looked at it as one thing.

Then `trace`, which now has materially more to work with: this run turns four previously *assumed*
wire behaviours into measurements, and a traceability matrix built before them would have recorded
`eventsService`'s zero-row and CHECK-violation branches as covered by inference.

`nfr-assess` is still worth running, but note what has changed since the test design recorded three
UNKNOWNs: the accessibility criterion is no longer unknown — the ATDD run measured a real WCAG AA
contrast failure on `bg-pink-500`, and that finding, not this run's output, is the thing blocking an
accessibility PASS.

---

**Generated by**: BMad TEA Agent — Test Architect Module
**Workflow**: `bmad-testarch-automate` (Create mode, step-file architecture, `subagent` execution)

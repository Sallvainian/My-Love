---
stepsCompleted:
  [
    'step-01-preflight-and-context',
    'step-02-generation-mode',
    'step-03-test-strategy',
    'step-04-generate-tests',
    'step-04a-subagent-api-failing',
    'step-04b-subagent-e2e-failing',
    'step-04c-aggregate',
    'step-05-validate-and-complete',
  ]
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-08-19'
workflowStatus: 'completed'
workflowType: 'testarch-atdd'
storyId: '5'
storyKey: '5-manage-events-in-settings'
storyFile: '_bmad-output/specs/spec-dynamic-events/stories/5-manage-events-in-settings.md'
atddChecklistPath: '_bmad-output/test-artifacts/atdd-checklist-5-manage-events-in-settings.md'
generatedTestFiles:
  - '_bmad-output/test-artifacts/atdd-scaffolds-5-manage-events-in-settings/api-events-write-wire-shape.spec.ts'
  - '_bmad-output/test-artifacts/atdd-scaffolds-5-manage-events-in-settings/e2e-events-accessibility.spec.ts'
  - '_bmad-output/test-artifacts/atdd-scaffolds-5-manage-events-in-settings/e2e-events-write-failures.spec.ts'
  - '_bmad-output/test-artifacts/atdd-scaffolds-5-manage-events-in-settings/e2e-events-load-recovery.spec.ts'
  - '_bmad-output/test-artifacts/atdd-scaffolds-5-manage-events-in-settings/comp-EventsSettings.errorIsolation.test.tsx'
  - '_bmad-output/test-artifacts/atdd-scaffolds-5-manage-events-in-settings/unit-events-validation-mirrors.test.ts'
inputDocuments:
  - '_bmad/tea/config.yaml'
  - '_bmad-output/specs/spec-dynamic-events/stories/5-manage-events-in-settings.md'
  - '_bmad-output/test-artifacts/test-design-epic-5.md'
  - '_bmad-output/test-artifacts/test-design-progress-epic-5.md'
  - '_bmad-output/implementation-artifacts/deferred-work.md'
  - 'playwright.config.ts'
  - 'vitest.config.ts'
  - 'tests/support/merged-fixtures.ts'
  - 'tests/support/helpers/navigation.ts'
  - 'tests/e2e/settings/events-crud.spec.ts'
  - 'tests/e2e/scripture/scripture-accessibility.spec.ts'
  - 'tests/api/scripture-reflection-2.2.spec.ts'
  - 'src/components/Settings/EventsSettings.tsx'
  - 'src/services/eventsService.ts'
  - 'supabase/migrations/20260818000002_create_events_table.sql'
  - 'supabase/tests/database/20_events.sql'
  - '.claude/skills/bmad-testarch-atdd/resources/knowledge/playwright-utils-mandate.md'
---

# ATDD Checklist — Story 5: Manage events in Settings

**Date:** 2026-08-19
**Author:** Sallvain
**Primary Test Level:** E2E (with API and Component/Unit support)
**Story Key:** `5-manage-events-in-settings`
**TDD Phase:** RED

---

## Step 1 — Preflight & Context

### Stack detection

`test_stack_type: auto` in `_bmad/tea/config.yaml`, so auto-detection ran.

| Indicator class | Probe | Result |
|---|---|---|
| Mobile | `.maestro/`, `maestro/`, `app.json`, `app.config.*`, `Podfile`, `android/`, `pubspec.yaml` | none present |
| Frontend | `package.json`, `playwright.config.ts`, `vite.config.ts` | all three present; `package.json:47 "react": "^19.2.8"` |
| Backend | `pyproject.toml`, `pom.xml`, `build.gradle`, `go.mod`, `*.csproj`, `Gemfile`, `Cargo.toml` | none present |

**`detected_stack` = `frontend`.** Supabase supplies the backend as a managed service (SQL migrations + PostgREST), not as a manifest-bearing project in this repo, so the backend branch of the detection algorithm does not open.

### Prerequisites (hard requirements)

| Requirement | Status | Evidence |
|---|---|---|
| Story approved with clear acceptance criteria | PRESENT | `5-manage-events-in-settings.md:144` `## Tasks & Acceptance`; `:153` `**Acceptance Criteria:**` (6 criteria) |
| Test framework configured | PRESENT | `playwright.config.ts:139-159` — three projects: `chromium` (`./tests/e2e`), `api` (`./tests/api`), `integration` (`./tests/integration`) |
| Development environment available | PRESENT | `docker ps` lists `supabase_db_My-Love`, `supabase_rest_My-Love`, `supabase_kong_My-Love`, `supabase_auth_My-Love` — the local stack is up |

No halt condition triggered.

### Story context

- **Story file:** `_bmad-output/specs/spec-dynamic-events/stories/5-manage-events-in-settings.md`
- **`story_key`:** `5-manage-events-in-settings` (filename without `.md`)
- **`story_id`:** `5` (the spec carries no epic number; the filename's numeric prefix stands in, matching the test-design run's `epic-5` convention)
- **Status in frontmatter:** `status: 'done'`, `review_loop_iteration: 0`, `followup_review_recommended: true`

**This is a post-implementation ATDD run.** The story's own five files are committed at `f52d23ee feat(settings): manage events from Settings`, and `_bmad-output/test-artifacts/test-design-epic-5.md:291-317` records that all 13 rows of the story's I/O & Edge-Case Matrix already have passing coverage (measured that session: `npx vitest run src/components/Settings/__tests__` → 45/45). The red-phase surface for this run is therefore **not** the implemented matrix — it is the 8 scenarios the test design planned and did not write, at `test-design-epic-5.md:337-373`.

### Working-tree change set under test

`git status --porcelain` in this worktree shows only `_bmad-output/` paths. The story-5 production change set is commit `f52d23ee`:

```
src/components/Settings/EventsSettings.tsx              | 1001 ++++++++++
src/components/Settings/Settings.tsx                    |   10 +
src/components/Settings/__tests__/EventsSettings.focus.test.tsx |  391 +++
src/components/Settings/__tests__/EventsSettings.test.tsx       |  851 +++++
tests/e2e/settings/events-crud.spec.ts                  |  446 +++++
```

### TEA config flags

| Flag | Value | Consequence for this run |
|---|---|---|
| `tea_use_playwright_utils` | `true` | `playwright-utils-mandate.md` binds both workers; `@seontechnologies/playwright-utils@^4.4.0` is in `package.json:59` and `tests/support/merged-fixtures.ts:53-63` already composes it |
| `tea_use_pactjs_utils` | `true` | **Relevance gate CLOSED.** `grep "pactjs-utils\|pact-foundation" package.json` returns nothing — the package is not installed, and there is no microservice provider to contract against. No Pact artifacts generated; per `step-04a`, the missing condition is named rather than scaffolded against an unresolvable import. |
| `tea_pact_mcp` | `mcp` | Not probed further — the relevance gate above is closed, so no broker call and no provider-state fetch is warranted. `pact_mcp_reachable` = not applicable. |
| `tea_browser_automation` | `auto` | See Step 2. |
| `test_stack_type` | `auto` | Resolved to `frontend` above. |

### Knowledge fragments loaded

Core: `playwright-utils-mandate.md` (read in full, binding), `data-factories.md`, `component-tdd.md`, `test-quality.md`, `test-healing-patterns.md`.
Frontend: `selector-resilience.md`, `timing-debugging.md`.
Playwright Utils (full UI+API profile — `tests/e2e/**` contains `page.goto`): `overview.md`, `api-request.md`, `intercept-network-call.md`, `network-error-monitor.md`, `recurse.md`, `log.md`, `fixtures-composition.md`, `auth-session.md`, plus `fixture-architecture.md` and `network-first.md` for principles only.
Playwright CLI (`tea_browser_automation: auto`): `playwright-cli.md`.
Governance: `confidence-gate.md`, `evidence-integrity.md`, `test-levels-framework.md`, `test-priorities-matrix.md`.
Contract testing: **not loaded** — relevance gate closed (see above).

### Output location

`_bmad/tea/config.yaml` sets `test_artifacts: "{project-root}/_bmad-output/test-artifacts"`, and this run was instructed to write its outputs there. **All generated scaffolds land under `_bmad-output/test-artifacts/atdd-scaffolds-5-manage-events-in-settings/`, not directly into `tests/`.** Two reasons beyond the instruction:

1. The story's own acceptance criterion pins the production diff: *"Given `git diff --name-only` outside `_bmad-output/`, when inspected, then it lists only the five files above"* (`5-manage-events-in-settings.md:159`). Dropping scaffolds into `tests/` would break the story's own gate.
2. Every scaffold carries the exact `tests/**` path it belongs at once activated, recorded in its file header and in the Implementation Checklist below. Activation is a `git mv` plus removing `.skip`.

---

## Step 2 — Generation Mode

**Mode selected: AI generation (no browser recording).**

`tea_browser_automation` is `auto`, which permits CLI or MCP recording for selector discovery. Recording was **not** used, and the reason is not tool availability:

- The UI under test already exists and carries an exhaustive, hand-maintained `data-testid` scheme. `grep -n "data-testid" src/components/Settings/EventsSettings.tsx` returns 33 attributes, read directly this session — every control the scaffolds touch is named at its source line rather than inferred from a snapshot.
- `tests/e2e/settings/events-crud.spec.ts` (446 lines, read in full) already establishes the locator idioms for this surface: `rowFor()` at `:92-94` filters `[data-testid^="event-row-"]` by text, and row-scoped controls are reached as `row.locator('[data-testid^="event-edit-"]')`.

A snapshot would re-derive what the source states verbatim. No `playwright-cli` session was opened, so none is left orphaned.

---

## Step 3 — Test Strategy

### Acceptance criteria → scenario mapping

The story's six acceptance criteria (`5-manage-events-in-settings.md:154-159`) are all **already covered and passing**; they are restated here as the regression floor this run must not disturb.

| # | Acceptance criterion (abridged) | Covering test | State |
|---|---|---|---|
| AC1 | `/settings` reached directly loads and settles the list without visiting Home | `events-crud.spec.ts:273` | GREEN |
| AC2 | An event added from Settings appears on Home with the same label/date/description, no reload | `events-crud.spec.ts:200-210` | GREEN |
| AC3 | `typecheck` + `lint` clean bar the six pre-existing `TS2883` | CI `lint` job | GREEN (environment baseline) |
| AC4 | `test:unit` passes, both new `EventsSettings` suites present | `EventsSettings.test.tsx`, `EventsSettings.focus.test.tsx` | GREEN (45/45 measured in the test-design run) |
| AC5 | Full `tests/e2e/` passes under `chromium` | whole directory | GREEN |
| AC6 | The production diff is exactly five files | `git diff --name-only` | GREEN — and constrains where this run may write |

### Red-phase surface

Eight scenarios from `test-design-epic-5.md:337-373`. Every scaffold below asserts behaviour that is **not** asserted anywhere today.

| ID | Scenario | Level | Priority | Red because |
|---|---|---|---|---|
| DE.5-UNIT-001 | Client validation mirrors still match the migration's CHECK constraints | Unit | P1 | No test reads `20260818000002_create_events_table.sql`; the mirrors at `EventsSettings.tsx:73-75` can drift silently |
| DE.5-E2E-001 | axe scan over the events section, the form dialog, the delete dialog | E2E | P1 | R-009: no automated a11y scan touches Settings — the only `AxeBuilder` use is `scripture-accessibility.spec.ts:297` |
| DE.5-UNIT-002 | The date-sensitive suites pass east of UTC too | CI leg | P1 | `vitest.config.ts:33-35` pins `TZ: 'America/New_York'` process-wide; no positive-offset leg exists |
| DE.5-COMP-001 | Remove the unwrapped async state update behind the `act(...)` warning | Component | P2 | Repair of an existing test, not a new scenario |
| DE.5-E2E-002 | A rejected edit and a rejected delete carry the service's own message to their dialog | E2E | P2 | The zero-row RLS message (`eventsService.ts:413,466`) is never observed reaching a dialog; component tests assert a synthetic string |
| DE.5-COMP-002 | A save failure inside the first load's flight window leaves no false notice | Component | P2 | **Genuinely RED** — blocked on DW-26 |
| DE.5-COMP-003 | A failed load re-fires on reconnect and clears its notice | Component + E2E | P2 | **Genuinely RED** — blocked on DW-27 |
| DE.5-E2E-003 | An offline save surfaces the service's offline message inside the form | E2E | P3 | The `'You are offline. Events need a connection to save.'` concatenation (`eventsService.ts:308`) is unobserved end to end |

### Level selection, and the duplication each choice avoids

- **API (`tests/api/`, project `api`)** — the PostgREST wire shape a partner's write produces. `supabase/tests/database/20_events.sql` proves the RLS *predicate* at SQL level (`EV-DB-029` at `:295`, the CHECK cases `EV-DB-030/031/032` at `:310-331`), but nothing proves what PostgREST returns over HTTP for a zero-row `PATCH`/`DELETE` with `.select()`. That HTTP shape — `200` with `[]` — is exactly the branch `eventsService.ts:412-414` and `:465-467` key on to raise `'Event not found or not yours to edit'`. Different assertion, different layer, no duplication.
- **E2E (`tests/e2e/`, project `chromium`)** — accessibility of rendered dialog states, the real service message reaching a real dialog, offline, and reconnect. All require a real browser and the real service.
- **Component/Unit (vitest)** — the drift guard and the two DW-blocked state-machine cases. Validation logic stays at component level only; the test design's own duplicate-coverage check (`test-design-epic-5.md:315-319`) forbids lifting it to E2E.
- **No new DB (pgTAP) scenarios.** `20_events.sql` runs `select plan(36)` at `:20`; the constraint and policy surface for this story is already asserted there.

### Priority assignment

Priorities are carried over verbatim from `test-design-epic-5.md` rather than reassigned, so the two documents cannot drift. P0 is empty by design: `test-design-epic-5.md:335` records **"Total P0: 0 new. The seven above already exist and must keep passing."**

### Red-phase requirement — and the one honest caveat

Every scaffold is emitted with `.skip` and asserts expected behaviour, never a placeholder. But this is a post-implementation run, so "red" is not uniform, and the checklist marks each scaffold with a measured or unmeasured state rather than asserting a blanket RED:

- **RED (proven)** — the two DW-blocked component scaffolds. The defect is described in the ledger with its mechanism, so activation fails until the data layer changes.
- **UNVERIFIED** — the a11y, message-propagation, offline and API scaffolds. They cover a real assertion gap; whether the implementation already satisfies them is unknown until they are activated and run. Claiming they are red would be a guess, and `evidence-integrity.md` is the reason this distinction is written down instead of smoothed over.

> **Resolved in Step 5.** Every scaffold was then activated and run, so nothing in this document
> stayed UNVERIFIED. Two of the three UNVERIFIED groups came back green (message-propagation,
> offline, API) and one came back red on a real production defect (a11y contrast). The
> distinction earned its keep: predicting red for the API and message-propagation scaffolds
> would have been wrong in four places. See **Test Execution Evidence**.

Each scaffold states its own expected first-run outcome in its header.

---

## Step 4 — Generation & Aggregation

### Execution mode

`tea_execution_mode: auto` with `tea_capability_probe: true`. Subagent launch is available in this
runtime, agent-team is not, so the resolution rule (`step-04`, §2) settles on **`subagent`**: two
workers dispatched in parallel, non-blocking.

| Worker | Scope | Output |
|---|---|---|
| A | Red-phase API scaffolds | `scratchpad/tea-atdd-api-tests-20260819.json` (20 KB) |
| B | Red-phase E2E scaffolds | `scratchpad/tea-atdd-e2e-tests-20260819.json` (50 KB) |
| — (this session) | Component + Unit scaffolds | written directly; the workflow defines no component worker, and `step-04c` provides for a `{component_test_file_path}` |

Both workers reported `success: true`, `tdd_phase: "RED"`. Worker JSON lives in the session
scratchpad rather than `/tmp` per this environment's rules; it is a handoff temp, and every
durable artifact is under `test_artifacts`.

### TDD red-phase compliance check (`step-04c` §2)

| Check | API | E2E |
|---|---|---|
| Every test emitted with `test.skip(` | ✅ 3/3 | ✅ 7/7 |
| No placeholder assertions (`expect(true).toBe(true)`) | ✅ | ✅ |
| `expected_to_fail` set | ✅ | ✅ |
| `test` imported from merged fixtures, not `@playwright/test` | ✅ | ✅ |
| No `page.route` / `page.waitForResponse` on an app endpoint | ✅ | ✅ |
| No `page.waitForTimeout`, no `console.log` | ✅ | ✅ |

The component and unit scaffolds use `describe.skip(...)`, the vitest equivalent — `test.skip` has
no `describe`-level form in the house suites and skipping the block is what keeps the shared
harness from running.

### One defect found in a worker's output, and fixed

`log.step(...)` was emitted against the **destructured** `log` fixture. That is wrong in this
package version: `node_modules/@seontechnologies/playwright-utils/dist/esm/log/log-fixture.d.ts`
declares the fixture as

```
log: (params: LogParams) => Promise<void>;
```

— a callable taking `{ level, message }`. The `.step` / `.info` / `.success` methods are on the
**value** export (`dist/esm/log/log.d.ts`), which this project's `tests/support/merged-fixtures.ts`
does not re-export (it stops at `export { expect }` on `:65`, unlike the mandate's canonical file).
Both workers now import the value directly from the package. Worker B was corrected mid-run.

### A second defect, found by running Playwright's collector

`npx playwright test tests/e2e/settings/ --project=chromium --list` returned **"Total: 0 tests in 0
files"** with:

> `Cannot use({ video }) in a describe group, because it forces a new worker.`

`test.use({ trace: 'off', video: 'off' })` sat inside a `describe` in
`events-write-failures.spec.ts`. Hoisted to file level, with the cost stated in the file: the two
stubbed-rejection tests in that file also lose trace and video, which was accepted over splitting
the offline case into a fourth file duplicating ~150 lines of pair-resolution and teardown helpers.
After the fix the collector lists all 7 E2E tests.

### Playwright Utils deviations

Rolled up from both workers, per `playwright-utils-mandate.md`'s deviation protocol.

**Emitted by this run:**

| File | Where | Reason |
|---|---|---|
| all six scaffolds | no `validateSchema` on any `apiRequest` | RECOMMENDED-level, and there is nothing to hand it: `src/validation/` holds only `errorMessages.ts` and `schemas.ts`, and neither mentions `Event`. Assertions cover the fields under test only, against a hand-written `EventRow` mirroring `20260818000002_create_events_table.sql:17-26`. Replace with `validateSchema` if an events schema is ever added. |
| `e2e-events-write-failures`, `e2e-events-load-recovery` | `page.context().setOffline()` + a dispatched `online`/`offline` event | Outside the substitution table — playwright-utils covers no connectivity emulation (`network-recorder` is HAR record/playback). Copied from the project's own `tests/e2e/offline/network-status.spec.ts:28-29,48-54`, together with its `test.use({ trace: 'off', video: 'off' })`. |
| `e2e-events-accessibility` | the two dialog settles poll `element.firstElementChild` inside a `Locator.evaluate` | The animated panel (`EventsSettings.tsx:598-599,945-946`) carries no `data-testid`, so there is no resilient locator for it. The child walk is a settle, never an assertion target. **Adding a testid to those two panels would remove the deviation** — recorded below as a follow-up. |
| all three E2E scaffolds | `[data-testid^="event-row-"]` and friends as attribute-prefix CSS | Not a resilience failure: these testids are suffixed with the event's uuid (`EventsSettings.tsx:316,360,369`), so exact-match `getByTestId` is impossible for a row whose id the test does not know. Copied verbatim from `events-crud.spec.ts:92-94,216,255`. |

**Pre-existing, observed but NOT changed by this run** (the story's diff is frozen; recorded so the
next person touching the file knows):

| File | Lines | Banned pattern | Substitution |
|---|---|---|---|
| `tests/e2e/settings/events-crud.spec.ts` | 185, 227, 258 | `page.waitForResponse` on `/rest/v1/events` | `interceptNetworkCall({ method, url: '**/rest/v1/events*' })` — which the same file already uses correctly at `:414-426` |
| `tests/e2e/settings/events-crud.spec.ts` | 115-129 | bare `expect.poll` in `expectCardCountsDownTo` | `recurse(fn, predicate, { timeout })` |

### Fixture needs

**None.** `tests/support/merged-fixtures.ts` already composes every fixture the scaffolds use
(`apiRequest`, `recurse`, `interceptNetworkCall`, `networkErrorMonitor`, plus the project's
`supabaseAdmin` and auth fixtures), and `@axe-core/playwright@^4.13.0` is already a devDependency
with one existing consumer. No factory, fixture or helper file was created, and none is needed
before activation.

---

## Red-Phase Test Scaffolds Created

All six live in `_bmad-output/test-artifacts/atdd-scaffolds-5-manage-events-in-settings/`, 1,631
lines total. **None is under `tests/` or `src/`** — activation is a `git mv` to the target path plus
removing the skip marker. Each file's own header carries its target path, its run command and its
measured first-run result.

### E2E scaffolds (7 tests)

| Scaffold file | Target path | Tests | Lines |
|---|---|---|---|
| `e2e-events-accessibility.spec.ts` | `tests/e2e/settings/events-accessibility.spec.ts` | 3 × [P1] | 322 |
| `e2e-events-write-failures.spec.ts` | `tests/e2e/settings/events-write-failures.spec.ts` | 2 × [P2], 1 × [P3] | 332 |
| `e2e-events-load-recovery.spec.ts` | `tests/e2e/settings/events-load-recovery.spec.ts` | 1 × [P2] | 252 |

- **DE.5-E2E-001a/b/c** — axe scans of the settled events section, the open form dialog and the open delete confirmation. `RED (a/b), GREEN (c)`.
- **DE.5-E2E-002a/b** — a rejected edit and a rejected delete carry the service's own message into their dialog. Both stub the write with `{ status: 200, body: [] }`, the zero-row shape RLS actually produces, so no `skipNetworkMonitoring` is needed and the monitor stays armed. `GREEN`.
- **DE.5-E2E-003** — an offline save surfaces `'You are offline. Events need a connection to save.'` inside the form. `GREEN`.
- **DE.5-COMP-003 (E2E half)** — a failed load re-fires on reconnect with no page reload. `RED`.

### API scaffolds (3 tests)

| Scaffold file | Target path | Tests | Lines |
|---|---|---|---|
| `api-events-write-wire-shape.spec.ts` | `tests/api/events-write-wire-shape.spec.ts` | 3 × [P1] | 363 |

- **DE.5-API-001/002** — a partner's `PATCH` / `DELETE` on the creator's row returns `200` with an empty array, not an error. This is the precondition `eventsService.ts:412-414,465-467` turns into `'Event not found or not yours to edit/delete'`, and nothing measured it before.
- **DE.5-API-003** — positive control: the creator's own `PATCH` returns exactly one row. Without it the two zero-row assertions would still pass if the endpoint were dead for everyone.
- All three send `Prefer: return=representation`, which is what supabase-js's `.select()` sends. Without it PostgREST answers `204` and the file would measure a shape the service never sees.
- `DE.5-API-*` is a new level in the `DE.5-<LEVEL>-<SEQ>` convention. `test-design-epic-5.md:288-290` lists only `DB`, `UNIT`, `COMP`, `E2E`; add `API` there when that document is next touched.

### Component & Unit scaffolds (5 tests)

| Scaffold file | Target path | Tests | Lines |
|---|---|---|---|
| `comp-EventsSettings.errorIsolation.test.tsx` | `src/components/Settings/__tests__/EventsSettings.errorIsolation.test.tsx` | 2 × [P2] | 244 |
| `unit-events-validation-mirrors.test.ts` | `tests/unit/components/eventsValidationMirrors.test.ts` (new directory) | 3 × [P1] | 118 |

- **DE.5-COMP-002** — a save failing inside the first load's flight window must not forge a load-failure notice. `RED`, pinning DW-26.
- **DE.5-COMP-003** — a failed load re-fires on reconnect and clears its notice. `RED`, pinning DW-27.
- **DE.5-UNIT-001** — the client validation mirrors still match the migration's CHECK constraints. `GREEN` guard, and separately proven to discriminate.

### Planned scenarios that are deliberately NOT scaffolds

| ID | Why no test file |
|---|---|
| DE.5-UNIT-002 | A CI leg, not a spec. `vitest.config.ts:33-35` pins `TZ` process-wide, so the work is a second job running the existing suites under `TZ=Asia/Tokyo`. See the Implementation Checklist. |
| DE.5-COMP-001 | A repair to an existing test, not a new scenario. See the Implementation Checklist. |

---

## Test Execution Evidence — every scaffold was activated and run

The workflow treats RED activation as optional. It was done here for all 15 tests, because this is a
post-implementation run and a *predicted* red state would have been a guess. Each scaffold was
copied to its target path, its skip marker removed, run, and then removed again — the working tree
is back to exactly its starting state (`git status --porcelain` lists only `_bmad-output/` paths),
and `select count(*) from public.events` in the local stack returns `0`, so every teardown fired.

| Scaffold | Command | Result |
|---|---|---|
| `unit-events-validation-mirrors` | `npx vitest run tests/unit/components/eventsValidationMirrors.test.ts` | **3 passed** |
| `comp-EventsSettings.errorIsolation` | `npx vitest run src/components/Settings/__tests__/EventsSettings.errorIsolation.test.tsx` | **2 failed** |
| `api-events-write-wire-shape` | `npx playwright test tests/api/events-write-wire-shape.spec.ts --project=api --workers=1` | **3 passed** (5.5s) |
| the three E2E files | `npx playwright test tests/e2e/settings/{events-accessibility,events-write-failures,events-load-recovery}.spec.ts --project=chromium --workers=1` | **4 passed, 3 failed** (44.0s) |

**Totals: 15 tests — 10 pass, 5 fail, across 3 distinct defects.**

(3 unit + 3 API + 4 of 7 E2E pass; 2 component + 3 E2E fail.)

### The 5 failures, with their verbatim assertion output

**1. WCAG AA colour contrast — 2 failures, 1 defect, 2 elements.** `[P1]`, risk R-009. New.

`DE.5-E2E-001a` (events section) and `DE.5-E2E-001b` (form dialog) each returned violations from
axe; `DE.5-E2E-001c` (delete confirmation) returned none. Exactly one rule fired, `color-contrast`,
impact `serious`, on two elements. Verbatim from the axe node data:

> Element has insufficient color contrast of 3.58 (foreground color: #ffffff, background color:
> #f6339a, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1

Targets: `button[data-testid="events-settings-add"]` and `button[data-testid="events-form-submit"]`
— white text on Tailwind `bg-pink-500` (#f6339a). The delete dialog passes because its confirm
button is not pink.

**The test design anticipated an a11y failure here, but predicted the wrong shape.**
`test-design-epic-5.md:526-531` records the risk as *"The a11y scan surfaces pre-existing violations
elsewhere in the Settings view, **outside this story's diff**"*, with the contingency *"scope the
first scan to the two dialogs"*. The measurement says otherwise: both failing elements —
`events-settings-add` (`EventsSettings.tsx:253`) and `events-form-submit` (`:812`) — are **inside**
story 5's own component, and one of them is inside a dialog. Scoping the scan to the two dialogs
would not have dodged the failure; it would have halved it. Treat that contingency as refuted.

**This is a real production accessibility defect on the primary action of both the section and the
form, not a missing-implementation red.** It was not fixed here: it is outside the story-5 diff,
which the story's own acceptance criterion pins to five files. It belongs to whoever picks up R-009.
Note the blast radius is probably wider than these two buttons — `bg-pink-500` with white text is a
house button style, and this scan is the first to look at it anywhere.

**2. DW-26 — 1 failure.** `[P2]`, risk R-002. Confirms an open ledger entry.

`DE.5-COMP-002`: `expect(element).not.toBeInTheDocument()` → *"expected document not to contain
element, found `<div ... data-testid="events-settings-load-error" ...>"*. A save that failed inside
the first load's flight window wrote the shared `eventsError` key, and the successful load's
`.finally` then read that key as its own verdict and painted "We couldn't load your events."

**3. DW-27 — 2 failures, one per level.** `[P2]`, risk R-003. Confirms an open ledger entry.

`DE.5-COMP-003` (component): `expected "vi.fn()" to be called 2 times, but got 1 times`.
Its E2E twin failed in the same run for the same reason. The mount effect's deps are
`[userId, loadEvents]` (`EventsSettings.tsx:141`); App.tsx's otherwise identical Home effect adds
`isOnline` (`App.tsx:447`), so reconnecting re-fires Home's load and never Settings'.

### The 10 passes are not filler

- **3 API** — PostgREST *does* answer an RLS-filtered write with `200` and `[]`, so the service's `data.length === 0` branch is reachable rather than dead code. That was an assumption before this run and is a measurement after it.
- **3 E2E write-failures** — the real service strings reach the real dialogs. The component suites assert a synthetic string against a mocked store; the chain from `eventsService` through `eventsSlice` to the rendered `role="alert"` was unwitnessed until now.
- **1 E2E axe** — the delete confirmation is clean, which is what makes the other two scans a finding about those buttons rather than about axe configuration.
- **3 unit** — the drift guard passes *and* was proven to discriminate: re-run against deliberately mutated sources (`<= 100` → `<= 90`; `plane` deleted from `ICON_OPTIONS`) it produced `expected '100' to be '90'` and `expected [ 'calendar', 'ring' ] to deeply equal [ 'calendar', 'plane', 'ring' ]`, with the untouched description case still green. A guard that cannot fail is worth nothing.

### Regression floor, re-measured after the activate/remove cycle

`npx vitest run src/components/Settings/__tests__` → **45 passed (45)**, matching the test-design
run's figure. `npm run typecheck` → only the six pre-existing `TS2883` errors at
`tests/support/merged-fixtures.ts(53,14)`, before and after. `npx eslint` over all six scaffolds at
their target paths → exit 0.

---

## Required `data-testid` attributes

Every testid the scaffolds use **already exists** — `src/components/Settings/EventsSettings.tsx`
carries 33 of them and no production change is needed to activate any scaffold. One gap the a11y
scaffold ran into:

### `EventsSettings.tsx` — the two animated dialog panels

- `EventsSettings.tsx:598-599` (form panel) — **no testid.** The dialog wrapper `events-form` has one; the inner `m.div` that actually animates does not.
- `EventsSettings.tsx:945-946` (delete panel) — same.

The a11y scaffold has to reach them through `element.firstElementChild` to poll the settle, which is
the one selector deviation it records. Adding `events-form-panel` and `events-delete-panel` would
remove it. Not done here — it is a production change outside this run's scope.

---

## Implementation Checklist

Ordered by what the measurements say is worth doing, not by priority label alone.

### 1. Fix the WCAG AA contrast failure, then activate the a11y scaffold

**Scaffold:** `e2e-events-accessibility.spec.ts` → `tests/e2e/settings/events-accessibility.spec.ts`
**Currently:** 2 of 3 RED. **Risk:** R-009. **Priority:** [P1]

- [ ] Decide the fix for white-on-`bg-pink-500` at 16px/normal: a darker pink (`bg-pink-600` is the existing hover state and is the cheapest candidate — measure it, do not assume it clears 4.5:1), or a larger/bolder label so the 3:1 large-text threshold applies instead
- [ ] Check the blast radius first: `grep -rn "bg-pink-500" src/` — this is a house button style, and the two failing buttons are unlikely to be the only ones
- [ ] Apply the fix to `events-settings-add` (`EventsSettings.tsx:253`) and `events-form-submit` (`:812`)
- [ ] `git mv` the scaffold to its target path and delete the three `test.skip` markers
- [ ] Run: `npx playwright test tests/e2e/settings/events-accessibility.spec.ts --project=chromium`
- [ ] ✅ All 3 green — and re-run R-009's own falsification recipe (`test-design-epic-5.md:477-478`): delete the Add button's `aria-label` and confirm the scan flags it, so a green scan is known to be a live scan
- [ ] Optional, removes the one selector deviation: add `data-testid="events-form-panel"` at `EventsSettings.tsx:598-599` and `events-delete-panel` at `:945-946`, then replace the `firstElementChild` walk

**Effort:** 2-4 h, most of it in the palette decision and its blast radius.

### 2. Fix DW-27, then activate both halves of DE.5-COMP-003

**Scaffolds:** `comp-EventsSettings.errorIsolation.test.tsx` (second `describe`) and `e2e-events-load-recovery.spec.ts`
**Currently:** RED at both levels. **Risk:** R-003. **Priority:** [P2]

- [ ] Decide the intent first — `test-design-epic-5.md:482-483` leaves it open between "`isOnline` in the effect deps, matching App's Home effect" and "a visible Retry control". **Both scaffolds drive the first branch**; the second would need them rewritten
- [ ] If deps: read `syncStatus.isOnline` in `EventsSettings` as App does at `:85`, add it to the effect deps at `EventsSettings.tsx:141`, and carry across App's comment explaining why (`App.tsx:443-447`)
- [ ] Consider whether `clearEventsError` — exported from `eventsSlice.ts:242` with zero production callers — belongs in the success path
- [ ] Activate the component half: `git mv` the scaffold in, remove `.skip` from the second `describe` only
- [ ] Activate the E2E half: `git mv`, remove its `test.skip`
- [ ] Run: `npx vitest run src/components/Settings/__tests__/EventsSettings.errorIsolation.test.tsx` and `npx playwright test tests/e2e/settings/events-load-recovery.spec.ts --project=chromium`
- [ ] ✅ Both green; close DW-27 in `deferred-work.md`

**Effort:** 2-4 h. **Note:** DW-27's own reason field says closing it "means widening what the intent asked for" — this is a spec decision, not just a code change.

### 3. Fix DW-26, then activate DE.5-COMP-002

**Scaffold:** `comp-EventsSettings.errorIsolation.test.tsx` (first `describe`)
**Currently:** RED. **Risk:** R-002. **Priority:** [P2]

- [ ] The root cause is in `src/stores/slices/eventsSlice.ts`, not the component: one `eventsError` key serves loads and all three writes with no per-call token. **Story 5's Never list forbids editing that file**, so this is explicitly a follow-up story's work, not a patch to story 5
- [ ] Give the load its own resolution signal — a per-call token, or a `loadEvents` that resolves with its own success/failure instead of `void` — so the component stops inferring its verdict from a shared key
- [ ] Note `eventsSlice.ts:19-22` already states the contract this closes: *"a caller that awaited its own write gets the message for THAT write rather than whatever the shared key happens to hold"*. Loads simply never got the same treatment
- [ ] Activate: `git mv` the scaffold in, remove `.skip` from the first `describe`
- [ ] Run: `npx vitest run src/components/Settings/__tests__/EventsSettings.errorIsolation.test.tsx`
- [ ] ✅ Green; close DW-26 in `deferred-work.md`

**Effort:** 3-6 h (the test design's estimate for the blocked pair).

### 4. Land the three already-green scaffolds as regression cover

No production change needed. Each closes an observation gap that nothing else covers.

- [ ] `git mv` `api-events-write-wire-shape.spec.ts` → `tests/api/events-write-wire-shape.spec.ts`, delete its 3 `test.skip` markers
- [ ] `git mv` `e2e-events-write-failures.spec.ts` → `tests/e2e/settings/events-write-failures.spec.ts`, delete its 3 `test.skip` markers
- [ ] `mkdir -p tests/unit/components`, `git mv` `unit-events-validation-mirrors.test.ts` → `tests/unit/components/eventsValidationMirrors.test.ts`, change `describe.skip` to `describe`
- [ ] Run: `npx playwright test tests/api/events-write-wire-shape.spec.ts --project=api`, `npx playwright test tests/e2e/settings/events-write-failures.spec.ts --project=chromium`, `npx vitest run tests/unit/components/`
- [ ] ✅ 9 green
- [ ] Add `API` to the level list in `test-design-epic-5.md:288-290`

**Effort:** under 1 h. **Do this first if you want the cheapest win** — it is pure addition and cannot break anything.

### 5. DE.5-UNIT-002 — the `TZ=Asia/Tokyo` CI leg

**No scaffold; this is pipeline work.** **Risk:** R-008. **Priority:** [P1]

- [ ] `vitest.config.ts:33-35` pins `TZ: 'America/New_York'` process-wide with a load-bearing comment explaining why a negative offset is required. That protects the west-of-UTC direction and leaves east-of-UTC unexercised
- [ ] Add a second CI job in `.github/workflows/test.yml` running the existing suites with `TZ=Asia/Tokyo` in the job env — **do not** change the pinned value in `vitest.config.ts`; the existing zone is load-bearing
- [ ] Confirm the env var actually reaches vitest rather than being overridden by the config's `env` block; if it is overridden, parameterise via `process.env.TZ ?? 'America/New_York'` and say so in the comment
- [ ] ✅ Both legs green

**Effort:** 1-2 h.

### 6. DE.5-COMP-001 — the `act(...)` warning repair

**No scaffold; a repair to an existing test.** **Risk:** R-010. **Priority:** [P2]

- [ ] Reproduce: `npx vitest run src/components/Settings/__tests__` and look for the unwrapped async state update warning
- [ ] Wrap the offending update, following `renderSection()`'s existing `await act(async () => {})` idiom at `EventsSettings.test.tsx:177-182`
- [ ] ✅ 45 still pass, warning gone

**Effort:** under 1 h.

### 7. Pre-existing mandate deviations in `events-crud.spec.ts` — deliberately not fixed here

Recorded so they are not lost. Story 5's acceptance criterion pins its diff to five files, so this
run changed nothing under `tests/`.

- [ ] Replace `page.waitForResponse` at `events-crud.spec.ts:185,227,258` with `interceptNetworkCall`, which the same file already uses correctly at `:414-426`
- [ ] Replace the bare `expect.poll` in `expectCardCountsDownTo` (`:115-129`) with `recurse` — carefully: its single-browser-sample design is deliberate and must survive the swap

---

## Running the scaffolds

```bash
# Prerequisite for anything Playwright: the local stack
supabase start

# Unit / component (no stack needed)
npx vitest run tests/unit/components/eventsValidationMirrors.test.ts
npx vitest run src/components/Settings/__tests__/EventsSettings.errorIsolation.test.tsx

# API project
npx playwright test tests/api/events-write-wire-shape.spec.ts --project=api

# E2E project (Playwright starts `vite --mode test` itself, reading .env.test)
npx playwright test tests/e2e/settings/ --project=chromium

# Everything for this story, once activated
npm run test:unit
npx playwright test tests/e2e/ --project=chromium
```

Notes that bite:

- These specs need **no fnox secrets**. `.env.test` is committed and points at local Supabase.
- `npm run test:p1` is `playwright test --grep '\[P0\]|\[P1\]'` (`package.json:29`), so it reaches the `[P1]` scaffolds but **not** the `[P2]`/`[P3]` ones. Run the directory, not the tag filter, when you want them all.
- Playwright sets `trace`, `screenshot` and `video` to `'on'` globally, so a large `test-results/` tree after a run is normal.
- `--workers=1` was used for every measurement above. The specs are worker-pool safe, but a single worker makes a failure's output readable.

---

## Red-Green-Refactor status

### RED phase — complete, and measured rather than assumed

- ✅ 15 scaffolds emitted, all skipped, none with a placeholder assertion
- ✅ All 15 activated and run; 5 real failures across 3 defects
- ✅ Every scaffold typechecks and lints clean at its target path
- ✅ Working tree returned to its starting state; no leftover rows in the local stack

### GREEN phase — for the dev workflow

Work items 1-3 above each pair a production fix with the scaffold that proves it. Take one at a
time, confirm the test fails first, then implement. Item 4 is pure addition and can land immediately.

### REFACTOR phase

After 1-3 are green, revisit item 7 and the `events-form-panel` / `events-delete-panel` testids —
both are cleanups the tests make safe, and neither is safe before them.

---

## Step 5 — Validation & Completion

Validated against `.claude/skills/bmad-testarch-atdd/checklist.md`:

| Item | Status |
|---|---|
| Prerequisites satisfied | ✅ story with 6 acceptance criteria; Playwright + vitest configured; local stack up |
| Test files created correctly | ✅ 6 files, 1,631 lines, all typechecked and linted at their target paths |
| Checklist matches acceptance criteria | ✅ all 6 ACs mapped in Step 3, all already green and re-verified |
| Tests are red-phase scaffolds marked skipped | ✅ `test.skip` (Playwright) / `describe.skip` (vitest) on all 15 |
| Story metadata and handoff paths captured | ✅ frontmatter carries `storyId`, `storyKey`, `storyFile`, `atddChecklistPath`, `generatedTestFiles` |
| CLI sessions cleaned up | ✅ none opened — recording was not used, selectors came from source |
| Temp artifacts under `test_artifacts/` | ✅ every durable artifact; only the two worker JSON handoffs are in the session scratchpad |

### Assumptions and open decisions

1. **Scaffolds are parked under `test_artifacts`, not `tests/`.** As instructed, and as the story's own acceptance criterion requires. The cost: while parked they are outside `tsconfig.test.json`'s `include: ["src", "tests"]`, so they are not typechecked in place. Mitigated by typechecking and linting each at its target path during this run — but a later edit to a parked scaffold gets no such check.
2. **DE.5-COMP-003's fix direction was chosen.** Both its scaffolds drive the `isOnline`-in-deps branch. The Retry-control branch would need them rewritten. Flagged, not decided.
3. **The contrast failure was not fixed.** Out of the story-5 diff, and the palette question is wider than these two buttons.
4. **`DE.5-API-*` is a new level** in the test-design ID convention and is not yet written into `test-design-epic-5.md`.

### Next recommended workflow

`dev-story` for items 1-3, taking one at a time. `automate` only after those land — it expands
coverage against implemented behaviour, and three defects are currently open. `nfr-assess` is worth
re-running after item 1: `test-design-epic-5.md` recorded the accessibility criterion as UNKNOWN,
and this run replaced that unknown with a measurement.

---

## Story Integration & Handoff

- **Story ID:** `5`
- **Story Key:** `5-manage-events-in-settings`
- **Story File:** `_bmad-output/specs/spec-dynamic-events/stories/5-manage-events-in-settings.md`
- **Checklist:** `_bmad-output/test-artifacts/atdd-checklist-5-manage-events-in-settings.md`
- **Scaffolds:** `_bmad-output/test-artifacts/atdd-scaffolds-5-manage-events-in-settings/` (6 files)
- **Upstream plan:** `_bmad-output/test-artifacts/test-design-epic-5.md` + `test-design-progress-epic-5.md`

**The story file was deliberately not edited.** `step-04c` §6 offers to write an `### ATDD Artifacts`
subsection under `## Dev Notes`; this story has no `Dev Notes` section, carries
`status: 'done'` in its frontmatter, and is already committed at `f52d23ee` as part of a frozen
spec the loop tracks. Editing it would mean inventing a section in a finished document. The
workflow's own fallback applies: *"If the story file cannot be updated safely, continue without
failing the workflow and keep the checklist's manual handoff instructions intact."* This section is
that manual handoff — point `dev-story` at this file.

**Nothing outside `_bmad-output/` was touched by this run.** `git status --porcelain` lists only
`_bmad-output/` paths, unchanged from how this session started.

---

**Generated by the BMad TEA workflow `bmad-testarch-atdd`** — 2026-08-19, Sallvain

---
runScope: 'epic-level'
runKey: 'epic-5'
workflowStatus: 'completed'
totalSteps: 5
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
nextStep: ''
lastSaved: '2026-08-19'
---

# Test Design Progress — epic-5

## Step 1: Mode Detection & Prerequisites

**Mode selected: Epic-Level (Phase 4).**

Reason (priority A — explicit user intent): the invocation names scope `5`, and the repository
carries story documents with acceptance criteria under
`_bmad-output/specs/spec-dynamic-events/stories/`, including
`5-manage-events-in-settings.md`. There is no PRD and no ADR set in this repository
(`find _bmad-output -type f` returns only spec/story/implementation artifacts), so System-Level
mode has no inputs. File-based detection is not needed because intent is explicit; note that
`_bmad-output/implementation-artifacts/sprint-status.yaml` does **not** exist, so rule (B) alone
would have selected System-Level — user intent (rule A) overrides it.

**Prerequisite check — Epic-Level requires epic/story requirements with acceptance criteria:**

| Requirement | Status | Evidence |
|---|---|---|
| Story requirements + acceptance criteria | PRESENT | `_bmad-output/specs/spec-dynamic-events/stories/5-manage-events-in-settings.md:153-159` "**Acceptance Criteria:**" |
| Epic/spec context | PRESENT | `_bmad-output/specs/spec-dynamic-events/SPEC.md`, `stories.yaml` |
| Architecture context | PARTIAL | `_bmad-output/specs/spec-dynamic-events/data-model.md`, `integration-points.md`, `navigation.md` (spec-scoped, not a project architecture doc) |
| Prior system-level TEA output | ABSENT | `_bmad-output/test-artifacts/` did not exist before this run |

No halt condition triggered.

## Run Identity

- `run_scope`: `epic-level`
- `epic_num`: `5`
- `run_key`: `epic-5`
- Checkpoint: `_bmad-output/test-artifacts/test-design-progress-epic-5.md`
- Step 5 output target: `_bmad-output/test-artifacts/test-design-epic-5.md`

`epic_num` resolved from rule 1 (the scope the user named in this invocation: `5`), corroborated by
the story filename `5-manage-events-in-settings.md`.

## Existing Checkpoint Check

`_bmad-output/test-artifacts/test-design-progress-epic-5.md` did not exist
(`ls -la _bmad-output/test-artifacts` → `No such file or directory`). Fresh run; nothing merged
from a prior run.

## Scope Under Test

The changes present in this worktree for story 5 — `git diff --stat HEAD~1 HEAD`:

```
 .../stories/5-manage-events-in-settings.md         |  314 ++++++
 src/components/Settings/EventsSettings.tsx         | 1001 ++++++++++++++++++++
 src/components/Settings/Settings.tsx               |   10 +
 .../__tests__/EventsSettings.focus.test.tsx        |  391 ++++++++
 .../Settings/__tests__/EventsSettings.test.tsx     |  851 +++++++++++++++++
 tests/e2e/settings/events-crud.spec.ts             |  446 +++++++++
 6 files changed, 3013 insertions(+)
```

Uncommitted working-tree change (`git status --porcelain`): `M _bmad-output/implementation-artifacts/deferred-work.md` only.

---

## Step 2: Context & Knowledge Loaded

### Config resolved (`_bmad/tea/config.yaml`)

| Key | Value |
|---|---|
| `test_artifacts` | `{project-root}/_bmad-output/test-artifacts` |
| `tea_use_playwright_utils` | `true` |
| `tea_use_pactjs_utils` | `true` |
| `tea_pact_mcp` | `mcp` |
| `tea_browser_automation` | `auto` |
| `test_stack_type` | `auto` |
| `risk_threshold` | `p1` |
| `user_name` / `communication_language` | `Sallvain` / `English` |

### Stack detection (`test_stack_type: auto`)

`detected_stack = frontend`. Present: `playwright.config.ts`, `vitest.config.ts`, `package.json`
with `react` in `dependencies`. Absent: every listed mobile indicator (`.maestro/`, `app.json`,
`Podfile`, `android/app/build.gradle`, `*.xcodeproj`, `pubspec.yaml`) and every listed backend
manifest (`pyproject.toml`, `pom.xml`, `build.gradle`, `go.mod`, `*.csproj`, `Gemfile`,
`Cargo.toml`).

**Qualifier carried forward:** the rule's backend indicators are language manifests, and the project
has none — but it does have a real server-side tier in Supabase (`supabase/config.toml`,
`supabase/migrations/`, and pgTAP suites under `supabase/tests/database/`). The coverage plan
therefore treats **DB/RLS as a live test level** even though auto-detection reports `frontend`.

### Playwright Utils profile

Full UI+API profile. `@seontechnologies/playwright-utils` is in `devDependencies`, and 27 files under
`tests/` contain `page.goto` or `page.locator`. Loaded `playwright-utils-mandate.md` first, per the
step's ordering rule.

### Pact relevance probe (recorded once)

**Contract testing is NOT relevant to this epic; no Pact fragments loaded.** Probe results: no
`pact/` directory, no `tests/contract/` directory, no `*.pacttest.ts` file, no `pact` string in
`package.json`, no `PACT_BROKER_*` in the environment, and the system is a single React client
against one Supabase project — no consumer/provider split to contract. Per
`pactjs-utils-mandate.md`'s relevance gate, `tea_use_pactjs_utils: true` "never means 'add contract
tests to this project'". `pact_mcp_reachable`: not probed further, because relevance failed first.

### Knowledge fragments loaded (Epic-Level required set)

- `risk-governance.md` — risk categories TECH/SEC/PERF/DATA/BUS/OPS, gate decision model
- `probability-impact.md` — 1-9 scoring, DOCUMENT/MONITOR/MITIGATE/BLOCK thresholds
- `test-levels-framework.md` — level selection, duplicate-coverage guard, `{EPIC}.{STORY}-{LEVEL}-{SEQ}` id format
- `test-priorities-matrix.md` — P0-P3 decision tree; priority is assigned separately from risk score
- `nfr-criteria.md` — loaded: this story carries security (creator-only writes under RLS), reliability (failed load / rejected write / offline) and maintainability concerns
- `playwright-utils-mandate.md` — loaded first per the profile rule
- `playwright-cli.md` — NOT loaded; browser exploration was skipped (see below)

### Browser exploration

**Skipped**; fell back to code and document analysis as the step's fallback allows. The app under
test requires a running local Supabase stack plus a seeded worker-pool account before any Settings
view renders (`AGENTS.md`: "E2E needs `supabase start` running first"), so a `playwright-cli` snapshot
against an unauthenticated app would capture only the login screen. No artifacts written to
`{test_artifacts}/exploration/`.

### Project artifacts loaded

| Path | Role |
|---|---|
| `_bmad-output/specs/spec-dynamic-events/stories/5-manage-events-in-settings.md` | The story: intent-contract, I/O matrix, acceptance criteria, deferred items, review triage log |
| `_bmad-output/specs/spec-dynamic-events/SPEC.md` | CAP-1, CAP-2, CAP-5, CAP-7, CAP-10 definitions |
| `_bmad-output/specs/spec-dynamic-events/stories.yaml` | Epic decomposition, stories 1-5 |
| `_bmad-output/implementation-artifacts/deferred-work.md` | DW-26, DW-27 (added in the working tree) |
| `src/components/Settings/EventsSettings.tsx` | The implementation under test (1001 lines) |
| `src/components/Settings/Settings.tsx` | Mount point (10 added lines) |
| `src/stores/slices/eventsSlice.ts` | Data layer the component reads through |
| `supabase/tests/database/20_events.sql` | Existing DB-level policy coverage (404 lines) |

### Existing coverage inventory (measured)

`grep -cE "^\s*(it|test)\("` per file:

| File | Lines | Tests | Layer |
|---|---|---|---|
| `tests/unit/services/eventsService.test.ts` | 605 | 32 | Unit (service) |
| `tests/unit/stores/eventsSlice.test.ts` | 456 | 22 | Unit (store) |
| `tests/unit/stores/persistedEvents.test.ts` | 75 | 1 | Unit (persistence) |
| `src/components/RelationshipTimers/__tests__/EventCountdown.test.tsx` | 255 | 21 | Component |
| `src/components/Settings/__tests__/EventsSettings.test.tsx` | 851 | 34 | Component (**new**) |
| `src/components/Settings/__tests__/EventsSettings.focus.test.tsx` | 391 | 11 | Component (**new**) |
| `tests/e2e/home/events.spec.ts` | 362 | 6 | E2E |
| `tests/e2e/settings/events-crud.spec.ts` | 446 | 5 | E2E (**new**) |
| `supabase/tests/database/20_events.sql` | 404 | — | DB (pgTAP) |

Live verification run this session:

```
npx vitest run src/components/Settings/__tests__
 ✓ src/components/Settings/__tests__/EventsSettings.focus.test.tsx (11 tests) 106ms
 ✓ src/components/Settings/__tests__/EventsSettings.test.tsx (34 tests) 205ms
 Test Files  2 passed (2)
      Tests  45 passed (45)
```

One stderr warning was emitted during that run, on the test
`EventsSettings list states > does not paint the load banner when the shared error key holds a save
failure`: `An update to EventsSettings inside a test was not wrapped in act(...)`. Carried into
step 3 as a testability finding.

### Notable gaps observed while loading (carried to step 3)

- `@axe-core/playwright` is a devDependency, and the only consumer anywhere is
  `tests/e2e/scripture/scripture-accessibility.spec.ts:297`
  (`const AxeBuilder = (await import('@axe-core/playwright')).default;`). There is no automated
  a11y scan over Settings or either new dialog.
- `tests/e2e/settings/` contains exactly one file — `events-crud.spec.ts`. `Settings.tsx` itself and
  `AnniversarySettings.tsx` have no test of any kind (`ls src/components/Settings/__tests__/`
  returns only the two new EventsSettings files).
- Nothing was missing that would block the workflow; no user confirmation needed.

---

## Step 3: Risk Assessment & Testability

**Section 1 (System-Level Testability Review) does not apply** — this is an Epic-Level run.
Testability findings that surfaced anyway are carried into the register below as TECH risks
(R-009, R-010) rather than dropped.

### Risk register (13 risks, scored P x I per `probability-impact.md`)

| ID | Cat | Risk | P | I | Score | Action |
|---|---|---|---|---|---|---|
| R-001 | DATA | Duplicate event rows from a re-attempted create | 2 | 2 | 4 | MONITOR |
| R-002 | BUS | DW-26: a false "we couldn't load your events" notice over a healthy list | 2 | 1 | 2 | DOCUMENT |
| R-003 | OPS | DW-27: a failed Settings load never re-fires | 2 | 2 | 4 | MONITOR |
| R-004 | TECH | A write whose promise never settles locks the dialog on its spinner | 1 | 2 | 2 | DOCUMENT |
| R-005 | SEC | The UI creator-only gate drifting from RLS | 1 | 3 | 3 | DOCUMENT |
| R-006 | SEC | A previous account's events surviving sign-out on a shared device | 1 | 3 | 3 | DOCUMENT |
| R-007 | DATA | Client validation mirrors drifting from the migration CHECK constraints | 2 | 2 | 4 | MONITOR |
| R-008 | BUS | Date off-by-one in the untested timezone direction | 2 | 2 | 4 | MONITOR |
| R-009 | TECH | No automated a11y scan on either new dialog | 2 | 2 | 4 | MONITOR |
| R-010 | TECH | Unwrapped async state update in the new component suite (`act(...)` warning) | 2 | 1 | 2 | DOCUMENT |
| R-011 | PERF | Bare `useAppStore()` subscription re-renders the whole section | 2 | 1 | 2 | DOCUMENT |
| R-012 | OPS | E2E teardown deletes every event for the worker pair | 1 | 2 | 2 | DOCUMENT |
| R-013 | SEC | Stored XSS through a label or description — verified absent | 1 | 3 | 3 | DOCUMENT |

**Distribution:** BLOCK (9) = 0 · MITIGATE (6-8) = 0 · MONITOR (4-5) = 5 · DOCUMENT (1-3) = 8.

Per `risk-governance.md`'s `evaluateGate`, zero score-9 blockers and zero open score-6-8 concerns
means the **risk axis** does not by itself hold the gate. Coverage gaps are assessed separately in
step 4; the two are combined in the gate criteria of the final document.

### Evidence per risk

**R-001 — DATA, 2 x 2 = 4, MONITOR.** `5-manage-events-in-settings.md:66`: "`public.events` has no
unique constraint and no idempotency key, so a disabled control is the only double-submit guard
available." The guard is real and tested (`EventsSettings.test.tsx:554` "disables submit while the
write is open, so a double tap creates one row"), but it lives inside one mounted `EventForm`
instance and only for the in-flight window. The automatic-retry vector AGENTS.md warns about does
not exist here — `eventsSlice.ts:145` states "No retry: `public.events` carries no idempotency key
to make one safe." The residual vector is user-driven: a slow or hung create, browser Back
(`src/App.tsx:210` `popstate`), re-open, resubmit — two rows if the first eventually lands.
*Mitigation:* accept and monitor; a DB `UNIQUE (user_id, label, event_date)` plus
`.upsert(..., { onConflict, ignoreDuplicates: true })` is the structural fix, and it belongs to the
data layer, which this story's Never list forbids touching.

**R-002 — BUS, 2 x 1 = 2, DOCUMENT.** DW-26, `deferred-work.md`: "The load-failure flag is read
once from the shared `eventsError` key in loadEvents()'s .finally, and `addEvent` writes its own
failure into that same key." Confirmed in code: `EventsSettings.tsx:135`
`setLoadFailed(useAppStore.getState().eventsError !== null);` reads the same key that
`eventsSlice.ts:170` writes on a failed `addEvent`. Impact is 1 because the list itself is correct —
only the notice lies. *Mitigation:* per-call error token in `eventsSlice.ts`; owned by story 2's
contract.

**R-003 — OPS, 2 x 2 = 4, MONITOR.** DW-27. `EventsSettings.tsx:142` — the effect deps are
`[userId, loadEvents]`. `deferred-work.md`: "App.tsx's otherwise identical Home effect deliberately
adds isOnline". There is no Retry control in the rendered notice: `EventsSettings.tsx:222` reads
"We couldn't load your events. Check your connection and reload the page." — the copy tells the user
to reload because nothing else will. *Mitigation:* add `isOnline` to the deps, or a Retry button;
either widens what the intent asked for, so it needs a spec decision.

**R-004 — TECH, 1 x 2 = 2, DOCUMENT.** Story residual risk, lines 309-311: "A write whose promise
never settles leaves the dialog on its spinner until the user navigates away with browser Back.
There is no request timeout in the Supabase client, and the intent does not specify a dismissal
policy for a hung write." The escape hatch was measured, not assumed — Review Triage Log:
"`popstate` is handled at src/App.tsx:210, so browser Back leaves /settings and unmounts the dialog."

**R-005 — SEC, 1 x 3 = 3, DOCUMENT.** Three independent layers, all with live assertions:
RLS (`supabase/tests/database/20_events.sql:247` "EV-DB-024: a partner's UPDATE of the creator's row
affects zero rows", `:270` "EV-DB-026: a partner's DELETE ... affects zero rows"), the service
turning zero rows into a message, and the UI gate at `EventsSettings.tsx:308`
`const isOwn = event.userId === userId;` guarding the controls at `:355`. Probability 1 because a
regression would have to defeat all three. Impact 3 keeps it a **P0 test target** despite the low
score — `test-priorities-matrix.md` assigns priority separately, and "Security-critical paths" is
its first P0 criterion.

**R-006 — SEC, 1 x 3 = 3, DOCUMENT.** `authSlice.ts:128-130` puts `events`, `eventsIsLoading` and
`eventsError` in `signedOutState()`, and `tests/e2e/auth/logout.spec.ts:67` is
"[P0] should clear account state through signedOutState on logout", asserting `events: 0`
(`:158`). This story adds no store state; its own state (`loadFailed`, `settledForUserId`) is
component-local and dies with the unmount, and `EventsSettings.tsx:195`
`const firstLoadSettled = settledForUserId !== null && settledForUserId === userId;` re-arms the load
for a different account rather than trusting a stale settle.

**R-007 — DATA, 2 x 2 = 4, MONITOR.** `EventsSettings.tsx:73-75` hardcodes `LABEL_MAX_LENGTH = 100`,
`DESCRIPTION_MAX_LENGTH = 500` and `ISO_DATE_PATTERN`, described in its own comment as "Mirrors of
the CHECK constraints in `20260818000002_create_events_table.sql:19,21,22`". Nothing links the two.
Measured: `grep -rn "100\b.*label\|LABEL_MAX\|char_length"` over the new component tests, the service
tests and `20_events.sql` returns **no** hits — no test anywhere asserts the mirror still matches the
migration. A limit changed in SQL leaves the client refusing valid input, or passing input the DB
rejects with raw constraint text.

**R-008 — BUS, 2 x 2 = 4, MONITOR.** This feature exists to avoid a live off-by-one
(`AnniversarySettings.tsx:103`, named in the story at line 64). The defence is real —
`formatDateISO` / `formatDateLong` over local components, and an E2E that samples expectation and
DOM inside one `page.evaluate` (`events-crud.spec.ts:114-130`). But `vitest.config.ts:34` pins
`TZ: 'America/New_York'` — one offset, west of UTC. No suite runs east of UTC, where the same class
of bug shows the *next* day rather than the previous one, so half the failure space is unexercised.

**R-009 — TECH, 2 x 2 = 4, MONITOR.** The change produced **four medium accessibility findings**
during review (story lines 184-187: Add-button accessible name below `sm`, unannounced and
unassociated field errors, no focus indicator on the sr-only icon radios, plus the duplicated
heading at line 188). All four were caught by review, none by a test. `@axe-core/playwright` is a
devDependency and its only consumer anywhere is
`tests/e2e/scripture/scripture-accessibility.spec.ts:297`. The 11 focus tests cover focus movement;
nothing covers roles, names, contrast or `aria-*` wiring automatically.

**R-010 — TECH, 2 x 1 = 2, DOCUMENT.** Measured this session. `npx vitest run
src/components/Settings/__tests__` passed 45/45 and emitted, on
`EventsSettings list states > does not paint the load banner when the shared error key holds a save
failure`: "An update to EventsSettings inside a test was not wrapped in act(...)". A state update
landing outside `act` is the standard precursor to an order-dependent flake.

**R-011 — PERF, 2 x 1 = 2, DOCUMENT.** `EventsSettings.tsx:100-101` destructures a bare
`useAppStore()` with no selector, so every unrelated store write re-renders the section. Dismissed in
review as "the prevailing convention at 15 sites, including the sibling AnniversarySettings.tsx:21".
Impact 1 at a couple's data scale — a handful of rows.

**R-012 — OPS, 1 x 2 = 2, DOCUMENT.** `events-crud.spec.ts:85`
`.from('events').delete().in('user_id', [userId, partnerId])` in an `afterEach` (`:146-149`). It is
scoped to this worker's own pair via `resolveOwnPair`, which is exactly what AGENTS.md's worker-pool
rule requires, and the deletion is checked rather than silent (`:86-88`). The residual exposure is
that it also removes rows seeded by `tests/e2e/home/events.spec.ts` for the same pair — harmless
while Playwright runs one test at a time per worker, and a real hazard if that ever changes.

**R-013 — SEC, 1 x 3 = 3, DOCUMENT.** Verified absent, not assumed: `event.label` and
`event.description` are rendered as React text children (`EventsSettings.tsx:325`, `:338`), which
escapes them, and `grep -rn "dangerouslySetInnerHTML" src/components/Settings/` returns nothing. No
DOMPurify pass is needed on this surface, unlike `LoveNoteMessage.tsx`. Recorded so a future
`dangerouslySetInnerHTML` on this surface reads as a regression rather than a choice.

### NFR Planning

| Category | Threshold | Source | Risk link | Planned validation | Evidence artifact |
|---|---|---|---|---|---|
| Security | A non-creator's UPDATE/DELETE affects exactly zero rows; `anon` holds no privilege on `public.events` | `supabase/tests/database/20_events.sql:153-166,247,270` | R-005, R-006 | pgTAP `supabase test db` + the partner-row E2E + the logout E2E | CI job "Database Tests" (`.github/workflows/test.yml:140`); Playwright chromium report |
| Security (SAST) | No new critical/high finding | `.github/workflows/codeql.yml` exists | R-013 | CodeQL on push | CodeQL alerts |
| Reliability | A rejected write keeps the form open and shows the message that write returned | `5-manage-events-in-settings.md:93` (I/O matrix row "Save rejected") | R-002, R-003 | Component tests + the `skipNetworkMonitoring` E2E | vitest JUnit; Playwright report |
| Reliability (retry / timeout) | **UNKNOWN** | No threshold in SPEC.md, the story, or the code. The story states "There is no request timeout in the Supabase client, and the intent does not specify a dismissal policy for a hung write" | R-003, R-004 | Cannot be validated until a policy exists | — |
| Performance | **UNKNOWN** | No SLO, SLA, or budget in SPEC.md or the story. `.github/workflows/lighthouse.yml` exists but carries no `minScore` / assertion block (grep returned nothing) | R-011 | Deferred; no threshold to test against | — |
| Maintainability (coverage) | lines 25, functions 25, branches 25 | `vitest.config.ts:52-55` | R-010 | `npm run test:unit:coverage` in CI (`test.yml:127`) | `unit-test-coverage` artifact (`test.yml:133`) |
| Accessibility | **UNKNOWN** — the story specifies concrete behaviours (focus trap, `role="dialog"`, `aria-modal`, announced field errors) but no automated pass criterion | Story lines 67-68, 185 | R-009 | Proposed: an axe scan over Settings and both dialogs, following `scripture-accessibility.spec.ts:297` | AxeBuilder results in the Playwright report |

**Do not invent the three UNKNOWNs.** Each becomes a clarification item in the final document rather
than a fabricated number.

**Load testing is out of scope and k6 is the wrong tool here.** `nfr-criteria.md` prescribes k6 for
system performance under load; this is a two-person application whose events table holds a handful of
rows per couple. There is no load profile to model.

---

## Step 4: Coverage Plan & Execution Strategy

### Test ID convention

`test-levels-framework.md` specifies `{EPIC}.{STORY}-{LEVEL}-{SEQ}`. The spec carries no epic
number, so `DE` (spec-dynamic-events) stands in: **`DE.5-<LEVEL>-<SEQ>`**, levels `DB`, `UNIT`,
`COMP`, `E2E`.

### A. Coverage already in place (the change ships with it)

Every row of the story's I/O & Edge-Case Matrix (`5-manage-events-in-settings.md:88-102`) has at
least one test that ran and passed this session or in the story's recorded verification.

| # | Requirement (I/O matrix row) | Level | Existing test | Risk |
|---|---|---|---|---|
| 1 | Add valid event | COMP + E2E | `EventsSettings.test.tsx:479`; `events-crud.spec.ts:152` | R-001 |
| 2 | Blank label rejected, no request | COMP | `EventsSettings.test.tsx:386` | R-007 |
| 3 | Over-length label rejected | COMP | `EventsSettings.test.tsx:398` | R-007 |
| 4 | Save rejected, exact message, form open | COMP + E2E | `EventsSettings.test.tsx:531`; `events-crud.spec.ts:398` | R-002 |
| 5 | Double submit creates one row | COMP | `EventsSettings.test.tsx:554` | R-001 |
| 6 | Edit own event, re-sorts | COMP + E2E | `EventsSettings.test.tsx:613,634`; `events-crud.spec.ts:212-248` | R-008 |
| 7 | Partner's event is read-only | COMP + E2E + DB | `EventsSettings.test.tsx:271`; `events-crud.spec.ts:363`; `20_events.sql:247,270` | R-005 |
| 8 | Delete confirmed, focus survives | COMP + E2E | `EventsSettings.test.tsx:688`; `EventsSettings.focus.test.tsx:350`; `events-crud.spec.ts:254-266` | — |
| 9 | Past event listed and editable | COMP + E2E | `EventsSettings.test.tsx:234`; `events-crud.spec.ts:311` | R-008 |
| 10 | Empty state carries an add control | COMP + E2E | `EventsSettings.test.tsx:314,322`; `events-crud.spec.ts:268-270` | — |
| 11 | Loading, never the empty state | COMP | `EventsSettings.test.tsx:300` | — |
| 12 | Load failure explained, not a save failure | COMP | `EventsSettings.test.tsx:330,344,367` | R-002, R-003 |
| 13 | Deep link / reload on Settings loads | COMP + E2E | `EventsSettings.test.tsx:225`; `events-crud.spec.ts:273` | — |

Plus 11 focus tests (`EventsSettings.focus.test.tsx`) covering initial focus, Escape, Tab wrap,
focus return after edit, the empty-state fallback, and the post-failure return — for both dialogs.

**Duplicate-coverage check.** Validation logic sits at COMP only (never E2E) — correct per
`test-levels-framework.md`'s anti-pattern list. Ownership sits at all three levels, which the same
fragment permits explicitly for "critical paths requiring defense in depth"; the three test
different things (UI affordance / real round trip / the database predicate itself). Date handling
sits at COMP (pre-fill) and E2E (round trip), not at both for the same assertion.

### B. Coverage gaps — the plan

| ID | Scenario | Level | Priority | Risk | Est. |
|---|---|---|---|---|---|
| DE.5-UNIT-001 | The client validation mirrors still match the migration's CHECK constraints | UNIT | P1 | R-007 | 1-2 h |
| DE.5-E2E-001 | axe scan: Settings view, the add/edit form, the delete confirmation | E2E | P1 | R-009 | 2-4 h |
| DE.5-UNIT-002 | The date-sensitive suites pass east of UTC as well as west | UNIT (CI leg) | P1 | R-008 | 1-3 h |
| DE.5-COMP-001 | Remove the unwrapped async state update behind the `act(...)` warning | COMP | P2 | R-010 | 0.5-1 h |
| DE.5-E2E-002 | A rejected **edit** and a rejected **delete** carry the service's own message to the dialog | E2E | P2 | R-005 | 2-3 h |
| DE.5-COMP-002 | A save failure inside the first load's flight window leaves no false notice | COMP | P2 (blocked) | R-002 | 1-2 h |
| DE.5-COMP-003 | A failed load re-fires on reconnect and clears its notice | COMP + E2E | P2 (blocked) | R-003 | 2-4 h |
| DE.5-E2E-003 | An offline save surfaces the service's offline message in the form | E2E | P3 | R-004 | 1-2 h |

**Priorities were assigned from the decision tree in `test-priorities-matrix.md`, not derived from
the risk scores.** None of these scenarios is revenue-critical (no revenue exists). DE.5-UNIT-001,
DE.5-E2E-001 and DE.5-UNIT-002 are P1 because each guards a core user journey — creating a correct
event with a correct date, reachable by the people who use this app — against a failure mode that is
currently invisible to every test. The rest are P2/P3: secondary behaviour, or a workaround exists.

**Per-gap detail:**

- **DE.5-UNIT-001** — read `supabase/migrations/20260818000002_create_events_table.sql` as text,
  extract `char_length(label) <= 100`, `char_length(description) <= 500` and
  `icon in ('ring', 'plane', 'calendar')`, and assert each against the values the component enforces.
  A drift guard, not a behaviour test. The structurally better fix — one exported constants module
  shared by the component and asserted against the migration — is a **production change** and out of
  scope for this run; note it as a follow-up.
- **DE.5-E2E-001** — follow `tests/e2e/scripture/scripture-accessibility.spec.ts:297`
  (`const AxeBuilder = (await import('@axe-core/playwright')).default;`). Scan three states: the
  Settings view with a populated list, the form modal open, and the delete confirmation open. The
  four medium findings this change already produced were all in that class.
- **DE.5-UNIT-002** — `vitest.config.ts:34` pins `TZ: 'America/New_York'` process-wide, so a
  per-file override is not available. Add a CI leg that re-runs only the date-sensitive suites under
  a UTC+ zone: `TZ=Asia/Tokyo npx vitest run src/components/Settings/__tests__
  src/components/RelationshipTimers tests/unit/services/eventsService.test.ts`. CI-only; no
  production or config change.
- **DE.5-E2E-002** — mirror `events-crud.spec.ts:392-446`: the `skipNetworkMonitoring` annotation
  plus `interceptNetworkCall` fulfilling the PATCH and the DELETE. This closes the only seam where
  the real service message (`'Event not found or not yours to edit'`) is never observed reaching a
  dialog; the component tests mock the store, so today they assert wiring against a synthetic string.
- **DE.5-COMP-002 / DE.5-COMP-003** — **blocked**, and deliberately so. Both need the per-call error
  token or the `isOnline` dep, which live in `eventsSlice.ts` / the load effect's contract. Writing
  the tests before the fix would put two red tests in CI. Schedule them with the DW-26 / DW-27 fix,
  not before.
- **DE.5-E2E-003** — P3 because the generic wiring it would exercise is already proven by
  `EventsSettings.test.tsx:531` and the service's own offline behaviour is pinned four times in
  `tests/unit/services/eventsService.test.ts:348,429,540,590`. Only the concatenation is unobserved.

### C. Explicitly not worth testing

| Item | Reason |
|---|---|
| `nextErrors.icon = 'Choose an icon'` (`EventsSettings.tsx:525-527`) | Unreachable through the UI. `icon` is typed `EventIcon` and written only from `ICON_OPTIONS`, so `!ICON_VALUES.includes(icon)` cannot be true. Same class as the `ISO_DATE_PATTERN` finding the review dismissed: "the only producer of that value is `<input type="date">`, which cannot emit an unparseable value". |
| Load testing / k6 | No load profile. Two users per couple; a handful of rows. `nfr-criteria.md` prescribes k6 for system throughput, which is not a question this system asks. |
| Contract tests (Pact) | No consumer/provider split. Relevance probe in step 2 returned nothing. |
| `AnniversarySettings.tsx`, `Settings.tsx` sections other than Events | Pre-existing untested surface, out of this story's diff. Flagged in the final document under Not in Scope, not silently absorbed. |
| Re-testing `eventsSlice` / `eventsService` behaviour | 54 unit tests already own it (22 + 32). Adding component-level assertions about slice internals would be duplicate coverage across levels. |

### D. NFR coverage and evidence plan

| NFR | Validation | Tool / level | Evidence for a later `nfr-assess` |
|---|---|---|---|
| Security — creator-only writes | Existing pgTAP + partner-row E2E | `supabase test db`, Playwright chromium | CI "Database Tests" job; Playwright report |
| Security — account isolation on sign-out | Existing `tests/e2e/auth/logout.spec.ts:67` | Playwright | Playwright report |
| Security — SAST | CodeQL on push | `.github/workflows/codeql.yml` | CodeQL alerts |
| Reliability — rejected write | Existing COMP + E2E; extended by DE.5-E2E-002 | vitest, Playwright | vitest JUnit (`test-results/vitest-junit.xml`), Playwright report |
| Reliability — retry / hung-write policy | **Blocked: threshold UNKNOWN** | — | — |
| Performance | **Blocked: threshold UNKNOWN.** `lighthouse.yml` exists with no assertion block | — | — |
| Maintainability — coverage | `npm run test:unit:coverage` against `vitest.config.ts:52-55` (25/25/25) | CI | `unit-test-coverage` artifact |
| Accessibility | **New:** DE.5-E2E-001 | `@axe-core/playwright` | AxeBuilder results in the Playwright report |

### E. Execution strategy (PR / Nightly / Weekly)

**PR — everything below, and it fits the 15-minute budget.** The two new component suites ran in
699 ms this session; the full Playwright chromium run is 127 passed / 2 skipped per the story's
recorded verification. Existing CI already runs lint + typecheck, unit-with-coverage, pgTAP, and the
Playwright projects on push (`.github/workflows/test.yml:81,108,140,171`).

| Stage | Contents | Budget |
|---|---|---|
| PR — smoke | `npm run test:unit -- src/components/Settings/__tests__` | < 1 min |
| PR — P0 | `supabase test db`; `npx playwright test tests/e2e/settings tests/e2e/home/events.spec.ts tests/e2e/auth/logout.spec.ts --project=chromium` | < 10 min |
| PR — P1 | Full `npm run test:unit:coverage`; the new DE.5-UNIT-001, DE.5-UNIT-002 leg and DE.5-E2E-001 | < 5 min |
| Nightly | Full `npx playwright test --project=chromium` across every directory — `scripture-overview.spec.ts` is untagged, so neither `test:p0` nor `test:p1` reaches it | ~15-25 min |
| Weekly | `npm run test:burn-in` over the two new suites, to surface the R-010 flake vector | as configured |

Note on `npm run test:p1`: it runs P0 **and** P1 (`playwright test --grep '\[P0\]|\[P1\]'`), so
"the P1 stage" above is additive, not exclusive.

### F. Resource estimates (ranges)

| Priority | Scenarios | Estimate |
|---|---|---|
| P0 | 0 new — all P0 behaviour already ships with coverage | 0 h |
| P1 | 3 (DE.5-UNIT-001, DE.5-E2E-001, DE.5-UNIT-002) | ~4-9 h |
| P2 | 4 (DE.5-COMP-001, DE.5-E2E-002, and the two blocked ones) | ~5-10 h |
| P3 | 1 (DE.5-E2E-003) | ~1-2 h |
| **Total** | **8** | **~10-21 h (~1.5-3 days)**, of which ~3-6 h is blocked on the DW-26 / DW-27 data-layer fix |

### G. Quality gates

- P0 pass rate: **100%**, no exceptions. Currently met — 45/45 component, and the story's recorded
  `npx playwright test tests/e2e/ --project=chromium` at 127 passed / 2 skipped / 0 failed.
- P1 pass rate: **>= 95%**, failures triaged with a named owner.
- Unit coverage: **>= the configured 25/25/25** in `vitest.config.ts:52-55`. Not raised here —
  raising a project-wide threshold on the back of one story's diff is a project decision, not a test
  design one.
- Risk gate: **no open risk at score >= 6.** Currently met — the highest score in the register is 4.
- The three **UNKNOWN** NFR thresholds (reliability retry/timeout, performance, accessibility pass
  criterion) are clarification items. Per `nfr-criteria.md`, "If targets or evidence are undefined →
  CONCERNS"; they do not fail this gate, but they cannot be signed off as PASS either.

---

## Step 5: Output Generation & Validation

### Execution mode resolution

| Input | Value |
|---|---|
| Explicit user hint in this run | none |
| `tea_execution_mode` (config) | `auto` |
| `tea_capability_probe` (config) | `true` |
| Probe — subagents launchable | yes |
| Probe — agent teams launchable | no |
| `resolvedMode` | `subagent` |

**Executed sequentially anyway.** Epic-Level mode produces one artifact, and step 5 states it
"remains single-worker by default (one output artifact)". Parallel workers exist only to write the
two system-level documents concurrently; there is no second document here to reconcile against.

### Output written

`_bmad-output/test-artifacts/test-design-epic-5.md` (602 lines), from
`test-design-template.md`. The path resolves from the `epic_num` fixed in step 1, so the plan and
this checkpoint name the same run.

No handoff document: step 5 section 4 restricts `{test_artifacts}/test-design/{project_name}-handoff.md`
to system-level runs.

### Checklist validation (`checklist.md`)

**Prerequisites — Epic-Level Mode**

| Item | Result |
|---|---|
| Story markdown with clear acceptance criteria | PASS — `5-manage-events-in-settings.md:153-159` |
| PRD or epic documentation | PASS — `SPEC.md` + `stories.yaml` (no PRD exists in this repository; the spec is the epic document) |
| Architecture documents from Phase 3 | N/A — no prior system-level TEA run; `_bmad-output/test-artifacts/` did not exist before this one |
| Requirements testable and unambiguous | PASS — a 13-row I/O & Edge-Case Matrix plus six acceptance criteria |

**Process steps**

| Item | Result |
|---|---|
| Existing test coverage analyzed | PASS — nine files inventoried with measured test counts; the two new suites re-run live |
| Knowledge fragments loaded | PASS — all four required, plus `nfr-criteria.md` and `playwright-utils-mandate.md` |
| Genuine risks, not features | PASS — 13 risks, each anchored to a cited line |
| Categories / P / I / score | PASS — every risk carries TECH/SEC/PERF/DATA/BUS/OPS, P and I in 1-3, score = P x I |
| High risks (>= 6) flagged | PASS (vacuously) — none exist, and the document says so explicitly rather than leaving the section blank |
| Mitigation, owner, timeline | PASS — plans given for all five MONITOR items even though none is mandatory |
| Residual risk documented | PASS — "Risks to Plan" plus the two blocked scenarios |
| NFR thresholds; UNKNOWNs not guessed | PASS — three UNKNOWNs recorded as clarification items |
| Atomic scenarios, levels, no duplicate coverage | PASS — duplicate-coverage check written out, with the one permitted overlap justified |
| P0 criteria strict | PASS — 0 new P0; the seven existing P0 items are regression-protection, which `test-priorities-matrix.md` lists as a P0 criterion |
| Execution order defined | PASS, as PR/Nightly/Weekly — see deviation 1 below |
| Estimates as ranges | PASS — no point estimate anywhere; timeline as both a day and a week range |
| Quality gates defined | PASS |
| Output at the correct location, template structure | PASS |

**Output validation**

| Item | Result |
|---|---|
| Unique risk IDs R-001..R-013 | PASS |
| P and I are 1, 2 or 3; scores correct | PASS — verified arithmetic on all 13 |
| Priority sections carry only "Criteria", no execution context | PASS |
| Note at top of Test Coverage Plan that P0-P3 is priority, not timing | PASS |
| Execution strategy is PR/Nightly/Weekly, not a tier structure | PASS — deviation from the template recorded in the document |
| Playwright parallelisation noted | PASS |
| Philosophy stated ("run everything in PRs if <15 min") | PASS |
| Coverage target | PARTIAL — the checklist recommends >= 80%; this project configures 25/25/25 in `vitest.config.ts:52-55`. Both are stated, and the document says raising a repository-wide threshold on one story's diff is Sallvain's decision, not this workflow's |
| Not in Scope with reasoning and mitigation | PASS — seven entries |
| Entry / Exit criteria | PASS |
| Interworking & Regression | PASS — six impacted components with regression scope |
| Professional tone, no emoji slop | PASS |

**Integration points**

| Item | Result |
|---|---|
| Knowledge fragments consulted | PASS |
| Status file integration ("Quality & Testing Progress") | N/A — no such status file exists. `_bmad-output/implementation-artifacts/sprint-status.yaml` is absent; the run is recorded in this checkpoint instead |
| Can proceed to `/bmad-testarch-atdd` with P0 scenarios | PASS — listed under Follow-on Workflows, not auto-run |

**Hygiene**

| Item | Result |
|---|---|
| CLI sessions cleaned up (no orphaned browsers) | PASS — no `playwright-cli` session was ever opened; browser exploration was skipped |
| Temp artifacts under `{test_artifacts}` | PASS — exactly two files, both under `_bmad-output/test-artifacts/` |
| No unresolved template placeholders | PASS — `grep -n "{[a-z_]*}"` over the output returns nothing outside the deliberate test-ID format |

### Recorded deviations

1. The template's **Execution Order** section (smoke / P0 / P1 / P2-P3 tiers) was replaced by an
   **Execution Strategy** section using PR / Nightly / Weekly, because `checklist.md:100-107` names
   the tiered structure as the thing to avoid. Where the two disagree, the checklist wins.
2. A **Coverage already in place** table precedes the P0-P3 sections. This is a post-implementation
   design; without it the plan reads as though nothing were tested.
3. Coverage target held at the project's configured 25/25/25 rather than the checklist's
   recommended 80%. Raising it is a project decision.

### Citation corrections made during validation

`eventsSlice.ts:143` corrected to `:145` in both documents — `grep -n "No retry"` returns line 145.
Every other cited line was re-verified against the file this session, including `src/App.tsx:210`
(`window.addEventListener('popstate', handlePopState);`), `EventCountdown.tsx:68,91` (the two
non-component exports behind the `react-refresh` warnings), and `tests/support/merged-fixtures.ts:53`
(`export const test = mergeTests(`, the TS2883 site).

### Completion report

- **Mode:** Epic-Level (Phase 4), run key `epic-5`, execution sequential
- **Outputs:** `_bmad-output/test-artifacts/test-design-epic-5.md`;
  `_bmad-output/test-artifacts/test-design-progress-epic-5.md`
- **Key risks:** five MONITOR items at score 4 — duplicate rows with no idempotency key (R-001), a
  failed load that never re-fires (R-003), client validation mirrors drifting from the migration
  (R-007), the untested timezone direction (R-008), and no automated a11y scan on a change that
  produced four medium a11y findings in review (R-009). No risk reaches 6.
- **Gate thresholds:** P0 100%, P1 >= 95%, no open risk >= 6, unit coverage at or above the
  configured 25/25/25.
- **Open assumptions:** the story's recorded 127-passed Playwright run was not re-executed here (it
  needs a live `supabase start`); the three UNKNOWN NFR thresholds need a decision from Sallvain;
  two P2 scenarios stay blocked until DW-26 and DW-27 are fixed in the data layer.
- **`workflow.on_complete`:** resolved to an empty string, so no terminal hook ran.

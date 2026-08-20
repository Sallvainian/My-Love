---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-identify-targets'
  - 'step-03-generate-tests'
  - 'step-03a-subagent-api'
  - 'step-03b-subagent-e2e'
  - 'step-03c-aggregate'
  - 'step-04-validate-and-summarize'
lastStep: 'step-04-validate-and-summarize'
lastSaved: '2026-08-19'
story: 'dw-persisted-events-key-strip'
inputDocuments:
  - '_bmad/tea/config.yaml'
  - '.claude/skills/bmad-testarch-automate/customize.toml'
  - '_bmad-output/implementation-artifacts/spec-dw-14-20-persisted-events-key-strip.md'
  - 'playwright.config.ts'
  - 'vitest.config.ts'
  - 'package.json'
  - 'src/stores/useAppStore.ts'
  - 'src/components/RelationshipTimers/EventCountdown.tsx'
  - 'tests/support/merged-fixtures.ts'
  - 'tests/support/fixtures/index.ts'
  - 'tests/support/fixtures/auth.ts'
  - 'tests/support/factories/events.ts'
  - 'tests/unit/stores/persistedEvents.test.ts'
  - 'tests/e2e/home/events.spec.ts'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/playwright-utils-mandate.md'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/test-levels-framework.md'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/test-priorities-matrix.md'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/test-quality.md'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/data-factories.md'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/confidence-gate.md'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/evidence-integrity.md'
---

# Test Automation Expansion — `dw-persisted-events-key-strip`

> Output file note: the step template names `{test_artifacts}/automation-summary.md`, but that
> filename is already taken by an earlier story's run in this directory. This run follows the
> convention the directory already uses for per-story runs
> (`automation-summary-dw-events-read-cap-and-pagination.md`,
> `automation-summary-dw-check-constraint-error-mapping.md`) and writes
> `automation-summary-dw-persisted-events-key-strip.md`.

## Step 1 — Preflight & Context

### Stack detection

`test_stack_type: auto` in `_bmad/tea/config.yaml`, so auto-detection ran:

- **Mobile indicators** — none. `ls -d maestro .maestro` → `No such file or directory` for both.
- **Frontend indicators** — present: `playwright.config.ts`, `vite.config.ts`, and `package.json`
  carrying `"react": "^19.2.8"`.
- **Backend indicators** — none of `pyproject.toml`, `pom.xml`, `go.mod`, `Gemfile`, `Cargo.toml`
  exists at the project root.

**`detected_stack` = `frontend`.**

Caveat recorded rather than assumed away: the repo does carry a Postgres surface under
`supabase/` (migrations plus pgTAP tests run by `supabase test db`). It matches none of the
manifests the detection algorithm lists, and its HTTP boundary is already exercised from the
Playwright `api` project in `tests/api/`. So `frontend` is the correct detection and the
Supabase boundary is reachable from this run's tooling; no `fullstack` override is needed.

### Framework verification — PASS

- `playwright.config.ts` present at the project root.
- `package.json` carries `@playwright/test@^1.62.1`, `vitest@^4.1.10`,
  `@testing-library/react@^16.3.2`, `happy-dom@^20.11.2`.
- Playwright projects declared: `chromium` (`testDir: ./tests/e2e`), `api`
  (`testDir: ./tests/api`, `baseURL: process.env.SUPABASE_URL`), `integration`
  (`testDir: ./tests/integration`).
- No HALT condition.

### Execution mode

**BMad-Integrated.** The story spec exists and was read in full:
`_bmad-output/implementation-artifacts/spec-dw-14-20-persisted-events-key-strip.md` — an
`<intent-contract>` with a five-row I/O & Edge-Case Matrix, five Acceptance Criteria, a Code Map,
and an Auto Run Result recording what shipped.

### TEA config flags read

| Flag | Value | Consequence for this run |
|---|---|---|
| `tea_use_playwright_utils` | `true` | Mandate **ACTIVE** — both gates pass (see below) |
| `tea_use_pactjs_utils` | `true` | Gate **not met** on relevance — see below |
| `tea_pact_mcp` | `mcp` | Moot: no contract-testing artifacts in scope |
| `tea_browser_automation` | `auto` | `playwright-cli.md` in scope |
| `test_stack_type` | `auto` | Resolved to `frontend` |
| `risk_threshold` | `p1` | P0/P1 scenarios are the required set |

**Playwright Utils mandate — ACTIVE.** `playwright-utils-mandate.md` requires *both* gates:
the flag is `true`, and `@seontechnologies/playwright-utils@^4.4.0` is a `devDependency` in
`package.json`. The suite already runs in that style: `tests/support/merged-fixtures.ts`
composes `apiRequestFixture`, `recurseFixture`, `logFixture`, `interceptFixture` and
`createNetworkErrorMonitorFixture` via `mergeTests` with the project's own fixtures. Loading
profile: **Full UI+API** (`detected_stack` is `frontend`; `tests/e2e/**` contains `page.goto`).

**Pact.js Utils — not applicable, and that is a relevance call, not a flag call.**
`pactjs-utils-mandate.md` carries the gate explicitly: the flag defaulting to `true` means "use
these utilities *when* contract tests are written", never "add contract tests to this project".
Probe for Pact indicators returned nothing — no `pact/` directory, no `@pact-foundation/pact` in
`package.json`, no `PACT_BROKER` in env files. This project has one consumer and one provider
(Supabase PostgREST) with no independently deployed service pair. No Pact artifact is produced.
`pact_mcp_reachable`: not probed, because no Pact artifact is in scope for this run.

### Knowledge fragments loaded

Core: `test-levels-framework`, `test-priorities-matrix`, `data-factories`, `test-quality`,
`confidence-gate`, `evidence-integrity`, `playwright-utils-mandate` (loaded first, per the
mandate's own ordering rule).
Referenced for principle only, per the mandate's "Relationship to the Traditional Fragments":
`fixture-architecture`, `network-first`.

### Existing test surface

Counted, not estimated:

```
$ find tests/e2e -name '*.spec.ts' | wc -l      →  34
$ find tests/api -name '*.spec.ts' | wc -l      →   6
$ find tests/unit -name '*.test.ts' | wc -l     →  (unit suite: 92 files / 1408 tests per spec)
```

Directly relevant existing coverage:

- `tests/unit/stores/persistedEvents.test.ts` — the file this story rewrote. 11 tests now
  (write side + 7 read-side cases added by the story).
- `tests/unit/stores/persistedMoods.test.ts` — the sibling this story's read-side cases mirror.
- `tests/unit/stores/signOutClearsAccountState.test.ts` — the in-memory third of the same guarantee.
- `tests/e2e/home/events.spec.ts`, `tests/e2e/home/events-read-window.spec.ts` — Home's
  store-driven events render, with `data-testid="event-countdown-<slug>"` per card.
- `tests/support/fixtures/index.ts` — `coupleEvents` fixture (seed/clear for this worker's pair).
- `tests/support/factories/events.ts` — anchor-relative seeding, `resolveWorkerPairIds`.

### Observation carried forward (not acted on — outside this workflow's scope)

The story spec asserts at two places that `version: 0` is "pinned" by the E2E auth fixtures.
A grep of the whole support tree finds no fixture that writes the key at all:

```
$ grep -rn "my-love-storage\|version: 0" tests/support/
tests/support/helpers/scripture-cache.ts:18:    localStorage.removeItem('my-love-storage');
```

The only reference *removes* the key. So nothing in the E2E harness would fail if the persist
version were bumped — the constraint is real for the shipped app (a version bump discards every
installed blob) but it is not currently enforced by a test. This is a gap in the *pinning claim*,
and Step 2 treats it as a coverage target rather than repeating the claim.

---

## Step 2 — Automation Targets & Coverage Plan

### The change under test

Branch-specific diff is two commits on top of `c68f347` (the `baseline_revision` the spec records):

```
$ git diff --stat c68f347..HEAD
 .../spec-dw-14-20-persisted-events-key-strip.md    | 194 +++++++++++++++++++++
 src/stores/useAppStore.ts                          |  43 +++--
 tests/unit/stores/persistedEvents.test.ts          | 166 ++++++++++++++++--
 3 files changed, 380 insertions(+), 23 deletions(-)
```

The production edit is one site. `src/stores/useAppStore.ts:74` declares
`const STALE_PERSISTED_KEYS = ['moods', 'events'] as const;` and `:136-144` walks it inside the
persist storage adapter's `getItem`, deleting each key it finds from the parsed blob and setting
the pre-existing `mutated` flag, so `:167` still re-serializes at most once.

The working tree itself carries only `M _bmad-output/implementation-artifacts/deferred-work.md`
(the loop's ledger). The behaviour to cover is therefore the branch's committed change, not an
uncommitted edit — recorded here so "changes currently in the working tree" is not read as a
larger surface than exists.

### Browser exploration (`tea_browser_automation: auto` → CLI)

`playwright-cli` is on PATH (`~/.local/share/mise/installs/node/24.19.0/bin/playwright-cli`).
Local Supabase is up (`npx supabase status` returns `API_URL http://127.0.0.1:54321`). A dev
server was started with `npx vite --mode test` (the `dev:local` script — reads `.env.test`, needs
no fnox secrets) and one `-s=tea-automate` session was opened, driven, and closed. No
`close-all` was used.

What the exploration established — each of these is a measurement, not an inference:

1. **The app gates on auth.** The unauthenticated snapshot is a `Welcome Back` sign-in form
   (`heading "Welcome Back"`, `textbox "Email"`, `button "Sign In" [disabled]`). Home is not
   reachable without the authenticated `page` fixture, which fixes the harness every E2E
   scenario below must use.
2. **The strip runs in a real browser, not just under happy-dom.** Seeding
   `my-love-storage` with `state.events = [{ label: 'PROBE-STALE-EVENT', date: '2026-09-12…' }]`
   and reloading produced `bodyHasProbeLabel: false`.
3. **The stale key is removed from disk after one load — and no existing test says so.**
   Post-reload the on-disk blob's `state` keys were exactly
   `["settings", "isOnboarded", "messageHistory"]`. Zustand's post-hydration write re-persists
   the `partialize` allowlist, so the seeded `events` key is gone from storage permanently, not
   merely withheld from state for that one load.
   This **corrects a claim in the story's own test docblock**
   (`tests/unit/stores/persistedEvents.test.ts:105-108`: "the adapter mutates only the copy it
   hands Zustand and never rewrites localStorage, so the seeded blob is still on disk with its
   stale keys intact afterwards"). That statement is true of the adapter *in isolation*, which is
   all a `vi.resetModules()` unit test exercises — no state change occurs, so no `setItem` fires.
   It is not true of the running app. Recorded as a finding; the file is not edited by this
   workflow.
4. **The strip does not trip the clear-the-whole-blob path.** The seeded `isOnboarded: true` and
   `messageHistory.currentIndex: 7` both survived into the rewritten blob. AC #2, observed live.

### The failure mode this change prevents, stated precisely

`src/App.tsx:625` calls `getUpcomingEventCards(...)`, which at
`src/components/RelationshipTimers/EventCountdown.tsx` filters with
`getCalendarDaysDiff(event.date, now)`, whose first statement dereferences
`date.getFullYear()`. JSON has no `Date`, so a rehydrated event's `date` is a **string**. A stale
blob therefore does not merely disclose the previous couple's dates — it throws a `TypeError`
inside Home's render. Two distinct harms, one input.

### Duplicate-coverage guard (applied before selecting anything)

`test-levels-framework.md` § Duplicate Coverage Guard. Already covered, so **not** regenerated:

| Behaviour | Covered by | Level |
|---|---|---|
| stale `events` does not reach store state | `persistedEvents.test.ts` "does not hydrate stored events into store state" | unit |
| surrounding persisted keys survive the strip | same file, "leaves the surrounding persisted keys intact…" | unit |
| both stale keys cleared from one blob | same file, "clears both stale keys from one blob" | unit |
| clean blob is a no-op on state | same file, "drops nothing from a blob that carries no stale keys" | unit |
| no-`state` blob / unparseable blob / absent blob | same file, three "lands on defaults…" cases | unit |
| `events` is never *written* to the blob | same file, write-side test | unit |
| in-memory reset on sign-out | `signOutClearsAccountState.test.ts` | unit |

The store's read path is well covered **at the store level**. What no test reaches is the level
where the two harms are actually visible: a real browser render.

### Selected targets

Justification for scope: **selective**, not comprehensive. The production change is one loop over
a two-element array; the risk that justifies it is a rendered-DOM disclosure plus a render-time
`TypeError`. Coverage is therefore concentrated at the level that can observe those two things
and thin everywhere else.

#### E2E — Playwright `chromium` project, `tests/e2e/`

| ID | Scenario | Priority | What turns it red |
|---|---|---|---|
| `DW14-E2E-001` | Signed-in account loads Home with a previous couple's blob on the device (`state.events` carrying a private label + description). The label and description never reach the DOM, no countdown card exists for it, and Home renders its own cards rather than the ErrorBoundary. | **P0** | Reverting `STALE_PERSISTED_KEYS` to `['moods']`: the label appears **and** `getCalendarDaysDiff` throws on the string date, replacing Home with "Something went wrong". |
| `DW14-E2E-002` | The same load leaves the rest of the persisted blob working: seeded `isOnboarded` and `messageHistory` survive into the rewritten blob, and the seeded theme is applied. | **P1** | Any change that makes the strip take the corruption path (`localStorage.removeItem` + `return null`) instead of deleting one key. |
| `DW14-E2E-003` | A blob carrying **both** `moods` and `events`: neither the private mood note nor the event label reaches the DOM, on Home and on the Mood view. | **P1** | Replacing the loop with a single-key branch — one of the two keys survives. |
| `DW14-E2E-004` | Self-heal on disk: after one authenticated load, `my-love-storage` no longer carries either stale key and its `state` keys are exactly the `partialize` allowlist. | **P1** | A strip that withheld the key from state but left the blob intact would pass 001-003 and fail this. Measured live in exploration; currently pinned by nothing. |

All four share one mechanic — seed `my-love-storage` before the app's first script runs — which
does not exist in the suite today. That is the **fixture** deliverable
(`tests/support/fixtures/persisted-blob.ts`, `seedPersistedBlob`).

#### Unit — Vitest, `tests/unit/stores/`

Three Acceptance Criteria / Boundaries in the spec are asserted by no test. Each is a pure-logic
property that **cannot** be observed from a browser, so `test-levels-framework.md` puts them at
unit level rather than duplicating them upward.

| ID | Scenario | Priority | What turns it red |
|---|---|---|---|
| `DW14-UNIT-001` | With no stale key present, `getItem` returns the **byte-identical original string**, not a re-serialization. | **P1** | Spec Boundaries: "When no stale key is present, `getItem` must still return the original `str` untouched" and "Do not add … a second `JSON.stringify`". Today an unconditional `return JSON.stringify(data)` passes every existing test. |
| `DW14-UNIT-002` | `STALE_PERSISTED_KEYS` and the `partialize` allowlist are disjoint. | **P1** | The spec's own named residual risk: "Adding a key to it that `partialize` does persist would silently stop that key from rehydrating. The declaration comment warns, but nothing enforces it." Adding `'settings'` to the list turns this red. |
| `DW14-UNIT-003` | The persisted blob's `version` is `0`. | **P2** | AC #5. Step 1 established that **nothing** currently pins this: `grep -rn "my-love-storage\|version: 0" tests/support/` returns one line, and it is a `removeItem`. |

#### API — none generated, deliberately

`step-03` dispatches Worker A "always", and it ran. Its finding is that this change has **no HTTP
boundary**: `STALE_PERSISTED_KEYS` and its walk live entirely inside a `localStorage` adapter, and
the diff touches no request, no RPC, no migration, and no policy. Writing an API spec here would
mean inventing a surface, which `confidence-gate.md` scores below 5 ("Endpoint paths … Confidence
< 5 if the endpoint is being invented") and which `evidence-integrity.md` classifies as a check
that cannot fail.

The one adjacent API-level target that is *not* invented was evaluated and **declined on
evidence**, not overlooked:

> **Considered:** an `events_select` negative proving a third, non-couple account cannot read the
> couple's events — the server-side half of the same disclosure story.
> **Why declined:** (a) it tests a policy this change does not touch —
> `supabase/migrations/20260818000002_create_events_table.sql:64-75`, unmodified on this branch;
> (b) it has no safe identity. `tests/support/auth/worker-pool.ts` provisions *pairs* keyed on
> worker index (`getWorkerEmail` / `getWorkerPartnerEmail`) and exposes no spare unpaired account,
> so an "outsider" would have to be either another worker's user or a newly provisioned one —
> and `AGENTS.md` states the rule directly: "A spec must not link or unlink partners, reset a
> password, or null a shared row at teardown; those rows belong to other workers."
> **If the team wants it:** it needs a pool-level third identity provisioned in
> `tests/support/auth/global-setup.ts`, which is a framework change and belongs to the `framework`
> workflow, not to this one.

`pact_mcp_reachable`: not probed. No Pact artifact is in scope (Step 1), so the probe would have
no consumer.

### Execution mode for Step 3

`tea_execution_mode: auto` with `tea_capability_probe: true` would ordinarily resolve to
`subagent`. It is pinned to **`sequential`** here by a project rule that outranks the default —
`CLAUDE.md`: "In a bmad-loop worktree, do the work yourself — never hand the task to a background
subagent and wait. A subagent that dies or hangs sends nothing … and a session sleep-waiting on
one looks active to the loop's stall detector, so it silently burns its whole 90-minute session
timeout". Sequential is a first-class mode in `step-03` ("run blocking and wait before next
dispatch"), and the output contract is identical across modes.

```
⚙️ Execution Mode Resolution:
- Requested: auto
- Probe Enabled: true
- Supports agent-team: false (bmad-loop worktree policy)
- Supports subagent:   false (bmad-loop worktree policy)
- Resolved: sequential
```

---

## Step 3 — Generation (sequential: Worker A, then Worker B, then aggregate)

### Worker A — API test generation

Dispatched (the matrix launches it for every stack) and returned **zero test files**, by
design rather than by failure. Its finding, restated from Step 2: the change touches no HTTP
boundary, and the one adjacent API-level target that is not invented was declined on evidence —
it exercises an unmodified policy and has no parallel-safe identity in the worker pool.

`playwright_utils_deviations`: none. `pact artifacts`: none, relevance gate not met.

### Worker B — E2E test generation

Four scenarios, one file. Selectors were verified against source rather than guessed, and the
behaviour was verified against a live browser before the spec was written:

| Selector / string | Verified at |
|---|---|
| `event-countdown-<slug>` | `EventCountdown.tsx:237` — `` `event-countdown-${label.toLowerCase().replace(/\s+/g, '-')}` `` |
| `time-together`, `event-countdown-wedding` | `App.tsx` Home block; also asserted by `tests/e2e/home/events.spec.ts` |
| `events-empty-placeholder` | `App.tsx:691` |
| `mood-tracker`, `mood-note-input` | `MoodTracker.tsx:305`, `:527` |
| `'Something went wrong'` | `ErrorBoundary.tsx:52` |
| `'Selected: Sad'` | `MoodTracker.tsx:501` renders `Selected: {…label…}`; `:49` maps `sad → 'Sad'` |
| `--color-primary` = `#14b8a6` | `themes.ts:22` (ocean), applied by `themes.ts:75` from `App.tsx:352` |

### Step 3C — Aggregation and fixture infrastructure

Per §4-PU (`use_playwright_utils` is `true`):

- **A) Merged fixtures** — `tests/support/merged-fixtures.ts` already exists and already composes
  `apiRequest`, `recurse`, `log`, `intercept`, `network-error-monitor` and the project's own
  fixtures with `mergeTests`. Per the step's own rule ("If … already exists, extend its
  `mergeTests` call instead of replacing the file"), it was **not replaced**. It was also not
  extended — see the fixture-shape decision below.
- **B) Auth fixture** — already wired. `tests/support/fixtures/auth.ts` builds on `auth-session`
  with a real `SupabaseAuthProvider`, and the generated spec takes authenticated state from the
  `page` fixture that provider backs. No `TODO`, no form-driven login, nothing to name in the
  deviations list.
- **C) Data factories** — `stalePersistedEvent()` / `stalePersistedMood()` with overrides and
  faker-generated nonces, per `data-factories.md`.
- **D) Network stubs** — none. No spec here stubs an endpoint, so no shared payload module was
  created (the step forbids one below three consumers anyway).
- **E) Helper utilities** — one module, justified below.

**Why the seeding lands in `helpers/` rather than as a new `mergeTests` entry.** Two reasons, both
concrete. First, §4-PU(E) bars a fixture "whose body is one `interceptNetworkCall` or one
`apiRequest` call"; this one is neither, but it also owns no lifecycle — the auth fixture creates a
fresh `browser.newContext()` per test and closes it (`tests/support/fixtures/auth.ts`), and that
context's storage state carries only the Supabase token and `lastWelcomeView`
(`supabase-auth-provider.ts:146-157`), never `my-love-storage`. There is nothing for a teardown to
clean. Second, `merged-fixtures.ts` is the sole site of this worktree's known `TS2883` typecheck
baseline (six errors, all on the `mergeTests` call at `:53`); adding a merge argument widens a
baseline that this workflow was not asked to touch. `fixture-architecture.md`'s "pure function
core, fixture shell" is satisfied at the core layer, and the shell is omitted deliberately. The
precedent is `tests/support/helpers/scripture-cache.ts`, a page-taking module for exactly this
class of client-state manipulation.

---

## Step 4 — Validation & Summary

### Files created

| File | Lines | Contents |
|---|---|---|
| `tests/support/helpers/persisted-blob.ts` | 278 | Fixture/helper module: `seedPersistedBlob`, `readStoredBlob`, `makePersistedBlob`, `stalePersistedEvent`, `stalePersistedMood`, `eventCardTestId`, and the seed constants |
| `tests/e2e/home/persisted-events-strip.spec.ts` | 218 | 4 E2E scenarios — 1 P0, 3 P1 |
| `tests/unit/stores/persistedBlobContract.test.ts` | 238 | 5 unit cases across 3 targets |

No existing file was modified. `src/` is untouched:

```
$ git status --short
 M _bmad-output/implementation-artifacts/deferred-work.md      (pre-existing, the loop's ledger)
?? _bmad-output/test-artifacts/automation-summary-dw-persisted-events-key-strip.md
?? tests/e2e/home/persisted-events-strip.spec.ts
?? tests/support/helpers/persisted-blob.ts
?? tests/unit/stores/persistedBlobContract.test.ts
```

### Coverage delivered

| ID | Level | Priority | Test |
|---|---|---|---|
| `DW14-E2E-001` | E2E | **P0** | a device carrying a previous couple's events blob shows none of it, and Home still renders |
| `DW14-E2E-002` | E2E | P1 | stripping the stale key leaves the rest of the persisted blob working |
| `DW14-E2E-003` | E2E | P1 | a blob carrying both stale keys leaks neither the events nor the moods |
| `DW14-E2E-004` | E2E | P1 | one load clears both stale keys from the stored blob, not just from state |
| `DW14-UNIT-001` | unit | P1 | does not re-serialize a blob that carries no stale key **+** re-serializes a blob it stripped exactly once |
| `DW14-UNIT-002` | unit | P1 | never persists a key the read side strips back out **+** still writes every key the allowlist is there to write |
| `DW14-UNIT-003` | unit | P2 | keeps the storage key and version the strip was chosen to preserve |

API: **0 tests, deliberately.** Reasons in Step 2; not an omission.

### Falsifiability — every new test was proved able to fail

`evidence-integrity.md` requires naming the input that turns each check red. Rather than name it,
each was executed. Four mutations were applied to `src/stores/useAppStore.ts`, run, and reverted;
`git diff --stat src/` is empty afterwards and the restored tree was re-run green.

| Mutation | Expected red | Observed |
|---|---|---|
| `return mutated ? JSON.stringify(data) : str` → `return JSON.stringify(data)` | UNIT-001 first case | ✅ `1 failed \| 4 passed` — "does not re-serialize a blob that carries no stale key" |
| add `moods: state.moods` to `partialize` | UNIT-002 first case | ✅ `1 failed \| 4 passed` — "never persists a key the read side strips back out" |
| `version: 0` → `version: 1` | UNIT-003 | ✅ `1 failed \| 4 passed` — "keeps the storage key and version…" |
| `STALE_PERSISTED_KEYS = ['moods', 'events']` → `['moods']` (the story's own change reverted) | UNIT-001 second case, and all four E2E | ✅ unit: `3 failed \| 10 passed` (including the story's own two cases); E2E: **4 failed** |

The last row produced the run's most important piece of evidence. With the change reverted, the
error-context snapshot for the P0 test reads:

```yaml
- text: 💔
- heading "Something went wrong" [level=1]
- paragraph: We encountered an unexpected error. Please try again.
- paragraph: date.getFullYear is not a function
- button "Try Again"
```

That is the `TypeError` the spec predicted from first principles ("since JSON has no Date, it
would hand EventCountdown a string where it calls `date.getFullYear()`"), reproduced as an actual
browser crash. Before this run the prediction was an argument; it is now a demonstration, and the
P0 test is what keeps it demonstrated. It also reframes the change: `events` on disk is not only a
disclosure risk, it is a hard-down Home screen.

### Verification runs

| Command | Result | Baseline it is judged against |
|---|---|---|
| `npx playwright test tests/e2e/home/persisted-events-strip.spec.ts --project=chromium --workers=2` | **4 passed (7.5s)** | n/a — new file |
| same, `--repeat-each=3` (burn-in, `ci-burn-in.md`) | **12 passed (14.9s)**, 0 flaky | n/a |
| `npx vitest run tests/unit/stores/persistedBlobContract.test.ts` | **5 passed** | n/a — new file |
| `npx vitest run` (full unit suite) | **93 files / 1413 tests passed** | spec recorded 92 / 1408 post-change; +1 file / +5 tests is exactly this run's addition, nothing regressed |
| `npm run lint` | **0 errors, 3 warnings** | byte-identical to the spec's recorded baseline (pre-existing `react-refresh/only-export-components` in `EventCountdown.tsx`) |
| `npm run typecheck` | **6 errors, all `TS2883` in `tests/support/merged-fixtures.ts`** | identical to this worktree's recorded baseline; **0 non-baseline errors** |
| `npx playwright test tests/e2e/home/events.spec.ts --grep "shows own and partner future events"` | **1 passed** | pre-existing spec, run as an environment control |

### One environment trap, worth recording

The first E2E run failed all four cases on the sign-in screen — and so did the pre-existing
`events.spec.ts`, which is what identified it as environmental rather than a defect in the new
spec. Cause: `playwright.config.ts` sets `reuseExistingServer: !process.env.CI`, so Playwright
adopted the `npx vite --mode test` server started earlier for browser exploration. That server
never received the ES256-re-signed keys the config's env block force-sets, so it served the
`.env.test` placeholder anon key and no fixture-minted session could be restored. This is the same
failure class `AGENTS.md` records for the Realtime 403s. **Kill any hand-started dev server before
running E2E**; let Playwright's `webServer` start its own.

### Checklist validation (`checklist.md`)

Passing, with three items answered rather than ticked:

- ✅ Every spec imports `test` from `tests/support/merged-fixtures`; `merged-fixtures.ts` exists and
  composes with `mergeTests`; package name is `@seontechnologies/playwright-utils` throughout.
- ✅ No `page.waitForTimeout`, no `page.route`/`page.waitForResponse` on an app endpoint, no
  `console.log`, no `.only`/`.skip`, no conditional flow (`if (await …)`), no try-catch for test
  logic, no page-object classes, no shared state between tests. Scanned, not assumed.
- ✅ Async wait uses `recurse`, not a hand-written poll.
- ✅ `network-error-monitor` is in the merge; no test needed a `skipNetworkMonitoring` opt-out,
  because none drives an error response.
- ✅ Authenticated state comes from the wired `auth-session` provider.
- ✅ Factories with faker; no cross-test data collisions (`coupleEvents` clears the worker's own
  pair before and after, and every stale string carries a per-call nonce).
- ⚠️ *"All tests use data-testid selectors (E2E tests)."* Partially. Positive assertions use
  `getByTestId`. The disclosure assertions use `getByText(<nonce string>)` with `toHaveCount(0)`
  **on purpose**: the claim is "this string is nowhere on the page", which no testid can express —
  a testid-scoped absence assertion would pass while the text leaked somewhere else.
- ⚠️ *"Given-When-Then format with clear comments."* Not literally. No spec in `tests/e2e/`
  uses GWT headers; the house style is a prose comment naming what the assertion is for and why.
  The generated files match the surrounding code rather than importing a foreign convention.
- ⚠️ *"No hardcoded test data."* One literal: the label `'Real Anniversary Strip'` in the P0 test.
  `data-factories.md` explicitly covers naming the domain literals a test hardcodes on purpose;
  this one is safe because `coupleEvents` scopes and clears rows per worker pair.
- ✅ CLI sessions cleaned up: `playwright-cli -s=tea-automate close` → `Browser 'tea-automate'
  closed`. No `close-all`. `.playwright-cli/` is gitignored (`.gitignore:93`).
- ✅ Artifacts written under `_bmad-output/test-artifacts/`, nowhere else.

### Playwright Utils deviations

**None.**

No RECOMMENDED utility was wanted-but-unwirable either. For completeness, since the reader cannot
tell "not needed" from "forgotten":

- `auth-session` — already wired (`SupabaseAuthProvider`), used.
- `network-recorder` — not needed; no offline or backend-free scenario in this plan.
- `webhook-*` — not applicable; no async event boundary in this change.
- `burn-in` — the repo has `scripts/burn-in.sh` / `npm run test:burn-in`; this run used
  `--repeat-each=3` directly for a single-file check, which is the same guarantee at this scale.
- `file-utils`, `handleDownload` — no download in scope.

### Pact.js Utils deviations

**N/A.** No contract artifacts generated — the relevance gate in `pactjs-utils-mandate.md` is not
met (single consumer, no independently deployed provider, no Pact indicators in the repo).

### Findings surfaced, not acted on

Three things this run measured that are outside its scope to change. None is a defect in the
story's change.

1. **The story's test docblock describes the unit environment, not the app.**
   `tests/unit/stores/persistedEvents.test.ts:105-108` says the adapter "never rewrites
   localStorage, so the seeded blob is still on disk with its stale keys intact afterwards".
   Probed both ways: under happy-dom the seeded key **does** survive on disk
   (`PROBE_KEYS=["isOnboarded","settings","messageHistory","events"]`), so the statement is true
   where it is written; in a browser running the app the key is **gone** after one load, because
   Zustand re-persists the `partialize` allowlist on the first post-hydration state change. Both
   halves are now pinned — the unit half by the story's own file, the browser half by
   `DW14-E2E-004`. The docblock was not edited.

2. **A partial `messageHistory` in the persisted blob crashes the app.** Zustand's merge is
   shallow, so a blob whose `messageHistory` omits `favoriteIds` replaces the default object
   outright, and `DailyMessage.tsx:59` then evaluates `messageHistory.favoriteIds.includes(...)`
   → `Cannot read properties of undefined (reading 'includes')` → ErrorBoundary. Found by this
   run's first failing E2E attempt, whose seed was partial. Unreachable from a blob the app itself
   wrote (`partialize` spreads the whole object), so it is a hand-edited-blob robustness gap of the
   same class as the entries this story closed — not a live bug. The seeding helper now mirrors the
   full default shape and documents why.

3. **AC #5's "`version: 0` is pinned by the E2E auth fixtures" was not true when this run
   started.** `grep -rn "my-love-storage\|version: 0" tests/support/` returned exactly one line,
   a `removeItem` in `scripture-cache.ts`. `DW14-UNIT-003` now pins it, and the mutation run
   confirms a bump to `version: 1` turns it red.

### Residual risk in what was generated

- `DW14-UNIT-001` counts `JSON.stringify` calls filtered to the seeded blob. It is the only
  mechanism-level test in the set, because "returned the original string" has no behavioural
  consequence downstream — Zustand parses whatever it gets. It is scoped by a
  `currentIndex: 7` sentinel rather than by a raw call count, and the mutation run shows it fires
  on the real regression and nothing else. If the adapter is ever restructured to serialize
  through something other than `JSON.stringify`, this test goes green-but-meaningless and would
  need rewriting rather than deleting.
- `DW14-E2E-004` depends on Zustand writing at least once after hydration. That write is
  triggered by ordinary app init, and burn-in at `--repeat-each=3` saw no flake, but it is an
  eventual-consistency assertion and so is polled with `recurse` at a 15s ceiling rather than read
  once.
- `DW14-E2E-002` asserts `--color-primary` to prove the seeded settings (not defaults) were used.
  That couples the test to the ocean palette in `src/utils/themes.ts:22`. Changing that hex without
  changing `SEEDED_THEME_PRIMARY` turns the test red for a cosmetic reason; both constants are
  cross-referenced in comments.

### Next recommended workflow

`trace` — `_bmad-output/test-artifacts/traceability-matrix.md` predates this story and does not
carry DW-14/DW-20. A trace run would map the five Acceptance Criteria in
`spec-dw-14-20-persisted-events-key-strip.md` onto the seven test IDs above and issue the gate
decision. `test-review` is the weaker second choice here: this run already applied
`test-quality.md` and proved falsifiability by mutation, which is most of what that lens checks.

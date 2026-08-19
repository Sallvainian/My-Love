---
runScope: 'epic-level'
runKey: 'epic-dw-events-offline-message-honesty'
workflowStatus: 'completed'
totalSteps: 5
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
nextStep: ''
lastSaved: '2026-08-19'
---

# Step 1 output — Mode detection & run identity

## Mode: Epic-Level

**Why.** Rule A (user intent, highest priority) resolves this before file-based
detection is consulted. The invocation names a single work item
(`dw-events-offline-message-honesty`) and asks for "a risk assessment and a
risk-based coverage strategy for the changes currently in the working tree".
The available inputs are a story-level spec with an explicit Tasks &
Acceptance section and an I/O & Edge-Case Matrix
(`_bmad-output/implementation-artifacts/spec-dw-7-18-events-offline-message-honesty.md`),
plus a deferred-work ledger. There is no PRD and no ADR in the repository, so
the "Epic + Stories (no PRD/ADR)" branch applies.

Note on Rule B: `find . -name sprint-status.yaml -not -path ./node_modules/*`
returns nothing in this worktree, which under file-based detection alone would
have routed to System-Level. Rule A takes priority and the prerequisites for
System-Level (PRD, ADR, architecture doc) are absent, so Epic-Level is the only
mode whose inputs actually exist.

## Prerequisite check — Epic-Level

| Requirement | Status | Source |
|---|---|---|
| Epic/story requirements with acceptance criteria | Met | `spec-dw-7-18-events-offline-message-honesty.md` — `## Tasks & Acceptance` lists 5 Given/When/Then criteria and 8 execution tasks |
| Architecture context | Partial | `AGENTS.md` (three data models, Supabase-only vs offline-first), spec `## Code Map` (9 files with line anchors), `## Design Notes` |

No halt condition triggered.

## Run identity

- `run_scope`: `epic-level`
- `epic_num`: `dw-events-offline-message-honesty` (the item carries no epic
  number; slug derived from the work-item key per step-01 §4 — already
  lowercase, hyphen-separated, alphanumeric, 32 chars)
- `run_key`: `epic-dw-events-offline-message-honesty`
- Step 5 output target: `_bmad-output/test-artifacts/test-design-epic-dw-events-offline-message-honesty.md`

## Checkpoint state

No prior checkpoint at this path. `_bmad-output/test-artifacts/` held only
`test-design-progress-epic-5.md`, which belongs to run key `epic-5` and is
neither read nor written by this run. This is a fresh run.

## Scope under test (established for later steps)

Working-tree state at `git status --porcelain`: one modified file,
`_bmad-output/implementation-artifacts/deferred-work.md` (+46/-2).
Branch vs `main` (`git diff --stat main...HEAD`): 4 files, +656/-21.

| File | Change | Under test? |
|---|---|---|
| `src/api/interactionService.ts` | +78/-14 | Yes — the only production file whose behavior changes |
| `tests/unit/api/interactionService.test.ts` | +350, new | Yes — as the coverage instrument being assessed |
| `_bmad-output/implementation-artifacts/spec-dw-7-18-events-offline-message-honesty.md` | +224, new | Document only |
| `_bmad-output/implementation-artifacts/deferred-work.md` | +25/-… committed, +46/-2 uncommitted | Ledger only; DW-7/DW-18 closed, DW-31..DW-35 opened |

---

# Step 2 output — Context & knowledge loaded

## Config resolved (`_bmad/tea/config.yaml`)

| Key | Value |
|---|---|
| `test_artifacts` | `{project-root}/_bmad-output/test-artifacts` |
| `tea_use_playwright_utils` | `true` |
| `tea_use_pactjs_utils` | `true` |
| `tea_pact_mcp` | `mcp` |
| `tea_browser_automation` | `auto` |
| `test_stack_type` | `auto` |
| `risk_threshold` | `p1` |

## Stack detection → `frontend`

- Mobile indicators: none. No `.maestro/`, `app.json`, `Podfile`, `android/`, `*.xcodeproj`, `pubspec.yaml`.
- Frontend indicators: `playwright.config.ts` present; `package.json` declares `"react": "^19.2.8"`.
- Backend indicators: none of `pyproject.toml`, `pom.xml`, `build.gradle`, `go.mod`, `*.csproj`, `Gemfile`, `Cargo.toml`. (A `supabase/` migration tree exists but matches no listed indicator.)
- Browser tests detected (`page.goto` / `page.locator` in `tests/e2e/home/events.spec.ts`, `tests/support/helpers.ts` and others) → **Full UI+API Playwright Utils profile**.

## Mandates

**Playwright Utils — BINDING.** Both gates pass: flag `true`, and `"@seontechnologies/playwright-utils": "^4.4.0"` is in `package.json` devDependencies. `tests/support/merged-fixtures.ts` already composes `apiRequestFixture`, `recurseFixture`, `logFixture`, `interceptFixture` and `createNetworkErrorMonitorFixture`. Every Playwright example this design emits imports `test` from `tests/support/merged-fixtures.ts` and uses `apiRequest` / `interceptNetworkCall` / `recurse` rather than the vanilla equivalents.

**Pact.js Utils — NOT RELEVANT, not loaded.** `pactjs-utils-mandate.md` carries the relevance gate, and it does not open here: detected stack is `frontend` (not `backend`/`fullstack`); `grep -c pact package.json` = 0; no `pact/` or `tests/contract/` directory; no `*.pacttest.ts` anywhere outside `node_modules`; no microservices indicators. Per `library-integration-mandate.md` the flag "never means 'add contract tests to this project'". Contract testing is out of scope for this run.

**Pact MCP.** `tea_pact_mcp: mcp`. Probe recorded once: `pact_mcp_reachable = false` — no `mcp__*pact*` tool is present in this session's tool list. Per `pact-mcp.md` the probe is a tool-list check, never a broker call. Because contract testing is not relevant here, the degradation path is a no-op; nothing in this design rests on broker data and none is inferred.

## Knowledge fragments loaded

Core, required for Epic-Level: `risk-governance.md`, `probability-impact.md`, `test-levels-framework.md`, `test-priorities-matrix.md`.
Also loaded: `library-integration-mandate.md`, `playwright-utils-mandate.md`, `confidence-gate.md`, `evidence-integrity.md`, `nfr-criteria.md` (the change is a reliability/error-handling change), and the relevance gate of `pactjs-utils-mandate.md`.
Deliberately not loaded: the per-utility Playwright Utils fragments beyond the mandate (no new fixture composition is proposed), every `pactjs-utils-*` and `pact-*` fragment, `maestro-*`, `mobile-*`, `webhook-*`, `email-auth`, `feature-flags`.

## Input documents

- `_bmad-output/implementation-artifacts/spec-dw-7-18-events-offline-message-honesty.md`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `src/api/interactionService.ts`, `src/api/errorHandlers.ts`, `src/services/eventsService.ts` (reference idiom), `src/stores/slices/interactionsSlice.ts`, `src/components/PokeKissInterface/PokeKissInterface.tsx`, `src/utils/offlineErrorHandler.ts`, `src/utils/interactionValidation.ts`
- `tests/unit/api/interactionService.test.ts`, `tests/support/merged-fixtures.ts`, `tests/unit/stores/loaderIdentityGuards.test.ts`
- `supabase/migrations/20251206024345_remote_schema.sql`
- `vitest.config.ts`, `playwright.config.ts`, `package.json`
- `AGENTS.md`
- `/Users/sallvain/Projects/My-Love/node_modules/@supabase/postgrest-js/dist/index.mjs` (v2.112.3, read-only, for client contract)

## Existing coverage — measured, not estimated

Suite shape: `find tests -name "*.test.ts*" -not -path "*/e2e-archive/*" | wc -l` = **47**; `find tests -name "*.spec.ts" -not -path "*/e2e-archive/*" | wc -l` = **36**. Playwright projects: `chromium` (`./tests/e2e`), `api` (`./tests/api`), `integration` (`./tests/integration`).

Executed in this worktree: `npx vitest run tests/unit/api/interactionService.test.ts` → **15 passed, 1 file, 4 ms**. The suite is genuinely green here; the run wrote `test-results/vitest-junit.xml`.

Coverage of the changed file, measured with `npx vitest run tests/unit/api/interactionService.test.ts --coverage --coverage.include='src/api/interactionService.ts'`:

| Metric | Value |
|---|---|
| Statements | 71.42% (45/63) |
| Branches | 50% (20/40) |
| Functions | 57.14% (8/14) |
| Lines | 72.58% (45/62) |

Uncovered statement lines: `238, 249, 250, 254, 257–262, 301, 302, 315, 348, 349, 390, 395`.
Uncovered functions: `subscribeInteractions@225` and its five inner callbacks.
Branches taken one way only (v8 `branchMap`, counts as `[if, else]`):

| Branch | Counts | What is never exercised |
|---|---|---|
| `cond-expr@77` | `[9, 0]` | `networkFailure`'s `'Unknown network error'` arm — **new code in this change** |
| `if@296` | `[2, 0]` | `getInteractionHistory` success path |
| `if@314` | `[0, 2]` | `getInteractionHistory` → `handleSupabaseError` — **an edited catch tail** |
| `if@344` | `[3, 0]` | `getUnviewedInteractions` success path |
| `if@386` | `[2, 0]` | `markAsViewed` success path |
| `if@394` | `[0, 2]` | `markAsViewed` → `handleSupabaseError` — **an edited catch tail** |

Repo coverage thresholds are `lines/functions/branches/statements: 25` (`vitest.config.ts:52-57`) — global, with no per-file rule, so none of the above can fail CI.

E2E coverage of this feature: `tests/e2e/partner/partner-mood.spec.ts:35` `[P0] 4.5-E2E-002 should display poke/kiss interaction buttons` asserts only that `poke-button` and `kiss-button` are visible. No E2E exercises a send, a failure, or any interaction error message.

## Missing inputs

No PRD, no ADR, no architecture document, and no prior system-level test-design output exist in this repository. Nothing in this epic-level plan depends on them; where a threshold would normally come from a PRD it is recorded as **UNKNOWN** below rather than guessed.

---

# Step 3 output — Risk assessment & testability

## Scope recap

One production file changes behavior: `src/api/interactionService.ts` (+78/−14). It removes `handleNetworkError` from five failure paths and replaces them with a module-local `InteractionWriteError` (offline guard, zero-row insert) and a module-local `networkFailure` builder (four catch tails). `tests/unit/api/interactionService.test.ts` is new (350 lines, 15 tests). `src/api/errorHandlers.ts`, `src/api/moodApi.ts` and `src/api/moodSyncService.ts` are untouched — confirmed by `git diff --stat main..HEAD`, which lists only the four files in the step-1 table.

The uncommitted working-tree change is `_bmad-output/implementation-artifacts/deferred-work.md` alone (+46/−2): it closes DW-7 and DW-18 and opens DW-31 … DW-35. It is a ledger, carries no executable behavior, and is therefore not a test target — but DW-31 … DW-35 are the source of several rows below.

## Risk register

Scored with `probability-impact.md`: probability 1 = unlikely / 2 = possible / 3 = likely-or-already-true; impact 1 = minor / 2 = degraded / 3 = critical. Action thresholds 1–3 DOCUMENT, 4–5 MONITOR, 6–8 MITIGATE, 9 BLOCK.

### R-1 · TECH · Score 6 · MITIGATE — A zero-row insert has two possible client outcomes and the suite tests only the less likely one

**Evidence.** `interactionService.ts:172-176` issues `.insert(interactionInsert).select().single()`. In `postgrest-js@2.112.3`, `select(columns)` ends with `this.headers.append("Prefer", "return=representation")`, and `single()` is `single() { this.headers.set("Accept", "application/vnd.pgrst.object+json"); return this; }`. Under those two headers a zero-row insert comes back as a **PostgrestError**, not as `{ data: null, error: null }` — the client's own zero-or-multiple handler builds `{ code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", status: 406, statusText: "Not Acceptable" }`. That value is thrown at `:179`, caught at `:190`, fails the `instanceof InteractionWriteError` test at `:191`, is logged by `logSupabaseError`, matches `isPostgrestError` at `:197`, and `errorHandlers.ts:70` maps `PGRST116` to `'No rows found'`. The caller reads **`'[InteractionService.sendInteraction] No rows found'`**.

The state the `!data` branch at `:182-186` guards *is* producible by this client, but only one way: `PostgrestBuilder`'s response handler contains `if (body === "") {}` on the `res.ok` path, leaving both `data` and `error` null when a 2xx arrives with an empty body. With `Prefer: return=representation` on the request that needs an intermediary or a server configuration that drops the representation. So the branch is **defensive with unverified reachability** — not dead code, and not the common case either.

The suite covers only the defensive half. `tests/unit/api/interactionService.test.ts:229-250` reaches it through the fake's `insertReturnsNothing` flag (`:91` returns `{ data: [], error: null }`; the fake's `single()` at `:132-135` collapses that to `{ data: null, error: null }`). The fake models no PGRST116 outcome at all.

**Why it matters.** The spec's I/O matrix row *"Insert returns no row → Message says the interaction was not sent"* is satisfied on the tested path (`'The poke was not sent'`) and **not** satisfied on the likelier one (`'No rows found'`, which names neither the interaction nor the fact it was lost). Both messages are honest — neither promises a sync, so the change's headline acceptance criterion holds either way — but the suite reports that matrix row as covered while its more probable realisation is unasserted. That is `evidence-integrity.md`'s "probe observing a proxy" shape moved into a fake: the fixture's contract diverges from the client's on exactly the branch the new error class was introduced for, and every future test written against this fake inherits the divergence.

P 3 (already true of the suite) × I 2 (this file is the entire regression guard for the change) = **6**. Owner: dev. Timeline: with the next edit to this file.

### R-2 · TECH · Score 4 · MONITOR — Two of the four edited catch tails have no test for their PostgREST branch

**Evidence.** The change rewrote four catch tails (`:201`, `:318`, `:365`, `:398`). Measured v8 branch counts: `if@314` = `[0, 2]` and `if@394` = `[0, 2]` — `isPostgrestError` is never true in `getInteractionHistory` or `markAsViewed`, and statements `315` and `395` are uncovered. Only `sendInteraction` (`:319-333` of the test) and `getUnviewedInteractions` (`:335-348`) have a PostgREST test.

**Why it matters.** In those two methods, swapping the `isPostgrestError` branch and the `networkFailure` throw — or deleting the `handleSupabaseError` call outright — passes the whole suite. The change's central claim is that PostgREST routing is *unchanged*; for half the edited tails nothing checks it.

P 2 × I 2 = **4**. Owner: dev.

### R-3 · TECH · Score 4 · MONITOR — `networkFailure`'s non-`Error` arm is new code with zero coverage

**Evidence.** `interactionService.ts:77`: `const detail = error instanceof Error ? error.message : 'Unknown network error';`. Measured branch `cond-expr@77` = `[9, 0]` — across all fifteen tests the `'Unknown network error'` arm never runs. The identical line in `eventsService.ts:124-127` is where it was copied from.

**Why it matters.** This function is the change's headline artifact; the whole point is that every message it can emit is truthful. One of its two possible messages has never been produced by a test. A rejection with a non-`Error` value (a thrown string, a bare object from a mis-wrapped fetch) takes it.

P 2 × I 2 = **4**. Owner: dev. One test closes it.

### R-4 · TECH · Score 4 · MONITOR — A second, still-false sync promise is live in `src/utils`, with nothing preventing the next Supabase-only feature from adopting it

**Evidence.** `src/utils/offlineErrorHandler.ts:74`: `export const OFFLINE_ERROR_MESSAGE = "You're offline. Changes will sync when reconnected.";` — a different sentence from `errorHandlers.ts:95`, making the same false promise. `grep -rn "offlineErrorHandler" src/` returns exactly one consumer: `src/components/MoodTracker/MoodTracker.tsx:31`, rendered at `:432`, where mood's service-worker queue makes it true. The honest sibling sits five lines below at `:79`: `OFFLINE_RETRY_MESSAGE = "You're offline. Please check your connection and try again."`.

**Why it matters.** The defect class this change closes for interactions has **two** live sources, and every mitigation so far is per-file: `eventsService.ts` and `interactionService.ts` each carry their own copy of the convention (DW-33), and the only tests are file-local. Nothing at repo level — no lint rule, no cross-cutting test — stops a third Supabase-only feature from importing either symbol and reintroducing the exact bug. `AGENTS.md` records three data models, and photos, love notes and partner interactions are all Supabase-only, so the population at risk is already larger than the two files that have been fixed.

P 2 × I 2 = **4**. Owner: dev. This is the one risk on the list whose mitigation is cheap and permanent (see TEST-05).

### R-5 · DATA · Score 4 · MONITOR — `markAsViewed` reports success on a zero-row UPDATE (DW-31), and the catch-tail edit does not change that

**Evidence.** `interactionService.ts:379-400` inspects `error` only, never a row count. Verified in the migration rather than taken from the ledger: `supabase/migrations/20251206024345_remote_schema.sql:316-321` creates `"Users can update received interactions"` on `public.interactions` `for update` `using ((( SELECT auth.uid() AS uid) = to_user_id))` — with no `with check` clause and no returning projection, a non-recipient's UPDATE is filtered to zero rows with no error. `interactionsSlice.ts:132-142` then runs `unviewedCount: Math.max(0, state.unviewedCount - 1)` regardless. `eventsService.ts:413` guards the same class with `'Event not found or not yours to edit'`.

**Why it matters.** Not reachable through today's UI — `handleAnimationComplete` only passes rows from `getUnviewedInteractions`, which filters on `to_user_id`. It is reachable by any future caller, and the badge count drifts silently when it happens.

P 1 × I 3 (a wrong unread count is user-visible and self-inflicted state corruption) = **3**… recorded as **4** on the strength of `interactionsSlice.ts:142` decrementing unconditionally, which converts a silent no-op into observable state drift. Owner: dev. Out of this change's scope (DW-31, open).

*(Scoring note: P 1 × I 3 = 3 by the formula. The row is filed under MONITOR because the deferred entry stays open and the mitigation is a row-count check, not because the arithmetic changes. Treat 3/DOCUMENT as the governing action.)*

### R-6 · BUS · Score 3 · DOCUMENT — No user sees any of this; the fix is invisible above the service layer

**Evidence.** `PokeKissInterface.tsx:183-186` — `console.error('[PokeKissInterface] Failed to send poke:', error); setShowToast('Failed to send poke. Try again.');` — and `:216-220` for kiss. Neither renders `error.message`. `interactionsSlice.ts:94` and `:127` `console.error` and re-throw without transforming. The spec's Code Map records this as read-only evidence that "no UI copy needs updating".

**Why it matters.** Offline, the user still reads "Failed to send poke. Try again." — no worse than before, and no better. The honesty repair lands in logs and in the contract available to future callers. Practically: **no E2E or component test can observe this change**, which is why the coverage plan in step 4 puts nothing at the E2E level. That is a deliberate exclusion, recorded so a later reader does not read the absence as an oversight.

P 3 (certain) × I 1 (no regression) = **3**.

### R-7 · TECH · Score 2 · DOCUMENT — `navigator.onLine` is the only offline signal

**Evidence.** `errorHandlers.ts:44-46`: `export const isOnline = (): boolean => { return navigator.onLine; };`, called at `interactionService.ts:156`. A device on a captive portal or a LAN with no route out reports `onLine === true`.

**Why it matters.** Such a device passes the guard, issues the insert, and receives `'[InteractionService.sendInteraction] Network error: Failed to fetch. Check your internet connection.'` instead of the offline message. Both are truthful; only specificity is lost. Unchanged by this diff.

P 2 × I 1 = **2**.

### R-8 · TECH · Score 2 · DOCUMENT — Three read/update methods still have no offline guard (DW-32)

**Evidence.** `interactionService.ts:156` is the only `isOnline()` call in the file. `getInteractionHistory` (`:282`), `getUnviewedInteractions` (`:335`) and `markAsViewed` (`:379`) enter their `try` directly. Offline they emit `'[InteractionService.<method>] Network error: Failed to fetch. Check your internet connection.'`.

**Why it matters.** Truthful after this change, so it is specificity rather than honesty. The spec's Never list excludes adding guards as new behavior; DW-32 is open.

P 2 × I 1 = **2**.

### R-9 · OPS · Score 1 · DOCUMENT — The `logSupabaseError` bypass has no production effect

**Evidence.** `interactionService.ts:191-193` re-throws `InteractionWriteError` ahead of `logSupabaseError` at `:195`. The spec's Residual Risks lists the lost `[Supabase]` log prefix. Checking the two paths that reach the re-throw: the **offline** path throws at `:159`, *before* the `try` at `:162`, so it never reached `logSupabaseError` before this change either; the **zero-row** path is R-1's unreachable branch. The production delta is therefore zero. Both paths are still logged downstream at `interactionsSlice.ts:94` / `:127` and `PokeKissInterface.tsx:183`.

P 1 × I 1 = **1**. Recorded to correct the spec's own residual-risk entry, which overstates this.

### R-10 · TECH · Score 4 · MONITOR — `subscribeInteractions` is wholly untested and calls `supabase.channel()` directly (DW-35)

**Evidence.** Measured: `subscribeInteractions@225` and its five inner callbacks are the only uncovered functions in the file; statements `238, 249, 250, 254, 257-262` never execute. `:253-255` passes a logger into `.subscribe()` and surfaces neither `CHANNEL_ERROR` nor `TIMED_OUT`. `AGENTS.md` records the direct-`supabase.channel()` teardown pitfall repo-wide; the missing error path is the half it does not cover. The file's own comment at `:229-237` documents the shared-topic hazard.

**Why it matters.** Unchanged by this diff and out of scope, but it is the largest single coverage hole in the file under test and it is what pulls the file's function coverage down to 57.14%.

P 2 × I 2 = **4**. Owner: dev, via DW-35.

### Risk summary

| ID | Cat | P | I | Score | Action | In this change's scope? |
|---|---|---|---|---|---|---|
| R-1 | TECH | 3 | 2 | **6** | MITIGATE | Yes |
| R-2 | TECH | 2 | 2 | 4 | MONITOR | Yes |
| R-3 | TECH | 2 | 2 | 4 | MONITOR | Yes |
| R-4 | TECH | 2 | 2 | 4 | MONITOR | Adjacent (defect class) |
| R-5 | DATA | 1 | 3 | 3 | DOCUMENT | No — DW-31 |
| R-6 | BUS | 3 | 1 | 3 | DOCUMENT | Yes (as an exclusion) |
| R-7 | TECH | 2 | 1 | 2 | DOCUMENT | No |
| R-8 | TECH | 2 | 1 | 2 | DOCUMENT | No — DW-32 |
| R-9 | OPS | 1 | 1 | 1 | DOCUMENT | Yes (corrects the spec) |
| R-10 | TECH | 2 | 2 | 4 | MONITOR | No — DW-35 |

**No risk scores 9.** Nothing here blocks. One risk (R-1) crosses the mitigation threshold, and it is a test-integrity risk rather than a product defect: the shipped code is correct on every reachable path this design could find.

## Testability assessment

### Strong

- **The failure surface is directly addressable.** `InteractionService` is a plain class with no constructor dependencies, and `tests/setup.ts` installs no Supabase mock, so a per-file `vi.mock('@/api/supabaseClient', …)` gives complete control of the boundary. The existing file proves it: fifteen tests, 4 ms.
- **Offline is controllable in a unit test.** `setOnline()` (`tests/unit/api/interactionService.test.ts:156-158`) redefines `navigator.onLine` with `configurable: true`, and `afterEach` restores it. `happy-dom` supports this; no fixture or browser is needed.
- **The regression is pinned the right way.** Messages are compared with `toBe`, not `toContain`. The file's header explains why in one paragraph: the regression is an *extra sentence*, and a substring assertion would pass with the promise re-attached. This is the correct call and worth preserving verbatim in any test added later.
- **The offline guard's central claim is falsifiable.** `backend.fromCalls` (`:52`, asserted `toBe(0)` at `:208`) proves the guard returns before any request, which is the one property a message assertion alone cannot establish.
- **The observability claim is asserted by contrast, not in isolation.** `:241-250` asserts `console.error` was *not* called and `:252-258` asserts it *was* on the neighbouring path. A single-sided assertion here would be satisfied by a test that simply never triggers logging.

### Concerns

- **🚨 TEST-A (feeds R-1) — the fake's `single()` diverges from the client's on the branch that matters.** The fake at `:132-135` returns `{ data: null, error: null }` for every zero-row result. The real client returns that shape only for a 2xx with an empty body; for a zero-row `application/vnd.pgrst.object+json` request it returns a `PGRST116` PostgrestError, which the fake cannot produce at all. The fake is this file's only boundary model, so the gap is inherited by anything written against it.
- **🚨 TEST-B (feeds R-2, R-3) — coverage is asymmetric in a way the numbers hide.** 71.42% statements looks healthy against a 25% threshold, but the three uncovered clusters are all failure-mode branches in the code that changed. Global thresholds cannot see this; there is no per-file rule in `vitest.config.ts`.
- **🚨 TEST-C (feeds R-4) — the honesty property has no repo-level guard.** It is enforced today by two module headers, four `// NOT handleNetworkError:` comments, and file-local `SYNC_PROMISE` constants in two test files. Nothing fails when a third service imports `handleNetworkError` or `OFFLINE_ERROR_MESSAGE`. The property is repo-wide; the enforcement is per-file.
- **⚠️ TEST-D (feeds R-6) — the property is unobservable above the service.** No component or E2E test can distinguish the pre- and post-change build, because `PokeKissInterface` renders a constant string. Any attempt to write an E2E for this change would be a hollow check.
- **⚠️ TEST-E — no live-stack verification is possible in this session.** E2E requires `supabase start` (`AGENTS.md`), which is not running, so R-1's PostgREST claim is established from the client's shipped source rather than from an observed 406. That is one inference step short of direct observation; TEST-01 below closes it.
- **ℹ️ TEST-F — `.or()`, `.order()` and `.range()` are no-ops in the fake** (`:127-131`, with a comment saying so). The history read's predicate, ordering and pagination are therefore unexercised — correct for a failure-surface file, and the reason TEST-04 is scoped as it is.

## NFR planning

| Category | In scope | Threshold | Planned evidence |
|---|---|---|---|
| **Reliability** | Yes — this is an error-handling change | **UNKNOWN.** No PRD or ADR exists; the spec states a qualitative bar ("Every message a caller can read must describe what actually happened") and no numeric target. Do not invent one. | The unit suite. Per `nfr-criteria.md`, graceful degradation is verified where each failure mode produces its own accurate message; today four of six matrix rows are pinned and the reachable zero-row row is not. |
| **Maintainability** | Yes | Repo global 25% (`vitest.config.ts:52-57`). `test-priorities-matrix.md` would put a P1 unit target at >80%; the changed file measures **71.42% statements / 50% branches**. No per-file threshold exists, so nothing enforces either number. | Measured coverage of `src/api/interactionService.ts` (command recorded in step 2). Duplication: the class and builder now exist in two byte-similar copies (DW-33) — `nfr-criteria.md` puts duplication under CI tooling, and this repo runs no duplication check. |
| **Security** | No new surface | n/a | The change adds no query, no policy, no exported symbol (`InteractionWriteError` is deliberately unexported, `:62`). RLS enters only as the *mechanism* behind R-1 and R-5, not as something this change alters. `supabase/tests/database/02_rls_policies.sql` asserts the policy set with pgTAP and is untouched. |
| **Performance** | No | n/a | No code path gained work; `networkFailure` runs only on a rejection. |
| **Observability** | Yes | UNKNOWN | R-9 — measured delta is zero. |

## Highest-priority findings

1. **R-1 / TEST-A** — keep the two existing tests (the defensive branch is real), teach the fake the `PGRST116` outcome, and add the assertion for the path a live PostgREST actually takes.
2. **R-2 / R-3 / TEST-B** — three cheap unit tests close every uncovered branch in the code this change wrote.
3. **R-4 / TEST-C** — one repo-level guard converts a per-file convention into an enforced invariant, and is the only mitigation here that protects features not yet written.

Confidence: **8**. Rationale: every claim above cites a line read in this session — `postgrest-js@2.112.3 dist/index.mjs` for the `single()`, `select()` and empty-body contracts, measured v8 `branchMap`/`fnMap` output for every coverage number, `supabase/migrations/20251206024345_remote_schema.sql:316-321` for the UPDATE policy, and two executed `vitest run` invocations (`15 passed` for the file, `89 files / 1316 tests passed` for the suite) for the suite's state. Unknowns: (a) PostgREST's server-side response to a zero-row `application/vnd.pgrst.object+json` insert is inferred from the client's own error construction rather than observed against a live stack — `supabase start` is not running in this session, and TEST-01 exists to observe it; (b) no PRD/ADR exists, so every NFR threshold is recorded UNKNOWN rather than guessed.

---

# Step 4 output — Coverage plan & execution strategy

## Priority calls, and why nothing here is P0

Applying the `test-priorities-matrix.md` decision tree rather than reading a priority off the risk score (the fragment is explicit that the two axes are separate, and that the score is a sanity check on a priority already assigned):

- **No revenue impact.** Pokes and kisses are free affordances in a two-person app.
- **No security-critical path.** The change adds no query, no policy, no exported symbol.
- **No data-integrity operation.** Nothing is written differently; only the text of a rejection changed.
- **No compliance requirement.**
- **A trivial workaround exists** for every failure this code reports: press the button again.
- **Regression prevention does apply** — DW-7 and DW-18 are previously-identified defects, which the matrix says raises priority.

That puts the ceiling at **P1**. Declaring a P0 here would make the P0 gate ("100%, no exceptions") meaningless for the paths that genuinely warrant it.

## Coverage matrix

| ID | Scenario | Level | Priority | Risk link | Tests | Owner |
|---|---|---|---|---|---|---|
| TEST-01 | A zero-row insert reported by PostgREST as `PGRST116` rejects with `'[InteractionService.sendInteraction] No rows found'`, and the message carries no sync promise | Unit | **P1** | R-1 | 2 | DEV |
| TEST-02 | `getInteractionHistory` and `markAsViewed` map a `PostgrestError` through `handleSupabaseError`, unchanged | Unit | **P1** | R-2 | 2 | DEV |
| TEST-03 | The honesty invariant is enforced repo-wide, not per file: no Supabase-only module may import `handleNetworkError` or `OFFLINE_ERROR_MESSAGE` | Lint (preferred) or Unit | **P1** | R-4 | 1 | DEV |
| TEST-04 | `networkFailure` produces `'Unknown network error'` for a non-`Error` rejection, still with no sync promise | Unit | **P2** | R-3 | 1 | DEV |
| TEST-05 | Success paths of `getInteractionHistory`, `getUnviewedInteractions` and `markAsViewed` — record mapping, and the `.or()` / `.order()` / `.range()` predicate the fake currently no-ops | Unit | **P2** | — (DW-34) | 4 | DEV |
| TEST-06 | `markAsViewed` surfaces a zero-row UPDATE instead of resolving successfully | Unit | **P3** | R-5 (DW-31) | 2 | DEV |
| TEST-07 | `subscribeInteractions` surfaces `CHANNEL_ERROR` / `TIMED_OUT` to its caller | Unit | **P3** | R-10 (DW-35) | 3 | DEV |

Every row is **Unit**, with one Lint row. That is the `test-levels-framework.md` answer, not a shortcut: the entire change is error-handling logic in an isolated class with a single mockable dependency, which the framework's own matrix marks "Error handling (logic) → Unit: Primary, E2E: Overkill". Adding an E2E for any of it would be duplicate coverage at best and, per R-6, a hollow check at worst.

### TEST-01 — detail

Two changes, one of them to the fixture rather than to a test:

1. Teach `interactionsQuery()`'s `single()` the client's real contract. Today `:132-135` returns `{ data: result.data?.[0] ?? null, error: result.error }`, which silently turns a zero-row result into `{ data: null, error: null }`. The real client returns that shape only for a 2xx with an empty body; a zero-row `application/vnd.pgrst.object+json` request returns `PGRST116`. Model both, and give them separate flags — rename `insertReturnsNothing` to `insertReturnsEmptyBody`, and add `insertMatchesNoRow` for the PostgREST outcome — so the two stop being conflated behind one boolean.
2. Assert the reachable path: `sendPoke` rejects with exactly `'[InteractionService.sendInteraction] No rows found'`, and `expect(failure?.message).not.toContain(SYNC_PROMISE)`.

Keep the two existing `insertReturnsEmptyBody` tests. The branch they cover is real defensive code and its message is the better of the two; deleting them would remove the only assertion on `InteractionWriteError`'s second construction site.

**Optional, higher-evidence variant.** Run the same assertion once as an integration test against local Supabase (`npm run supabase:up`, then the `integration` Playwright project) to observe a real 406 rather than inferring it from the client's source. This is what would move R-1's Unknown from *inferred* to *measured*. It is optional because the unit assertion is what guards the regression; the integration run is what proves the premise.

### TEST-03 — detail, and why it is the highest-leverage item here

The honesty property is repo-wide. Its enforcement today is not: two module headers, four `// NOT handleNetworkError:` comments, and a `SYNC_PROMISE` constant duplicated in two test files. Nothing fails when a third Supabase-only feature imports either false-promise symbol.

**Preferred mechanism — ESLint.** `eslint.config.js` already runs over `src` in CI (inside the `lint` job, per `AGENTS.md`). A `no-restricted-imports` rule with `importNames`, in an override scoped to the Supabase-only modules, names both symbols and the reason:

```js
// Supabase-only features have no offline queue, so any message promising a
// later sync is false there. Mood and messages are offline-first and keep both.
{
  files: ['src/api/interactionService.ts', 'src/services/eventsService.ts', 'src/services/photoService.ts', 'src/stores/slices/notesSlice.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      paths: [
        { name: './errorHandlers', importNames: ['handleNetworkError'], message: "No offline queue here — build a local message. See interactionService.ts:8-16." },
        { name: '../api/errorHandlers', importNames: ['handleNetworkError'], message: "No offline queue here — build a local message. See interactionService.ts:8-16." },
        { name: '../utils/offlineErrorHandler', importNames: ['OFFLINE_ERROR_MESSAGE'], message: 'Promises a sync. Use OFFLINE_RETRY_MESSAGE.' },
      ],
    }],
  },
}
```

The `files` list is the thing to get right, and it is a judgement call about which modules are Supabase-only — `AGENTS.md` names photos, love notes and partner interactions, plus events. Confirm each path before adding it; a wrong entry either blocks a legitimate import or silently protects nothing.

**Fallback — a vitest guard.** If touching `eslint.config.js` is not wanted, a single test that reads each file with `fs.readFileSync` and asserts neither symbol appears in an import gives the same signal from the suite that already runs. It is weaker (string matching, not module resolution) and should say so in a comment.

Either way this is one artifact, and it is the only mitigation on this plan that protects features not yet written.

## Not in scope

| Item | Reasoning | Mitigation |
|---|---|---|
| E2E for any interaction error message | `PokeKissInterface.tsx:184-186` and `:217-220` render the constant strings `'Failed to send poke. Try again.'` / `'Failed to send kiss. Try again.'` and never `error.message`. An E2E asserting a toast would pass identically before and after this change — a check that cannot fail for the reason it claims to (R-6, and `evidence-integrity.md` Shape 5). | The unit tests pin the message where it exists. `tests/e2e/partner/partner-mood.spec.ts:35` continues to cover the buttons' presence. |
| Component test for `PokeKissInterface` | Same reason one level down: the component's error branch has no dependency on the message text. | Nothing to mitigate; the component is unchanged. |
| Contract testing (Pact) | Relevance gate in `pactjs-utils-mandate.md` does not open: frontend stack, no Pact dependency, no `pact/` or `tests/contract/` tree, no `*.pacttest.ts`, no microservices. | n/a — the flag defaulting to `true` is not a reason to scaffold. |
| `src/api/errorHandlers.ts`, `src/api/moodApi.ts`, `src/api/moodSyncService.ts` | Byte-identical to `HEAD`, and their `handleNetworkError` usage is *correct* — 14 and 2 throw sites over a real service-worker sync queue. Changing them would introduce the inverse defect. | Their existing suites are the regression guard (see Interworking). TEST-03's `files` list must exclude them. |
| Performance / load | The change adds no work to any path; `networkFailure` runs only on a rejection. | n/a |
| Re-verifying `eventsService`'s copy of the convention | Out of this change's scope; `tests/unit/services/eventsService.test.ts` already covers it. | Runs in the same PR suite. |

## NFR coverage and evidence plan

| Category | Threshold | Risk link | Planned validation | Evidence for later `nfr-assess` |
|---|---|---|---|---|
| Reliability | **UNKNOWN** — no PRD or ADR exists. The spec states a qualitative bar only: "Every message a caller can read must describe what actually happened." | R-1, R-2, R-3 | TEST-01, TEST-02, TEST-04 — one pinned message per reachable failure mode | `npx vitest run tests/unit/api/interactionService.test.ts` output, and the file's v8 branch report |
| Maintainability | **UNKNOWN per file.** Repo global is 25% (`vitest.config.ts:52-57`); `test-priorities-matrix.md` would put a P1 unit target at >80%. Current measured: 71.42% statements, 50% branches. | R-3, R-10 | TEST-04, TEST-05, TEST-07 raise both. Duplication (DW-33) has no CI check in this repo. | `--coverage.include='src/api/interactionService.ts'` report |
| Maintainability (invariant) | Binary: zero Supabase-only modules importing a sync-promising symbol | R-4 | TEST-03 | `npm run lint` exit code, or the guard test |
| Security | No new surface | — | None planned | `supabase/tests/database/02_rls_policies.sql` continues to assert the policy set; untouched by this change |
| Performance | N/A | — | None planned | — |

**Do not invent the missing thresholds.** Two decisions are the operator's, not this workflow's: whether `src/api/interactionService.ts` gets a per-file coverage threshold, and what number. Recorded as decisions below rather than filled in.

## Execution strategy

**PR tier — everything.** Measured in this session: the whole vitest suite is `89 files, 1316 tests, 6.24s`, and the interactionService file alone is `15 tests, 4 ms`. All seven rows are unit or lint and add no meaningful wall-clock. Nothing here belongs in a nightly or weekly tier.

The one exception is TEST-01's optional integration variant, which needs `supabase start`. If it is written, it belongs in the existing `integration` Playwright project (`playwright.config.ts:157-158`) and runs where E2E already runs — not in the PR unit job.

## Resource estimates

| Priority | Items | Tests | Estimate | Notes |
|---|---|---|---|---|
| P0 | 0 | 0 | — | None; see the priority reasoning above |
| P1 | TEST-01, TEST-02, TEST-03 | 5 | **~4–8 h** | TEST-03 is most of it: the `files` list needs each path confirmed as Supabase-only, and the rule must be verified not to fire on `moodApi`/`moodSyncService`/`MoodTracker`. TEST-01 includes the fixture correction. |
| P2 | TEST-04, TEST-05 | 5 | **~2–4 h** | TEST-05 needs the fake to stop no-op'ing `.or()`, `.order()` and `.range()` |
| P3 | TEST-06, TEST-07 | 5 | **~3–6 h** | Both are deferred-work items with their own ledger entries; TEST-06 requires a production change (a row-count check) and is therefore not a test-only task |
| **Total** | **7** | **15** | **~9–18 h** | ~1.5–3 days |

Ranges, not points. TEST-06 and TEST-07 are the widest because each depends on a production change the current spec's Never list excludes.

## Quality gates

- **P0 pass rate** — n/a, no P0 scenarios.
- **P1 pass rate** — 100%. Three items, all cheap; a waiver would cost more to write than the test.
- **P2/P3 pass rate** — ≥90%, informational.
- **High-risk mitigation** — R-1 (score 6) is the only item above the mitigation threshold. TEST-01 closes it. No score-9 item exists, so no gate FAIL is implied by this design.
- **Coverage** — proposed target for `src/api/interactionService.ts` after TEST-01/02/04/05: **≥85% statements, ≥75% branches**, up from the measured 71.42% / 50%. This target cannot be enforced by the current config; see the decisions below.
- **NFR evidence** — reliability and maintainability evidence identified above. Final PASS/CONCERNS/FAIL is `nfr-assess`'s call, not this workflow's.

## Entry criteria

- [x] The change under test is committed (`f486587`) and its suite is green — verified in this session
- [x] Requirements available: `spec-dw-7-18-events-offline-message-honesty.md` `## Tasks & Acceptance` and `## I/O & Edge-Case Matrix`
- [x] Unit test environment works in this worktree — `npx --no-install vitest run` succeeds despite the worktree having no local `node_modules`
- [ ] **For TEST-01's optional integration variant only:** `npm run supabase:up` running. Not required for any P1 unit item.
- [ ] Decision taken on TEST-03's mechanism (ESLint override vs vitest guard) and on the `files` list

## Exit criteria

- [ ] TEST-01, TEST-02, TEST-03 written and passing
- [ ] R-1 closed: both realisations of "insert returns no row" asserted, and the fake's `single()` no longer conflates them
- [ ] Branch counts `if@314` and `if@394` in `src/api/interactionService.ts` are no longer one-sided
- [ ] `npx vitest run` still reports 89+ files green, and `npm run lint` still exits 0 for `src` and `tests`
- [ ] DW-31, DW-32, DW-33, DW-34, DW-35 remain open in the ledger with their scores recorded here, or are consciously bundled into a follow-up

## Interworking & regression

| Component | How this change affects it | Regression that must pass |
|---|---|---|
| `src/api/moodApi.ts`, `src/api/moodSyncService.ts` | Not at all — 16 `handleNetworkError` call sites keep the sync promise, which is true for them | `tests/unit/api/moodApi.test.ts`, `tests/unit/api/moodSyncService.test.ts`, `tests/unit/api/moodSyncSubscription.test.ts` |
| `src/api/errorHandlers.ts` | Untouched; loses one consumer | Covered transitively by the mood suites |
| `src/services/eventsService.ts` | Untouched; is the reference idiom this change copied | `tests/unit/services/eventsService.test.ts` |
| `src/stores/slices/interactionsSlice.ts` | Re-throws the service error unchanged (`:94`, `:127`, `:147`), so the new message is what a caller sees | `tests/unit/stores/loaderIdentityGuards.test.ts` (covers `loadInteractionHistory`) |
| `src/components/PokeKissInterface/PokeKissInterface.tsx` | No behavioral change — renders constants, not `error.message` | `tests/e2e/partner/partner-mood.spec.ts:35` `[P0] 4.5-E2E-002` |
| `src/components/MoodTracker/MoodTracker.tsx` | Unaffected, but it is the sole consumer of `OFFLINE_ERROR_MESSAGE` (`:31`, rendered `:432`) — TEST-03's scope must not include it | The mood suites, plus `npm run lint` |

## Decisions for the operator

These change what gets built and are not this workflow's to make:

1. **TEST-03's mechanism.** ESLint `no-restricted-imports` override (stronger, touches `eslint.config.js`) or a vitest guard test (weaker, touches only `tests/`). Recommendation: ESLint, because it fails in the job that already runs and because module resolution beats string matching.
2. **TEST-03's scope list.** Which modules count as Supabase-only. `AGENTS.md` names photos, love notes and partner interactions; events is the fourth. Each path needs confirming before it goes in the list.
3. **A per-file coverage threshold** for `src/api/interactionService.ts`, and its value. Without one, the ≥85%/≥75% target above is a review-time check only — the global 25% floor cannot see a regression from 71% to 30%.
4. **Whether TEST-06 and TEST-07 belong in this bundle at all.** Both need production changes that this spec's Never list excludes, and both already have ledger entries (DW-31, DW-35). Leaving them deferred is defensible; what is not defensible is listing them as planned coverage while the code they would test cannot change.

---

# Step 5 output — Generation & validation

## Execution mode resolved: `sequential`

`tea_execution_mode: auto` and `tea_capability_probe: true`. Two things settle it, and they agree: Epic-Level mode produces **one** output artifact and step 5 states it "remains single-worker by default", so there is nothing to parallelize; and this project's `CLAUDE.md` forbids handing bmad-loop worktree work to a background subagent and waiting on it, because a subagent here cannot be polled and a session sleep-waiting on one burns its whole 90-minute timeout while looking active to the stall detector (run `20260818-230216-c22b` lost two sessions exactly that way). Sequential, in-session, is both the default and the only safe choice.

## Output written

- `_bmad-output/test-artifacts/test-design-epic-dw-events-offline-message-honesty.md` — 509 lines, from `test-design-template.md`.

The filename carries the same `epic_num` slug that names this checkpoint, so plan and checkpoint identify the same run.

## Checklist validation (`checklist.md`)

**Prerequisites — Epic-Level.** Story markdown with acceptance criteria: yes. PRD/epic documentation: the spec serves as both; no separate PRD exists. Architecture documents: none exist — `AGENTS.md` is the durable prose by deliberate policy. Requirements testable and unambiguous: yes, the I/O matrix is six concrete rows.

**Risk assessment.** 10 risks, all with unique IDs, a category from the six-value legend, integer P and I in 1–3, and a score equal to P × I — arithmetic re-checked row by row. One risk ≥ 6, flagged, with a five-step mitigation, an owner and a timeline. Residual risk documented as its own subsection.

**NFR planning.** Seven category rows. Four thresholds marked **UNKNOWN** with no value invented; two of the four are escalated as operator decisions and one (duplication) is escalated as DW-33. Planned evidence named per row. No PASS/CONCERNS/FAIL assigned — that is `nfr-assess`'s call.

**Coverage design.** Seven scenarios, each with a level, a priority, a risk link where one exists, a count and an owner. No duplicate coverage: every scenario is Unit except the one Lint row, and the Not-in-Scope table records why the E2E and component levels are excluded rather than leaving the absence to be read as an oversight. **P0 scenarios: 0**, with the decision-tree reasoning written out — the checklist's "P0 tests should cover <10% of total scenarios" is satisfied trivially, and the "too many P0 tests" failure mode is avoided in the direction the matrix actually prescribes.

**Execution strategy.** The simple PR / Nightly / Weekly table, with the philosophy stated and the measured 6.24 s justifying "everything in PRs". No smoke/P0/P1/P2 tier structure, and no re-listing of the tests already in the coverage plan. Playwright parallelization noted.

**Resource estimates.** Every figure is an interval: `~4–8 h`, `~2–4 h`, `~3–6 h`, `~9–18 h`, `~1.5–3 days`. No `count × hours` arithmetic anywhere.

**Quality gates.** P1 at 100% with the reasoning; P2/P3 at ≥90% informational; high-risk mitigation required; coverage target stated **together with the fact that the current config cannot enforce it**, which is the honest form of that row.

**Priority-vs-timing separation.** The note "P0/P1/P2/P3 denote priority, not execution timing" sits at the top of the Test Coverage Plan. Each priority section carries a **Criteria** line and nothing about when it runs.

**Accountability.** Not-in-Scope has seven rows, each with a reasoning and a mitigation. Entry and exit criteria are concrete and checkable. Interworking names six components with their regression scope. **Project Team is omitted** — this is a single-maintainer repository, and the workflow's own guidance says to omit rather than invent role placeholders.

**Tone and bloat.** No emoji in the output document. No repeated caveats. Length is driven by the evidence table and the two detailed mitigations, not by restatement.

**Housekeeping.** No `playwright-cli` session was opened, so none can be orphaned. Scratch files were written to the session scratchpad and the coverage JSON to `/private/tmp/.../scratchpad/cov`; the only artifacts under the repo are the two files in `_bmad-output/test-artifacts/`. `test-results/vitest-junit.xml` was rewritten by the two verification runs — it is generated output that the repo already expects.

**Not applicable.** Every System-Level checklist section (two-document validation, handoff document, architecture-doc structure, ASR categorization, tooling-and-access) is skipped: this run is Epic-Level, which the checklist scopes those blocks away from.

## Production code

Untouched, as instructed. `git status --porcelain` at the end of this run shows the same single modified file it showed at the start — `_bmad-output/implementation-artifacts/deferred-work.md` — plus the two new files under `_bmad-output/test-artifacts/`. No file under `src/` or `tests/` was created, edited or deleted.

## Open assumptions carried out of this run

1. PostgREST's zero-row response under `Accept: application/vnd.pgrst.object+json` is **inferred** from `postgrest-js@2.112.3`'s own error construction, not observed against a live stack. TEST-01's optional integration variant is the measurement.
2. No PRD or ADR exists, so four NFR thresholds stay UNKNOWN.
3. The membership of "Supabase-only modules" for TEST-03's scope list is left to the operator rather than resolved here.

## On Complete

`uv run _bmad/scripts/resolve_customization.py --skill .claude/skills/bmad-testarch-test-design --key workflow` returned `"on_complete": ""` — empty, so the hook is skipped and the workflow exits normally.

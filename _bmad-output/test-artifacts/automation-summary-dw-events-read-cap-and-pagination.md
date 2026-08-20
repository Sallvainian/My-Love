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
runScope: 'story-level'
runKey: 'dw-events-read-cap-and-pagination'
executionMode: 'BMad-Integrated'
detectedStack: 'frontend'
resolvedExecutionMode: 'sequential'
inputDocuments:
  - '_bmad-output/implementation-artifacts/spec-dw-9-22-events-read-cap-and-pagination.md'
  - 'src/services/eventsService.ts'
  - 'src/api/supabaseClient.ts'
  - 'src/App.tsx'
  - 'src/components/RelationshipTimers/EventCountdown.tsx'
  - 'src/components/RelationshipTimers/index.ts'
  - 'src/components/Settings/EventsSettings.tsx'
  - 'src/stores/slices/eventsSlice.ts'
  - 'src/utils/dateUtils.ts'
  - 'tests/unit/services/eventsService.test.ts'
  - 'src/components/RelationshipTimers/__tests__/EventCountdown.test.tsx'
  - 'tests/e2e/home/events.spec.ts'
  - 'tests/e2e/settings/events-crud.spec.ts'
  - 'tests/api/check-constraint-error-mapping.spec.ts'
  - 'tests/api/scripture-reflection-rpc.spec.ts'
  - 'tests/support/merged-fixtures.ts'
  - 'tests/support/fixtures/index.ts'
  - 'tests/support/fixtures/auth.ts'
  - 'tests/support/factories/index.ts'
  - 'tests/support/helpers/supabase.ts'
  - 'tests/support/auth/worker-pool.ts'
  - 'tests/README.md'
  - 'supabase/migrations/20260818000002_create_events_table.sql'
  - 'playwright.config.ts'
  - 'vitest.config.ts'
  - 'tsconfig.test.json'
  - 'package.json'
  - 'AGENTS.md'
  - '_bmad/tea/config.yaml'
  - 'node_modules/@supabase/postgrest-js/src/PostgrestTransformBuilder.ts'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/library-integration-mandate.md'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/playwright-utils-mandate.md'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/confidence-gate.md'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/test-levels-framework.md'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/test-priorities-matrix.md'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/test-quality.md'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/evidence-integrity.md'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/data-factories.md'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/api-request.md'
---

# Test Automation Summary: dw-events-read-cap-and-pagination

**Date:** 2026-08-19
**Author:** Sallvain
**Mode:** BMad-Integrated (implementation spec present; no test-design or ATDD artifact for this story)
**Scope under test:** branch `bmad-loop/20260819-133049-ee65/dw-events-read-cap-and-pagination`, commit `7a81ed4` — `getEvents(limit = 50, offset = 0)` reading a bounded page on each side of today (DW-9), and `getUpcomingEventCards` capping Home's column at three (DW-22).

---

## 1. Preflight

| Item | Resolution | Evidence |
|------|-----------|----------|
| Detected stack | `frontend` | `playwright.config.ts` and `vitest.config.ts` present; `package.json` carries `react`, `vite`, `@playwright/test`. Probed and absent: `pyproject.toml`, `pom.xml`, `go.mod`, `Gemfile`, `Cargo.toml`, `*.csproj`, `.maestro/`, `app.json`, `Podfile`, `pubspec.yaml`. |
| Framework readiness | PASS (no HALT) | `playwright.config.ts` declares projects `chromium` (`testDir: ./tests/e2e`), `api` (`./tests/api`), `integration` (`./tests/integration`). |
| Playwright Utils profile | Full UI+API | `@seontechnologies/playwright-utils ^4.4.0` in `devDependencies`; browser specs under `tests/e2e` use `page.goto`. |
| `tea_use_playwright_utils` | `true` — **mandate binds** | Both gates of `library-integration-mandate.md` hold: flag `true` in `_bmad/tea/config.yaml`, package installed. |
| `tea_use_pactjs_utils` | `true`, **not applicable** | Relevance gate, not the flag. Probed: no `pact/` directory, no `@pact-foundation/pact` or `@seontechnologies/pactjs-utils` in `package.json`, no `PACT_BROKER`. This is a single PWA against Supabase-as-a-service with no provider codebase. **No Pact artifacts generated.** |
| `tea_pact_mcp` | `mcp`, `pact_mcp_reachable: false` | Tool-list probe only, per `pact-mcp.md`. No SmartBear/PactFlow MCP server is connected to this session. Recorded once, not retried; moot because no Pact artifacts are in scope. |
| `tea_execution_mode` | `auto` → resolved **`sequential`** | Capability probe: this is a bmad-loop worktree session, and the worktree's own `CLAUDE.md` forbids handing the work to a background subagent ("a session sleep-waiting on one looks active to the loop's stall detector … burns its whole 90-minute session timeout"). `supports.agentTeam` and `supports.subagent` are therefore both false and `auto` resolves deterministically to `sequential`. Worker 3A (API) and worker 3B (E2E) were both executed in-process. |
| `tea_browser_automation` | `auto` → **not used** | Browser exploration exists to discover unknown selectors. Every selector this run needed already exists as a `data-testid` and is already exercised by a passing spec: `event-countdown-<kebab-label>` (`src/components/RelationshipTimers/EventCountdown.tsx:237`, used at `tests/e2e/home/events.spec.ts:158`), `events-empty-placeholder` and `events-load-error` (`src/App.tsx:680,691`). No `playwright-cli` session was opened, so none needed closing. |
| Knowledge fragments loaded | 10 | `library-integration-mandate`, `playwright-utils-mandate`, `confidence-gate`, `test-levels-framework`, `test-priorities-matrix`, `test-quality`, `evidence-integrity`, `data-factories`, `api-request`, `fixture-architecture` (principles). |

---

## 2. Confidence Gate

Per `confidence-gate.md`, declared before any artifact was written.

```
Confidence: 9
Rationale: The change under test was read in full this session — src/services/eventsService.ts
  getEvents(), src/App.tsx's events column, and getUpcomingEventCards in
  EventCountdown.tsx. The existing coverage was enumerated by name
  (44 cases in tests/unit/services/eventsService.test.ts, 5 for
  getUpcomingEventCards, 7 P0 E2E in tests/e2e/home/events.spec.ts, 6 in
  tests/e2e/settings/events-crud.spec.ts), so the gap this run fills is a
  measured absence rather than a guess. The gap itself is named by the story's
  own Review Triage Log. `.range(from, to)` → `?offset=&limit=` was read from
  @supabase/postgrest-js/src/PostgrestTransformBuilder.ts:559-574, not assumed.
  Every code shape is copied from a passing neighbour: worker-pair resolution
  and seeding from tests/e2e/home/events.spec.ts:36-105, the user-JWT client
  from tests/support/helpers/supabase.ts:49-75, the fixture shape from
  tests/support/fixtures/index.ts.
Unknowns:
  - Whether local GoTrue always refreshes cleanly across the clock jump the
    midnight E2E performs. Observed to work on every run here; recorded in §8.
  - Whether the API spec's mirror of the production query chain can drift from
    src/services/eventsService.ts unnoticed. Bounded, not eliminated — see §8.
```

Above the threshold of 7, so generation proceeded. Both Unknowns are carried into §8.

---

## 3. What was already covered, measured

Counted by name from the files, not estimated.

| Level | File | Cases | What it covers for this change |
|-------|------|-------|-------------------------------|
| Unit | `tests/unit/services/eventsService.test.ts` | 44 | The whole I/O matrix against a hand-rolled PostgREST fake: both windows, per-side cap, next-event-survives, outward paging, clamping, today-dated row, tiebreaks in both windows, the mid-read duplicate drop, unreadable rows, offline (zero `from()` calls), query error. |
| Unit | `src/components/RelationshipTimers/__tests__/EventCountdown.test.tsx` | 5 (for `getUpcomingEventCards`) | Filter, cap, the UNCAPPED count, refill at midnight, empty. |
| E2E | `tests/e2e/home/events.spec.ts` | 7 P0 | Own + partner cards, past hidden, placeholder, no pre-settle flash, today-dated, background reload, and DW-22's cap at three. |
| E2E | `tests/e2e/settings/events-crud.spec.ts` | 6 P0 | Full CRUD round trip, direct `/settings` reload, a past event listed with its controls, a partner's event read-only, a rejected save. |

### The three gaps this run fills

1. **Nothing crosses the window against a real database.** The unit fake implements `.range()` as its own `found.slice(from, to + 1)` (`tests/unit/services/eventsService.test.ts`, `run()`), so it proves the service *asks* for the window and says nothing about whether PostgREST *honours* it. The story records this itself, in the Review Triage Log's dismissed item **"No test crosses the read cap against a real database"**: _"what remains unexercised is the Supabase client's own `.range` implementation."_

2. **The shipped limit is never exercised.** `eventsSlice.loadEvents` calls `eventsService.getEvents()` bare (`src/stores/slices/eventsSlice.ts:116`), so `limit = 50` is the only value a user ever runs; every existing test uses 2 because it is cheap. Nothing anywhere seeds past history beyond 50.

3. **The refill at local midnight is only covered below `App`.** `getUpcomingEventCards` and `EventCountdown`'s self-retirement are each unit-tested; no test renders `App`, where they meet. The story's own triage log calls this out: _"The capped tail's refill at local midnight was untested and untestable — no test renders `App`."_ Extracting the helper made the filter testable and left the composition uncovered.

### What was deliberately NOT added (duplicate-coverage guard)

Per `test-levels-framework.md` § Duplicate Coverage Guard:

- **Settings list ordering.** `loadEvents` sets the array straight from `getEvents` with no re-sort (`src/stores/slices/eventsSlice.ts`, success branch), so a broken merge would be visible in Settings' order — but that merge is already pinned by `it('returns both sides of today in one ascending list')`, and `EventsSettings` only maps the array. A UI test would re-assert unit-level logic through a slower surface.
- **A partner's *past* event in Settings.** The `events_select` predicate is per-row and owner-based; the past window differs from the upcoming one only in its date predicate. There is no mechanism by which a partner row survives `gte` and not `lt`. Covered instead, cheaply, at API level (§5, test 6) where both windows are asserted in one test.
- **RLS negative (a third party's events).** Would require seeding rows for a user outside this worker's pair. `AGENTS.md` forbids a spec touching rows that belong to other workers, and `supabase/tests/database/20_events.sql` already pins the policy set with pgTAP.
- **The Settings truncation bound.** Past ~50 past events the oldest stop arriving; that is a **deferred** item in the story's own frontmatter (`severity: medium`), not accepted behaviour to lock in. Pinning it would make the follow-up harder to land.

---

## 4. Coverage Plan

`coverage_target: critical-paths`. Levels chosen per `test-levels-framework.md`, priorities per `test-priorities-matrix.md`.

| # | Scenario | Level | Priority | Why this level |
|---|----------|-------|----------|----------------|
| 1 | The upcoming window is truncated at `limit`, keeping the soonest | API | P0 | Server behaviour. Cannot be tested below the wire; a browser adds nothing. |
| 2 | Past history longer than `limit` never crowds the next event out | API | P0 | The DW-9 design decision. Data-integrity-adjacent: the failure silently hides a real event. |
| 3 | The past window keeps the most recent past events, newest first | API | P1 | The ordering `getEvents`' `.reverse()` depends on. |
| 4 | `offset` pages outward from today on both sides, with no overlap | API | P1 | The paging half of DW-9, which has no production caller yet. |
| 5 | A today-dated row lands in the upcoming window, not the past one | API | P1 | The `gte`/`lt` boundary over the wire; must agree with App's `>= 0` filter. |
| 6 | Both windows return the partner's events (no `user_id` filter) | API | P1 | Couple-shared read under real RLS, for the *new* window as well as the old. |
| 7 | The past window breaks same-day ties on `created_at`, newest first | API | P2 | Tiebreak, over the wire. Cosmetic ordering rather than a correctness gate. |
| 8 | Home still shows the next event when past history fills the **default** window | E2E | P0 | The DW-9 symptom at the outermost surface, at the only limit users run. |
| 9 | The hidden fourth card takes the freed slot when local midnight passes | E2E | P1 | The one acceptance criterion that lives only in `App`; needs a controlled clock. |

**Priority breakdown:** P0 = 3, P1 = 5, P2 = 1, P3 = 0. **Total 9 new cases.**

Test IDs (per `test-levels-framework.md` § Test ID Format): `DW9.22-API-001` … `-007`, `DW9.22-E2E-001` … `-002`, assigned in the order above.

---

## 5. Files Created and Updated

### Created

| File | Lines | Contents |
|------|-------|----------|
| `tests/support/factories/events.ts` | 223 | Pure factory + seeding module: `resolveWorkerPairIds`, `eventDateFrom`, `eventInsert`, `seedEvents` (one bulk statement, label-keyed), `clearPairEvents`. No Playwright import. |
| `tests/api/events-read-window.spec.ts` | 321 | 7 cases (P0 ×2, P1 ×4, P2 ×1) against local PostgREST under a real user JWT. |
| `tests/e2e/home/events-read-window.spec.ts` | 170 | 2 cases (P0 ×1, P1 ×1) against the running app. |

### Updated

| File | Change |
|------|--------|
| `tests/support/fixtures/index.ts` | +90 lines: two fixtures, `coupleEvents` and `supabaseAsUser`. `merged-fixtures.ts` is **not** touched — the project's custom fixtures already flow into it through `customFixtures`, and adding to the existing `base.extend<CustomFixtures>` avoids widening the `mergeTests` union. |

### The fixtures

**`coupleEvents`** — the events seeding handle for the running worker's own couple.

```ts
{ userId, partnerId, anchor, seed(specs), clear() }
```

- **Auto-cleanup in teardown**, per `test-quality.md` Example 2 and `fixture-architecture.md`. It also clears *before* `use()`, because a previously failed run leaves rows owned by this same fixed worker identity and every events assertion is about which rows the couple has — the self-healing the existing specs open with by hand (`tests/e2e/home/events.spec.ts:135-137`).
- Deletion is by `user_id` for both halves of the pair, not by tracked id, so a row created through the UI mid-test is cleaned up too. Both ids belong to this worker's own pair, so this never reaches another worker's rows — the constraint `AGENTS.md` sets on teardown.
- `anchor` is exposed rather than kept private: it is the single clock reading every seeded date derives from, and the midnight E2E pins the browser's clock to that same instant.

**`supabaseAsUser`** — a `TypedSupabaseClient` speaking as this worker's user, so RLS applies. Distinct from `supabaseAdmin`, which is `service_role` and sees every row; a read asserted through the admin client would prove nothing about `events_select`. Built with the publishable key plus a real user JWT, which is what `src/api/supabaseClient.ts:55` gives the app. `persistSession: false` so it can never write into the storage state the browser contexts read.

### On `faker`

`data-factories.md` mandates generated data for anything that only needs to be *unique*. The events factory deliberately does not use it, and that is the fragment's own § Example 6 case — "the literals a test writes on purpose because the assertion is about that exact value":

- **Day offsets are the subject.** Every assertion here is about which side of today a row falls on and in what order. A faker date would make the expected result unknowable.
- **Labels are the assertion vocabulary.** `expect(labelsOf(upcoming)).toEqual(['Window First API', 'Window Second API'])` reads as the claim. A faker label would force the test to re-derive its own expectation from the seed, which is the shape that passes against a broken implementation.
- **Parallel safety comes from elsewhere.** Rows are scoped to the worker's own fixed pair and cleared on both sides of every test, so uniqueness is not what keeps workers apart here — ownership is.

Labels are still required unique *within* a `seedEvents` call, and that is enforced with a throw rather than left to chance.

---

## 6. Evidence Integrity: every new test was made to fail

Per `evidence-integrity.md` — "for every check, name the input that would turn it red". Each mutant below was applied, run, and reverted; `git diff --quiet` was used to confirm the restore.

| Mutant | Applied to | Result |
|--------|-----------|--------|
| **A** — delete `.range(offset, lastRow)` from both windows | `tests/api/events-read-window.spec.ts` (the spec's own helper) | **4 of 7 failed** — tests 1, 2, 3, 4. The three that survived are the ones that read at `limit = 50` with fewer than 50 rows, where a missing range is genuinely a no-op; they are about the boundary and the owner set, not the cap. |
| **B** — replace the two date-anchored windows with one ascending `.range(firstRow, lastRow)` over the whole history | `src/services/eventsService.ts` | **E2E test 8 failed** (`element(s) not found` on the survivor card) after the full 15s retry budget. E2E test 9 survived, correctly: it seeds no past history. |
| **C** — delete `onRetire={handleEventRetired}` | `src/App.tsx` | **Both E2E tests still passed.** Recorded rather than hidden — see below. |
| **D** — freeze App's clock reading (`const now = <module-level Date>` in place of `const now = new Date()`) | `src/App.tsx` | **E2E test 9 failed**, and only test 9. |

**Mutant C is the finding worth reading.** The refill E2E is *not* an isolation test for the `onRetire` wiring, and the file header now says so in as many words. `now` is sampled in App's render body, so **any** re-render after the day rolls refills the slot — and a jump this long expires the access token, whose `TOKEN_REFRESHED` event sets a new `session` object that `src/App.tsx:392-417` depends on, re-rendering App by itself. No browser-level test can attribute the re-render to one trigger. What the test does pin, measured by mutant D, is the class of regression the acceptance criterion is actually about: a stale clock reading. That mutant is a realistic one — memoising `now` to avoid re-deriving it every render is exactly the change someone makes — and nothing else in the suite catches it.

> **Correction, 2026-08-19 (later review pass).** Mutant C's row above, and the
> paragraph before this one, describe the E2E test as it stood when this summary
> was written. That test was reworked afterwards and both claims are now false;
> the measurements above are kept as the record of what was true at the time.
>
> The rework installs the clock five minutes before the anchor day's local
> midnight — inside the previous calendar day, so the page clock runs BEHIND real
> time and never ahead of it — and crosses with a five-minute jump. No token
> refresh is due at any point, so `TOKEN_REFRESHED` can no longer re-render App
> in the retire tick's place. Measured after the rework: deleting
> `onRetire={handleEventRetired}` now FAILS the refill test, and mutant D still
> fails it. The sentence "No browser-level test can attribute the re-render to
> one trigger" is therefore wrong as stated — removing every other available
> re-render trigger is what attributes it. The current reasoning lives in the
> header of `tests/e2e/home/events-read-window.spec.ts`, and the rework is
> recorded under `addressed_findings` in the story spec's Review Triage Log.
>
> Two line counts in §10 are stale for the same reason: the E2E spec is 213
> lines, not 170, and `tests/support/factories/events.ts` is 234, not 223. Both
> still satisfy the ≤ 1000 criterion.

Mutant D's first form was invalid and is recorded so nobody repeats it: `const [now] = useState(...)` placed at that line sits *after* App's early returns, so React raised "Rendered more hooks than during the previous render" and both tests failed for the wrong reason. The module-level constant is the valid form.

---

## 7. Verification Performed

All commands run in this session, in this worktree, against the running local Supabase stack (`supabase_db_My-Love`, `supabase_rest_My-Love`, `supabase_auth_My-Love`, `supabase_kong_My-Love` all up).

| Command | Result |
|---------|--------|
| `npx playwright test tests/api/events-read-window.spec.ts --project=api` | **7 passed** (5.9s) |
| `npx playwright test tests/e2e/home/events-read-window.spec.ts --project=chromium` | **2 passed** (5.2s) |
| `npx playwright test <both new specs> --repeat-each=3` | **27 passed** (13.5s) — burn-in per `ci-burn-in.md`; zero flakes across 3 repeats |
| `npm run test:unit` | **92 files, 1397 tests, all passing** (5.5s) |
| `npm run test:p0` | **74 collected, 72 passed, 0 failed, 2 skipped** (88.6s). The 2 skips are pre-existing `Display Name Setup` OAuth cases, unrelated to this change; counts read from `test-results/junit.xml`, not from the console tail. |
| `npm run typecheck` | **6 `TS2883` errors, zero non-`TS2883` errors** — byte-identical to the baseline measured before any file was written. The six are the known worktree-only `merged-fixtures.ts` errors (`node_modules` resolves seven directories up in a loop worktree); they are not evidence of anything this run did. |
| `npm run lint` | **0 errors, 3 warnings** — all three are the pre-existing `react-refresh/only-export-components` warnings on `EventCountdown.tsx`, already recorded in the story's own verification section. `npx eslint` over the four touched files alone: clean. |

---

## 8. Playwright Utils deviations

Per `playwright-utils-mandate.md`. The self-check was run against both spec files before writing.

| File:line | Deviation | Reason |
|-----------|-----------|--------|
| `tests/api/events-read-window.spec.ts:76-109` (`readEventWindows`) | `apiRequest` not used; the reads are issued by `@supabase/supabase-js`. | `apiRequest` would send a URL this file wrote by hand, so every assertion would rest on a **transcription** of how postgrest-js serialises `.range()` / `.order()` / `.gte()` — and that serialisation is the exact thing the unit fake cannot cover and the story's review log names as unexercised. `.range(from, to)` currently emits `?offset=<from>&limit=<to-from+1>` (`@supabase/postgrest-js/src/PostgrestTransformBuilder.ts:567-573`, read this session); an upgrade that moved it back to the `Range` header would break the app and leave a hand-written URL green. Driving the production client is what makes that failure reachable. Marked in-file with `// playwright-utils deviation:` per the protocol. |

No other deviation exists. Verified across both new specs and the two support files: no `page.route`, no `page.waitForResponse`, no raw `request.<method>`, no `page.waitForTimeout`, no `console.log`, and no spec-level `import { test } from '@playwright/test'`. Both specs import `test` and `expect` from `tests/support/merged-fixtures.ts`.

### Recommended utilities: used, not used, and the wiring each would need

| Utility | Status |
|---------|--------|
| `interceptNetworkCall` | **Not used, and correctly so.** Neither E2E test observes or stubs an application call: test 8 asserts a render, test 9 asserts a re-render after a clock jump with no network in between. There is nothing to intercept, so there is no vanilla equivalent being substituted for. |
| `network-error-monitor` | **Used, implicitly.** Already in the project's merge (`tests/support/merged-fixtures.ts`, `excludePatterns` at :31-37). Neither new test needed a `skipNetworkMonitoring` opt-out, because neither drives an error response. |
| `recurse` | Not used — nothing here is eventually consistent. Playwright's web-first assertions cover the one re-render this suite waits on. |
| `apiRequest` | Not used — see the deviation above. This is the run's only mandate gap and it is deliberate. |
| `authToken` (`auth-session`) | **Not used, and this is a real wiring gap, unchanged from the previous run.** The project has `SupabaseAuthProvider` (`tests/support/auth/supabase-auth-provider.ts`) but it yields a browser storage state, not a bearer token for an arbitrary pool user. `supabaseAsUser` therefore calls the repo's own `getUserAccessToken(supabaseAdmin, userId)` (`tests/support/helpers/supabase.ts:49`), which is what `tests/api/scripture-reflection-rpc.spec.ts:41` and `tests/api/check-constraint-error-mapping.spec.ts:137` already do. **Wiring still needed:** an `authToken` fixture parameterised by pool-user identity, built on `createAuthFixtures()`, so API specs stop re-signing-in per test. That is `framework`-workflow scope, not `automate`'s. |
| `network-recorder` | Not used. Would need a HAR directory and a recording pass; nothing in scope is an offline or backend-free run. |
| `burn-in` (`runBurnIn`) | Not used as a library. The burn-in in §7 was `--repeat-each=3` by hand. Wiring `runBurnIn({ configPath, baseBranch })` into `scripts/burn-in.sh` is `ci`-workflow scope. |
| `log` | Not used. Neither spec emits report output, so there is no `console.log` to substitute for. |
| `file-utils`, `webhook-*` | Not applicable — no downloads, no webhooks. |

## Pact.js Utils deviations

**N/A — no contract artifacts were generated.** Per `pactjs-utils-mandate.md`'s relevance gate, `tea_use_pactjs_utils: true` means "use these utilities when contract tests are written", never "add contract tests to this project". This is a single frontend PWA against Supabase-as-a-service: there is no provider codebase to verify against, and the Pact indicator probe found nothing (§1). A consumer pact here would be one nobody can verify.

---

## 9. Assumptions and Risks

1. **The API spec mirrors the production query chain; it cannot import it.** `src/api/supabaseClient.ts:20-21` reads `import.meta.env`, a Vite build-time substitution with no value under the Playwright runner, so `eventsService` cannot be loaded into a spec. The chain in `readEventWindows` is therefore a hand-copy. **Bounded, not eliminated:** `tests/unit/services/eventsService.test.ts` records every bound, ordering and range the service actually issues and asserts on them (`backend.queries`), so a change to production's chain goes red there rather than passing silently. What remains uncovered is a change made in production *and* mirrored here incorrectly. Stated in the spec header so the next reader inherits the constraint rather than rediscovering it.

2. **The midnight E2E depends on a token refresh surviving the clock jump.** `page.clock.install({ time: anchor })` lets the page load normally, then `fastForward` jumps up to ~24h — enough to expire the access token, so supabase-js refreshes mid-test. It succeeded on every run here (9 individual runs plus 3 burn-in repeats, zero failures), local GoTrue refresh tokens do not expire by default, and `tests/support/merged-fixtures.ts:35` already excludes `/auth/v1/token` from the network monitor for exactly this class of noise. If this test ever goes red with an auth symptom rather than a card-count symptom, this is the cause, and the fix is to install the clock nearer midnight and jump only seconds — at the cost of a larger jump at install time instead.

3. **`fastForward` fires each due timer at most once.** That is what makes a ~24h jump affordable against `EventCountdown`'s one-second interval — 1 tick, not 86,400. It is a documented Playwright guarantee, not an observation, but it is load-bearing enough to name: if it changed, this test would hang rather than fail.

4. **Test 8 seeds 51 rows and asserts a render, not a row count.** The truncation itself is invisible from the DOM; it is asserted over the wire in the API spec instead. What test 8 claims is narrower and is stated in-file: at the shipped default, the next event is still on Home. Mutant B confirms it discriminates.

5. **The `coupleEvents` fixture clears every event for the worker's pair, on both sides of the test.** That is the same blast radius the existing events specs already take (`clearPairEvents` in both `tests/e2e/home/events.spec.ts` and `tests/e2e/settings/events-crud.spec.ts`), and it is safe only because worker pairs are disjoint. `getAuthPoolSize()` floors at 8 and global-setup provisioned 10 pairs in this run against 5 workers; a run with more workers than pool pairs would make two workers share an identity, and this fixture would then be one more thing that stomps. That is a pre-existing suite property, not something introduced here.

6. **`tests/README.md` was not updated.** Its directory tree is already stale independently of this run: **9 of the 40 spec files under `tests/e2e`, `tests/api` and `tests/integration` are not named in it** (measured by `basename` grep), 7 of them pre-existing — the whole `tests/e2e/settings/` directory, `tests/e2e/home/events.spec.ts`, and `tests/api/check-constraint-error-mapping.spec.ts` among them. Adding only this run's two files would make a tree that is missing seven others look current. A full refresh is a documentation change of its own and, per `AGENTS.md`, gets its own commit.

7. **`package.json` scripts were not changed.** `test:e2e`, `test:p0`, `test:p1`, `test:unit`, `test:integration` and `test:burn-in` all already exist and all reach the new files. The checklist's `test:api` has no equivalent; adding one (`playwright test --project=api`) is a one-line change but is not something this run's targets need, and `AGENTS.md` scopes edits to what the ask implies.

---

## 10. Definition of Done

Against `test-quality.md` § Core Quality Checklist, per generated file.

| Criterion | `events-read-window.spec.ts` (API) | `events-read-window.spec.ts` (E2E) | `factories/events.ts` + fixture |
|-----------|-----------------------------------|-----------------------------------|--------------------------------|
| No hard waits | ✅ no `waitForTimeout`; web-first assertions only | ✅ `page.clock.fastForward` is a controlled clock advance, not a sleep — the test's subject, not a synchronisation crutch | ✅ n/a |
| No conditionals controlling flow | ✅ | ✅ | ✅ (the throws are guards on invalid input, not branches over behaviour) |
| No try/catch for flow control | ✅ none | ✅ none | ✅ none |
| ≤ 1000 lines | ✅ 321 | ✅ 170 | ✅ 223 / 157 |
| < 1.5 min per test | ✅ slowest 0.70s | ✅ slowest 1.4s | ✅ n/a |
| Self-cleaning | ✅ `coupleEvents` teardown | ✅ same | ✅ the fixture *is* the cleanup |
| Explicit assertions in test bodies | ✅ every `expect` in the test; `labelsOf` extracts, never asserts | ✅ | ✅ no assertions in helpers |
| Parallel-safe | ✅ worker-pair scoped; 5 workers, `--repeat-each=3`, zero flakes | ✅ same | ✅ ownership-scoped, not id-scoped |
| No committed `.only` / `fdescribe` | ✅ | ✅ | ✅ |
| Skips documented | ✅ none added | ✅ none added | ✅ none |
| Assertions can fail | ✅ mutant A killed 4 of 7 | ✅ mutants B and D each killed one | ✅ exercised by both specs |
| One concern per test | ✅ counted by subject: each test names one window property | ✅ one per test | ✅ n/a |
| Grouped and shallow | ✅ one `describe`, one level | ✅ one `describe`, one level | ✅ n/a |
| Behavioural names, one dialect | ✅ `expect` throughout; names state the behaviour | ✅ | ✅ |
| Priority tags | ✅ `[P0]` ×2, `[P1]` ×4, `[P2]` ×1 | ✅ `[P0]` ×1, `[P1]` ×1 | ✅ n/a |
| `data-testid` selectors (E2E) | n/a | ✅ `getByTestId` throughout, no CSS-class or XPath selectors | n/a |
| TypeScript complete | ✅ typecheck delta zero | ✅ | ✅ |
| No debug statements | ✅ | ✅ | ✅ |

### Known checklist deviations

Stated rather than silently skipped.

- **Given-When-Then comments.** The checklist asks for literal `// GIVEN / // WHEN / // THEN` comments. The generated files use the explanatory-prose comment style of their immediate neighbours — `tests/e2e/home/events.spec.ts`, `tests/e2e/settings/events-crud.spec.ts` and `tests/api/check-constraint-error-mapping.spec.ts` all do, and none of them uses GWT — per `AGENTS.md`'s "match surrounding style by hand". Only the `tests/api/scripture-reflection-*.spec.ts` family uses GWT.
- **"One assertion per test."** The checklist's phrasing is stricter than the loaded `test-quality.md`, which states the rule as **one concern**, "counted by subject, not by `expect` call". The knowledge fragment governs; the generated tests follow it.
- **Factories without faker.** Deliberate, with the fragment's own justification — see §5 § On `faker`.
- **`tests/README.md` and `package.json` not updated** — §9 items 6 and 7, with the measured reasons.
- **Healing loop not entered.** `auto_heal_failures` is off by default and no generated test failed on first run, so there was nothing to heal and no healing report to write.

---

## 11. Next Steps

**Run the new coverage**

```bash
# Prerequisite: npx supabase start
npx playwright test tests/api/events-read-window.spec.ts --project=api
npx playwright test tests/e2e/home/events-read-window.spec.ts --project=chromium

# In the priority sweeps the suite already has
npm run test:p0        # includes DW9.22-API-001/002 and DW9.22-E2E-001
npm run test:p1        # adds the four P1 API cases and DW9.22-E2E-002
```

**Recommended follow-on workflows**

1. `/bmad-testarch-trace` — this story has no traceability matrix of its own; the five acceptance criteria in `spec-dw-9-22-events-read-cap-and-pagination.md` now have coverage at three levels and are worth mapping.
2. `/bmad-testarch-test-review` — on the two new specs plus the four existing events files, to check the events suite as a whole rather than this increment alone.
3. `framework` scope, not this run's: the `authToken` wiring named in §8.

**Deferred items this run deliberately left alone** (all three are in the story's own frontmatter): the Settings "load more" affordance, the unreadable-row-consumes-a-slot case, and the three separate `3` literals encoding one product decision. None is accepted behaviour, so none was pinned by a test.

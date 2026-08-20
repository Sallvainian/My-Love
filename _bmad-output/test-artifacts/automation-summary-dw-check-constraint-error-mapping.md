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
runKey: 'dw-check-constraint-error-mapping'
executionMode: 'BMad-Integrated'
detectedStack: 'frontend'
resolvedExecutionMode: 'sequential'
inputDocuments:
  - '_bmad-output/implementation-artifacts/spec-dw-8-16-check-constraint-error-mapping.md'
  - '_bmad-output/implementation-artifacts/deferred-work.md'
  - 'src/api/errorHandlers.ts'
  - 'src/api/interactionService.ts'
  - 'src/api/moodApi.ts'
  - 'src/api/supabaseClient.ts'
  - 'src/services/eventsService.ts'
  - 'src/stores/slices/eventsSlice.ts'
  - 'src/components/Settings/EventsSettings.tsx'
  - 'src/components/MoodTracker/MoodTracker.tsx'
  - 'src/components/Settings/__tests__/EventsSettings.test.tsx'
  - 'tests/unit/api/errorHandlers.test.ts'
  - 'tests/unit/api/interactionService.test.ts'
  - 'tests/unit/api/moodApi.test.ts'
  - 'tests/unit/api/fakeInteractionsBackend.ts'
  - 'tests/unit/api/fakeMoodsBackend.ts'
  - 'tests/unit/services/eventsService.test.ts'
  - 'tests/e2e/settings/events-crud.spec.ts'
  - 'tests/api/scripture-reflection-rpc.spec.ts'
  - 'tests/support/merged-fixtures.ts'
  - 'tests/support/test-credentials.ts'
  - 'tests/support/auth/worker-pool.ts'
  - 'tests/support/helpers/supabase.ts'
  - 'tests/README.md'
  - 'supabase/migrations/20260818000002_create_events_table.sql'
  - 'supabase/migrations/20251203000001_create_base_schema.sql'
  - 'supabase/migrations/20251206024345_remote_schema.sql'
  - 'vitest.config.ts'
  - 'playwright.config.ts'
  - 'package.json'
  - 'tsconfig.test.json'
  - 'AGENTS.md'
  - '_bmad/tea/config.yaml'
  - 'node_modules/@seontechnologies/playwright-utils/dist/esm/api-request/api-request.js'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/library-integration-mandate.md'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/playwright-utils-mandate.md'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/pactjs-utils-mandate.md'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/confidence-gate.md'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/test-levels-framework.md'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/test-priorities-matrix.md'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/test-quality.md'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/evidence-integrity.md'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/data-factories.md'
  - '.claude/skills/bmad-testarch-automate/resources/knowledge/api-request.md'
---

# Test Automation Summary: dw-check-constraint-error-mapping

**Date:** 2026-08-19
**Author:** Sallvain
**Mode:** BMad-Integrated (implementation spec available, no test-design for this story)
**Scope under test:** branch `bmad-loop/20260819-133049-ee65/dw-check-constraint-error-mapping`, commit `ba2bdd9` — one production line, `src/api/errorHandlers.ts:66`, mapping SQLSTATE `23514` to a readable sentence. Resolves DW-8 and DW-16.

---

## 1. Preflight

| Item | Resolution | Evidence |
|------|-----------|----------|
| Detected stack | `frontend` | `playwright.config.ts` and `vitest.config.ts` present; `package.json` carries react/vite/@playwright/test. No `pyproject.toml`, `pom.xml`, `go.mod`, `Gemfile`, `Cargo.toml`, `*.csproj`, no `.maestro/`, no `app.json`, no `Podfile`, no `pubspec.yaml` — all probed. |
| Framework readiness | PASS (no HALT) | `playwright.config.ts` with projects `chromium`, `api`, `integration`; `vitest.config.ts` with `include: ['tests/**/*.test.ts', …]`. |
| Playwright Utils profile | Full UI+API | `@seontechnologies/playwright-utils ^4.4.0` in `package.json`; 27 files under `tests/` contain `page.goto` or `page.locator`. |
| `tea_use_playwright_utils` | `true` — **mandate binds** | Both gates of `library-integration-mandate.md` hold: flag true in `_bmad/tea/config.yaml`, package installed. |
| `tea_use_pactjs_utils` | `true`, **not applicable** | The mandate's relevance gate: no consumer-provider boundary. Probed for Pact indicators — no `pact/` directory, no `@pact-foundation/pact` or `@seontechnologies/pactjs-utils` in `package.json` (`grep -c pact package.json` returns 0), no `PACT_BROKER`. The flag means "use these utilities when contract tests are written", never "add contract tests". **No Pact artifacts generated.** |
| `tea_pact_mcp` | `mcp`, `pact_mcp_reachable: false` | Tool-list probe only, per `pact-mcp.md`. No SmartBear/PactFlow MCP server is connected to this session. Recorded once; not retried; moot because no Pact artifacts are in scope. |
| `tea_execution_mode` | `auto` → resolved **`sequential`** | Capability probe: this run is a bmad-loop worktree session, where `CLAUDE.md` forbids delegating the work to a background subagent ("a session sleep-waiting on one looks active to the loop's stall detector … burns its whole 90-minute session timeout", citing run `20260818-230216-c22b`). Both `supports.agentTeam` and `supports.subagent` are therefore false, and `auto` resolves deterministically to `sequential`. Both worker roles (3A API, 3B E2E) were executed in-process. |
| `tea_browser_automation` | `auto` → **not used** | Browser exploration is for discovering unknown selectors. Every selector this run needed is an existing `data-testid` read from `src/components/Settings/EventsSettings.tsx` and already exercised by `tests/e2e/settings/events-crud.spec.ts`. No CLI session was opened, so none needed closing. |

---

## 2. Confidence Gate

Per `confidence-gate.md`, declared before any artifact was written.

```
Confidence: 9
Rationale: The change is one line, read this session at src/api/errorHandlers.ts:66.
  The 23514 wire envelope was MEASURED against this repo's running local stack
  (postgrest/13.0.5) under two different roles, on three tables. The full CHECK
  constraint set was measured from pg_constraint (14 rows). The set of modules
  importing handleSupabaseError was measured with grep (3 modules, 15 throw sites).
  Every code shape copied from an existing passing spec: error injection from
  tests/unit/services/eventsService.test.ts:173, the fulfillResponse stub and the
  skipNetworkMonitoring annotation from tests/e2e/settings/events-crud.spec.ts:396-425,
  worker-identity resolution from the same file at :37-69.
Unknowns:
  - Whether CI's Postgres/PostgREST build emits an identical envelope. Mitigated:
    the API spec asserts on `code`, on key *presence*, and on a substring of
    `message` — never on the exact `details` text, which is the field that varies.
  - Whether a free worker identity exists at run time. Pre-existing suite-wide
    precondition, not introduced here.
```

Above the threshold of 7, so generation proceeded. Both Unknowns are recorded in §8.

---

## 3. What the change actually is, measured

The story's one-line fix is a **defence-in-depth net, not a fix for a live user-visible bug.** That finding drove every priority decision below, so the evidence is given in full.

**Which constraints sit behind the mapping.** Measured from the catalogue, not read off the migrations:

```
docker exec supabase_db_My-Love psql -U postgres -d postgres -c \
  "select conrelid::regclass, conname, pg_get_constraintdef(oid) from pg_constraint
     where contype='c' and connamespace='public'::regnamespace"
```

14 rows. Seven are on tables written through a module that imports `handleSupabaseError`; seven are not.

| Table | CHECK constraints | Routes through `handleSupabaseError`? |
|-------|------------------|--------------------------------------|
| `events` | `events_label_check`, `events_description_check`, `events_icon_check` | Yes — `src/services/eventsService.ts:39` |
| `moods` | `moods_mood_type_check`, `moods_mood_types_values_check`, `moods_note_check` | Yes — `src/api/moodApi.ts:14` |
| `interactions` | `interactions_type_check` | Yes — `src/api/interactionService.ts:23` |
| `love_notes` | `different_users`, `love_notes_content_check` | **No** — `notesSlice.ts` handles its own rejections |
| `partner_requests` | `no_self_requests`, `partner_requests_status_check` | **No** — `partnerService.ts` throws hand-written Errors |
| `photos` | `photos_caption_check`, `valid_mime_type` | **No** — `photoService.ts` rethrows the raw insert error |
| `scripture_reflections` | `scripture_reflections_rating_check` | **No** — `scriptureReadingService.ts` interpolates `error.message` |

**Every one of the seven covered constraints is mirrored client-side, so none is reachable by typing.**

- `EventsSettings.tsx:511-529` mirrors blank label, `LABEL_MAX_LENGTH` (100), `DESCRIPTION_MAX_LENGTH` (500) and `ICON_VALUES`; nothing is requested until the mirror passes.
- `MoodTracker.tsx:523` sets `maxLength={200}` on the note textarea against a database check of `char_length(note) <= 500`.
- `interactions.type` is the TypeScript union `'poke' | 'kiss'` (`src/api/interactionService.ts:39`), with only `sendPoke` and `sendKiss` as callers.

**The wire envelope, measured under two roles.** Same rejection, two different bodies:

```
# service_role (secret key)
{"code":"23514",
 "details":"Failing row contains (c3760217-…, …, probe, 2030-01-01, null, not-an-icon, …).",
 "hint":null,
 "message":"new row for relation \"events\" violates check constraint \"events_icon_check\""}

# authenticated (a JWT for testworker0@test.example.com) — what the app receives
HTTP/1.1 400 Bad Request
{"code":"23514","details":null,"hint":null,
 "message":"new row for relation \"events\" violates check constraint \"events_icon_check\""}
```

Three consequences, each of which changed a test that had already been drafted:

1. **The status is 400, not 500.** The neighbouring stub in `events-crud.spec.ts:413-425` fulfils with 500 for its `XX000` case; a 23514 stub copying that would be testing a response the server never sends. The new E2E fulfils with 400.
2. **The failing row never reaches the app.** Postgres withholds `details` from a non-privileged role, so the user's own typed input is not disclosed. A test asserting "the failing row is kept out of the message" against the app-facing envelope would have been asserting against something the server never sent — an assertion that cannot fail, which `evidence-integrity.md` classifies as decoration. It is now driven by the explicitly-labelled service_role envelope instead.
3. **`details` is present-and-`null`, not absent.** `isPostgrestError` (`src/api/errorHandlers.ts:109-117`) keys on the *presence* of `code`, `message` and `details` and never inspects a value. JSON `null` still produces the property, so the guard passes and the map is consulted. **If a future PostgREST omitted the key, the guard would go false, every adopter would route its rejection into a network tail, and the user would be told their change "will be synced when you're back online" about a write the database refused outright — with every unit test in the repo still green.** That is the single highest-value thing this run could pin, and it is the P0.

---

## 4. Coverage Plan

### Existing coverage, and what it cannot show

| Existing artifact | What it covers | Gap |
|---|---|---|
| `tests/unit/api/errorHandlers.test.ts` (13 tests, added by the dev in `ba2bdd9`) | The map itself: `23514` → generic sentence, the seven previously-mapped codes, and the fallback | Feeds the mapper an envelope a test author wrote down. Cannot show the key is *reached* by any caller, nor that the server still sends that envelope. |
| `tests/e2e/settings/events-crud.spec.ts:391-445` | A rejected save keeps the form open, using an injected `XX000` | Asserts only that the surfaced text contains `Injected create failure`. Unaffected by, and blind to, the `23514` mapping. |
| `src/components/Settings/__tests__/EventsSettings.test.tsx:404` | Client-side rejection of a 101-character label | Owns the client-mirror claim. Re-testing it in a browser would be the same claim, slower and more brittle. |

### Targets, levels and priorities

Levels chosen per `test-levels-framework.md`; priorities per `test-priorities-matrix.md`'s decision tree.

| ID | Level | Target | Priority | Why this level, and why not another |
|----|-------|--------|----------|--------------------------------------|
| DW8.16-API-001 | API (Playwright, live stack) | `events_label_check` rejected over the wire → the live body fed through `handleSupabaseError` | **P0** | The only place the server's half and the app's half meet. Regression-prevention on previously-broken functionality, and the failure mode it guards (the `isPostgrestError` guard silently going false) is undetectable at every other level. Not unit: a unit test cannot observe the server. |
| DW8.16-API-002 | API | `interactions_type_check`, same loop | P1 | Second adopter, live constraint. |
| DW8.16-API-003 | API | `moods_note_check`, same loop | P1 | Third adopter, live constraint. |
| DW8.16-API-004 | API | `details` arrives `null` but the key is present; `code` and `message` present | P1 | The mapping's precondition, asserted on the live body. |
| DW8.16-API-005 | API | A rejected CHECK write commits no row | P1 | Makes this spec's "no teardown needed" claim checkable instead of assumed (`AGENTS.md`: a spec must not null a shared row at teardown). |
| DW8.16-SVC-001…015 | Service boundary (Vitest) | Each of the three adopters under a `23514`: mapped sentence with context prefix, no leak markers, not dressed as a network error, `code`/`details`/`hint` pass-through, failing row kept out of `.message` | P1 | Each adopter's catch tail has an earlier branch that could swallow a `23514` before the map sees it. That routing is logic, so it belongs at unit level, not E2E. |
| DW8.16-SVC-016…019 | Service boundary | Fake fidelity: the injected envelope is one `isPostgrestError` accepts; one without `details` is not | P1 | The file's own premise, asserted rather than assumed. |
| DW8.16-SVC-020…022 | Service boundary | An adjacent SQLSTATE (`23515`, exclusion_violation) still falls back | P1 | Without it, every assertion above would pass equally if the map had been widened to all of `235xx`. Distinguishes a precise fix from a blunt one. |
| DW8.16-E2E-001 | E2E (Playwright) | The events Settings form shows the mapped sentence and no part of the Postgres sentence | P1 | The user-visible surface the story was about. One test only — E2E is for the critical path, and the variations are already covered a level down. |

**Deliberately not generated**

- **Contract (Pact) tests** — no consumer-provider boundary; see §1.
- **Component tests** — the component-level claim (client-side mirror) is already owned by `EventsSettings.test.tsx:404`. Adding one would be duplicate coverage across levels, which `test-levels-framework.md` names as an anti-pattern.
- **A second E2E asserting the client mirror** — drafted, then removed for exactly that reason. The claim it made now lives as prose in the E2E file header with a pointer to the component test that owns it.
- **Coverage for the seven CHECK constraints on `love_notes`, `partner_requests`, `photos` and `scripture_reflections`** — those tables' writers never call `handleSupabaseError`, so no mapping exists to test. This is the story spec's own `severity: medium` deferred item, and it is out of scope here.

---

## 5. Files Created

| File | Lines | Contents |
|------|-------|----------|
| `tests/support/check-constraint-envelopes.ts` | 178 | Shared, import-free measured-envelope module + factory |
| `tests/unit/api/checkConstraintMapping.test.ts` | 319 | 22 service-boundary tests (Vitest) |
| `tests/api/check-constraint-error-mapping.spec.ts` | 231 | 5 live-stack contract tests (Playwright `api` project) |
| `tests/e2e/settings/events-check-constraint.spec.ts` | 183 | 1 user-surface test (Playwright `chromium` project) |

**No existing file was modified.** `git status` shows four untracked additions and nothing else beyond the orchestrator's own `deferred-work.md` edit.

### Infrastructure: the shared factory

`tests/support/check-constraint-envelopes.ts` follows the shape of `tests/support/test-credentials.ts` — zero imports, so both the Vitest and the Playwright side can consume it without dragging a test framework across the boundary. It exports:

- `PostgrestErrorEnvelope` — the wire type, with `details`/`hint` correctly nullable (the SDK's own `PostgrestError` types both as plain `string`, which every measured response contradicts).
- `CHECK_VIOLATION_HTTP_STATUS` (400), `CHECK_VIOLATION_CODE` (`'23514'`), `CHECK_VIOLATION_MESSAGE`, `LEAK_MARKERS`.
- `AUTHENTICATED_EVENTS_LABEL_CHECK`, `AUTHENTICATED_EVENTS_ICON_CHECK`, `AUTHENTICATED_INTERACTIONS_TYPE_CHECK`, `AUTHENTICATED_MOODS_NOTE_CHECK` — what the app receives.
- `SERVICE_ROLE_EVENTS_ICON_CHECK` — the privileged-role contrast, kept verbatim and labelled as not-what-the-app-gets.
- `checkViolation(overrides)` — the factory, with `code` overridable so a test can prove the mapping is keyed on `23514` alone.

Per `data-factories.md` § naming the domain literals a test hardcodes on purpose: `'x'.repeat(101)` and `'n'.repeat(501)` in the API spec are named constants carrying the constraint definition they cross (`char_length(label) <= 100`, `char_length(note) <= 500`). Faker is deliberately **not** used for them — a random length would not reliably violate the boundary, which is the entire point of the value.

No auth fixture, network-mock module, or helper was created. The project already has all three, and the mandate's §4-PU explicitly forbids a helper whose body is one `interceptNetworkCall`.

---

## 6. Validation Results

Every number below is from a command run in this worktree, not an estimate.

| Check | Command | Result |
|-------|---------|--------|
| New service-boundary tests | `npx vitest run tests/unit/api/checkConstraintMapping.test.ts` | **22 passed** |
| Full unit suite | `npm run test:unit` | **92 files, 1380 tests passed.** Baseline before this run was 91 files / 1358 (recorded in the story spec's deferred notes); the delta is exactly the one file and 22 tests added. |
| New API contract tests | `npx playwright test --project=api tests/api/check-constraint-error-mapping.spec.ts` | **5 passed** (5.9s) |
| New E2E test | `npx playwright test --project=chromium tests/e2e/settings/events-check-constraint.spec.ts` | **1 passed** (7.2s) |
| Regression across neighbours | `npx playwright test --project=api --project=chromium tests/api tests/e2e/settings` | **26 passed** (19.4s) across 7 files — the whole `api` project plus every settings E2E, including `events-crud.spec.ts`, running alongside the new specs |
| Typecheck | `npm run typecheck` | 6 errors, **all pre-existing**: verified by moving the four new files aside and re-running — 6 before, 6 after, every one `TS2883` at `tests/support/merged-fixtures.ts(53,14)`, all naming the parent repo's `node_modules`. This is the documented loop-worktree baseline. **Delta from this run: zero.** |
| Lint | `npm run lint` | **0 errors**, 2 warnings — both `react-refresh/only-export-components` in `src/components/RelationshipTimers/EventCountdown.tsx`, a file this run did not touch. |

### Falsifiability — measured, not argued

`evidence-integrity.md` requires naming the input that turns each check red, and verifying it. The `23514` line was deleted from `src/api/errorHandlers.ts` and each suite re-run. The file was restored afterwards and `git diff --stat src/api/errorHandlers.ts` confirmed byte-identical to `ba2bdd9`.

| Suite | Green | With `'23514'` deleted |
|-------|-------|------------------------|
| `checkConstraintMapping.test.ts` + `errorHandlers.test.ts` | 35 passed | **9 failed, 26 passed** (6 of the failures are the new file's) |
| `tests/api/check-constraint-error-mapping.spec.ts` | 5 passed | **3 failed, 2 passed** — the two survivors assert server-side properties, which the mutation does not touch. Correct shape. |
| `tests/e2e/settings/events-check-constraint.spec.ts` | 1 passed | **1 failed** |

Every generated test either fails under the mutation or is demonstrably about something the mutation does not affect.

---

## 7. Playwright Utils deviations

Per `playwright-utils-mandate.md`. The self-check was run against all three spec files before writing.

| File:line | Deviation | Reason |
|-----------|-----------|--------|
| — | **None.** | No `page.route`, no `page.waitForResponse`, no raw `request.<method>`, no `page.waitForTimeout`, no `console.log`, and no spec-level `import { test } from '@playwright/test'` appears in any generated file. Both Playwright specs import `test` and `expect` from `tests/support/merged-fixtures.ts`; the API spec uses `apiRequest`; the E2E spec uses `interceptNetworkCall` declared before `page.goto`. |

### Recommended utilities: what was used, what was not, and what it would need

| Utility | Status |
|---------|--------|
| `apiRequest` | **Used.** REQUIRED substitution, applied to all five API tests. Verified from the package source (`dist/esm/api-request/api-request.js:38-44`) that `retryStatusCodes` is `[500, 502, 503, 504]`, so the 400 under test returns `{ status, body }` rather than throwing — the assertions rest on measured library behaviour, not on the fragment's prose. |
| `interceptNetworkCall` | **Used.** Declared before `page.goto`, awaited after, with `fulfillResponse` carrying the measured 400 envelope. |
| `network-error-monitor` | **Used, with a scoped opt-out.** Already in the project's merge. The new E2E describe carries `{ annotation: [{ type: 'skipNetworkMonitoring' }] }` because the injected 4xx is the subject of the test — the same opt-out `events-crud.spec.ts:396` uses for the same reason. |
| `authToken` (`auth-session`) | **Not used — and this is a real gap worth naming.** The project has a `SupabaseAuthProvider` wired at `tests/support/auth/supabase-auth-provider.ts`, but it yields a browser storage state, not a bearer token for an arbitrary pool user. The API spec therefore calls the project's own `getUserAccessToken(supabaseAdmin, userId)` (`tests/support/helpers/supabase.ts:49`), which signs in with the shared test password and returns `session.access_token`. That is the established repo-wide pattern — `tests/api/scripture-reflection-rpc.spec.ts:43` does the identical thing. **Wiring still needed** to close this properly: an `authToken` fixture parameterised by pool user identity, built on `createAuthFixtures()`, so API specs stop re-signing-in per test. That is `framework`-workflow scope, not `automate`'s. |
| `recurse` | Not used — nothing here is eventually consistent. A CHECK rejection is synchronous. |
| `log` | **Not used, deliberately.** The mandate makes `log.*` the required substitution *for* `console.log`; no generated file contains a `console.log` to substitute. Measured: of the 38 spec files under `tests/` outside `e2e-archive/`, zero use `log.step`/`log.info`/`log.success`/`log.warning`/`log.error`. Adopting it in two new ones would diverge from every neighbour without adding signal. Recorded here rather than left silent. |
| Schema validation via `apiRequest` | Not used. The response under test is a PostgREST *error* envelope, for which the project has no schema. Per the mandate's RECOMMENDED clause: no response schema exists for the `23514` body, so assertions cover the fields under test only — `code`, `message`, and the presence of `code`/`message`/`details`. The `PostgrestErrorEnvelope` interface in the shared factory documents the shape a future schema would formalise. |
| `networkRecorder`, `webhook*`, `handleDownload`/`read*`, `runBurnIn` | Not applicable — no offline/HAR run, no async events, no downloads, no diff-selection in scope. |

## Pact.js Utils deviations

**N/A — no contract artifacts were generated.** Per `pactjs-utils-mandate.md`'s relevance gate, `tea_use_pactjs_utils: true` means "use these utilities when contract tests are written", not "add contract tests to this project". This is a single-frontend PWA against Supabase-as-a-service: there is no provider codebase to verify against, and no Pact indicators exist (see §1). Generating a consumer contract here would produce a pact nobody can verify.

---

## 8. Assumptions and Risks

1. **CI's Postgres/PostgREST may differ from local.** The `23514` envelope was measured against postgrest/13.0.5 in this repo's Docker stack. Mitigation is built into the assertions: `tests/api/check-constraint-error-mapping.spec.ts` asserts on `code`, on key *presence*, and on a substring of `message` — never on the exact `details` text, which is the field most likely to vary between builds. If the envelope ever does change, that spec fails loudly, which is the intended behaviour: it is the canary, not a casualty.

2. **The E2E stubs, and it must.** No CHECK constraint behind `handleSupabaseError` is reachable through the UI today (§3). A stubbed test proves the mapping renders correctly given the response; it cannot prove a user can produce that response, and the file header says so in as many words. `tests/api/check-constraint-error-mapping.spec.ts` is what proves the real server still sends it, so the pair together carries the claim neither half carries alone.

3. **`SoloReadingFlow.test.tsx` is a known flake** — about one run in five, per the story spec's own `severity: low` deferred entry. It passed in this run's full-suite execution. Unrelated to anything generated here; if `npm run test:unit` goes red on that file, this is the cause.

4. **The internal context prefix is user-visible.** The events form renders `[EventsService.createEvent] Some values are not allowed - check length and format limits` — `eventsSlice.messageOf` (`src/stores/slices/eventsSlice.ts:73-75`) returns `error.message` verbatim, prefix included. That is pre-existing behaviour, equally true of the `XX000` case the older E2E already asserts, and out of scope for this story. The new E2E pins the exact string, so it is now visible rather than incidental — a future decision to strip the prefix will surface here as a deliberate update.

5. **`tests/README.md` was not updated, and its directory tree is already stale.** Measured discrepancies against the actual tree: it lists `tests/api/scripture-reflection-api.spec.ts`, which does not exist (the real files are `scripture-reflection-2.2.spec.ts`, `-2.3.spec.ts`, `-rpc.spec.ts`); it lists `tests/support/auth-setup.ts` and `tests/support/fixtures/worker-auth.ts`, neither of which exists (auth now lives under `tests/support/auth/`); and it omits `tests/unit/api/` entirely — a directory holding 8 files, including the `errorHandlers.test.ts` this story added. Threading four new filenames into an already-wrong tree would be cosmetic. Repairing the tree is a documentation change that `AGENTS.md` says gets its own commit, and it is outside this ask. Raised as an actionable finding instead.

6. **No `test:api` npm script was added.** `package.json` has `test:integration` (`--project=integration`) but no `--project=api` equivalent, so the new API spec is run via `npx playwright test --project=api …`. Adding a script is a project-configuration change beyond "generate tests and fixtures"; flagged for the operator rather than taken unilaterally.

---

## 9. Definition of Done

Against `.claude/skills/bmad-testarch-automate/checklist.md` and `test-quality.md`'s Core Quality Checklist.

### Coverage and design

- [x] Execution mode determined (BMad-Integrated; spec present, no test-design for this story)
- [x] Framework configuration loaded and validated — no HALT
- [x] Coverage analysis completed; existing coverage and its blind spots tabulated in §4
- [x] Automation targets identified from the working-tree change, grounded in measured evidence
- [x] Test levels selected per `test-levels-framework.md`
- [x] **Duplicate coverage avoided** — one drafted E2E test was deleted because `EventsSettings.test.tsx:404` already owns its claim; no component tests generated for the same reason
- [x] Priorities assigned per `test-priorities-matrix.md` (P0 = 1, P1 = 5 in Playwright; the 22 Vitest tests are classified P1 in §4 and carry no in-code tag, matching every other Vitest file in the repo — the `test:p0`/`test:p1` grep scripts are Playwright-only)
- [x] Coverage plan documented with justification per row

### Infrastructure

- [x] Existing fixtures checked before generating; `tests/support/merged-fixtures.ts` **extended by import, not replaced**
- [x] Shared factory created with override support (`checkViolation(overrides)`)
- [x] Domain literals named and their constraint definitions quoted, per `data-factories.md`
- [x] No redundant helper module created — stubs live in the test that needs them, per the mandate's §4-PU(D)/(E)
- [x] Cleanup: **not required and proven so.** Every API write is rejected, so no row is created; `DW8.16-API-005` asserts that rather than assuming it. The E2E clears only its own worker pair's events, the same scope `events-crud.spec.ts:80-89` uses.

### Test quality (`test-quality.md` Core Quality Checklist)

- [x] **No hard waits** — no `waitForTimeout` in any generated file
- [x] **No conditionals** — no `if`/`try-catch` controlling flow; the one `throw` in each helper is a precondition guard that fails the test loudly rather than branching around a missing premise
- [x] **≤ 1000 lines** — largest generated file is 319
- [x] **< 1.5 minutes** — slowest new suite is the 5-test API spec at 5.9s
- [x] **Self-cleaning** — see above
- [x] **Explicit assertions** — every `expect` is in a test body; no assertions hidden in helpers
- [x] **Unique data** — the E2E probe label is `check-probe-${userId}`, scoped to the worker's own identity
- [x] **Parallel-safe** — the 5 API tests ran concurrently on 5 workers ("Running 5 tests using 5 workers") against the shared account pool and all passed; the `api` and `chromium` projects then ran together, 26 tests across 7 files, all passed. Rejected writes touch no shared row; the E2E uses only its own worker pair, per `AGENTS.md`'s worker-pool rule
- [x] **No committed focus** — no `.only`, no `fdescribe`, no `fit`
- [x] **Skips documented** — none present
- [x] **Assertions can fail** — proven by mutation, per suite, in §6
- [x] **One concern per test** — counted by subject, per `test-quality.md`, not by `expect` call
- [x] **Grouped and shallow** — `describe` used throughout; deepest nesting is 2 levels
- [x] **Behavioural names, one dialect** — names state behaviour; each file uses a single assertion style

### Playwright Utils mandate

- [x] Every spec imports `test` from `tests/support/merged-fixtures.ts`
- [x] `interceptNetworkCall` used for the only application-endpoint stub; no `page.route`, no `page.waitForResponse`
- [x] `apiRequest` used for every application endpoint; no raw `request.<method>`
- [x] No `page.waitForTimeout`, no hand-written poll loop
- [x] No `console.log`
- [x] `network-error-monitor` in the merge, opted out only on the test whose subject is an error response
- [x] Package name is `@seontechnologies/playwright-utils` throughout
- [x] Deviation list present and explicitly `None`; every unused RECOMMENDED utility named with the wiring it would need (§7)

### Code quality

- [x] TypeScript types complete — typecheck delta zero, measured by removal and re-run
- [x] No lint errors in generated files
- [x] Naming matches neighbours (`kebab-case.spec.ts` under `tests/api` and `tests/e2e`, `camelCase.test.ts` under `tests/unit/api`)
- [x] E2E uses `data-testid` selectors throughout
- [x] Network-first: interception declared before `page.goto`
- [x] No page-object classes, no shared mutable state between tests
- [x] No debug statements

### Known checklist deviations

- **Given-When-Then comment format.** The checklist asks for explicit `// GIVEN / // WHEN / // THEN` comments. The generated files use the explanatory-prose comment style of their immediate neighbours (`tests/unit/api/interactionService.test.ts`, `tests/e2e/settings/events-crud.spec.ts`, `tests/unit/services/eventsService.test.ts` — none of which uses GWT), per `AGENTS.md`'s "match surrounding style by hand". Only `tests/api/scripture-reflection-*.spec.ts` uses GWT, and the new API spec sits beside it; that one is the closest call. Stated rather than silently skipped.
- **"One assertion per test".** The checklist's phrasing is stricter than the loaded `test-quality.md`, which says the rule is **one concern**, "counted by subject, not by `expect` call". The knowledge fragment governs, and the generated tests follow it.
- **`tests/README.md` and `package.json` scripts not updated** — see §8 items 5 and 6, with the measured reasons.

---

## 10. Next Steps

**Run the new coverage**

```bash
# service boundary
npx vitest run tests/unit/api/checkConstraintMapping.test.ts

# live-stack contract (needs `supabase start`)
npx playwright test --project=api tests/api/check-constraint-error-mapping.spec.ts

# user surface (needs `supabase start`)
npx playwright test --project=chromium tests/e2e/settings/events-check-constraint.spec.ts

# everything this run touched, plus its neighbours
npm run test:unit
npx playwright test --project=api --project=chromium tests/api tests/e2e/settings
```

**Recommended follow-on workflows**

1. `/bmad-testarch-trace` — map DW-8/DW-16 acceptance criteria to the 28 new tests and issue a gate decision. The acceptance criteria in `spec-dw-8-16-check-constraint-error-mapping.md` are now covered at three levels; the traceability matrix should record which level owns which criterion.
2. `/bmad-testarch-test-review` — quality lens over the four generated files.
3. **Operator decisions**, neither taken here: repair the stale `tests/README.md` directory tree (§8 item 5) in its own documentation commit, and decide whether a `test:api` npm script is wanted (§8 item 6).
4. **Deferred, not addressed by this run** — the story spec's own open items stay open: the prototype-chain lookup at `src/api/errorHandlers.ts:72`, the sibling SQLSTATEs (`22001`, `22007`, `22P02`, `23P01`, `40001`, `57014`, `PGRST202`, `PGRST204`) that still fall through, and the four CHECK-carrying write paths that never reach `handleSupabaseError` at all. The last of those is quantified in §3: **seven of the schema's fourteen CHECK constraints sit outside the mapping's reach.**

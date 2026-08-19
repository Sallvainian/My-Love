---
title: 'Map Postgres CHECK-constraint violations (23514) to a readable message'
type: 'bugfix'
created: '2026-08-19'
baseline_revision: 'b9b3a4371ad0dd596fd430e487b7e31602636652'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: ['oversized']
deferred:
  - summary: >-
      The SQLSTATE lookup walks Object.prototype, so a code of toString,
      constructor, valueOf or hasOwnProperty returns an inherited function and
      renders it to the user as the error message.
    evidence: |-
      `errorMessages` is a bare object literal (src/api/errorHandlers.ts:62) and
      the lookup is `errorMessages[error.code] || ...` (:72), both unchanged by
      this story. Measured with node against a literal of the same shape:
      code 'toString' yields "function toString() { [native code] }",
      'constructor' yields "function Object() { [native code] }", and
      '__proto__' yields "[object Object]". Each is truthy, so the fallback
      never runs and the string is interpolated straight into the user-facing
      message. `Object.hasOwn(errorMessages, error.code)` or
      `Object.create(null)` closes it. error.code comes from the response body,
      and tests/e2e/settings/events-crud.spec.ts:413-425 shows arbitrary
      PostgREST bodies are injectable.
    location: >-
      src/api/errorHandlers.ts:72
    severity: low
  - summary: >-
      Sibling SQLSTATEs that also carry raw Postgres text are still unmapped, so
      the same leak class this story closed for 23514 remains open for them.
    evidence: |-
      After this change the map covers 23505, 23503, 23502, 23514, 42501, 42P01,
      PGRST116 and PGRST301. Still falling through to `Database error:
      ${error.message}`: 22001 (string data right truncation), 22007 and 22P02
      (invalid input syntax, which render the rejected literal verbatim), 23P01,
      40001, 57014, PGRST202 and PGRST204. public.events.event_date is
      `date not null` (supabase/migrations/20260818000002_create_events_table.sql:20),
      so a malformed date is a 22007 on a live column.
    location: >-
      src/api/errorHandlers.ts:62-70
    severity: medium
  - summary: >-
      Four CHECK-carrying write paths never reach handleSupabaseError, so the
      SQLSTATE map cannot protect them however many codes it maps.
    evidence: |-
      Only three modules import handleSupabaseError (measured with
      `grep -rln handleSupabaseError src/`): src/api/moodApi.ts:14,
      src/api/interactionService.ts:23, src/services/eventsService.ts:39. The
      non-adopters each handle rejections themselves: photoService.ts rethrows
      the raw insertError, scriptureReadingService.ts interpolates
      `Failed to submit reflection: ${error.message}`, notesSlice.ts swallows the
      error into a flag, and partnerService.ts throws hand-written Errors. The
      CHECK constraints on photos (20251203190800_create_photos_table.sql:18,24),
      scripture ratings (20260128000001_scripture_reading.sql:65), love_notes and
      partner_requests (20251206024345_remote_schema.sql:93,105,109,113) sit
      behind those paths. Pre-existing routing, not introduced here.
    location: >-
      src/services/photoService.ts, src/services/scriptureReadingService.ts, src/api/partnerService.ts, src/stores/slices/notesSlice.ts
    severity: medium
  - summary: >-
      A PostgrestError with a missing or empty message takes the fallback and
      surfaces the bare string "Database error: " with nothing after the colon.
    evidence: |-
      The fallback at src/api/errorHandlers.ts:72 interpolates error.message
      unconditionally. tsconfig.app.json sets no noUncheckedIndexedAccess, so an
      absent code is typed as string and silently takes the same branch. Nothing
      in the repo covers either case. Pre-existing; the new tests scope to 23514
      per the story intent.
    location: >-
      src/api/errorHandlers.ts:72
    severity: low
  - summary: >-
      SoloReadingFlow.test.tsx is flaky under the full suite, failing about one
      run in five while passing in isolation.
    evidence: |-
      Measured during this story's verification. `npm run test:unit` was run five
      times: four reported 91 files / 1358 tests passed; one reported
      "1 failed | 1357 passed" on
      "SoloReadingFlow > Story 2.3: Daily Prayer Report > treats partner as
      complete when session-level reflection exists". The file run alone
      (`npx vitest run src/components/scripture-reading/__tests__/SoloReadingFlow.test.tsx`)
      passed 113/113 three times consecutively. This story touches only
      src/api/errorHandlers.ts and tests/unit/api/errorHandlers.test.ts, neither
      of which SoloReadingFlow imports.
    location: >-
      src/components/scripture-reading/__tests__/SoloReadingFlow.test.tsx
    severity: low
---

<intent-contract>

## Intent

**Problem:** `handleSupabaseError` maps seven Postgres/PostgREST codes to friendly text but has no entry for `23514` (check_violation), so any CHECK-constraint rejection falls through to `` `Database error: ${error.message}` `` and the raw Postgres sentence — e.g. `new row for relation "events" violates check constraint "events_label_check"` — is rendered verbatim to the user.

**Approach:** Add a `23514` entry to the existing `errorMessages` map in `src/api/errorHandlers.ts` alongside the other codes, and add a unit-test file for `handleSupabaseError` that pins the new mapping plus the already-mapped codes and the unmapped fallback.

## Boundaries & Constraints

**Always:** Keep the fix inside the existing `errorMessages` object literal — one new key, same shape and tone as its neighbours. The new message must contain no part of `error.message`, no constraint name, and no table name. `error.code`, `error.details` and `error.hint` keep passing through to the constructed `SupabaseServiceError` unchanged, exactly as they do for the seven already-mapped codes.

**Never:** Do not restructure `handleSupabaseError`, `handleNetworkError`, the type guards, or `logSupabaseError`. Do not add per-table or per-constraint parsing of the raw message. Do not touch client-side validation (`src/components/Settings/EventsSettings.tsx`), any service that calls `handleSupabaseError`, any migration, or any pgTAP file. Do not edit `implementation-artifacts/deferred-work.md` — the orchestrator records resolution.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| CHECK violation, no context | `PostgrestError` with `code: '23514'`, `message: 'new row for relation "events" violates check constraint "events_label_check"'` | Thrown error's `message` is exactly `Some values are not allowed - check length and format limits` | Raw message, constraint name and table name absent from `.message` |
| CHECK violation, with context | Same error, `context: 'EventsService.createEvent'` | `message` is `[EventsService.createEvent] Some values are not allowed - check length and format limits` | Context prefix applied the same way as for every other code |
| CHECK violation, fields preserved | Same error with `details: 'Failing row contains (…)'`, `hint: null`, `code: '23514'` | Returned error carries `code === '23514'`, the same `details` and `hint`, and `isNetworkError === false` | No error expected |
| Already-mapped code unchanged | `code: '23505'` | `message` is `This record already exists` | No regression from the new key |
| Unmapped code still falls back | `code: 'XX000'`, `message: 'Injected create failure'` | `message` is `Database error: Injected create failure` | Fallback branch preserved |

</intent-contract>

## Code Map

- `src/api/errorHandlers.ts:62-70` -- the `errorMessages: Record<string, string>` literal. Keys today: `'23505'`, `'23503'`, `'23502'`, `'42501'`, `'42P01'`, `PGRST116`, `PGRST301`. Numeric-looking codes are quoted; `PGRST*` keys are bare identifiers. Two entries (`42501`, `42P01`) already use the ` - ` separator style the new message follows. **This is the only production line that changes.**
- `src/api/errorHandlers.ts:72` -- the leak site: `userMessage` is `errorMessages[error.code]` or else the template-literal fallback `Database error: <error.message>`. Adding the key is what stops the fallback.
- `src/api/errorHandlers.ts:74-80` -- `SupabaseServiceError` construction: `code`, `details`, `hint` pass through, `isNetworkError` is `false`. Unchanged.
- `src/api/errorHandlers.ts:16-36` -- `SupabaseServiceError` is **not exported**; a test can only assert on the thrown/returned object's public fields (`message`, `code`, `details`, `hint`, `isNetworkError`, `name === 'SupabaseServiceError'`), never `instanceof`.
- `tests/unit/api/` -- destination directory. **No test file for `src/api/errorHandlers.ts` exists** (`find src tests -iname '*errorHandler*'` returns only `src/api/errorHandlers.ts`, `src/utils/offlineErrorHandler.ts`, `tests/unit/utils/offlineErrorHandler.test.ts`). Create `tests/unit/api/errorHandlers.test.ts`.
- `tests/unit/api/offlineMessageHonesty.test.ts:32-36` -- convention reference for a plain unit test in this directory: explicit `import { describe, it, expect } from 'vitest'` even though `globals: true`.
- `vitest.config.ts` -- `include` already covers `tests/**/*.test.ts`; the `@` alias resolves to `./src` and is the tests-only import style (`AGENTS.md`: never `@/` inside `src/`). No config change needed.
- **Read-only evidence — do not edit:**
  - `src/components/Settings/EventsSettings.tsx:511-529` -- client-side mirror of the events CHECK constraints (blank label, `LABEL_MAX_LENGTH`, `DESCRIPTION_MAX_LENGTH`, `ICON_VALUES`). It closes the events-specific route only; it is why this bundle is a defence-in-depth fix, not a user-visible events bug.
  - CHECK constraints reachable from client writes on other tables, all still routed through `handleSupabaseError`: `20251206024345_remote_schema.sql:89,93,97,101,105,109,113,117` (`interactions_type_check`, `love_notes.different_users`, `moods_mood_type_check`, `moods_mood_types_values_check`, `partner_requests.no_self_requests`, `partner_requests_status_check`, `love_notes_content_check`, `moods_note_check`), `20251203190800_create_photos_table.sql:18,24`, `20260128000001_scripture_reading.sql:65`, `20260818000002_create_events_table.sql:19,21,22`.
  - `src/components/Settings/EventsSettings.tsx:789-795` -- only `error.message` is rendered (`saveError`); `.details` never reaches the UI, so mapping on `code` fully closes the user-visible leak.
  - `tests/e2e/settings/events-crud.spec.ts:413-425` -- injects code `XX000` and asserts the `Database error: ` prefix. Unaffected by a `23514` key; the fallback must keep working for it.

## Tasks & Acceptance

**Execution:**
- `src/api/errorHandlers.ts` -- add `'23514': 'Some values are not allowed - check length and format limits',` to the `errorMessages` literal, placed after `'23502'` so numeric codes stay in ascending order -- closes the raw-constraint-text leak at its single source for every table in the repo.
- `tests/unit/api/errorHandlers.test.ts` -- new file; unit-test `handleSupabaseError` over every row of the I/O & Edge-Case Matrix -- the mapping is a one-line literal that a future edit can silently drop, and nothing else asserts it.

**Acceptance Criteria:**
- Given the repo after the change, when `grep -n "23514" src/api/errorHandlers.ts` runs, then it returns exactly one line and that line sits inside the `errorMessages` literal.
- Given a caller that passes a `23514` `PostgrestError` whose `message` names a constraint, when it inspects the returned error's `message`, then that string contains neither the substring `check constraint` nor the substring `Database error:`.
- Given the full unit suite, when `npm run test:unit` runs, then it passes with no pre-existing test modified — the only test change is the added file.
- Given the repo after the change, when `npm run typecheck` and `npm run lint` run, then both exit 0.

## Design Notes

The message is deliberately generic. The map is keyed on SQLSTATE alone and is shared by every table in the app — events, moods, love notes, photos, interactions, partner requests, scripture ratings — so it cannot name a field without being wrong for the other callers. Field-level wording is the job of client-side validation (the `EventsSettings.tsx:511-529` pattern), and this entry is the last-resort net beneath it.

Existing style to match exactly:

```ts
    '23502': 'Required field is missing',
    '23514': 'Some values are not allowed - check length and format limits',
    '42501': 'Permission denied - check Row Level Security policies',
```

`SupabaseServiceError` is module-private, so tests assert on public fields:

```ts
const err = handleSupabaseError(pgErr, 'EventsService.createEvent');
expect(err.message).toBe('[EventsService.createEvent] Some values are not allowed - check length and format limits');
expect(err.code).toBe('23514');
expect(err.isNetworkError).toBe(false);
```

## Verification

**Commands:**
- `npx vitest run tests/unit/api/errorHandlers.test.ts` -- expected: all new tests pass.
- `npm run test:unit` -- expected: whole unit suite green, no previously passing test broken.
- `npm run typecheck` -- expected: exit 0 (see `project_worktree_ts2883_baseline` if worktree-only TS2883 noise appears; it is unrelated to this change).
- `npm run lint` -- expected: exit 0.
- `git diff --stat` -- expected: exactly two paths — `src/api/errorHandlers.ts` (1 insertion) and the new `tests/unit/api/errorHandlers.test.ts`.

## Spec Change Log

_No bad_spec loopback occurred._

## Review Triage Log

### 2026-08-19 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 1: (high 0, medium 1, low 0)
- defer: 5: (high 0, medium 2, low 3)
- dismissed:
  - Spec's placement rationale says the key was placed after `'23502'` "so numeric codes stay in ascending order", but the literal reads 23505, 23503, 23502, 23514 — descending, then a jump — so the stated rule is wrong (verified at `src/api/errorHandlers.ts:63-66`) — the claim is true, but its only fix edits the spec this build is implementing, which this step does not do; the key's placement has no behavioural consequence.
  - Spec Code Map calls the CHECK constraints on love_notes, photos, partner_requests and scripture "all still routed through `handleSupabaseError`", which is false — only `moodApi.ts`, `interactionService.ts` and `eventsService.ts` import it — the claim is true and confirmed, but its fix edits the spec this build is implementing; the half of it that lives in shipped code (the test file's header comment) was kept and patched, and the routing gap itself is recorded under `deferred`.
  - The message "check length and format limits" names a cause that is wrong for membership CHECKs such as `different_users`, `no_self_requests` and `moods_mood_type_check` — the exact string is pinned by the I/O & Edge-Case Matrix inside `<intent-contract>`, so any fix edits the spec this build is implementing; the verified consequence is imprecise advice, not the raw constraint text the intent set out to hide.
  - Spec Verification expects `git diff --stat` to show "exactly two paths" but the change set is three, because the spec artifact is itself tracked — true, and its only fix edits the spec this build is implementing.
  - The test's `WirePostgrestError`/`asPostgrestError` duplicate `FakePostgrestError` in `tests/unit/api/fakeInteractionsBackend.ts:59-63`; import it instead — the named replacement is not a drop-in: it is a plain interface, not a `PostgrestError`, so importing it still requires the identical `as unknown as PostgrestError` cast the finding objects to, removing nothing while coupling the error handler's own test to an unrelated feature's fake backend.
  - The `details: 'Failing row contains (…).'` fixture is invented where the directory's convention is measured against live PostgREST — the only assertion on that field is a pass-through identity check (`errorHandlers.test.ts:94`) that holds for any value, so the fixture's realism has no bearing on what the test proves.
  - The test double is a cast object literal, not a real `Error`, so future code branching on `instanceof Error` or reading `stack` would pass and fail in production — verified that `handleSupabaseError` (`errorHandlers.ts:55-81`) never reads `stack` or `toJSON` and never branches on `instanceof Error`, so no path to the claimed consequence exists in what this change ships.
  - Four of the module's five exports (`handleNetworkError`, `isPostgrestError`, `isOnline`, `logSupabaseError`) are untested in a file named for the module — the intent scopes the test work to "cover it [the 23514 entry] in the errorHandlers unit tests"; module-wide coverage is outside it on the intent's own authority, and `handleNetworkError` is already exercised by `tests/unit/api/offlineMessageHonesty.test.ts`.
  - `details`/`hint` pass-through is asserted only for 23514, so a regression dropping them for the other codes would go unnoticed — pass-through is one shared code path (`errorHandlers.ts:74-80`) with no per-code branching, so the 23514 assertions already pin the mechanism for every code.
  - `error.details` still carries `Failing row contains (…)` through unchanged and `logSupabaseError` console.errors it in full, so the leak is not fully closed — verified no component or store reads `.details` (`grep -rn "\.details" src/components src/stores` returns nothing), so the claimed user-visible leak does not occur; console output is developer-facing and pre-existing by design, and the spec's Boundaries require the pass-through to match the seven existing codes.
  - The ledger's premise is stale and no acceptance criterion covers user-observable behaviour — the spec states the defence-in-depth framing explicitly (Code Map, Design Notes); changing that framing edits the spec this build is implementing.
  - The test docstring hard-codes line numbers that will rot — the finding confirms they are accurate today, and line-anchored citation is this directory's established convention (`tests/unit/api/offlineMessageHonesty.test.ts:6-10` cites `src/api/errorHandlers.ts:95` the same way), so the claimed convention violation does not stand.
  - `expect(err.message).not.toContain('events')` is subsumed and would break if the helper were reused with an `EventsService.*` context prefix — verified that assertion sits only in the no-context test (`errorHandlers.test.ts:73-82`), which passes no context string, so the spurious-failure path it describes cannot occur there.
  - The worktree's `node_modules` is empty, so the spec's `npm run` verification commands cannot have been run there as written — refuted by running them: Node and TypeScript resolve up to the parent repository's `node_modules` (which is also what produces the known worktree-only TS2883 paths), and all four commands were executed in this worktree with the results recorded below.
  - No test proves the mapped message surfaces through a real caller, so only the pure function is pinned — the intent names "the errorHandlers unit tests" as the surface to cover, so the function's return value is the outermost surface the intent references.
- addressed_findings:
  - `[medium]` `[patch]` The new test file's header comment asserted two repo-wide properties that are false: that "every Supabase-only service routes its rejections through this one function" (only `moodApi.ts:14`, `interactionService.ts:23` and `eventsService.ts:39` import it), and that `tests/e2e/settings/events-crud.spec.ts` "asserts the `Database error: ` prefix" (it asserts only `toContainText('Injected create failure')` at `:437-439`). Both raised independently by two layers, one root cause: unverified claims about the rest of the repo in the header. Rewrote the header and the inline comment at the fallback tests to name the three actual importers, to state explicitly that `photoService.ts`, `notesSlice.ts`, `partnerService.ts` and `scriptureReadingService.ts` are NOT covered, and to record that this unit test is the only thing in the repo pinning the `Database error: ` prefix.

## Auto Run Result

Status: done

### Implemented change

Added the missing `23514` (Postgres `check_violation`) entry to the SQLSTATE→message map in `handleSupabaseError`, so a CHECK-constraint rejection surfaces a readable sentence instead of falling through to `Database error: ${error.message}` and rendering raw text such as `new row for relation "events" violates check constraint "events_label_check"`. Added the module's first unit-test file to pin the new entry, the seven codes that were already mapped, and the fallback. Resolves DW-8 and DW-16.

### Files changed

- `src/api/errorHandlers.ts` — one line: `'23514': 'Some values are not allowed - check length and format limits',` added to the `errorMessages` literal.
- `tests/unit/api/errorHandlers.test.ts` — new, 13 tests covering every row of the I/O & Edge-Case Matrix: the new code bare and context-prefixed, its no-leak guarantees, `code`/`details`/`hint`/`isNetworkError`/`name` pass-through, the seven pre-existing codes via `it.each`, and the `Database error:` fallback bare and context-prefixed.
- `_bmad-output/implementation-artifacts/spec-dw-8-16-check-constraint-error-mapping.md` — this spec.

The deferred-work ledger was not edited, as the invocation required (`git status --porcelain -- .../deferred-work.md` is empty).

### Review findings breakdown

Four review layers ran: blind-hunter, edge-case-hunter, verification-gap and intent-alignment. The verification-gap layer reported "No verification gaps found" after tracing every Supabase write path that renders an error to the user.

- **Patches applied: 1** (medium) — the test file's header comment asserted two false repo-wide properties; both corrected. Detail in the Review Triage Log above.
- **Items deferred: 5** — see frontmatter `deferred`. Two medium (unmapped sibling SQLSTATEs such as 22007/22P02/22001; four CHECK-carrying write paths that never reach `handleSupabaseError`), three low (the `Object.prototype` lookup hole, the empty-`message` fallback rendering a bare `Database error: `, and a pre-existing flake in `SoloReadingFlow.test.tsx`).
- **Dismissed: 15** — each with its reason in the Review Triage Log above.
- **Follow-up review recommended: false.** Patched entries this pass: high 0, medium 1, low 0. No high-severity patch; score = 3 × 1 + 1 × 0 = 3, which is below 5.

### Verification performed

- `npx vitest run tests/unit/api/errorHandlers.test.ts` — 13 passed, both before and after the patch.
- `npm run test:unit` — run five times. Four runs: 91 files / 1358 tests passed. One run failed a single unrelated test in `SoloReadingFlow.test.tsx`, which then passed 113/113 in isolation three times running; recorded as a deferred pre-existing flake, not a regression from this change.
- `npm run typecheck` — exits 2 with 6 `TS2883` errors, all in `tests/support/merged-fixtures.ts`, a file this change does not touch. Proved pre-existing by reverting `src/api/errorHandlers.ts` to the baseline commit and moving the new test file aside: the same 6 errors and the same exit code reproduce with the change absent. This is the known loop-worktree-only baseline (the error paths point seven levels up into the parent repository's `node_modules`).
- `npm run lint` — exit 0. Two pre-existing `react-refresh` warnings in `EventCountdown.tsx`, untouched by this change.
- `git diff --stat` against the baseline — three paths, as listed above. The spec's Verification section predicted two; it did not anticipate that the spec artifact is itself tracked.
- Matrix test audit — all five I/O & Edge-Case Matrix rows are covered by tests that ran and passed.

### Residual risks

- The fix protects only the three modules that route through `handleSupabaseError`. A CHECK violation on photos, love notes, partner requests or scripture ratings still takes each site's own error path; deferred above with evidence.
- The message wording names length and format, which is precise for the length CHECKs that motivated the bundle but imprecise for membership CHECKs such as `moods_mood_type_check`. It is readable and leaks nothing either way.
- The context prefix (`[EventsService.createEvent] `) reaches the user ahead of the mapped message. This is pre-existing behaviour shared by all seven previously mapped codes; the new entry inherits it rather than introducing it.

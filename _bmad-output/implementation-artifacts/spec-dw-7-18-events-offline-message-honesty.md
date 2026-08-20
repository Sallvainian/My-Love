---
title: 'DW-7 / DW-18: stop interactionService promising an offline sync that cannot happen'
type: 'bugfix'
created: '2026-08-19'
status: 'done'
baseline_revision: '3c25b05c1e5f6cfa8eae710bcc2d6fe1976ca3b8'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: ['oversized']
deferred:
  - summary: >-
      markAsViewed resolves successfully when its UPDATE matches zero rows, so a
      row the caller may not update is reported as marked.
    evidence: |-
      The UPDATE policy is `USING (auth.uid() = to_user_id)`
      (supabase/migrations/20251206024345_remote_schema.sql:316-321), so RLS
      filters a non-recipient's update into a zero-row success with no error.
      src/api/interactionService.ts:379-400 checks only `error`, never the row
      count, and interactionsSlice.markInteractionViewed then decrements
      unviewedCount regardless. This is the same silent-RLS class eventsService
      guards with 'Event not found or not yours to edit'
      (src/services/eventsService.ts:413). Not reachable through today's UI:
      handleAnimationComplete only passes rows from getUnviewedInteractions,
      which already filters toUserId === userId. Pre-existing; untouched by this
      change.
    location: >-
      src/api/interactionService.ts:379
    severity: low
  - summary: >-
      getInteractionHistory, getUnviewedInteractions and markAsViewed have no
      isOnline() guard, so an offline caller gets a mid-flight message.
    evidence: |-
      Only sendInteraction guards (src/api/interactionService.ts:156). The other
      three go straight into the try, so offline they surface
      '[InteractionService.<method>] Network error: Failed to fetch. Check your
      internet connection.' rather than naming the offline state. Truthful
      either way after this change, so this is specificity, not honesty. Adding
      guards is new behavior and was excluded by this spec's Never list.
    location: >-
      src/api/interactionService.ts:282
    severity: low
  - summary: >-
      The write-error class and networkFailure builder now exist in two copies,
      one per Supabase-only feature.
    evidence: |-
      src/services/eventsService.ts:108-127 and
      src/api/interactionService.ts:53-79 carry the same class shape and a
      byte-identical networkFailure body. Copying was what the intent asked for
      ('the same treatment eventsService applied'), but a third Supabase-only
      feature would make extraction worth doing. eventsService.ts:120-122
      already records that rewording the shared helper is cross-feature work.
    location: >-
      src/api/interactionService.ts:76
    severity: low
  - summary: >-
      The new interactionService test file covers the failure surface only; the
      success paths of the three read/update methods stay untested.
    evidence: |-
      tests/unit/api/interactionService.test.ts asserts happy paths for
      sendPoke/sendKiss only. getInteractionHistory, getUnviewedInteractions and
      markAsViewed appear solely in rejection tests, and the fake builder's
      or(), order() and range() are deliberate no-ops, so the history read's
      predicate, ordering and pagination are not exercised at all. Those methods
      are unchanged by this diff, so the gap is pre-existing rather than
      introduced.
    location: >-
      tests/unit/api/interactionService.test.ts:129
    severity: low
  - summary: >-
      subscribeInteractions has no error handling — a failed subscribe only logs
      its status and the returned unsubscribe still looks healthy.
    evidence: |-
      src/api/interactionService.ts:253-255 passes a logger into .subscribe()
      and never surfaces CHANNEL_ERROR or TIMED_OUT to the caller. It also calls
      supabase.channel() directly, which AGENTS.md already records as a
      repo-wide teardown pitfall; the missing error path is the half AGENTS.md
      does not cover. Unchanged by this diff.
    location: >-
      src/api/interactionService.ts:225
    severity: low
---

<intent-contract>

## Intent

**Problem:** `handleNetworkError` (`src/api/errorHandlers.ts:95`) appends "Your changes will be synced when you're back online." to every error it builds. That promise is true for its mood callers, which have a service-worker sync queue, but false for partner interactions, which are Supabase-only with no queue, no IndexedDB mirror and no retry. `src/api/interactionService.ts` still routes all five of its failure paths through that helper, so a poke or kiss that was never sent is reported as one that will sync later.

**Approach:** Apply to `interactionService` the same error convention `src/services/eventsService.ts` already applies for the identical reason: a module-local write error for writes that could not land, a module-local `networkFailure` builder for mid-flight failures, and no `handleNetworkError` import at all. `handleSupabaseError` routing for PostgREST errors is unchanged. `errorHandlers.ts` itself is not touched.

## Boundaries & Constraints

**Always:** Copy the idiom already in `src/services/eventsService.ts:99-127` (the `EventWriteError` class and the `networkFailure` function) rather than inventing a new one; keep the `// NOT handleNetworkError:` comments so the next reader knows the omission is deliberate. Keep every existing `isPostgrestError` → `handleSupabaseError` branch exactly as it is. Keep `logSupabaseError` on the branches that already have it. Every message a caller can read must describe what actually happened.

**Never:** Do not edit `src/api/errorHandlers.ts` — its message stays correct for `moodApi` (14 throw sites) and `moodSyncService` (2 throw sites), which do have a sync queue. Do not add new `isOnline()` guards to methods that lack one (`getInteractionHistory`, `getUnviewedInteractions`, `markAsViewed`) — that is new behavior, not honesty repair. Do not build an offline queue, mirror or retry for interactions. Do not export the new error class. Do not change `src/stores/slices/interactionsSlice.ts` or `src/components/PokeKissInterface/PokeKissInterface.tsx`. Do not touch `moodApi.ts` or `moodSyncService.ts`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Send succeeds | `navigator.onLine` true, insert returns a row | Resolves with the interaction record | No error expected |
| Send while offline | `navigator.onLine` false | Rejects before any `supabase.from()` call | Message names the offline state and the fact the interaction was not sent; contains no "will be synced" text |
| Insert returns no row | `navigator.onLine` true, insert resolves `{ data: null, error: null }` | Rejects | Message says the interaction was not sent; not dressed as a network error and contains no "will be synced" text |
| Send fails mid-flight | Insert rejects with a plain `Error` (e.g. `fetch failed`) | Rejects | `[InteractionService.sendInteraction] Network error: fetch failed. Check your internet connection.` |
| Send rejected by PostgREST | Insert returns a `PostgrestError` (e.g. `42501`) | Rejects | Unchanged: `handleSupabaseError` message, e.g. `[InteractionService.sendInteraction] Permission denied - check Row Level Security policies` |
| Read/update fails mid-flight | `getInteractionHistory`, `getUnviewedInteractions` or `markAsViewed` rejects with a plain `Error` | Rejects | `[InteractionService.<method>] Network error: <detail>. Check your internet connection.` |

</intent-contract>

## Code Map

- `src/api/interactionService.ts` -- the only file whose behavior changes. Six `handleNetworkError` references: the import at `:13`, the offline guard at `:112`, and four catch tails at `:151` (`sendInteraction`), `:268` (`getInteractionHistory`), `:315` (`getUnviewedInteractions`), `:348` (`markAsViewed`). `:139` throws `new Error('No data returned from Supabase insert')` **inside** the try, so it is currently re-dressed as a network error by `:151`. Stale JSDoc `@throws SupabaseServiceError on failure` at `:60`, `:81`, `:103`.
- `src/services/eventsService.ts` -- READ-ONLY reference implementation. `:108-113` `EventWriteError` class; `:115-127` `networkFailure` doc comment and function; `:305-309` offline guard shape; `:332-335` the `!data` write error with its "must not be dressed as one" comment; `:345-357` catch-tail shape with the `instanceof` re-throw ahead of `logSupabaseError`. `:19-26` module-header paragraph explaining the convention.
- `src/api/errorHandlers.ts` -- READ-ONLY. `:90-101` `handleNetworkError`; `:95` is the sentence at issue. `handleSupabaseError` (`:55`), `isOnline` (`:44`), `isPostgrestError` (`:109`), `logSupabaseError` (`:135`) all stay imported and used.
- `tests/unit/services/eventsService.test.ts` -- READ-ONLY test idiom to copy: in-file fake of `@/api/supabaseClient` over an in-memory backend (`:45-66` backend object with a `fromCalls` counter, `:86-171` chainable/thenable builder, `:173-181` `vi.mock`), `setOnline` helper at `:185-187`, offline assertions at `:348-351`, mid-flight network assertion at `:382`.
- `src/stores/slices/interactionsSlice.ts` -- READ-ONLY. `:93-96`, `:126-129`, `:146-149` log and re-throw untouched, so the service message is the caller-visible one.
- `src/components/PokeKissInterface/PokeKissInterface.tsx` -- READ-ONLY. `:183-186` and `:217-220` show a fixed toast and do **not** render `error.message`, so today the false sentence is visible only in logs and to any future caller that reads the message. Read-only evidence that no UI copy needs updating.
- `vitest.config.ts` -- READ-ONLY. `include` covers `tests/**/*.test.ts`; `@` resolves to `src`; `tests/setup.ts` installs no Supabase mock, so each test file fakes the client itself.

## Tasks & Acceptance

**Execution:**
- `src/api/interactionService.ts` -- add a module-header paragraph recording the error convention (interactions are Supabase-only, so `handleNetworkError`'s sync promise is false here), mirroring `eventsService.ts:19-26` -- so the omission reads as deliberate.
- `src/api/interactionService.ts` -- drop `handleNetworkError` from the `./errorHandlers` import at `:12-18`, keeping the other four imports -- the helper must no longer be reachable from this module.
- `src/api/interactionService.ts` -- add a module-local, non-exported `InteractionWriteError extends Error` and a module-local `networkFailure(context, error): Error` returning ``[${context}] Network error: ${detail}. Check your internet connection.``, both doc-commented, copied in shape from `eventsService.ts:99-127` -- one place per failure kind, no shared helper to reword.
- `src/api/interactionService.ts` -- replace the offline guard throw at `:112-115` with an `InteractionWriteError` naming the interaction `type` and the fact it was not sent, preceded by a `// NOT handleNetworkError:` comment -- the write is lost, not queued.
- `src/api/interactionService.ts` -- replace the `!data` throw at `:139` with an `InteractionWriteError`, and add `if (error instanceof InteractionWriteError) { throw error; }` as the first line of the `sendInteraction` catch tail at `:144`, ahead of `logSupabaseError` -- a write that reached the database and changed nothing must not be re-dressed as a network failure.
- `src/api/interactionService.ts` -- replace the four `handleNetworkError(error, ...)` catch-tail throws at `:151`, `:268`, `:315`, `:348` with `networkFailure(<same context string>, error)` -- a mid-flight drop is the other path that currently promises a sync.
- `src/api/interactionService.ts` -- correct the `@throws SupabaseServiceError on failure` JSDoc at `:60`, `:81`, `:103` to name the accurate offline / mid-flight / `SupabaseServiceError` cases, mirroring `eventsService.ts:296-302` -- the offline path no longer throws a `SupabaseServiceError`.
- `tests/unit/api/interactionService.test.ts` -- new file covering every row of the I/O matrix, using the `eventsService.test.ts` fake-client idiom -- there is no existing test for this service.

**Acceptance Criteria:**
- Given `grep -n handleNetworkError src/api/interactionService.ts`, when it is run after the change, then it prints only comment lines and no import or call site.
- Given the whole repo, when `grep -rn "will be synced when you're back online" src` is run, then `src/api/errorHandlers.ts:95` is the only match outside comments, and no `interactionService` throw can produce that text.
- Given a caller awaiting any `InteractionService` method that rejects, when the rejection message is read, then it describes an offline device, a mid-flight network failure, a write that changed nothing, or a PostgREST error — and never a future sync.
- Given `navigator.onLine` is false, when `sendPoke` or `sendKiss` is called, then it rejects without issuing any `supabase.from()` call.
- Given `moodApi.ts` and `moodSyncService.ts`, when the change is complete, then their `handleNetworkError` call sites and `errorHandlers.ts` are byte-identical to `HEAD`.

## Spec Change Log

## Review Triage Log

### 2026-08-19 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 1: (high 0, medium 0, low 1)
- defer: 5: (high 0, medium 0, low 5)
- dismissed:
  - Diff exceeds the ledger entries, which both name only `interactionService.ts:111` (the offline guard), while the diff also rewrites four catch tails — the intent's own goal sentence, "Stop promising an offline sync that cannot happen for Supabase-only features", admits exactly one reading here: the narrow one would leave the identical false sentence live at `:151`, four lines below the line it fixed, so the claim that the diff overreaches does not stand.
  - The module header now contains the literal string "changes will be synced when you're back online", so a naive repo grep for the false promise returns three hits instead of one — the two extra hits are doc comments in `interactionService.ts:10` and `eventsService.ts:118`; no code path can emit them and no consumer of the app is affected, so the claimed consequence does not occur.
- addressed_findings:
  - `[low]` `[patch]` The catch tail's `instanceof InteractionWriteError` re-throw skips `logSupabaseError`, but nothing asserted it — reordering the tail would restore both the double-log and the network dressing undetected. Added two contrasting assertions to `tests/unit/api/interactionService.test.ts`: the zero-row write path leaves `console.error` uncalled, the mid-flight path calls it.

## Design Notes

Scope call worth recording: the two ledger entries cite `interactionService.ts:111` (the `isOnline()` guard) specifically, but the stated goal is "Stop promising an offline sync that cannot happen for Supabase-only features", and the justification they give — partner interactions are Supabase-only with no queue, mirror or retry — is a property of the feature, not of that one line. All six references in the file emit the same sentence, so fixing only the guard would leave the false promise live four lines below it. `eventsService`'s own header says "every catch tail here builds its own truthful message instead", so the full sweep *is* "the same treatment eventsService applied".

The `InteractionWriteError` class earns its place on the `!data` path, not the offline path: the offline guard sits before the `try`, so nothing would catch a bare `Error` there, but `:139`'s "No data returned from Supabase insert" is thrown *inside* the try and today reaches `handleNetworkError`. `eventsService.ts:333` flags exactly this case — "Not a network problem, so it must not be dressed as one".

Shape to copy (`eventsService.ts:124-127`):

```ts
function networkFailure(context: string, error: unknown): Error {
  const detail = error instanceof Error ? error.message : 'Unknown network error';
  return new Error(`[${context}] Network error: ${detail}. Check your internet connection.`);
}
```

Two consequences that are accepted, not bugs. First, `logSupabaseError`'s `SupabaseServiceError` branch (`errorHandlers.ts:137`) no longer fires for interactions; they land on the `error instanceof Error` branch at `:150`, exactly as events already do. Second, the re-thrown `InteractionWriteError` skips `logSupabaseError` entirely — `interactionsSlice.ts` and `PokeKissInterface.tsx` each `console.error` it anyway, so nothing goes unlogged.

Left alone deliberately: `getInteractionHistory`, `getUnviewedInteractions` and `markAsViewed` have no `isOnline()` guard at all. Adding one is new behavior and out of scope; their catch tails still stop promising a sync.

## Verification

**Commands:**
- `npx vitest run tests/unit/api/interactionService.test.ts` -- expected: all new tests pass.
- `npm run typecheck` -- expected: no new errors beyond the worktree's known pre-existing `TS2883` baseline.
- `npm run lint` -- expected: clean for `src` and `tests`.
- `npx vitest run` -- expected: no regression in the existing suite, coverage thresholds still met.
- `grep -rn "handleNetworkError" src/api/interactionService.ts` -- expected: comment lines only.
- `git diff --stat HEAD -- src/api/errorHandlers.ts src/api/moodApi.ts src/api/moodSyncService.ts` -- expected: empty output.

## Auto Run Result

Status: done
Blocking condition: none

### What changed

`src/api/interactionService.ts` no longer imports or calls `handleNetworkError`. Its five failure paths now build their own messages, following the convention `src/services/eventsService.ts` already applies for the identical reason. `src/api/errorHandlers.ts` is untouched — its sync promise stays true for `moodApi` (14 throw sites) and `moodSyncService` (2), which do have a service-worker queue.

### Files changed

- `src/api/interactionService.ts` -- module header records why `handleNetworkError` is not used here; adds a non-exported `InteractionWriteError` and a local `networkFailure` builder; the offline guard and the zero-row insert now throw `InteractionWriteError`, re-thrown untouched ahead of `logSupabaseError`; the four catch tails route mid-flight failures through `networkFailure`; three stale `@throws SupabaseServiceError on failure` JSDoc lines corrected.
- `tests/unit/api/interactionService.test.ts` -- new, 15 tests. Covers every I/O matrix row plus the re-throw ordering, with messages pinned by `toBe` so a re-attached sync promise cannot pass. Fakes the Supabase client per file, as `tests/unit/services/eventsService.test.ts` does.

### Review findings

- Patches applied: 1 (low) -- nothing asserted that the `instanceof InteractionWriteError` re-throw sits above `logSupabaseError`; added contrasting `console.error` assertions.
- Deferred: 5 (all low) -- see frontmatter `deferred`. All five are pre-existing and untouched by this change: `markAsViewed`'s silent zero-row success, the three read/update methods having no `isOnline()` guard, the now-duplicated error convention, the untested success paths of those three methods, and `subscribeInteractions` having no error handling.
- Dismissed: 2 -- see `## Review Triage Log` for each dismissal and the reason it disposes of that finding's claim.
- Follow-up review recommended: `false`. Patched entries this pass: high 0, medium 0, low 1. Score = 3x0 + 1x1 = 1, below the threshold of 5.

### Verification performed

- `npx vitest run tests/unit/api/interactionService.test.ts` -- 15 passed.
- `npx vitest run` -- 89 files, 1316 tests passed.
- `npx vitest run --coverage` -- statements 50.32%, branches 45.61%, functions 47.84%, lines 50.86%; all above the 25% thresholds.
- `npm run typecheck` -- 6 errors, all `TS2883` in `tests/support/merged-fixtures.ts`, a file this change does not touch. This is the known loop-worktree baseline; zero errors in changed files.
- `npm run lint` -- 0 errors, 2 pre-existing `react-refresh` warnings in `src/components/RelationshipTimers/EventCountdown.tsx`, untouched.
- `grep -rn "handleNetworkError" src/api/interactionService.ts` -- comment lines only.
- `git diff --stat HEAD -- src/api/errorHandlers.ts src/api/moodApi.ts src/api/moodSyncService.ts` -- empty.
- `grep -rn "will be synced when you're back online" src` -- `errorHandlers.ts:95` is the only non-comment match.

### Residual risks

- The thrown type on the offline path changed from `SupabaseServiceError` (`isNetworkError: true`, `code: 'NETWORK_ERROR'`) to `InteractionWriteError`. No consumer branches on either field -- verified by grepping `src` and `tests` for `isNetworkError`, `NETWORK_ERROR` and `SupabaseServiceError` -- but a future caller that expects the old shape from this service will not find it.
- `logSupabaseError` no longer fires for the zero-row insert path. `interactionsSlice.ts` and `PokeKissInterface.tsx` each `console.error` the same error, so nothing goes unlogged, but the `[Supabase]` log prefix is gone for that one case.
- E2E was not run: it needs `supabase start`, and no E2E spec asserts any interactionService message (checked by grep).

### Process deviation

Steps 3 and 4 call for synchronous subagents. This harness spawns every agent in the background with a mailbox handoff, and the project's `CLAUDE.md` forbids handing bmad-loop worktree work to a background subagent and waiting on it -- a prior run lost two full sessions that way. The implementation subagent was spawned, immediately stopped before it made any edit (`git status` confirmed a clean tree), and the implementation and all four review lenses -- blind hunter, edge cases, verification gaps, intent alignment -- were carried out directly in this session instead.

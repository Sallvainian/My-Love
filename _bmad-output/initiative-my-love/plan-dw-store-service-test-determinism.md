---
title: 'Remove hidden order and implementation dependencies from four store/service unit tests'
type: 'chore'
ticket: ''
created: '2026-10-29'
status: 'done'
baseline_revision: 'ebf65ee9f54843eeeffd1c9be301d301a9f44f3b'
route: 'oneshot'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: ['multiple-goals']
deferred:
  - summary: 'The same JSON.stringify(state) leak check, blind to Error/Map/Set, is used outside the events file.'
    evidence: 'grep finds it at tests/unit/stores/loaderIdentityGuards.moods.test.ts:214,242, loaderIdentityGuards.partner.test.ts:225,251,322,395 and signOutClearsAccountState.test.ts:340,479,555,563; DW-306 names only the events file. They can adopt serializedStore() from loaderIdentityGuardsFixture.ts.'
    location: 'tests/unit/stores/loaderIdentityGuards.moods.test.ts:214'
    severity: 'low'
  - summary: >-
      Complete list of the leak checks outside the events file that still use plain JSON.stringify on store state (it supersedes the incomplete item above).
    evidence: |-
      These are blind to an Error, Map or Set, as DW-306 was. Found with `grep -rn "JSON.stringify(" tests/unit` on 2026-10-29.

      On useAppStore, so they can adopt serializedStore() from loaderIdentityGuardsFixture.ts:
        - loaderIdentityGuards.moods.test.ts:214,242
        - loaderIdentityGuards.partner.test.ts:225,251,322,395
        - loaderIdentityGuards.customMessages.test.ts:284,326,395
        - loaderIdentityGuards.notes.test.ts:232,271
        - loaderIdentityGuards.photos.test.ts:277,341,472
        - loaderIdentityGuards.messages.test.ts:251,559
        - signOutClearsAccountState.test.ts:340,479,555,563,646

      On a local store or a slice of state, so they need the replacer to take a value:
        - interactionsSubscription.test.ts:634,656
        - notesSlice.localCopy.test.ts:517
        - partnerSlice.localCopy.test.ts:213
        - notesSlice.sessionGuard.test.ts:216
        - settingsSlice.initializeApp.test.ts:307,392,447,470
        - notesSlice.localCopyWrites.test.ts:174
    location: >-
      tests/unit/stores/loaderIdentityGuards.customMessages.test.ts:284
    severity: low
---

<intent-contract>

## Intent

**Problem:** Four unit tests pass for reasons hidden from the reader (deferred-work bundle `store-service-test-determinism`: DW-306, DW-308, DW-309, DW-310). DW-306: the events leak checks use `JSON.stringify(state)`, which writes an Error, Map or Set as `{}`, so a leaked label inside one is invisible. DW-308: four retries in `notesSlice.idempotency.test.ts` take `notes[0].tempId` by index without proving the row is still the unconfirmed queued note. A confirmed row has no `tempId`. DW-309: `usePhotoImage.test.ts` puts the one hoisted `PHOTO` object into the store in the mock factory and in every `beforeEach`, so a mutation would leak across shuffled tests. DW-310: two negative checks in `photoImageCache.test.ts` settle a wrong resume by joining a second `requestPhotoImageFill` run, which relies on private coalescing. A resume deferred by two or more microtasks also escapes that check.

**Approach:**
- DW-306: add a shared `serializedStore()` to `loaderIdentityGuardsFixture.ts`. It uses a replacer that writes out Errors (name, message, cause, own fields), Maps (entries) and Sets (values). The six events leak checks use it.
- DW-308: add a `queuedKey(store, content)` helper. It runs after `sendText` has awaited the drain, finds the note by content, asserts `queued: true` and `sending: false` (the drain let go of it and did not confirm it), and returns its `tempId`. The four retries use it.
- DW-309: put `{ ...PHOTO }` into the store, in both the mock factory and `beforeEach`.
- DW-310: wait one macrotask turn before each negative check, then assert on public signals: no `download` calls and no cached notice from `onPhotoImageCached`. Every fake in the file resolves on microtasks, so a wrong resume finishes within that turn however many microtasks it was deferred by, and the wait does not depend on how runs coalesce.

</intent-contract>

## Implementation Notes

Oneshot: about 60 changed lines across five test files. Each change is a local, mechanical edit, and each is checked by running its own file plus fault injection.

DW-308 premise check: `sendText` already awaits `drainQueuedNotes()`, and that call joins the drain `sendNote` started (`src/stores/slices/notesSlice.ts:1894-1900`). So at all four reads the drain has already settled. The real weakness is the index read, which nothing ties to the note under test. `queuedKey` makes the settled, unconfirmed state an assertion rather than an assumption.

DW-310 proof (plan 1.13's breaks, `src/services/photoImageCache.ts` `resumeHeldFill`, applied temporarily):
- (1) Drop the `isCurrent()` guard and pass `{ ...session, isCurrent: () => true }`.
- (2) Drop `heldForMobileData()` and bypass `fillPass`'s hold.
- (3) Defer the resume by two or more microtasks. The old join did not catch this one.

Each break must fail its test. With the breaks reverted, the file must pass.

**Implementation (2026-10-29).** Files touched:
- `tests/unit/stores/loaderIdentityGuardsFixture.ts`: adds `serializedStore()`. The Error branch spreads the Error first and then sets `name`, `message` and `cause` explicitly; written the other way round it raised TS2783.
- `tests/unit/stores/loaderIdentityGuards.events.test.ts`: all six leak checks use it.
- `tests/unit/stores/notesSlice.idempotency.test.ts`: adds `queuedKey`.
- `tests/unit/hooks/usePhotoImage.test.ts`: the store gets `{ ...PHOTO }`.
- `tests/unit/services/photoImageCache.test.ts`: adds `expectNoFillStarted()`, used in both negative checks.

**Surprise (DW-308): one case was vacuous.** In 'preserves unrelated errors on retry recovery' the first send failed transiently. The `drainQueuedNotes()` that `sendText` joins set `drainRequested`, and the drain's second pass sent the note. So 'first' was already confirmed and had no `tempId`. The old `retryFailedMessage(undefined)` matched that confirmed row through `note.tempId === tempId` (`notesSlice.ts:1481`) and never retried a failed note. `queuedKey` caught this on its first run.

The fix makes the first failure a server refusal (`NOT_NULL_VIOLATION`, no banner). The note now stays failed until the retry, and a new assertion checks which row landed (`['second']` for send, `['first']` for retry). The `notesError` assertion is unchanged. The send variant means the same as before: a non-CHECK error survives a later successful send.

**Evidence:**
- Serializer probe, a temporary file that has been removed: an Error, a Map, a Set, and a Map holding an Error whose `cause` carried the label. Plain `JSON.stringify` missed all four; `serializedStore()` found all four.
- photoImageCache breaks, applied with a script and reverted with `git checkout`:

| Break | New check | Old join (HEAD copy) |
|---|---|---|
| (1) `isCurrent` | 'never resumes' fails | fails |
| (2) cellular | Wi-Fi case fails | fails |
| (3a) `isCurrent`, deferred 3 microtasks | 'never resumes' fails | both cases pass (missed) |
| (3b) cellular, deferred 3 microtasks | Wi-Fi case fails | Wi-Fi case passes (missed) |

- Commands: the four files pass (107 tests). `SEED=20261029 npm run test:unit:coverage` passes 198 files and 3117 tests, exit 0. `npm run lint` and `npm run typecheck` exit 0, with no TS2883 in this worktree.

## Plan Change Log

## Review Triage Log

### 2026-10-29 — Review pass
- verdicts: 1 finding — high 0, medium 0, low 1, false 0, maybe-false 0
- findings:
  - `[low]` `[defer]` The frontmatter `deferred` item that lists other files with the same blind `JSON.stringify(state)` leak check is incomplete. It misses `loaderIdentityGuards.customMessages`, `.notes`, `.photos` and `.messages`, `signOutClearsAccountState.test.ts:646`, and the checks on local stores. — Confirmed by `grep -rn "JSON.stringify(" tests/unit`. The weakness in those files predates this change, and DW-306 names only the events file. Recorded as a second `deferred` item listing every location found; the first item is kept because the list is append-only.

## Verification

**Commands:**
- `npx vitest run tests/unit/stores/loaderIdentityGuards.events.test.ts tests/unit/stores/notesSlice.idempotency.test.ts tests/unit/hooks/usePhotoImage.test.ts tests/unit/services/photoImageCache.test.ts` -- expected: all pass
- `SEED=20261029 npm run test:unit:coverage` -- expected: shuffled suite passes
- `npm run lint` and `npm run typecheck` -- expected: exit 0 (typecheck may show only the known worktree TS2883 baseline)

**Manual checks (if no CLI):**
- Fault injection: an Error, a Map and a Set holding `A-PRIVATE-EVENT-LABEL` in state are each found by `serializedStore()`, and none is found by plain `JSON.stringify`. Breaks (1)-(3) above each fail their photoImageCache test.

## Auto Run Result

Status: built

**Summary:** Removes the hidden order and implementation dependencies from four store and service unit tests: DW-306, DW-308, DW-309 and DW-310. No source file changed.

**Files changed:**
- `tests/unit/stores/loaderIdentityGuardsFixture.ts`: adds `serializedStore()`, a store serializer that writes out an Error, a Map and a Set.
- `tests/unit/stores/loaderIdentityGuards.events.test.ts`: all six leak checks use `serializedStore()` (DW-306).
- `tests/unit/stores/notesSlice.idempotency.test.ts`: four changes for DW-308.
  - Adds `queuedKey`, which finds a note by content after the drain and asserts it is still queued, not sending, and has a `tempId`.
  - The four retries read their key through it.
  - The case 'preserves unrelated errors on retry recovery' never retried a failed note. Its first failure is now a refusal, so the note stays failed until the retry.
  - A new assertion checks which row landed.
- `tests/unit/hooks/usePhotoImage.test.ts`: the store gets `{ ...PHOTO }` in the mock factory and in `beforeEach` (DW-309).
- `tests/unit/services/photoImageCache.test.ts`: both negative checks use `expectNoFillStarted()` instead of joining a second run (DW-310). It waits one macrotask turn, then asserts that nothing was downloaded and no cached notice fired.

**Review findings:** one Quick-lens finding.
- Patches applied: 0.
- Deferred: 1 (low). The fuller list of other tests with the same blind `JSON.stringify(state)` check, added as a second `deferred` item.
- Rejected: 0.

**Follow-up review recommended:** false. No entries were patched (high 0, medium 0, low 0).

**Verification:**
- Target files: 4 files, 107 tests passed.
- `SEED=20261029 npm run test:unit:coverage`: 198 files, 3117 tests passed, exit 0.
- `npm run lint` and `npm run typecheck`: exit 0.
- Fault injection: the serializer probe and the four photoImageCache breaks behaved as recorded in Implementation Notes. The new check catches the deferred-resume breaks that the old join missed.

**Residual risks:**
- `expectNoFillStarted()` covers a wrong resume deferred by any number of microtasks. It does not cover one deferred by a timer. No path in `photoImageCache.ts` defers a resume through a timer today.
- The same blind `JSON.stringify(state)` check remains in the files listed in the deferred items.

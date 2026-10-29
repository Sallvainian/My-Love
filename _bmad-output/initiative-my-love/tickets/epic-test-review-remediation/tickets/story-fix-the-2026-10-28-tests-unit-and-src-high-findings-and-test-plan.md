---
title: 'Fix the 2026-10-28 tests/unit and src High findings and tests that cannot fail'
type: 'chore'
ticket: '13'
created: '2026-10-29'
status: done
baseline_revision: 'a709d500fe647b59cc11a3a81f1b2d6622153244'
route: 'full'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: ['{project-root}/_bmad-output/initiative-my-love/tickets/epic-test-review-remediation/findings-2026-10-28-unit-src.md']
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** The 2026-10-28 TEA reviews of `tests/unit/` and `src/` left 12 High rows (unit: 8 H10 + 1 H3; src: 2 H10 + 1 H4) and seven advisory notes (A1–A7) on tests that pass while the behaviour they name is broken, all listed in `findings-2026-10-28-unit-src.md`.

**Approach:** Apply each item's suggested fix (or a stronger one) so every assertion pins a value, every negative assertion runs after the work it guards has settled, and no state leaks between shuffled tests. For each advisory note, temporarily break the named behaviour, confirm the fixed test fails, then restore.

## Boundaries & Constraints

**Always:** Locate each finding by content, not line number. A fix keeps or strengthens what the test proves. Three commits, in order: `test(unit): …` (tests/unit High rows), `test(src): …` (src High rows), `test(unit,src): …` (advisory notes A1–A7). If a corrected test exposes a real app bug, fix it in its own `fix(...)` commit and also run the e2e suite. Fixtures stay fictional (Casey/Jessie/Harper). Any new `eslint-disable` carries a same-line ` -- ` reason. Match the surrounding style by hand; never run `prettier --write`.

**Never:** Weaken, skip or delete a test to satisfy a rule. Change app code other than a real bug fix. Touch other findings, other advisory notes, Medium/Low rows, `tests/e2e-archive/`, or the ticket's status. Run a test review.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Advisory proof | Named behaviour temporarily broken | The fixed test fails; restored code passes | Record the break used per note in Implementation Notes |
| Shuffle | `npm run test:unit:coverage` (shuffled) | All green; OwnDisplayName first describe always starts unlinked | — |

</intent-contract>

## Code Map

tests/unit High (findings file §tests/unit 1–9):
- `tests/unit/api/broadcastSchemas.test.ts` 'strips a forged imagePreviewUrl' -- replace the three presence checks with `toEqual` of the five `note()` fields (NOTE_ID, PARTNER, ME, 'thinking of you', '2026-09-12T10:00:00.000Z').
- `tests/unit/components/AdminPanel.accountData.test.tsx` 'keeps the row on disk and in the store after a failed delete' -- `toMatchObject` on `diskRow(aId)` and on the store row, as the 'allows cancellation…' sibling does.
- `tests/unit/stores/moodSlice.sync.test.ts` 'sets isSyncing…' and 'still completes normally…' -- `lastSyncAt` `toEqual(NOW)` (NOW from `./moodSliceFixture`, pinned in beforeEach).
- `tests/unit/stores/notesSlice.idempotency.test.ts` -- (a) CHECK-failure test: `failCheckSend` builds its File inline; return it alongside the note (or build it in the test) and assert `failed.imageBlob` `toBe(file)` (the `compressImage` mock returns its input). (b) 'sends a note with the composed message tempId…': replace `sendText` with `await sendNote(...)`, read `notes[0].tempId` (set synchronously before the un-awaited drain), then `await drainQueuedNotes()` and assert `idempotency_key` `toBe(tempId)`. `confirmOptimisticNote` drops `tempId` on confirm, so it must be read before the drain.
- `tests/unit/stores/notesSlice.localCopy.test.ts` 'offline with no copy…' -- `notesError` `toBe('TypeError: Failed to fetch')` (`goOffline` in `notesSliceCopyFixture.ts`).
- `tests/unit/utils/messageRotation.test.ts` 'defaults to today…' -- fake only `Date` (`vi.useFakeTimers({ toFake: ['Date'] })`, `vi.setSystemTime`, `vi.useRealTimers()` in afterEach) and assert `toBe(getDailyMessage(messages, NOW))`; choose NOW whose message differs from another date's, and prove it in the test (e.g. an inequality against a second date).
- `tests/unit/stores/notesSlice.offlineQueue.test.ts` 'server rejection: Retry resends…' -- pin the state list (contents, in the order the slice actually keeps) before the `.every`.

src High (findings file §src 1–3):
- `src/components/love-notes/__tests__/MessageInput.test.tsx` 'should send on Enter' -- `toHaveBeenCalledWith('Hello', undefined)` plus `toHaveBeenCalledTimes(1)`.
- `src/hooks/__tests__/useRealtimeMessages.test.ts` 'releases the love-notes channel on unmount' -- take the channel from `vi.mocked(supabase.channel).mock.results[0].value` and assert `removeChannel` was called with it.
- `src/components/love-notes/__tests__/OwnDisplayName.test.tsx` -- reset `storeState.partner = null` in a file-level `beforeEach` (or `afterEach` in the second describe).

Advisory notes:
- A1 `tests/unit/stores/loaderIdentityGuards.events.test.ts` -- the three 'does not paint the previous account's failure…' tests (addEvent/editEvent/removeEvent). The write actions in `src/stores/slices/eventsSlice.ts` return their failure and never write `eventsError`. Seed C with a sentinel (e.g. `eventsError: 'C-OWN-LOAD-ERROR'`) and assert it is unchanged and the state holds no `A-REQUEST-FAILURE`. Proof break: a `set({ eventsError: null })` (or the failure) in the catch.
- A2 `moodSlice.sync.test.ts` 'does not reload moods or overwrite the pending count' -- `getAll` is never called by the slice. Build the store with a `userId` (loaders no-op without one) and a seeded `syncStatus.pendingMoods`, then assert `getAllForUser` and `getUnsyncedMoods` were not called and `pendingMoods` is unchanged. Proof break: drop the `if (!locked.ran)` early return in `syncPendingMoods`.
- A3 `tests/unit/services/dbSchema.v15MessageData.test.ts` 'from v8, drops the favorites…' -- add `expect(await db.count('messages')).toBe(BUNDLED.length)` as the v14 sibling ('copies nothing when nobody is signed in') does.
- A4 `tests/unit/services/photoImageCache.test.ts` 'resumes when the connection changes to Wi-Fi' (still-cellular step) and 'never resumes a session that is no longer current' -- replace `await Promise.resolve()` with settling any fill a resume started: `await requestPhotoImageFill(session(() => [], () => false))` joins a running fill and resolves after it, and a non-current session does not call `releaseHold()`. Proof breaks in `src/services/photoImageCache.ts` `resumeHeldFill`: resume regardless of the guard, passing `{ ...session, isCurrent: () => true }` (and, for the cellular case, a path that bypasses `fillPass`'s `heldForMobileData()` check).
- A5 `OwnDisplayName.test.tsx` ('keeps the default…', 'falls back to Partner…', 'does not borrow…') and `src/components/love-notes/__tests__/LoveNotes.realtimeStatus.test.tsx` ('shows the name alone for %s', 'falls back to "Partner"…') -- the fallbacks equal `LoveNotes.tsx`'s initial `useState` values. Before asserting a fallback, wait until the lookups have been called and their promises have resolved inside `act` (`getPartnerDisplayName` resolves after the own-name branch). Proof break: make `LoveNotes.tsx` set a non-default name when a lookup answers null.
- A6 `src/components/love-notes/__tests__/LoveNoteMessage.test.tsx` 'ignores a retried signed URL that arrives after unmount' -- before unmount, assert the retry request was made (`mockGetSignedImageUrl` called a second time). `src/components/PokeKissInterface/__tests__/PokeKissInterface.test.tsx` 'ignores a late status…' -- the post-unmount `queryByRole('alert')` cannot fail; replace it with an observable check, e.g. the `useState` dispatch observer `LoveNoteMessage.test.tsx` mocks `react` with (clear before reporting the late status, expect no dispatch). Proof breaks: delete the retry call; drop `if (cancelled) return;` in `PokeKissInterface.tsx`'s status handler.
- A7 `src/utils/__tests__/backgroundSync.test.ts` -- the three `.resolves.not.toThrow()` become `.resolves.toBeUndefined()`.

## Tasks & Acceptance

**Execution:**
- [x] Record `baseline_revision` (`git rev-parse HEAD`) in this plan before any code change.
- [x] tests/unit High: the seven tests/unit files above -- apply fixes 1–9 -- commit `test(unit): …`.
- [x] src High: `MessageInput.test.tsx`, `useRealtimeMessages.test.ts`, `OwnDisplayName.test.tsx` (partner reset) -- commit `test(src): …`.
- [x] Advisory A1–A7: the files above -- fix, break each named behaviour to watch the fixed test fail, restore (`git diff -- src/` must be empty for app files afterwards) -- commit `test(unit,src): …`.
- [x] Append to Implementation Notes: per advisory note, the break used and the failing assertion observed.

**Acceptance Criteria:**
- Given the fixed suite, when each of the 12 High rows and 7 notes is re-read against its test, then none still describes it.
- Given each advisory note's behaviour is temporarily broken, when its fixed test runs, then it fails; with the code restored it passes.
- Given the branch, when lint, typecheck, unit and shuffled coverage run, then all pass and the only `src/` changes are test files (or a separate `fix(...)` commit).

## Implementation Notes

Commits: `a7279406` test(unit), `96ff4937` test(src), `f26f8c97` test(unit,src). No app bug surfaced, so no `fix(...)` commit; `git diff a709d500 -- src` touches only `__tests__` files. Each break below was applied to the app file, run, and reverted with `git checkout --`; "old" means the test as it stood at `a709d500`.

- **A1** (`loaderIdentityGuards.events.test.ts`, add/edit/removeEvent). Break 1: `set({ eventsError: null })` after `writeFailureOf` in each catch of `eventsSlice.ts` -- all three fail `expected null to be 'C-OWN-LOAD-ERROR'`. Break 2: `set({ eventsError: (error as Error).message })` -- all three fail `expected 'A-REQUEST-FAILURE' to be 'C-OWN-LOAD-ERROR'`.
- **A2** (`moodSlice.sync.test.ts` 'does not reload moods or overwrite the pending count'). Break: replace the `if (!locked.ran) { … return … }` block in `syncPendingMoods` with `const result = locked.ran ? locked.result : { synced: 0, failed: 0 }` -- fails `expected "vi.fn()" to not be called at all, but actually been called 1 times` (`getAllForUser`). Dropping the block outright also fails the test, but by a `TypeError` on `result.synced`, not an assertion.
- **A3** (`dbSchema.v15MessageData.test.ts` 'from v8, drops the favorites…'). Break: move `cursor.delete()` in `dbSchema.ts` `moveRows` out of the `isCustom` branch, so every row goes -- fails `expected +0 to be 5`; the old `.every` passes on the emptied store.
- **A4** (`photoImageCache.test.ts`). Break 1, in `resumeHeldFill`: drop the `isCurrent()` guard and pass `{ ...session, isCurrent: () => true }` -- 'never resumes…' fails with `download` called 2 times. Break 2: drop `heldForMobileData()` from `resumeHeldFill` and skip `fillPass`'s hold check while a module flag set there is on -- 'resumes when the connection changes to Wi-Fi' fails at the still-cellular step with `download` called 3 times. The old `await Promise.resolve()` versions also failed both breaks, but saw only 1 download, so the old check was a race on mock timing.
- **A5** (`OwnDisplayName.test.tsx` 'keeps the default…', 'falls back to Partner…', 'does not borrow…'; `LoveNotes.realtimeStatus.test.tsx` 'shows the name alone for %s', 'falls back to "Partner"…'). Break: in `LoveNotes.tsx`, `else setUserName('BROKEN-OWN')` after the email fallback and `else setPartnerName('Broken')` after the partner lookup. All named tests fail, for example `expected 'BROKEN-OWN' to be 'You'` and `expected 'Broken' to be 'Partner'`. The old tests: 'keeps the default…', 'falls back to Partner…' and both realtimeStatus cases passed; 'does not borrow…' already failed.
- **A6**. `LoveNoteMessage.test.tsx`: break by replacing the `getSignedImageUrl(message.image_url, true)` retry call with `await Promise.resolve('')` -- fails `expected "vi.fn()" to be called 2 times, but got 1 times`; the old test passes. `PokeKissInterface.test.tsx`: break by dropping `if (cancelled) return;` from `handleStatusChange` -- fails `expected "vi.fn()" to not be called at all, but actually been called 1 times` (the `useState` dispatch observer); the old test passes.
- **A7** (`backgroundSync.test.ts`). Break: `registerBackgroundSync` returns `'unsupported'` from its early return and `'failed'` from its catch -- all three fail (`expected 'unsupported' to be undefined`, `expected 'failed' to be undefined`); the old `.resolves.not.toThrow()` passes.

Verification: `npm run lint` exit 0; `npm run typecheck` exit 0 (no TS2883 either); `npm run test:unit` 197 files / 3090 tests passed; `npm run test:unit:coverage` (shuffled) 197 files / 3090 tests passed; the 17 changed files shuffled under seeds 1–8 all passed (422 tests each).

## Plan Change Log

- tests/unit High 2 (`AdminPanel.accountData.test.tsx`): the findings file's store-side fix asserted `serverId` on the store row, but the store's `CustomMessage` has no `serverId` (`toCustomMessage` in `messagesSlice.ts` drops it). The store row is pinned on the fields it does carry (`id`, `text`, `category`, `isCustom`, `active`); `serverId` is pinned on the disk row.
- tests/unit High 9 (`notesSlice.offlineQueue.test.ts`): the list is pinned with the file's own `contents(store)` helper; the slice keeps `['one', 'two', 'three']`.
- A6 `LoveNoteMessage.test.tsx`: the file's `getSignedImageUrl` mock forwards only `path`, so the retry is pinned as the second call with the image path; the force-refresh `true` argument is not visible to it.
- A4 limit: the join settles a fill that a resume starts synchronously from the event. A resume deferred by two or more microtasks starts after the join and is not caught; the old `Promise.resolve()` check did not catch it either.

## Review Triage Log

### 2026-10-29 — Review pass
- verdicts: 0 findings — high 0, medium 0, low 0, false 0, maybe-false 0
- findings: none. The Quick lens re-checked the AdminPanel `serverId` and offlineQueue `contents(store)` changes against the source, plus every new assertion's ability to fail (fresh channel objects, `tempId` read before confirm, the synchronous retry call, the name-lookup order, and `releaseHold()` only for a current session). It also checked commit order, that `src/` changes are confined to `__tests__`, and that there are no new `eslint-disable` lines. It mentioned an untracked empty `.diff` at the worktree root, which was outside the reviewed change: an artifact of the orchestrating session's failed `mktemp`, since removed.

## Verification

**Commands:**
- `npm run lint` -- expected: exit 0
- `npm run typecheck` -- expected: exit 0, or only the worktree-only TS2883 errors in `tests/support/merged-fixtures.ts` (no local `node_modules`); any other error is a failure
- `npm run test:unit` -- expected: all pass
- `npm run test:unit:coverage` -- expected: all pass (shuffled)

## Auto Run Result

Status: built

**Summary:** Fixed all 12 High rows (tests/unit 8 H10 + 1 H3; src 2 H10 + 1 H4) and all seven advisory notes (A1–A7) in `findings-2026-10-28-unit-src.md`. Assertions now pin values, not just presence, type or format. Negative checks run after the work they guard has settled. `OwnDisplayName.test.tsx` can no longer leak a linked partner between shuffled tests. For each advisory note, the named behaviour was temporarily broken and the fixed test failed; the break used for each note is listed in Implementation Notes. No app code changed and no app bug was found, so there is no `fix(...)` commit and no e2e run.

**Commits:** `a7279406` test(unit), `96ff4937` test(src), `f26f8c97` test(unit,src), plus this plan.

**Files changed:**
- `tests/unit/api/broadcastSchemas.test.ts`: the forged-`imagePreviewUrl` test asserts the whole parsed note.
- `tests/unit/components/AdminPanel.accountData.test.tsx`: the kept row's content is pinned on disk and in the store.
- `tests/unit/stores/moodSlice.sync.test.ts`: `lastSyncAt` must equal `NOW`. A2 now targets the real reload and count paths, with a signed-in store and a seeded pending count.
- `tests/unit/stores/notesSlice.idempotency.test.ts`: the kept image must be the same File object that was sent, and the idempotency key must equal the note's `tempId`.
- `tests/unit/stores/notesSlice.localCopy.test.ts`: asserts the exact offline banner.
- `tests/unit/stores/notesSlice.offlineQueue.test.ts`: pins the note list before the `.every`.
- `tests/unit/utils/messageRotation.test.ts`: the date is pinned, and the default-date result must equal today's message.
- `tests/unit/stores/loaderIdentityGuards.events.test.ts`: A1 seeds a sentinel `eventsError` instead of `null`.
- `tests/unit/services/dbSchema.v15MessageData.test.ts`: A3 adds the bundled-row count.
- `tests/unit/services/photoImageCache.test.ts`: A4 waits for any started fill to finish before the negative checks.
- `src/components/love-notes/__tests__/MessageInput.test.tsx`: Enter must send `('Hello', undefined)`, exactly once.
- `src/hooks/__tests__/useRealtimeMessages.test.ts`: `removeChannel` must receive the channel the hook opened.
- `src/components/love-notes/__tests__/OwnDisplayName.test.tsx`: a file-level partner reset, plus A5 waits for the name lookups to settle.
- `src/components/love-notes/__tests__/LoveNotes.realtimeStatus.test.tsx`: A5 waits for the name lookups to settle.
- `src/components/love-notes/__tests__/LoveNoteMessage.test.tsx`: A6 checks the retry request was made before unmount.
- `src/components/PokeKissInterface/__tests__/PokeKissInterface.test.tsx`: A6 replaces the post-unmount DOM check with a `useState` dispatch observer.
- `src/utils/__tests__/backgroundSync.test.ts`: A7 replaces `.resolves.not.toThrow()` with `.resolves.toBeUndefined()`.

**Review findings:** Quick lens, 0 findings. Patches applied: 0. Deferred: 0. Rejected: 0.

**Follow-up review recommended:** false (patched: high 0, medium 0, low 0).

**Verification (rerun by the orchestrating session after the implementer returned):**
- `npm run lint`: exit 0.
- `npm run typecheck`: exit 0, with no TS2883 errors.
- `npm run test:unit`: 197 files / 3090 tests passed.
- `npm run test:unit:coverage` (shuffled): 197 files / 3090 tests passed.
- The implementer also ran the 17 changed files shuffled under seeds 1–8, and all passed.

**Residual risks:**
- A4: joining the run catches a wrong resume only if the resume starts synchronously from the event. One deferred by two or more microtasks would start after the join and go uncaught. The old check had the same limit.
- A6 (`LoveNoteMessage`): the file's mock forwards only the path, so the force-refresh `true` argument of the retry is not asserted.
- Done when 1 still needs the owner's fresh test reviews after merge.

---
title: 'Split oversize test files'
type: 'refactor'
created: '2026-09-26'
status: 'done'
baseline_revision: '116b0cc77bf0de9787d415971c49016b0dee496b'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/specs/spec-test-review-remediation/corrections.md'
warnings: ['oversized']
deferred:
  - summary: >-
      src/stores/slices/authSlice.ts:98 still names loaderIdentityGuards.test.ts, which this story split into loaderIdentityGuards.*.test.ts; the comment is app code, which this story may not touch.
    evidence: |-
      The comment reads "are covered by `loaderIdentityGuards.test.ts`". That file no longer exists; its tests are in the seven loaderIdentityGuards.*.test.ts files. SPEC.md limits app-code changes to test hooks and bug fixes, so the comment was left as is.
    location: >-
      src/stores/slices/authSlice.ts:98
    severity: low
  - summary: >-
      EventsSettings.errorIsolation, .focus, .lifetime and .pagination still keep their own copies of helpers that eventsSettingsKit.tsx now exports (makeEvent, renderSection, fillForm and others).
    evidence: |-
      The duplication predates this story: each sibling hand-copied the harness from EventsSettings.test.tsx. This story created the shared kit, but its spec forbade editing the siblings. The copies differ in places (the setStore behaviour, and makeEvent signatures in lifetime and pagination), so consolidating them is a separate change.
    location: >-
      src/components/Settings/__tests__/EventsSettings.{errorIsolation,focus,lifetime,pagination}.test.tsx
    severity: low
  - summary: >-
      Coverage counts non-test helper modules under src/**/__tests__/ as app source, and this story adds two (eventsSettingsKit.tsx, realtimeMessagesKit.ts).
    evidence: |-
      vitest.config.ts coverage.exclude lists only src/**/*.test.ts(x), so a helper in a __tests__ folder counts toward coverage as covered app code. src/components/PhotoGallery/__tests__/fakePhotoStore.ts already did this before this story. The fix is a config change: add 'src/**/__tests__/**' to coverage.exclude.
    location: >-
      vitest.config.ts coverage.exclude
    severity: low
---

<intent-contract>

## Intent

**Problem:** Rule H5 flags every test file over 1000 lines. The catalogs list ten, and at HEAD `116b0cc7` all ten are still over, with no others: `loaderIdentityGuards` 2398, `EventsSettings` 2264, `useRealtimeMessages` 1653, `notesSlice.offlineQueue` 1601, `eventsService` 1300, `dbSchema` 1264, `moodSyncSubscription` 1209, `moodSlice` 1114, `accountDataSlices` 1069 and `notesSlice.localCopy` 1061. `corrections.md` has no H5 item. The folder-run and suite-run rows for the same file are one finding.

**Approach:** Split each file into sibling test files along its existing `describe` groups. Shared non-mock code (constants, builders, fakes, render and store helpers) moves into one non-test helper module per family. Each file is one commit, which also re-points any comment elsewhere that cites a moved line.

## Boundaries & Constraints

**Always:**
- **Every test survives unchanged:** the same full name (describe path plus title), body, assertions and `it.each` rows. Where a group leaves its wrapper `describe`, the new file repeats that wrapper title and its hooks verbatim, so full names stay identical. The new files together hold exactly the tests of the original.
- **Every file ends under 1000 lines, and should stay at or below 800,** new helper modules included.
- **Mocks stay per file.** `vi.mock` and `vi.hoisted` cannot move into a helper, so each file keeps every `vi.mock` the original had, not just the ones its group seems to need; the slices import all the mocked modules at load. Each file also keeps the original's hooks, in their original order. A factory may reference a helper export only inside a closure. If a run fails with `Cannot access '__vi_import_N__' before initialization`, move that fake into a module that does not import the module under test.
- **Helper modules** are named in the repo's style (`fakeMoodsBackend.ts`, `fakePhotoStore.ts`). They export only names some file imports, because Knip checks them. A helper under `src/**/__tests__/` is linted as app code: unused imports fail, and `vi`/`expect` must be imported explicitly. It must also use relative imports only.
- **Header comments are divided, never dropped.** Each new file gets the part of the original header that is about its tests.
- Match the surrounding style by hand; never run `prettier --write`. A new `eslint-disable` carries a same-line ` -- ` reason.

**Never:**
- Do not rename, rewrite, merge, weaken or delete a test, and do not fix other rules' defects in moved code. Moving code is the whole change; moved code is not re-reviewed for other rules.
- Do not touch app code. `src/stores/slices/authSlice.ts:98` names `loaderIdentityGuards.test.ts`, and it goes to `deferred` rather than being edited.
- Do not edit sibling files that already exist, apart from the comment pointers in the Code Map.
- Leave `tests/e2e-archive/`, pgTAP, config, ESLint and Knip settings alone. Do not symlink `node_modules`.

</intent-contract>

## Code Map

Line numbers are for HEAD `116b0cc7`. Sizes are the planning investigation's estimates.

**`tests/unit/stores/loaderIdentityGuards.test.ts`**: 102 tests, no `vi.hoisted`.
- **Kept in every file:** the fakes (34–55, 156–157), all 11 `vi.mock`s (57–173), and `describe('loader identity guards')` with its `beforeEach` (335–367). The `beforeEach` order is load-bearing: `clearAllMocks`, then the store reset, then re-arming the mocks.
- **Helper `loaderIdentityGuardsFixture.ts`** exports:
  - `A`, `C`, `deferred`, `storageQuota`, `switchToUserC`
  - `resetStoreSignedInAsA()`, which runs lines 343–351 and 364
  - `aCustomMessage`, `aCopy`, `cRotationPool`
  - header lines 10–25 as a doc comment
- **New files**, each with its "when the identity has not changed" cases nested under the same title:
  - `.notes.test.ts`: `fetchNotes`, `fetchOlderNotes`, `removeNote`, and unchanged 2176. 7 tests.
  - `.moods.test.ts`: `loadMoods`, `fetchPartnerMoods`, `updateSyncStatus` (1802). 3 tests. Moves the misplaced moodSlice banner (479) here.
  - `.messages.test.ts`: `loadMessages`, `toggleFavorite`, the nested `setAuthUser refills` (877–891 hooks), and unchanged 2187. 15 tests.
  - `.customMessages.test.ts`: 1011–1269 and unchanged 2199–2285, including both `restoreAllMocks` calls. 19 tests.
  - `.photos.test.ts`: 1275–1557 and unchanged 2296–2396, plus the type imports at 177–185. 22 tests.
  - `.partner.test.ts`: `loadInteractionHistory`, `loadPartner`, `loadPendingRequests`, `searchUsers`, and unchanged 2163. 14 tests.
  - `.events.test.ts`: 1821–2156 and unchanged 2287. 22 tests.
- The original file is deleted.
- **Pointer:** update `tests/unit/stores/signOutClearsAccountState.test.ts:236` to `loaderIdentityGuards.*.test.ts`.

**`src/components/Settings/__tests__/EventsSettings.test.tsx`**: 113 tests.
- **Kept in every file:** the motion mock (44–51), the hoisted `store` (57–84), the `useAppStore` mock (86–90), `beforeEach` 301 and the drain `afterEach` 309.
- **Helper `eventsSettingsKit.tsx`** exports:
  - types, `OWN_USER_ID`, `PARTNER_USER_ID`
  - `dateFromISO`, `makeEvent`, `ok`, `loadOk`, `writeFailure`, `UNREADABLE`, `STALE`
  - `renderSection`, `openAddForm`, `fillForm`, `submitForm`, `renderedLabels`, `regionLabels`, `emptyStateText`, `regionDescriptions`
  - `deferredLoad`, `expectUnsettledSession`, `oldOutcomes`
  - `createEventsStoreKit(store)`, which returns `{ setStore, currentEvents, reauthenticate }`. It builds the real `authSlice` once per call. The hoisted `store` stays in each test file and is passed in, because the kit must not own the store: that would create an import cycle.
  - The `created` counter stays per `setStore` call.
- **Files:**
  - Keep `EventsSettings.test.tsx`: list and list states (313–745). 18 tests.
  - `.validation.test.tsx`: 747–1038. 26 tests.
  - `.addEdit.test.tsx`: 1040–1424. 18 tests.
  - `.reconciliation.test.tsx`: 1426–1719, keeping its own `beforeEach`. 22 tests.
  - `.delete.test.tsx`: 1721–2063. 17 tests.
  - `.session.test.tsx`: 2065–2264. 12 tests.
- **Pointers:**
  - `EventsSettings.errorIsolation.test.tsx:43-44` says the harness is "duplicated from `EventsSettings.test.tsx:20-180`". Re-point it to the kit and the kept file's mocks.
  - `tests/e2e/settings/events-check-constraint.spec.ts:42` cites `EventsSettings.test.tsx:404`; re-point it to that test's new location.
  - `tests/unit/components/eventsValidationMirrors.test.ts:5` should name `EventsSettings.validation.test.tsx`.

**`src/hooks/__tests__/useRealtimeMessages.test.ts`**: 42 tests.
- **Kept in every file:** `mocks` (16–37), the supabase mock (40–77), `mockStoreState` and its mock (80–89), and `describe('useRealtimeMessages')` with its `beforeEach` (119–132, `resetAllMocks` included).
- **Helper `realtimeMessagesKit.ts`** exports `USER_ID`, `PARTNER_ID`, `OUTSIDER_ID`, `SubscribeCallback`, `emitStatus`, `validNote` and `parkedChannel` (174, now at module scope).
- **Files:**
  - Keep the `.test.ts` name: lifecycle (134–493). 11 tests.
  - `.retry.test.ts`: Error Handling 504–862. 8 tests.
  - `.retriedJoin.test.ts`: Error Handling 864–1312, including the nested token-install describe. 13 tests.
  - `.messages.test.ts`: 1315–1422. 5 tests.
  - `.closes.test.ts`: 1424–1651. 5 tests.
  - Both Error Handling files repeat the `describe` title and its fake-timer hooks.
- **Pointer:** `src/components/love-notes/__tests__/LoveNotes.realtimeStatus.test.tsx:5`: re-point it if what it cites moved.

**`tests/unit/stores/notesSlice.offlineQueue.test.ts`**: 68 tests.
- **Helper `notesSliceQueueFixture.ts`** exports:
  - `A`, `PARTNER`, `B`, types, `server`, `fakeFrom(table)`
  - `sendEphemeralBroadcast`, `uploadCompressedBlob`
  - `createTestStore`, `signOutLiveStores()`, `setOnline`, `stubOnline()`
  - `copyIds`, `deferred`, `contents`, `queued`, `serverRow`, `SAVED_COPY_ROW`, `queuedIds`, `clearStores`, `sendThreeOffline`, `expectQueueDeliveredOnceInOrder`
- **Kept in every file:** the 5 mocks, the hoisted `copyWrites`, and both hooks (385–406). The `afterEach` signs the stores out *before* `useRealTimers`.
- **Files:**
  - Keep `notesSlice.offlineQueue.test.ts`: 408–539 and 748–1175. 38 tests.
  - `notesSlice.queueMultiTab.test.ts`: 541–746, with `stubWebLocks`. 6 tests.
  - `notesSlice.queueRateLimit.test.ts`: 1177–1328, with `failedNote`. 9 tests.
  - `notesSlice.queueRetry.test.ts`: 1330–1466. 7 tests.
  - `notesSlice.queueStaleSession.test.ts`: 1468–1600. 8 tests.
- **Pointer:** `tests/e2e/offline/needs-a-connection.spec.ts:24-25`. Check it and re-point it if needed.

**`tests/unit/stores/notesSlice.localCopy.test.ts`**: 49 tests.
- **Helper `notesSliceCopyFixture.ts`** exports:
  - `USER_A`, `PARTNER`, `USER_B`, `Row`, `server`, `fakeFrom`
  - the `vi.fn`s `getPartnerId`, `lookupPartnerId`, `readLocalCopy`, `writeLocalCopy`, `registerLocalCopy`, and `savedCopies`
  - `createTestStore`, `row`, `key`, `savedIds`, `stateIds`, `deferred`, `readsHeld`, `goOffline`
- **Files:**
  - Keep `notesSlice.localCopy.test.ts`: fetchNotes and account switch (260–678). 28 tests.
  - `notesSlice.localCopyWrites.test.ts`: confirmed changes (680–1060). 21 tests.
- `beforeEach` 234–258 is kept in both.

**`tests/unit/stores/moodSlice.test.ts`**: 65 tests.
- **Helper `moodSliceFixture.ts`** exports `createTestStore`, `NOW`, `TODAY`, `makeMoodEntry`, `SyncBatch` (type-only) and `syncResult`. `savedCopies` stays per file.
- **Kept in every file:** all 5 mocks and both hooks (109–130).
- **Files:**
  - Keep `moodSlice.test.ts`: 132–308, 589–659 and 1100–1113. 23 tests.
  - `.sync.test.ts`: 310–587. 15 tests.
  - `.historyBackfill.test.ts`: 661–867. 11 tests.
  - `.partnerMoodsCopy.test.ts`: 869–1098. 16 tests.
- **Pointers:** `src/components/MoodTracker/__tests__/moodArrayGuards.test.tsx:473` and `:502`, which cites `moodSlice.test.ts:84-86`. Point both to the fixture.

**`tests/unit/services/eventsService.test.ts`**: 86 tests.
- **Helper `fakeEventsBackend.ts`:** lines 24–266 moved verbatim. It exports `backend`, `eventsQuery`, `row`, `permissionDenied`, `setOnline`, `USER_ID` and `PARTNER_ID`.
- **Kept in every file:** the mock (268–276), which calls these lazily, and the wrapper hooks (303–315).
- **Files:**
  - Keep `eventsService.test.ts`: reads (321–939) and header reason 1. 42 tests.
  - `eventsService.writes.test.ts`: 945–1299, `eventInput`, `eventWriteFailure` and header reason 2. 44 tests.
- **Pointer:** `tests/unit/api/checkConstraintMapping.test.ts:39` cites `eventsService.test.ts:173`, which is fake code. Point it to `fakeEventsBackend.ts`.

**`tests/unit/services/dbSchema.test.ts`**: 31 tests, no mocks.
- **Helper `dbSchemaFixtures.ts`** exports `deleteDatabase`, `legacyMessage`, `legacyMood`, `swAuthRow` and `withinTimeout`, dropping the duplicate copy at 1150.
- **Kept in every file:** the `describe('dbSchema')` wrapper with `openDbs`, `openTestDb` and both hooks (66–93).
- **Files:**
  - Keep `dbSchema.test.ts`: fresh install and 1214–1263. 6 tests.
  - `.upgradesToV9.test.ts`: 122–484. 6 tests.
  - `.upgradesToV14.test.ts`: 486–771. 8 tests.
  - `.v15MessageData.test.ts`: 773–996. 6 tests.
  - `.blockedUpgrade.test.ts`: 998–1212. 7 tests.

**`tests/unit/api/moodSyncSubscription.test.ts`**: 32 tests.
- **Helper `fakeMoodRealtime.ts`:** lines 27–116 and 240–329, plus the factory's channel and removeChannel bodies. Renamed as `fakeRemoveChannel`.
  - Every `let` becomes an exported `const`, cleared in place by `resetRealtimeFake()`.
  - `recordLookup` uses `splice`.
  - `teardownRealtimeFake()` holds the body of the 355–365 `afterEach`.
  - Test bodies stay verbatim.
- **Kept in every file:** a lazy factory and the wrapper with its hooks.
- **Files:**
  - Keep `moodSyncSubscription.test.ts`: 367–710 and 986–996. 15 tests.
  - `.identity.test.ts`: 712–984. 9 tests.
  - `.reopen.test.ts`: 998–1208, nested under the same outer describe. 8 tests.

**`tests/unit/stores/accountDataSlices.test.ts`**: 54 tests.
- **Helper `accountDataFixtures.ts`** exports `deferred`, `offline`, `setOnline`, `setAnniversaries` and `StoreState`.
- **Kept in both files:** every mock and hoist (14–73), `counter`/`A`, and the `beforeEach` (134–144). `refreshLocalCopies()` runs every refresher.
- **Files:**
  - Keep `accountDataSlices.test.ts`: messages (463–1069). 31 tests.
  - `accountDataSlices.anniversaries.test.ts`: 150–461. 23 tests.
- **Pointer:** `tests/unit/stores/coupleSettings.test.ts:305`. Check it, and re-point it if what it cites moved.

## Tasks & Acceptance

**Execution:**
- **Before any edit,** record the baseline in the scratchpad: `npx vitest list <the 10 files>` (full names) and each file's passing count.
- Do each family as its own commit, typed `test(<area>): split <file> under 1000 lines (H5)`. In each commit:
  1. Create the helper.
  2. Create the new files and trim or delete the original.
  3. Apply the pointer updates.
  4. Run the family's files, including under `--sequence.shuffle`, and confirm the full-name set matches the baseline.
- Order the commits largest first: loaderIdentityGuards, EventsSettings, useRealtimeMessages, notesSlice.offlineQueue, eventsService, dbSchema, moodSyncSubscription, moodSlice, accountDataSlices, notesSlice.localCopy.
- **Finally:**
  - Add the `authSlice.ts:98` pointer to `deferred`.
  - Run the Verification commands.

**Acceptance Criteria:**
- Given the repo after this story, when every `*.test.ts(x)`/`*.spec.ts` under `src/`, `tests/` (excluding `tests/e2e-archive/`) and `supabase/functions/` is counted with `wc -l`, then none exceeds 1000 lines. Neither does any new helper module.
- Given the baseline list, when `npx vitest list` runs over the new files, then the sorted multiset of full test names equals the baseline's. The full unit run passes, and its test total equals the pre-story total.
- Given each new file run alone and under `--sequence.shuffle`, then it passes.
- Given each comment pointer in the Code Map, then it names a file (and line) that exists and holds what the comment describes.

## Spec Change Log

## Review Triage Log

### 2026-09-26 — Review pass
- verdicts: 20 findings — high 0, medium 0, low 17, false 3, maybe-false 0
- findings:
  - `[false]` `[reject]` Blind: `tests/unit/api/interactionService.test.ts:16` still cites eventsService.test.ts for the fake-client idiom — eventsService.test.ts still fakes the Supabase client per file over a backend (its `vi.mock` delegates to `fakeEventsBackend.ts`), which is the idiom the comment names.
  - `[low]` `[patch]` Blind: `tests/api/events-read-window.spec.ts:7-11` calls the fake's `.range()` "the test file's own" slice — reworded to name the fake's own slice in `fakeEventsBackend.ts` (245531bc).
  - `[low]` `[patch]` Blind: open ledger entries DW-252, DW-255, DW-256, DW-259 and DW-276 cite lines that moved — their `location:` lines in the gitignored `deferred-work.md` now name the new files.
  - `[low]` `[patch]` Blind: `USER_ID` (fakeMoodRealtime.ts) and `Row` (notesSliceCopyFixture.ts) are exported but imported by no file — `export` dropped (245531bc).
  - `[low]` `[patch]` Blind: the two lookup-mapping factory bodies were copied into three moodSyncSubscription files — moved to `fakeResolvePartnerLookup`/`fakeResolveSignedInUser` in fakeMoodRealtime.ts and called lazily; `recordLookup` is now module-private (245531bc).
  - `[low]` `[patch]` Blind: the `resetRealtimeFake` doc claimed every collection is cleared — it now lists what is cleared and says `moodIds` and `getSession` persist (245531bc).
  - `[false]` `[reject]` Blind: the "LOADING FLAG IS HALF THE GUARD" paragraph was copied into the notes and events headers — both files assert on `notesIsLoading`/`eventsIsLoading`, which is exactly the rule that paragraph states; the partner component is its example.
  - `[low]` `[patch]` Blind: the `NOW` comment in moodSliceFixture.ts said "top-level beforeEach", and the moodSlice/useRealtimeMessages families lack split headers — comment fixed (245531bc); neither original had a header to divide, so no header was added.
  - `[low]` `[patch]` Blind: the dead `@see tech-spec-03-test-factories.md` reference was copied into four new dbSchema files — removed from the four copies (245531bc).
  - `[low]` `[patch]` Blind: the re-pointed comments cite line numbers that go stale — they now name the symbol or test title (245531bc).
  - `[low]` `[defer]` Blind: the other EventsSettings siblings still copy helpers the kit exports — pre-existing duplication; the spec forbade editing the siblings; deferred.
  - `[low]` `[patch]` Blind: the new EventsSettings headers and the errorIsolation comment record change history — history clauses dropped, kit pointers kept (245531bc).
  - `[low]` `[patch]` Blind: an untracked vitest-list JSON file `src/components/Settings/__tests__/EventsSettings` appeared during review — written by a review run, not the change; moved out of the tree to the session scratchpad.
  - `[low]` `[defer]` Edge: coverage counts helpers under src/**/__tests__/ as app source — the gap is in the existing config and `fakePhotoStore.ts` already hit it; fixing it is a vitest.config.ts change; deferred.
  - `[low]` `[patch]` Edge: events-read-window.spec.ts pointer — same defect as the Blind row above; fixed there.
  - `[low]` `[patch]` Edge: needs-a-connection.spec.ts:24-25 omits notesSlice.localCopyWrites.test.ts, which now holds the offline no-partner send and offline older-page cases — added (245531bc).
  - `[low]` `[patch]` Edge: unused exports `USER_ID`/`Row` — same defect as the Blind row above; fixed there.
  - `[false]` `[reject]` Intent: success is judged by a fresh TEA re-review that was not run, and mocks are duplicated per file — the four folder re-reviews are the epic's done gate after all nine stories (SPEC.md Success signal), no registry rule scores duplicate mocks, and vitest scopes `vi.mock` to the file.
  - `[low]` `[patch]` Intent: ledger entries cite moved lines — same defect as the Blind ledger row; fixed there.
  - `[low]` `[patch]` Intent: the needs-a-connection pointer is loose — same defect as the Edge row; fixed there.

## Design Notes

A test's full name is its `describe` path plus its title. Keeping the wrapper titles is what lets the name-set check prove that nothing was lost or renamed. Mocks are duplicated per file, because that is the existing precedent (`EventsSettings.focus/.lifetime/.pagination/.errorIsolation`) and because vitest scopes hoisting to the file. Plain helpers are shared, which follows the `tests/unit/api/fakeMoodsBackend.ts` precedent and the src advisory that recommends a shared EventsSettings support module.

## Verification

**Commands:**
- `npm run lint`: exits 0.
- `npm run typecheck`: exits 0, or reports only the known worktree `TS2883` errors in `tests/support/merged-fixtures.ts`.
- `npx vitest run`: all pass; total equals the pre-story total.
- `git ls-files -- src tests supabase/functions | grep -v e2e-archive | grep -E '\.(ts|tsx)$' | xargs wc -l | sort -rn | head`: the top non-total entry is at most 1000.
- The only e2e and api changes are comments, so Playwright is not required. Typecheck covers those files.

## Auto Run Result

Status: done

**Summary:** All ten test files that rule H5 flagged, and every other test file, are now under 1000 lines. Each one was split along its existing `describe` groups into sibling test files, and plain shared code moved into one helper module per family. All 2907 unit tests keep their exact full names and all pass. The largest test file in the repo is now `tests/unit/stores/eventsSlice.test.ts` at 974 lines, which this story did not touch. The largest new file is 708 lines.

**Files changed:**
- `tests/unit/stores/loaderIdentityGuards.*.test.ts` (7 files) and `loaderIdentityGuardsFixture.ts`: split per slice; the original file was deleted.
- `src/components/Settings/__tests__/EventsSettings{,.validation,.addEdit,.reconciliation,.delete,.session}.test.tsx` and `eventsSettingsKit.tsx`.
- `src/hooks/__tests__/useRealtimeMessages{,.retry,.retriedJoin,.messages,.closes}.test.ts` and `realtimeMessagesKit.ts`.
- `tests/unit/stores/notesSlice.{offlineQueue,queueMultiTab,queueRateLimit,queueRetry,queueStaleSession}.test.ts` and `notesSliceQueueFixture.ts`.
- `tests/unit/stores/notesSlice.{localCopy,localCopyWrites}.test.ts` and `notesSliceCopyFixture.ts`.
- `tests/unit/stores/moodSlice{,.sync,.historyBackfill,.partnerMoodsCopy}.test.ts` and `moodSliceFixture.ts`.
- `tests/unit/services/eventsService{,.writes}.test.ts` and `fakeEventsBackend.ts`.
- `tests/unit/services/dbSchema{,.upgradesToV9,.upgradesToV14,.v15MessageData,.blockedUpgrade}.test.ts` and `dbSchemaFixtures.ts`.
- `tests/unit/api/moodSyncSubscription{,.identity,.reopen}.test.ts` and `fakeMoodRealtime.ts`.
- `tests/unit/stores/accountDataSlices{,.anniversaries}.test.ts` and `accountDataFixtures.ts`.
- Comment pointers only: `signOutClearsAccountState.test.ts`, `EventsSettings.errorIsolation.test.tsx`, `LoveNotes.realtimeStatus.test.tsx`, `moodArrayGuards.test.tsx`, `checkConstraintMapping.test.ts`, `eventsValidationMirrors.test.ts`, `coupleSettings.test.ts`, `tests/e2e/settings/events-check-constraint.spec.ts`, `tests/e2e/offline/needs-a-connection.spec.ts` and `tests/api/events-read-window.spec.ts`.
- `_bmad-output/implementation-artifacts/deferred-work.md` (gitignored): the `location:` lines of DW-252, DW-255, DW-256, DW-259 and DW-276.

**Commits:**
- One per file: ab268166, 6e36939b, 4e837aac, f42498fa, 04a1c246, 2e9a6a16, ade40e22, 50fb187a, f9ac9245 and f5528551.
- Review patches: 245531bc.

**Review findings:** 20 in total: high 0, medium 0, low 17, false 3.
- **Patched (low):** 15 rows, which are 10 distinct defects plus 5 duplicate reports of them:
  - stale pointers in `events-read-window` and `needs-a-connection`
  - the ledger locations
  - two unused exports
  - the duplicated lookup-mapping mock bodies
  - the `resetRealtimeFake` doc
  - the `NOW` comment
  - the dead `@see` copies
  - line-number pointers
  - history clauses in headers
  - a stray untracked file left by a review run, which was moved out of the tree
- **Deferred (low):** 2, the EventsSettings sibling duplication and the coverage exclusion of `src/**/__tests__` helpers. The earlier-recorded `authSlice.ts:98` comment also stays deferred.
- **Rejected (false):** 3:
  - The `interactionService` pointer is still accurate.
  - The loading-flag header paragraph applies to the notes and events assertions.
  - The fresh TEA re-review is the epic-level gate, not this story's.

**Follow-up review recommended:** false. This was a first pass, and every patched entry was low: none high, and none medium.

**Verification (after the review patches):**
- `npm run lint`: exit 0.
- `npm run typecheck`: exit 0, with 0 errors.
- `npx vitest run`: 2907 of 2907 passed. The sorted full names and statuses are identical to the pre-story baseline.
- The largest test file is 974 lines.
- The implementer ran every new file alone and under `--sequence.shuffle`.
- Playwright was not run, because the only e2e and api changes are comments.

**Residual risks:**
- The spec's `wc -l` Verification command also counts app code. `src/stores/slices/notesSlice.ts` is 1955 lines, so that literal command tops out above 1000. The acceptance criterion covers only test and helper files, and those all pass.
- Every file still carries its own `vi.mock` blocks. That is forced by how vitest hoists mocks, but it means a change to a mocked module's surface has to be repeated in each sibling, for example the 11 mocks in the 7 loaderIdentityGuards files.
- The ledger edit is not committed, because `_bmad-output/` is gitignored; the loop carries the ledger back.

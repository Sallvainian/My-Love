---
title: 'DW-313: consolidate shared test fixtures and constants'
type: 'refactor'
ticket: ''
created: '2026-10-29'
status: 'done'
baseline_revision: '95dc2d4cf44793cfccfca1e88212b1c64370948a'
route: 'full'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: ['multiple-goals', 'oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** DW-313 (retrospective D-dup1–7, P-div1, A5): test fixtures and constants were invented file by file — three photo-row builders with an unexplained `file_size: 68`, four copies of a hoisted `vi.mock('react')` `useState` observer, per-file SQLSTATE constants and literals, hand-built `{ status: 'failure', error }` beside `loadFailure()`, a pasted `settleNameLookups`, a duplicated IndexedDB store list, hand-rolled e2e IndexedDB reads (some unguarded), and `stalePersistedMood()` defaulting its anchor to the wall clock.

**Approach:** Give each duplicate one named home and point every copy at it: a shared photo-row factory, a react-state-spy module, a SQLSTATE constants module, `loadFailure` in every EventsSettings sibling, a love-notes test kit, one exported `ALL_STORES`, a guarded generic IndexedDB store reader for e2e, and a required `anchor` on `stalePersistedMood`. Test-only change; no `src/` production file is edited.

## Boundaries & Constraints

**Always:** every touched test keeps its behaviour and every assertion it had (value, visibility, scope) — this is a move, not a rewrite. Match surrounding style by hand (no `prettier --write`). Relative imports from `src/**/__tests__` into `tests/support` (as the photo factory already is). Shared modules carry a short doc comment saying what they are for.

**Never:** edit production code under `src/` (only `__tests__` files there); edit `_bmad-output/initiative-my-love/deferred-work.md`; touch `tests/e2e-archive/`; replace SQLSTATE literals in `src/` production code; convert the two e2e IndexedDB *writes* (`account-data.spec.ts` seeded `moods` add, `mood-offline-copy.spec.ts` `clearMoodsStore`) — they are not reads; change `savedLocalCopy`'s signature.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Reader, DB absent | `my-love-db` not yet created | `readStore` returns `null` without opening (no empty DB created) | caller maps `null` to its old fallback |
| Reader, store absent / read fails / open blocked | store missing, request error, `onblocked` | `null` | callers that used to reject throw on `null`; callers that used to resolve a fallback (`[]`, `false`) return it |
| Reader, Blob value | `image-cache` row | Blob comes back as `{ blobSize: n }`; other values JSON-cloned (Date → ISO string) | — |

</intent-contract>

## Code Map

- `tests/support/factories/photos.ts` -- has `createPhotoInsert`; add the row factories here. `SupabasePhoto`/`PhotoWithUrls` are in `src/services/photoService.ts:34,52` (type-only import).
- Photo builders: `src/components/PhotoGallery/__tests__/{PhotoGallery.kit,PhotoGallery.pagination,PhotoGridItem.recovery,PhotoImageStates,PhotoViewer.focus}.test.tsx`, `src/components/shared/__tests__/photoDialogsA11y.test.tsx` (each spreads `createPhotoInsert({...row, file_size: 68})` then restates `row`, adds `signedUrl: null, isOwn`); `tests/unit/stores/photosSlice.localCopy.test.ts:72-83` (`as SupabasePhoto`, `file_size: 1000 + n`); `tests/unit/stores/loaderIdentityGuards.photos.test.ts:186-202` (`PhotoRowFields`, `file_size: 1`).
- React observer copies: `src/components/Settings/__tests__/EventsSettings.{pagination:15-31,lifetime:13-29}.test.tsx`, `src/components/PokeKissInterface/__tests__/PokeKissInterface.test.tsx:7-25`, `src/components/love-notes/__tests__/LoveNoteMessage.test.tsx:21-37` — each `const stateSetterCalls = vi.hoisted(...)` + identical factory.
- SQLSTATE: per-file declarations — `notesSlice.offlineQueue.test.ts:95` (`INSUFFICIENT_PRIVILEGE`), `notesSlice.queueRetry.test.ts:100` (`CONNECTION_FAILURE`), `notesSlice.idempotency.test.ts:34` and `tests/unit/services/photoService.idempotency.test.ts:38` (`NOT_NULL_VIOLATION`), `tests/unit/stores/eventsSlice.test.ts:56` (`INSUFFICIENT_PRIVILEGE`), `tests/support/check-constraint-envelopes.ts:100` (`CHECK_VIOLATION_CODE`, imported by `notesSlice.{offlineQueue,queueStaleSession,queueMultiTab}.test.ts`, `photoService.idempotency.test.ts`, `tests/api/{check-constraint-error-mapping,empty-database-error-fallback}.spec.ts`), `tests/api/{profile-name-email-ownership:37,interaction-authorization:45}.spec.ts` (`DENIED_CODE`). `'23514'`/`'08006'` literals — `notesSlice.{sessionGuard:233,idempotency:229,localCopyWrites:70,offlineQueue:424}`, `check-constraint-envelopes.ts:158`, `tests/unit/api/{checkConstraintMapping,errorHandlers,partnerService.check}`, `tests/api/events-wire-contract.spec.ts:766`.
- loadFailure: `src/components/Settings/__tests__/eventsSettingsKit.tsx:72`; hand-built at `EventsSettings.pagination.test.tsx:72`, `.lifetime:71`, `.delete:236`, `.reconciliation:182`, `.addEdit:419,455-458`.
- `settleNameLookups`: `src/components/love-notes/__tests__/OwnDisplayName.test.tsx:81-~110` and `LoveNotes.realtimeStatus.test.tsx:88-~118`; both read a file-local `api` (`vi.hoisted`) for `getOwnDisplayName`, `getUser`, `getPartnerDisplayName`.
- `ALL_STORES`: `tests/unit/services/storageSchema.test.ts:39`; hard-coded sorted list at `dbSchema.v15MessageData.test.ts:168-175`; shared home `tests/unit/services/dbSchemaFixtures.ts`.
- e2e IndexedDB reads (pattern to generalise: `tests/support/helpers/local-copy.ts` guard): `tests/e2e/auth/logout.spec.ts:24-58` (getAll `local-copies` + `messages`, rejects), `auth/implicit-fragment-rejection.spec.ts:90-118` (get `'current'` from `sw-auth`, `onblocked`→null, rejects on error), `mood/mood-kit.spec.ts:94-113` (count `moods`, guarded), `offline/love-notes-offline-send.spec.ts:48-74` (index `by-user` getAll, fallback `[]`), `account-data/account-data.spec.ts:46-63` (`localRows`, JSON-cloned, rejects), `offline/photos-offline.spec.ts:56-81` and `offline/love-notes-offline-copy.spec.ts:52-77` (identical `imageCached`, fallback `false`), `offline/mood-offline-copy.spec.ts:56-80` (`ownMoodRows`, fallback `[]`), `offline/account-data-offline-copy.spec.ts:56-76` (`messages` getAll, rejects).
- `tests/support/helpers/persisted-blob.ts:178-196` (`stalePersistedMood`); callers `tests/e2e/home/persisted-events-strip.spec.ts:177,214` (`clockAnchor` from `tests/support/helpers/events.ts`, already imported there).

## Tasks & Acceptance

**Execution:**
- [x] `tests/support/factories/photos.ts` -- add `createPhotoRow(input)` (requires `id, user_id, storage_path, caption, mime_type, created_at`; optional rest incl. `file_size`, defaulting to an exported named constant set to 68 with a comment that the gallery never reads it) returning `SupabasePhoto`, and `createPhotoWithUrls(input, isOwn = true)` returning `PhotoWithUrls` with `signedUrl: null` -- one builder replaces three patterns.
- [x] the six src photo tests, `photosSlice.localCopy.test.ts`, `loaderIdentityGuards.photos.test.ts` -- build rows with the new factories, keeping every field value; drop the cast, `PhotoRowFields` and the "restated" comments.
- [x] `tests/support/react-state-spy.ts` (new) -- export `stateSetterCalls` (`vi.fn`) and `async function reactWithStateSpy()` returning the mocked module; each of the four tests imports `stateSetterCalls` and writes `vi.mock('react', async () => (await import('<rel>/tests/support/react-state-spy')).reactWithStateSpy())`. The module must not statically import a React value.
- [x] `tests/support/sqlstate.ts` (new) -- export `CHECK_VIOLATION_CODE`, `NOT_NULL_VIOLATION`, `INSUFFICIENT_PRIVILEGE`, `CONNECTION_FAILURE`; remove every per-file declaration (incl. `DENIED_CODE`) and repoint `CHECK_VIOLATION_CODE` importers; replace `'23514'`/`'08006'` literals in test code, and in each file this touches also `'23502'`/`'42501'` literals; `check-constraint-envelopes.ts` imports the code instead of declaring it.
- [x] five EventsSettings siblings -- replace hand-built failures with `loadFailure('<same message>')` (keep any `as const`-free typing valid).
- [x] `src/components/love-notes/__tests__/loveNotesTestKit.ts` (new) -- export `settleNameLookups(api)` taking the three lookup mocks; both tests call it with their `api`.
- [x] `tests/unit/services/dbSchemaFixtures.ts` -- export `ALL_STORES`; `storageSchema.test.ts` imports it; v15 test asserts `toEqual([...ALL_STORES].sort())`.
- [x] `tests/support/helpers/indexed-db.ts` (new) -- `readStore<T>(page, store, query, database = 'my-love-db')` with `query` = `{ op: 'getAll', index?, key? } | { op: 'get', key } | { op: 'count' }`, guarded per the I/O matrix; convert the nine reads, two `imageCached` copies becoming one exported helper here. Signed-in user id read on the Node side where the old code read it in-page, with the same no-user fallback.
- [x] `tests/support/helpers/persisted-blob.ts` -- `stalePersistedMood(anchor: Date, overrides = {})`, no default; spec passes `anchor` at 177 and `clockAnchor()` at 214.
- [x] `tests/unit/helpers/indexed-db.test.ts` (new) -- unit-test every I/O-matrix row of `readStore` against `fake-indexeddb` (loaded by `tests/setup.ts`) with a fake `Page` whose `evaluate(fn, arg)` calls `fn(arg)`: absent DB returns `null` and creates none, absent store / blocked open return `null`, `getAll`/index `getAll`/`get`/`count` return the rows, a Date comes back as its ISO string, a Blob as `{ blobSize }` -- the reader is shared by nine specs, so its edge cases get their own test.

**Acceptance Criteria:**
- Given the change, when grepping `tests/` and `src/**/__tests__`, then `file_size: 68`, `vi.mock('react', async () => {`, `function settleNameLookups`, a local `const (CHECK_VIOLATION_CODE|NOT_NULL_VIOLATION|INSUFFICIENT_PRIVILEGE|CONNECTION_FAILURE|DENIED_CODE) =` outside `tests/support/sqlstate.ts`, `status: 'failure', error` in `src/components/Settings/__tests__/EventsSettings.*`, `indexedDB.open(` in `tests/e2e/**` reads, and `anchor: Date = new Date()` each match nothing.
- Given the touched unit suites, when run, then the same tests pass with the same counts as at baseline.
- Given `npm run typecheck` and `npm run lint`, when run, then both pass.

## Implementation Notes

- `readStore` keys are typed `StoreKey` (`string | number | Array<string | number>`), not `IDBValidKey`: the recursive DOM type made `page.evaluate`'s argument typing fail with TS2589.
- `reactWithStateSpy()` is typed `Promise<Record<string, unknown>>`: an inferred return type fails declaration emit (TS4058) under the composite test project, and React's `useState` overloads do not accept a one-signature double.
- The fake-indexeddb Blob case stubs the global `Blob` with Node's: happy-dom's Blob does not survive the fake's structured clone.
- `backgroundSyncUserId` (implicit-fragment) and `savedMoodCount` (mood-kit) already answered `null` for an absent store/database, so they keep `null` on any `readStore` null; a failed read there now reads as `null` where it used to reject. The other callers that used to reject (`ownedRowCounts`, `localRows`, `customRowsInMessagesStore`) throw on `null`.
- `npx playwright test --list` over the whole tree fails in this worktree on the untouched `tests/e2e/auth/token-persistence-overlap.spec.ts`, which reads `node_modules/@playwright/test/package.json` from the worktree root where `node_modules` is empty; listing the touched specs by path succeeds.
- Review patch (supersedes the `backgroundSyncUserId`/`savedMoodCount` note above): `readStore` now rejects on a failed open or failed read request and answers `null` only when there is nothing to read (no database, store or index, a blocked open, a `get` miss), so every caller that used to reject on a broken read does again; `imageCached`, `queuedRows` and `ownMoodRows`, which used to answer `false`/`[]`, catch the rejection to keep that answer.

## Plan Change Log

## Review Triage Log

### 2026-10-29 — Review pass
- verdicts: 5 findings — high 0, medium 2, low 2, false 1, maybe-false 0
- findings:
  - `[medium]` `[patch]` `backgroundSyncUserId` (implicit-fragment-rejection.spec.ts) reads a failed open or read as `null`, so the two P0 assertions (`toBeNull()`, `toContain([null, …])`) pass on a broken read where they used to fail — confirmed against the old `reject` paths. Matrix row 2 conflated "absent" with "failed", but the intent's "assertions stay the same" leaves one reading. Fix: `readStore` now rejects on a failed open or read request, and keeps `null` for absent DB/store/index, a blocked open, or a get miss.
  - `[medium]` `[patch]` `savedMoodCount` (mood-kit.spec.ts:238) turned a failed read into `null` that `recurseUntil` polls to timeout. Same root cause as above; the same `readStore` fix restores the immediate rejection.
  - `[low]` `[patch]` `indexed-db.test.ts` had no case for a failed read request (`request.onerror`). Fix: the `error` open case now expects a rejection, and a new case stubs `getAll` to fire `onerror` and expects that error. `imageCached`, `queuedRows` and `ownMoodRows` catch the rejection and return their old `false`/`[]`, so their behaviour is unchanged.
  - `[false]` `[reject]` The acceptance grep for `function settleNameLookups` still matches. Refutation: the one match is the shared kit's definition (`loveNotesTestKit.ts`), which the plan's task requires; both pasted copies are gone. Only the criterion's wording is off, and fixing it would mean editing this plan.
  - `[low]` `[patch]` `PokeKissInterface.test.tsx:3` kept an unused `import type { SetStateAction }`: its only use was the removed mock factory (grep finds it only on line 3). Fix: import deleted.

## Design Notes

`vi.mock` factories are hoisted above imports, so the factory must reach the spy module by dynamic `import()`; vitest gives the factory and the test's static import the same module instance, so `stateSetterCalls` is shared. Each `page.evaluate` body is self-contained, so the reader is one body switching on `query.op`; it returns `JSON.parse(JSON.stringify(result, replacer))` where the replacer turns a `Blob` into `{ blobSize: size }` — `account-data.spec.ts` already JSON-cloned, and `imageCached` becomes `typeof row?.blob?.blobSize === 'number' && row.blob.blobSize > 0`.

## Verification

**Commands:**
- `npx vitest run src/components/PhotoGallery src/components/shared src/components/Settings src/components/PokeKissInterface src/components/love-notes tests/unit/stores tests/unit/services tests/unit/api tests/unit/helpers` -- expected: pass; test count equals baseline plus the new `indexed-db.test.ts` cases.
- `npm run typecheck && npm run lint` -- expected: exit 0.
- `npx playwright test --list` -- expected: lists without import/type errors (full e2e needs local Supabase; run the converted specs if `supabase status` is up).

## Auto Run Result

Status: built

**Summary:** This resolves DW-313. Each fixture or constant that tests had duplicated file by file now has one shared home:
- a photo-row factory (`createPhotoRow`, `createPhotoWithUrls`, `DEFAULT_PHOTO_FILE_SIZE`);
- a React `useState` spy module;
- a SQLSTATE constants module;
- `loadFailure()` in every EventsSettings sibling;
- a love-notes test kit (`settleNameLookups`);
- one exported `ALL_STORES`;
- a guarded generic e2e IndexedDB reader (`readStore`, `signedInUserId`, `imageCached`) with its own unit test;
- a required `anchor` on `stalePersistedMood`.

The change is test-only: no production file under `src/` was edited.

**Files changed (56 plus this plan):**
- **New shared modules:** `tests/support/sqlstate.ts`, `tests/support/react-state-spy.ts`, `tests/support/helpers/indexed-db.ts`, `src/components/love-notes/__tests__/loveNotesTestKit.ts`.
- **New unit test:** `tests/unit/helpers/indexed-db.test.ts`, 8 cases covering every I/O-matrix row.
- **Extended:** `tests/support/factories/photos.ts` gains the row factories. `tests/unit/services/dbSchemaFixtures.ts` gains `ALL_STORES`. `tests/support/helpers/persisted-blob.ts` now requires the anchor. `tests/support/check-constraint-envelopes.ts` imports the check-violation code instead of declaring it.
- **Photo-row callers:** 6 src photo tests, `photosSlice.localCopy`, `loaderIdentityGuards.photos`.
- **React spy users:** 4 tests (EventsSettings pagination and lifetime, PokeKissInterface, LoveNoteMessage).
- **`loadFailure` callers:** 5 EventsSettings siblings.
- **`settleNameLookups` callers:** 2 love-notes tests.
- **`ALL_STORES` callers:** `storageSchema` and `dbSchema.v15MessageData`.
- **SQLSTATE adopters:** 12 unit test files and 5 api specs.
- **`readStore` callers:** 9 e2e specs.
- **Anchor caller:** `persisted-events-strip.spec.ts`.

**Review findings:**
- **Patched (4 findings, 3 entries):**
  - One medium entry: `readStore` answered `null` for a failed read, which weakened two P0 assertions and the `mood-kit` count. It now rejects on a failed open or read request.
  - One low: there was no test for a failed read request. Now tested.
  - One low: an unused `SetStateAction` import. Removed.
- **Deferred:** none.
- **Rejected:** one false finding. The grep for `function settleNameLookups` matches only the shared kit's own definition; both pasted copies are gone.

**Follow-up review recommended:** false. This pass patched no high entry and one medium entry, under the threshold of two.

**Verification:**
- **Unit suites (the plan's command):** baseline 135 files / 2295 tests; after the change 136 / 2303, all passing. The 8 new tests are the reader's.
- **`npm run typecheck` and `npm run lint`:** both exit 0.
- **Playwright:** the touched specs list (93 tests in 22 files). The implementer ran the 10 touched e2e specs (40/40) and 5 api specs (30/30) against local Supabase. After the review patch it re-ran the 9 reader specs (36/36).
- **Full `npx playwright test --list`:** fails in this worktree on the untouched `token-persistence-overlap.spec.ts`, because the worktree has no `node_modules`. This predates the change.

**Residual risks:**
- `readStore` JSON-clones what it reads, so a Date comes back as an ISO string. No converted caller reads a Date as a `Date`.
- The plan's I/O-matrix row 2 still says a failed read answers `null`. The code follows the intent's rule that assertions keep their strength, and so rejects instead.

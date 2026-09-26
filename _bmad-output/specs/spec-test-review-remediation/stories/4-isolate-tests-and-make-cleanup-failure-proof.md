---
title: 'Isolate tests and make cleanup failure-proof'
type: 'chore'
created: '2026-09-25'
status: 'done'
baseline_revision: 'dfc30d5a1af0a4102903bb360319572a705de017'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/specs/spec-test-review-remediation/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-test-review-remediation/corrections.md'
warnings: ['oversized']
deferred:
  - summary: >-
      Catch-then-cleanup teardown is skipped when Playwright times the test out.
    evidence: |-
      A timeout abandons the test body, so cleanup placed after a catch never runs (the display-name-setup `renamed` docblock explains this). Affected sites: display-name-setup nameless accounts (~102, ~164); couple-broadcast-authorization outsiders; interaction-authorization; interaction-record-ownership (~64/~97); profile-name-email-ownership; events-write-wire-shape `runWithPairCleanup`. Fixing it means moving each cleanup to `test.afterEach`. No H4 row or corrections item names these; found by a planning audit.
    location: >-
      tests/api/*.spec.ts; tests/e2e/auth/display-name-setup.spec.ts
    severity: low
  - summary: >-
      Seeding helpers leak what they already created when a later step of the seed fails.
    evidence: |-
      photos-offline `seedPhotos` (~111-143) leaks objects and rows because `seeded` is assigned only once the helper returns. birthdays-wedding-offline `setValues` (~118, ~180) makes three writes before its `try`. implicit-fragment-rejection `createForeignSession` (~40-43) throws after creating the account. Found by a planning audit; no row names them.
    location: >-
      tests/e2e/offline/photos-offline.spec.ts; tests/e2e/offline/birthdays-wedding-offline.spec.ts; tests/e2e/auth/implicit-fragment-rejection.spec.ts
    severity: low
  - summary: >-
      birthdays-wedding resets the pair to null instead of restoring its prior values, and leaves the couple_settings row in place.
    evidence: |-
      `resetPair` (~33-52) sets both birthdays and wedding_date to null. The couple_settings row is the pair's one shared settings row, and couple-start-date also upserts it, so the row is not an entity created by the test. It is left in a neutral state.
    location: >-
      tests/e2e/settings/birthdays-wedding.spec.ts:33
    severity: low
  - summary: >-
      love-notes-offline-send teardown deletes while the page is back online, so a queued note can still flush after the delete.
    evidence: |-
      The `finally` block runs `setOffline(false)` before `deleteNotes`. This only happens when the test fails partway through the flush. The fix would close the page, or keep it offline, before deleting. Found by a planning audit.
    location: >-
      tests/e2e/offline/love-notes-offline-send.spec.ts:205
    severity: low
  - summary: >-
      The shuffled-order guarantee is checked only by hand; no CI or npm script runs vitest shuffled.
    evidence: |-
      Found by the verification-gap review. `test:unit` and CI's `test:unit:coverage` run in declaration order, which passed even before this story. Reverting `resetAllMocks` or `unstubAllGlobals` would pass CI again. The fix is a fixed-seed `vitest run --sequence.shuffle --sequence.seed=1` step in `test.yml` or `scripts/ci-local.sh`. This story's spec forbids config changes.
    location: >-
      .github/workflows/test.yml; package.json
    severity: medium
  - summary: >-
      The G6 e2e teardowns still sit in `finally` blocks, which a Playwright timeout skips.
    evidence: |-
      Found in review. The `finally` teardowns in cross-device, the account-data mood test, the three account-data-offline-copy tests and love-notes-offline-send run only when the body throws, not when it times out. G5 moved note deletion to `test.afterEach` for this reason; these were not moved. The first deferred entry names this same class for the api specs.
    location: >-
      tests/e2e/account-data/cross-device.spec.ts; tests/e2e/account-data/account-data.spec.ts; tests/e2e/offline/account-data-offline-copy.spec.ts; tests/e2e/offline/love-notes-offline-send.spec.ts
    severity: low
  - summary: >-
      The account-data mood teardown checks the delete's error but not how many rows it deleted.
    evidence: |-
      This predates the story. The delete, keyed on `user_id` plus `created_at`, would also answer `error: null` if its filter matched nothing. G5's note teardown checks the count for this reason.
    location: >-
      tests/e2e/account-data/account-data.spec.ts:292
    severity: low
  - summary: >-
      Isolation advisories that carry no rule id are fixed by no story.
    evidence: |-
      Found by the intent audit. None has an H4 id:
      - unit: `customMessageService.ownership.test.ts:82` replaces `globalThis.indexedDB` and never restores it; `accountDataSlices.test.ts` has console.error spies.
      - api: the `check-constraint-error-mapping.spec.ts:241-280` fixed-per-worker leak advisory.
      - e2e: the "readers that rely on other tests' try/finally restores" advisory (home-kit, mood-kit, persisted-events-strip, photos-offline).
      Story 4's intent is H4 rows plus the corrections items.
    location: >-
      tests/unit/services/customMessageService.ownership.test.ts:82; tests/api/check-constraint-error-mapping.spec.ts:241
    severity: low
  - summary: >-
      Two specs outside this diff still throw a bare `AggregateError`, which hides the assertion it wraps in Playwright reports.
    evidence: |-
      `interaction-record-ownership.spec.ts` (~108) and `display-name-setup.spec.ts` (~154, ~229) predate this story and are outside its sites. The new `throwCollected` helper (`tests/support/helpers/collected-failures.ts`) is the fix.
    location: >-
      tests/api/interaction-record-ownership.spec.ts:108; tests/e2e/auth/display-name-setup.spec.ts:154
    severity: low
  - summary: >-
      A LoveNoteMessage image-cache session test failed once under full-suite load.
    evidence: |-
      Seen during this story's verification. "drops a cache read that resolves after a sign-out and back in (new session)" reported that `createObjectURL` was called once. It then passed 8 of 8 runs alone, a full `test:unit` rerun, and 15 shuffled seeds. The file is untouched by this story; this is timing nondeterminism, story 2's class.
    location: >-
      src/components/love-notes/__tests__/LoveNoteMessage.test.tsx:452
    severity: medium
---

<intent-contract>

## Intent

**Problem:** Tests leak state into later tests and skip or mask their own cleanup when they fail. That covers every H4 row: 7 in `findings-unit.md`, 4 sites in `findings-src.md`, and 3 in `findings-e2e.md`. It also covers the corrections items on cleanup ordering and leaked love-note rows, the items stories 1 and 2 deferred here (`authServices` console spy, the `dbSchema` shuffle failure), and the suite advisory where the `offlineErrorHandler` `onLine` restore never runs. A baseline `vitest run --sequence.shuffle` fails on 15 of 15 seeds, in four files.

**Approach:** Reset every piece of shared state in a hook rather than inline. For module mocks, that means `vi.resetAllMocks()` and re-arming the defaults. For globals, restore the property descriptor or unstub it. For IndexedDB, clear it in `afterEach`. Create throwaway accounts and rows only inside the reach of their cleanup. Delete every row a spec sends, from `afterEach`, keyed on its unique content and the worker's own pair. Soften teardown assertions so they cannot replace the test's real error.

## Boundaries & Constraints

**Always:**
- Locate each site by content. Keep or strengthen what every test proves.
- Follow the patterns already in the repo:
  - api specs collect errors in a `failures` array and throw an `AggregateError`;
  - e2e teardown uses `expect.soft` (see `love-notes-realtime.spec.ts` ~244-270);
  - e2e cleanup that must survive a timeout goes in `test.afterEach` (see the `display-name-setup` `renamed` pattern).
- E2E imports come from `tests/support/merged-fixtures.ts`. Delete only rows keyed on the worker's own pair (`resolveOwnPair`). Fixture data uses the fictional values.
- Match the surrounding style by hand; never run `prettier --write`.
- One commit per group, G1 to G6, with the message named in each group. End every commit with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

**Never:**
- Change `vitest.config.ts` (e.g. `mockReset: true`), `playwright.config.ts`, ESLint rules or app code.
- Touch rows owned by other stories:
  - M1 waits (story 3);
  - M9/L9 helper adoption (story 6);
  - names and selectors (story 8);
  - H5 file splits (story 9).
- Work on `tests/e2e-archive/` or pgTAP files.
- Link or unlink partners, or delete another worker's rows.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Shuffled unit run | `vitest run --sequence.shuffle --sequence.seed=N` | Every seed passes | n/a |
| E2E test sends a note, then fails or times out | `afterEach` runs | The note row with that content from the own pair is deleted | Delete error recorded with `expect.soft`; the original error stays |
| API setup fails after creating account A | Creating B throws, or A's session check fails | A is still deleted | Setup and cleanup failures are both reported in the `AggregateError` |

</intent-contract>

## Code Map

Baseline shuffle failures (15 seeds): `loveNoteImageService` 15/15, `useRealtimeMessages` 13/15, `photoDownloadPreference` 7/15, `dbSchema` 4/15. File isolation is on, so these failures are order dependence inside each file.

### G1 — unit H4 rows (`test(unit): reset shared globals and IndexedDB in hooks`)
- `tests/unit/stores/moodSlice.test.ts` ~541-573, "…untouched when the lock was held": the inline `Reflect.deleteProperty(navigator, 'locks')` runs only after the assertions. Move it into an `afterEach` on the enclosing describe "when the session ends before the batch settles", as the describe at ~427-431 does.
- `tests/unit/stores/signOutClearsAccountState.test.ts`:
  - ~549-572: `onLine` is set and then restored inline. In the file's `afterEach` (~252), call `Reflect.deleteProperty(navigator, 'onLine')`; happy-dom keeps `onLine` on the prototype, so deleting the own property restores it. Drop the inline restore.
  - `seedDevice` tests ~771-870: remove the trailing `await clearDevice()` from each test and call `clearDevice()` from the `afterEach`, after the `pendingReloads` settle.
  - Add `afterEach` to the vitest import.

### G2 — unit shuffle and advisory (`test(unit): make order-dependent suites pass shuffled`)
- `tests/unit/services/dbSchema.test.ts` "blocked upgrade prompt" ~1051-1191:
  - `vi.stubGlobal('location', …)` is never unstubbed, so the next `supabaseClient` import throws `Invalid URL`.
  - `window.confirm = …` is never restored.
  - Fix: stub `confirm` through `vi.stubGlobal`, and add a describe-level `afterEach(() => vi.unstubAllGlobals())`. The top-level `vi.stubGlobal('import', …)` is inert (`import.meta` is not a global), so unstubbing it too is harmless.
- `tests/unit/services/photoDownloadPreference.test.ts` ~56-68: `vi.spyOn(localStorage, …)` spies on happy-dom's Storage **Proxy**, and `restoreAllMocks` does not undo that, so later tests throw `SecurityError`. Spy on `Storage.prototype` instead, after confirming once in a scratch run that happy-dom routes calls through the prototype. If it does not, save and restore the instance methods in `afterEach`.
- `tests/unit/utils/offlineErrorHandler.test.ts` ~61-68, ~97-103, ~135-141: `original` is `undefined`, so the restore never runs. Add an else branch that calls `Reflect.deleteProperty(navigator, 'onLine')`.

### G3 — src H4 rows (`test(src): restore mock defaults between tests`)
- `src/hooks/__tests__/useRealtimeMessages.test.ts` top-level `beforeEach` ~119: replace `vi.clearAllMocks()` with `vi.resetAllMocks()`. In Vitest 5 that restores each `vi.fn(impl)` factory default, including `supabase.channel` and the `useAppStore` selector, and drops unconsumed `*Once` queues. The re-arms that follow stay. The `userId` row (~432) was already fixed by story 2's `mockStoreState.userId = USER_ID` in `beforeEach`; confirm it is still there.
- `src/services/__tests__/loveNoteImageService.test.ts` `beforeEach` ~104: make the same change, which restores `validateImageFile`, `getSession`, `compressImage`, `storage.from` and `crypto.randomUUID`. Then drop the now-redundant per-test `validateImageFile.mockReturnValue({ valid: true })` re-arms (~184, 196, 220, 244, 268, 292).
- `src/api/auth/__tests__/authServices.test.ts` ~280-377 (deferred by story 1): add `afterEach(() => vi.restoreAllMocks())` and remove the four trailing `errorLog.mockRestore()` calls.

### G4 — api cleanup ordering (`test(api): keep throwaway state inside its cleanup's reach`)
- `tests/api/interaction-authorization.spec.ts` ~50-53, ~142-145: move `getSession` and the token `expect` inside the `try`. Split the cleanup into two `try` blocks, so the account delete still runs when the row DELETE fails.
- `tests/api/profile-name-email-ownership.spec.ts`:
  - ~47-51: move the session and token lines and the premise reads (~53-67) inside the `try`.
  - ~146-149: create `partner` inside the `try`, and clean up only the accounts that exist (`accounts` array).
- `tests/api/couple-broadcast-authorization.spec.ts`:
  - ~540-541: this is the same shape as ~146-149; create `outsiderB` inside the `try`.
  - ~256-278, ~282-345, ~538-590: `removeAllChannels()` and `cleanup()` each run in their own collected `try`. Assert `cleanup()`'s `error` is null. Switch `failure` to the `failures` + `AggregateError` pattern.
- `tests/api/upload-love-note-image-limits.spec.ts` browser Blob test ~276-289: register `storagePath` for cleanup straight after reading the body, before any assertion, as the sibling tests at ~90-93 do. Use a non-throwing parse helper. In `finally`, delete the objects before `context.close().catch(() => {})`.
- `tests/api/check-error-write-boundaries.spec.ts` ~86-92, ~121-130: replace the `finally` + hard `expect` with the collected pattern (body `try`/`catch` → cleanup `try`/`catch` → throw).

### G5 — e2e leaked love-note rows (`test(e2e): delete the love notes specs send`)
- New `tests/support/helpers/love-notes.ts`: `deleteOwnPairNotes(supabaseAdmin, content)`. It resolves the own pair, deletes `love_notes` rows `.eq('content', content).in('from_user_id', [userId, partnerId])` with `.select('id')`, and returns the deleted ids. The caller applies `expect.soft` to the error.
- `tests/e2e/notes/love-notes.spec.ts` 4.2-E2E-003, `tests/e2e/notes/notes-kit.spec.ts` bubble test, and `tests/e2e/auth/display-name-setup.spec.ts` Display Name Edit (~368):
  - Record the content in a describe-scoped `let sentNote: string | null` before the send click.
  - A `test.afterEach` deletes that note and soft-asserts the error is null. Once the POST has answered 2xx (a `committed` flag), it also soft-asserts exactly one row was deleted.
  - `display-name-setup` has an existing `afterEach` that returns early when `!renamed`. Restructure it so the name restore and the note delete run independently.

### G6 — other e2e leaks and masking teardown (`test(e2e): delete leftover rows and keep teardown from masking failures`)
- `tests/e2e/account-data/account-data.spec.ts`:
  - ~109-121: the A/B/A test leaves user1's favorite on the server. Clear the pair's `message_favorites` in a `test.afterEach`, keyed on the pair ids, as the start-of-test clear is.
  - ~274-279: turn `page.close()` into `.catch(() => {})` and the cleanup `expect` into `expect.soft`.
- `tests/e2e/account-data/cross-device.spec.ts` ~54-60, ~156-160: `clear()` uses `expect.soft` so every table is attempted. Guard the closes with `.catch(() => {})`.
- `tests/e2e/offline/account-data-offline-copy.spec.ts` `clear` helpers ~134-137, ~189-194, ~244-249: switch them to `expect.soft`.
- `tests/e2e/offline/love-notes-offline-send.spec.ts` ~205-213: the `finally` calls `sentRows`, which holds a hard `expect`. Query the ids inline there with `expect.soft`, then call `deleteNotes`.

## Tasks & Acceptance

**Execution:**
- G1–G6 files as mapped above: hook-based resets, cleanup placed within reach of every created resource, and soft teardown assertions. Together these fix every H4 row and the corrections cleanup and leak items.

**Acceptance Criteria:**
- Given the unit and src suites, when `npx vitest run --sequence.shuffle --sequence.seed=N` runs for N = 1..15, then every seed passes (the baseline fails all 15).
- Given each G1–G3 fix, when that fix is reverted locally and the shuffle seed that failed at baseline is rerun, then that seed fails again. Restore afterwards, and record one example per group in the Auto Run Result.
- Given the G5 specs, when they run and then the local database is queried for the sent contents (`E2E test note`, `Kit note`, `Display name edit E2E`), then zero rows remain.
- Given the story, when `npm run lint`, `npm run typecheck`, `npm run test:unit` and `npx playwright test` run on every changed spec (with local Supabase up), then all pass.

## Spec Change Log

## Review Triage Log

### 2026-09-25 — Review pass
- verdicts: 40 findings — high 0, medium 7, low 29, false 4, maybe-false 0
- findings:
  - `[low]` `[reject]` Blind: a note POST still in flight when an afterEach delete runs can commit after it, and the count check is skipped. This only happens if a test fails or times out in the short window between the send click and the POST answering. Closing that window means waiting on in-flight send state in teardown, which is more than a direct fix.
  - `[low]` `[patch]` Blind: the 20-line note-teardown afterEach was copied into three specs. Moved into `deleteSentNote` in `tests/support/helpers/love-notes.ts`; each hook is now 5 lines.
  - `[low]` `[patch]` Blind: the "Soft, so … rather than replacing it" comment is wrong inside an afterEach. The helper's comment now says soft only keeps later checks running.
  - `[low]` `[patch]` Blind: upload-limits `removeObjects` throws from `finally`, masking the real error, and the reorder let a failed removal skip `context.close()`. `removeObjects` now records failures with `expect.soft`.
  - `[low]` `[patch]` Blind: the soft `clear()` also softened the start-of-test clear. `clear({ soft })`: the pre-test call is hard, the teardown call soft.
  - `[low]` `[patch]` Blind: the love-notes-offline-send `finally` still runs unroute, setOffline and `resolveOwnPair` unguarded. The pair is now resolved once before the `try`; the unroute and setOffline calls use `.catch(() => {})`.
  - `[low]` `[defer]` Blind: the G6 `finally` teardowns are skipped on timeout and are not in the ledger. Pre-existing structure; added to `deferred`.
  - `[low]` `[defer]` Blind: the account-data mood teardown checks the error but not the count. Pre-existing; added to `deferred`.
  - `[low]` `[patch]` Blind: the top-level `unstubAllGlobals` turns the module-level `import` stub into first-test-only dead code. The inert stub and its comment were deleted.
  - `[low]` `[reject]` Blind: the `storageSpies` registry is opt-in, so a future test could leak. Hypothetical future misuse; the current tests are correct, and a wrapper adds surface for no present defect.
  - `[false]` `[reject]` Blind: `committed` (2xx) and `status < 400` disagree for a 3xx. A PostgREST insert answers 201 or an error and never redirects, so a 3xx cannot occur.
  - `[low]` `[reject]` Blind: offlineErrorHandler has three identical afterEach blocks with an unreachable branch. Cosmetic; no one is harmed, and consolidating them is a restructure.
  - `[medium]` `[patch]` Edge: couple-broadcast ~315 wraps a single body failure in AggregateError, and Playwright's `filterStackTrace` (`node_modules/playwright/lib/util.js:70-88`) drops `.errors`. Added `throwCollected` (`tests/support/helpers/collected-failures.ts`): 1 failure is rethrown as-is; 2+ are named in the message with `cause`. Used at all nine sites.
  - `[medium]` `[patch]` Edge: couple-broadcast ~266. Same root cause, same fix.
  - `[medium]` `[patch]` Edge: couple-broadcast ~371. Same root cause, same fix.
  - `[medium]` `[patch]` Edge: check-error-write-boundaries ~185. Same root cause, same fix.
  - `[medium]` `[patch]` Edge: check-error-write-boundaries ~222. Same root cause, same fix.
  - `[low]` `[patch]` Edge: an upload-limits `removeObjects` throw in `finally` replaces the test's error and skips close. Grouped with the Blind upload row; same fix.
  - `[false]` `[reject]` Edge: registering `storagePath` before the prefix assertion could delete another user's object. The path is where the function stored this request's own upload, so removing it removes this test's object; the sibling tests already register the same way.
  - `[low]` `[patch]` Edge: `resolveOwnPair` in the love-notes-offline-send `finally` can mask the test's error. Grouped with the Blind offline-send row; same fix.
  - `[low]` `[defer]` Edge: `setOffline(false)` lets queued notes drain after the delete. Already recorded in `deferred` at planning ("teardown deletes while the page is back online"); not added again.
  - `[low]` `[reject]` Edge: love-notes afterEach can race an in-flight send. Carries the Blind race row's reason.
  - `[low]` `[reject]` Edge: notes-kit afterEach race. Same reason.
  - `[low]` `[reject]` Edge: display-name-setup afterEach race. Same reason.
  - `[low]` `[patch]` Edge: the `deleteOwnPairNotes` doc says it returns rather than throws, but `resolveOwnPair` can throw. The doc was corrected, and `deleteSentNote` catches the throw and records it with `expect.soft`.
  - `[low]` `[patch]` Edge: cross-device soft pre-test clear. Grouped with the Blind `clear()` row; same fix.
  - `[low]` `[patch]` Edge: account-data-offline-copy anniversaries soft pre-test clear. Same fix.
  - `[low]` `[patch]` Edge: account-data-offline-copy favorites soft pre-test clear. Same fix.
  - `[low]` `[patch]` Edge: account-data-offline-copy custom-message soft pre-test clear. Same fix.
  - `[medium]` `[defer]` Verification-gap: the shuffled-order fixes are exercised by no CI or npm script. The spec forbids config changes; added to `deferred`.
  - `[medium]` `[patch]` Verification-gap: AggregateError hides assertion text in check-error and couple-broadcast. Grouped with the Edge AggregateError rows; `throwCollected`.
  - `[low]` `[patch]` Verification-gap: `resolveOwnPair` in the offline-send `finally`. Grouped with the Blind offline-send row.
  - `[low]` `[reject]` Verification-gap: an in-flight note POST can leak unreported. Carries the Blind race row's reason.
  - `[false]` `[reject]` Intent: display-name-setup adds a second afterEach instead of restructuring the first. Playwright runs every afterEach even when an earlier one throws, so the two teardowns are independent, which is the outcome the spec asked for.
  - `[low]` `[patch]` Intent: the soft `clear()` weakens the pre-test clean. Grouped with the Blind `clear()` row.
  - `[low]` `[patch]` Intent: `resolveOwnPair` in the offline-send `finally`. Grouped with the Blind offline-send row.
  - `[low]` `[defer]` Intent: isolation advisories with no rule id (unit indexedDB and console spies, api check-constraint leak, e2e restore readers) are untouched. The intent limits this story to H4 rows and the corrections items; added to `deferred`.
  - `[low]` `[reject]` Intent: the G5 "zero rows remain" bar is not met literally, because 16/34/42 rows from earlier runs remain. They predate this story, and the counts stayed unchanged across runs of the fixed specs. Deleting local data that pre-existed is outside the code change.
  - `[low]` `[reject]` Intent: the teardown failure branches never run in the committed suite. Proving them needs meta-tests that force failures, which is new complexity. They were demonstrated by forced local failures (4.2-E2E-003, profile partner creation) and restored.
  - `[false]` `[reject]` Intent: "one commit per finding group" is ambiguous. The spec defines groups G1–G6 and there is exactly one commit per group.

## Design Notes

`vi.clearAllMocks()` clears call history only. `vi.resetAllMocks()` (Vitest ≥3) also restores each `vi.fn(impl)` to `impl` and empties the `*Once` queues, so a test's override cannot reach the next test.

```ts
test.afterEach(async ({ supabaseAdmin }) => {
  if (!sentNote) return;
  const content = sentNote;
  sentNote = null;
  const { data, error } = await deleteOwnPairNotes(supabaseAdmin, content);
  expect.soft(error, 'teardown must delete the sent note').toBeNull();
  if (committed) expect.soft(data ?? []).toHaveLength(1);
});
```

## Verification

**Commands:**
- `npm run lint` -- expected: exit 0.
- `npm run typecheck` -- expected: exit 0.
- `npm run test:unit` -- expected: all pass.
- `for s in $(seq 1 15); do npx vitest run --sequence.shuffle --sequence.seed=$s; done` -- expected: every seed exits 0.
- `npx playwright test <changed e2e specs> --project=chromium` and `npx playwright test <changed api specs> --project=api` (with `supabase start`) -- expected: all pass.

## Auto Run Result

**Summary:** Every H4 row now resets its shared state in a hook, not inline:
- unit: the `navigator.locks` and `onLine` fakes and the seeded IndexedDB rows;
- src: the module mock defaults, through `vi.resetAllMocks()`;
- e2e: every love-note row the three specs send is deleted from `test.afterEach`.

The corrections cleanup items are fixed:
- api throwaway accounts are created inside the reach of their cleanup;
- the upload object is registered before any assertion;
- no teardown `expect` sits in a `finally`.

The two items deferred here are done: the `authServices` spy restore and the `dbSchema` shuffle failure. The shuffle work also fixed `photoDownloadPreference` and the `offlineErrorHandler` `onLine` restore. The unit and src suites now pass under `--sequence.shuffle` on seeds 1–15; at baseline all 15 failed. The review pass added:
- `throwCollected`, so a single failure is reported with its own assertion text;
- one shared note-teardown helper;
- a hard pre-test clear;
- guarded offline-send teardown;
- non-throwing upload cleanup;
- removal of the inert `dbSchema` stub.

**Files changed:**
- `tests/unit/stores/moodSlice.test.ts`: the lock fake is removed in the describe's `afterEach`.
- `tests/unit/stores/signOutClearsAccountState.test.ts`: the `onLine` delete and `clearDevice()` moved into `afterEach`.
- `tests/unit/services/dbSchema.test.ts`: `confirm` stubbed through `vi.stubGlobal`; `vi.unstubAllGlobals()` in `afterEach`; the inert `import` stub deleted.
- `tests/unit/services/photoDownloadPreference.test.ts`: the localStorage spies are held and restored with their own `mockRestore()`.
- `tests/unit/utils/offlineErrorHandler.test.ts`: the `onLine` restore works when happy-dom keeps it on the prototype.
- `src/hooks/__tests__/useRealtimeMessages.test.ts`, `src/services/__tests__/loveNoteImageService.test.ts`: `vi.resetAllMocks()` in `beforeEach`; the redundant re-arms dropped.
- `src/api/auth/__tests__/authServices.test.ts`: the console spies are restored in `afterEach`.
- `tests/support/helpers/collected-failures.ts` (new): `throwCollected`.
- `tests/api/interaction-authorization.spec.ts`, `tests/api/profile-name-email-ownership.spec.ts`, `tests/api/couple-broadcast-authorization.spec.ts`, `tests/api/check-error-write-boundaries.spec.ts`: session checks and second-account creation moved inside `try`; every teardown step runs in its own collected `try`; failures go through `throwCollected`.
- `tests/api/upload-love-note-image-limits.spec.ts`: the Blob upload is registered before assertions; `removeObjects` records failures softly.
- `tests/support/helpers/love-notes.ts` (new): `deleteOwnPairNotes` and `deleteSentNote`.
- `tests/e2e/notes/love-notes.spec.ts`, `tests/e2e/notes/notes-kit.spec.ts`, `tests/e2e/auth/display-name-setup.spec.ts`: the sent note is deleted in `test.afterEach`.
- `tests/e2e/account-data/account-data.spec.ts`: the pair's favorites are cleared in `afterEach`; the mood teardown is soft and its close guarded.
- `tests/e2e/account-data/cross-device.spec.ts`, `tests/e2e/offline/account-data-offline-copy.spec.ts`: `clear({ soft })`, hard before the test and soft in teardown; the closes are guarded.
- `tests/e2e/offline/love-notes-offline-send.spec.ts`: the pair is resolved once before `try`; the teardown is guarded and soft.

**Commits:**
- G1 `1479e328`
- G2 `8e165a41`
- G3 `63fb1a18`
- G4 `6290e7b8`
- G5 `002de6f5`
- G6 `b36a0a77`

The review fixes were folded into their group commits. The spec record is committed on top.

**Review findings:** 40 in total: high 0, medium 7, low 29, false 4, maybe-false 0.
- Patched: 6 entries, 1 medium and 5 low.
  - the AggregateError masking (medium);
  - the note-teardown helper, its comment and its doc;
  - upload cleanup masking;
  - the soft pre-test clear;
  - the offline-send `finally`;
  - the inert `dbSchema` stub.
- Deferred: 5 new items (shuffle not in CI; G6 `finally` teardowns skipped on timeout; the mood teardown count; isolation advisories with no rule id; the remaining bare AggregateError sites). Also recorded is the LoveNoteMessage flake seen during verification. The offline-send flush race was already deferred at planning.
- Rejected, with reasons in the triage log:
  - lows: the in-flight note race (×5 rows); the opt-in spy registry; the duplicate offlineErrorHandler hooks; the pre-existing note backlog; teardown failure branches that no committed test exercises;
  - false: the 3xx `committed` mismatch; the prefix deletion; the second afterEach; commit grouping.

**Follow-up review recommended: false.** This is a first pass. No high entry and only 1 medium entry were patched, which is below the threshold of two. Patched: high 0, medium 1, low 5.

**Verification (after the review patches):**
- `npm run lint`: exit 0.
- `npm run typecheck`: exit 0.
- `npm run test:unit`: 155 files, 2796 tests pass. One unrelated LoveNoteMessage test flaked once; it then passed 8 of 8 alone and on a full rerun, and it is deferred.
- `npx vitest run --sequence.shuffle --sequence.seed=N` for N = 1..15: every seed exits 0. At baseline all 15 failed: loveNoteImageService 15/15, useRealtimeMessages 13/15, photoDownloadPreference 7/15, dbSchema 4/15.
- Playwright `--project=chromium`, the 7 changed e2e specs: 17 passed.
- Playwright `--project=api`, the 5 changed api specs: 20 passed. The edge runtime was served with `supabase functions serve` and then stopped.
- Local `love_notes` counts of `E2E test note%`, `Kit note%` and `Display name edit E2E%` stayed at 16/34/42 across the runs, so no new rows were left behind. The existing rows come from earlier leaking runs.

**Revert and forced-failure evidence (all restored, never committed):**
- G2: `dbSchema` at baseline fails seed 2; `photoDownloadPreference` at baseline fails seed 1.
- G3: `loveNoteImageService` and `useRealtimeMessages` at baseline fail seed 1.
- G1: no seed exposes these leaks, which surface only after a test has failed. An injected throw showed the leak at baseline: `moodSlice` 2 failures vs 1 fixed, `signOutClearsAccountState` 6 vs 2.
- G5: a forced failure after the send in 4.2-E2E-003 still deleted its note.
- G4: a forced throw before the partner is created in profile-name-email-ownership still deleted the owner account (count 0 before and after) and reported the forced error.

**Residual risks:**
- A test that fails in the short window between a note's send click and its POST answering can still leave that one row (rejected as rare).
- Timeout-skipped `finally` teardowns remain in the G6 e2e specs and in the catch-then-cleanup api specs (deferred).
- Nothing in CI runs the suite shuffled, so the order-independence could regress unnoticed (deferred).
- The local stack has no edge-runtime container; `supabase functions serve` was used for the upload spec.

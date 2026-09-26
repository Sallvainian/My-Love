---
title: 'Make every test able to fail'
type: 'chore'
created: '2026-09-25'
status: 'done'
baseline_revision: 'e11e6a879aee2305e9611a5eee98f3d315bbf5c7'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/specs/spec-test-review-remediation/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-test-review-remediation/corrections.md'
warnings: ['oversized']
deferred:
  - summary: >-
      planImport's own "Unsupported export version" check is unreachable because the import schema accepts only version 1.0.
    evidence: |-
      src/validation/schemas.ts:139 is z.literal('1.0'), so a 2.0 file is refused by the schema ("Invalid version. Please select a valid option.") before src/services/customMessageService.ts:313-315 runs; no test reaches that message. Pre-existing, not caused by this story.
    location: >-
      src/services/customMessageService.ts:313
    severity: low
  - summary: >-
      authServices tests restore their console.error spy only at the end of each test, so a failing test leaves console.error silenced for later tests.
    evidence: |-
      src/api/auth/__tests__/authServices.test.ts calls errorLog.mockRestore() as the last statement (pattern predates this story); vitest.config.ts sets no restoreMocks. Cleanup-on-failure belongs to story 4 (H4).
    location: >-
      src/api/auth/__tests__/authServices.test.ts
    severity: low
  - summary: >-
      The stale playwright-utils deviation comment in events-persistence.spec.ts survives in the submitNewEvent docblock.
    evidence: |-
      corrections.md lists it (real waitForResponse calls are at 135/177/208/338); it is a recorded-deviation (M9) item owned by story 6, not a story-1 category.
    location: >-
      tests/e2e/settings/events-persistence.spec.ts:122
    severity: low
  - summary: >-
      interactionsSubscription.test.ts drains a fixed 2-3 microtasks before asserting, which may pass vacuously if the async chain is longer.
    evidence: |-
      Unit advisory marks it UNVERIFIED (lines ~394-401, 439-443, 498-508). Settle by lengthening the chain in the SUT locally and checking the negative assertions still fail. Timing work is owned by story 2.
    location: >-
      tests/unit/stores/interactionsSubscription.test.ts:394
    severity: medium (unverified)
  - summary: >-
      getDateLabel counts elapsed ms / 86400000 from local midnight, so just after spring-forward it labels yesterday "Today".
    evidence: |-
      src/utils/moodGrouping.ts:66; found during planning (now = 2026-03-09 00:30 EDT gives diff 0 for Mar 8). Story 1's rewritten tests avoid DST; story 2 owns the DST row at src/utils/__tests__/moodGrouping.test.ts:8.
    location: >-
      src/utils/moodGrouping.ts:66
    severity: medium
---

<intent-contract>

## Intent

**Problem:** The 2026-09-25 TEA reviews found tests that cannot fail: placeholder `expect(true)` bodies, comparisons of test-local literals, shape-only checks (H10), assertions chosen or skipped by `if`/ternary on the case parameter (H3), results that are only logged, swallowed rejections, vacuous premises, and two e2e specs whose names claim coverage they never exercise.

**Approach:** Work every C1–C7, H3 and H10 row in `findings-e2e.md`, `findings-src.md` and `findings-unit.md` (api and cross-cutting have none), plus the corrections.md log-only / swallowed-error / vacuous-premise / false-coverage items listed in the Code Map. Each fix constrains the value the code under test produced, or moves expected values into the parameter table so every case runs the same unconditional assertions.

## Boundaries & Constraints

**Always:**
- `corrections.md` overrides a finding's suggested fix. Locate every site by content; catalog lines are from 92f1c517.
- Keep or strengthen what each test proves; keep every existing test title unless the Code Map says to rewrite it.
- One commit per finding group (groups G1–G13 below), `test(scope): description`, ending with the attribution trailer `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- For each CRITICAL (G1, G2, G3, G4): break the named source line, run the test and see it fail, restore the source, see it pass. Record command + failing assertion line under `## Critical Break Evidence` in this file (outside the intent contract). Never commit a break.
- App-code changes only as test hooks (`data-testid`) or, if a corrected test exposes a real bug, a separate `fix(...)` commit.
- Fictional fixture values only (Casey/Jessie, Harper); no emails, keys or personal data.
- New `eslint-disable` lines carry a same-line ` -- ` reason. Match surrounding style by hand; never run `prettier --write`.
- E2E imports `{ test, expect }` from `tests/support/merged-fixtures.ts`.

**Never:**
- Weaken, skip or delete a test to satisfy a rule (the `error-boundary.spec.ts` bodies may be replaced because `home/routing.spec.ts` keeps identical coverage).
- Fix rows of other stories' ids (H1, H2, H4, M-, L-), cleanup-ordering or readiness-gate items, or `MessageInput` Shift+Enter (story 5). Do not touch `tests/e2e-archive/` or pgTAP files.
- Add `[P#]` markers to Vitest tests. Hand-edit `src/types/database.types.ts`. Symlink `node_modules` into the worktree.
- Pin an expected value you have not observed: where the Code Map marks a value UNVERIFIED, confirm it with one run first.

</intent-contract>

## Code Map

Paths below are current (HEAD e11e6a87). "→" gives the fix. All values were read from source; UNVERIFIED ones must be confirmed by a run.

### G1 — CRITICAL: unit placeholders (`test(unit): ...`)
- `tests/unit/utils/dateFormat.test.ts:10,17` — `expect(true)` placeholders. → import `formatDateISO` from `src/utils/dateUtils.ts` only (formatDateLong/formatFullTimestamp are a non-goal). `:10` "format dates consistently": `formatDateISO(new Date(2026,0,5))`→`'2026-01-05'`; `new Date(2026,8,25,23,30)`→`'2026-09-25'`. `:17` "midnight, DST": `new Date('2026-03-08T04:59:59.999Z')`→`'2026-03-07'`, `'2026-03-08T05:00:00Z'`→`'2026-03-08'`, `'2026-03-08T07:00:00Z'`→`'2026-03-08'`, `'2026-11-01T05:30:00Z'` and `'2026-11-01T06:30:00Z'`→`'2026-11-01'` (TZ is America/New_York, `vitest.config.ts:37`). Break: `dateUtils.ts:156-160` body → `return date.toISOString().split('T')[0];`.
- `tests/unit/utils/moodGrouping.test.ts:10,17` — placeholders. → `groupMoodsByDate` (`src/utils/moodGrouping.ts`) under `vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime(new Date(2026,8,25,12,0))`, restored in `afterEach`. Moods (`SupabaseMood`, `updated_at: null`) m1 `'2026-09-25T14:00:00.000Z'`, m2 `'2026-09-25T04:30:00.000Z'`, m3 `'2026-09-25T03:59:59.000Z'`, m4 `'2026-09-20T16:00:00.000Z'` → `toEqual([{date:new Date(2026,8,25),dateLabel:'Today',moods:[m1,m2]},{date:new Date(2026,8,24),dateLabel:'Yesterday',moods:[m3]},{date:new Date(2026,8,20),dateLabel:'Sep 20',moods:[m4]}])`. Empty: `groupMoodsByDate([])` → `[]`. No DST dates (see Design Notes). Break: `moodGrouping.ts:36` `toDateString()` → `toISOString().slice(0,10)`; empty case: insert an early `return [{ date: new Date(), dateLabel: 'Today', moods: [] }]` when empty.

### G2 — CRITICAL: `tests/unit/api/offlineMessageHonesty.test.ts:131` (`test(unit): ...`)
- Keep the non-empty guard (it stops `it.each([])` passing with zero tests). → same test: `toHaveLength(6)` / `toHaveLength(3)`, plus scan every non-test `.ts`/`.tsx` under `src/` (skip `__tests__` and `*.test.*`) with the file's `importedNames` and assert the sorted set of files importing any `SYNC_PROMISING_SYMBOLS` equals the sorted `OFFLINE_FIRST_IMPORTERS` files (`src/api/moodApi.ts`, `src/api/moodSyncService.ts`, `src/components/MoodTracker/MoodTracker.tsx`). Retitle to say it also finds every importer. Break: add `import { handleNetworkError } from '../api/errorHandlers';` to `src/utils/moodGrouping.ts`.

### G3 — CRITICAL + corrections: `src/components/love-notes/__tests__/LoveNoteMessage.test.tsx` (`test(love-notes): ...`)
- `:661-682` image-only bubble: dead filter (`text-base` no longer exists). → add `data-testid="love-note-text"` to the `<p>` at `src/components/love-notes/LoveNoteMessage.tsx:411`; assert `queryByTestId('love-note-text')` is null; in "should render both text and image" (~`:642`) add `getByTestId('love-note-text')` has text `'Check out this photo!'`. Break: `LoveNoteMessage.tsx:409` → `{(sanitizedContent || hasImage) && (`.
- Memory-leak tests `:713`, `:760`, `:817` (filters `:749-755`, `:806-812`, `:845-851`) cannot fail under React 19. → copy the `vi.mock('react')` `useState` setter spy from `src/components/Settings/__tests__/EventsSettings.lifetime.test.tsx:14-31`; `stateSetterCalls.mockClear()` just before `unmount()` (for `:760` after `fireEvent.error(img)`, since `:268` sets state synchronously), then `expect(stateSetterCalls).not.toHaveBeenCalled()` after the late resolve/reject. `:817` also asserts `consoleErrorSpy` called with `'[LoveNoteMessage] Failed to get signed URL:', expect.any(Error)`. Guards: `LoveNoteMessage.tsx:186`, `:272`, `:192`.

### G4 — CRITICAL + H10: `src/utils/__tests__/haptics.test.ts` (`test(haptics): ...`)
- `:144-156` literal 50>15. → capture `vibrateMock.mock.calls[0][0]` after `triggerMoodSaveHaptic()` before `mockClear`, then after `triggerSelectionHaptic()`; assert `50`, `15`, and greater-than. Break: `src/utils/haptics.ts:65` → `vibrate(80)`.
- `:159-170` → `expect(saveCall).toBe(50); expect(errorCall).toEqual([100,50,100]); expect(errorCall).not.toEqual(saveCall)`.

### G5 — H10 unit (`test(unit): constrain shape-only assertions`)
- `api/broadcastSchemas.test.ts:48` → `toMatchObject({ id: NOTE_ID, content: 'x' })` and `'x'.repeat(1000)`.
- `api/partnerService.check.test.tsx:163` → expected-requests column: send `['getUser','insert']`, accept `['accept_partner_request']`, decline `['decline_partner_request']`; `toEqual`.
- `components/eventsValidationMirrors.test.ts:101,131` → expected-throw column. :101 empty `/Too small: expected array to have >=1 items/`, duplicate `/Icon values must be unique/`. :131 missing & duplicate tag `'Expected exactly one tagged events validation contract in the pgTAP SQL'`, malformed JSON `SyntaxError`, string limit `/expected number, received string/`, non-string icon `/expected string, received number/`, empty `/Too small.../`, duplicate `/Icon values must be unique/`, unknown shape `/unrecognized_keys/`.
- `components/AdminPanel.accountData.test.tsx:200` → `expect(await diskRow(aId)).toMatchObject({ id: 1000, text: 'Account A message', serverId: 'srv-account-a', userId: A, category: 'custom' })`.
- `services/accountDataApis.test.ts:144,156` → `vi.spyOn(AbortSignal,'timeout')` (call-through); `toHaveBeenCalledExactlyOnceWith(30_000)` (`REQUEST_TIMEOUT_MS`, `src/services/accountDataError.ts:92`) and signal `toBe(timeout.mock.results[0].value)`.
- `services/coupleSettingsService.test.ts:119` → `rejects.toMatchObject({ name:'AccountDataError', code:'transport', message:'[CoupleSettingsService.fetchCoupleSettings] Database error: boom' })`.
- `services/customMessageService.ownership.test.ts:280` → `toThrow(/^Unsupported export version: 2\.0$/)`.
- `services/moodNormalization.test.ts:73` → `it.each` over rows, each asserted on `moodSyncPayload` and `moodSyncFingerprint`: bad mood `'Mood contains no recognized values'`, note 5 `'Mood note is invalid'`, `new Date('bad')` → `toThrow(RangeError)` + `/Invalid time value/` (thrown by `toCreatedAt`, `moodSyncPayload.ts:52-54`).
- `services/moodService.test.ts` — `:53`,`:85` `rejects.toMatchObject({ name:'ValidationError', message:'Invalid mood. Please select a valid option., Invalid moods.0. Please select a valid option.' })`; `:58` `{ name:'ValidationError', message:'Note cannot exceed 200 characters' }`; `:142` keep the created mood, add one for another userId, `expect(result).toEqual([created])`; `:380` local row `toEqual(local)` and server row `toMatchObject({ userId, mood:'grateful', moods:['grateful'], note:'from the server', synced:true, supabaseId:'server-1' })`; `:414` `rejects.toMatchObject({ name:'ConstraintError' })`.
- `services/profileService.test.ts:96` → `{ code:'transport', message:'[ProfileService.fetchOwnProfile] Database error: boom' }`; `:116` → `{ code:'invalid-response', message:'Your birthday was not saved' }` (not `'not-found'`: `src/services/profileService.ts:96`).
- `services/swDbScoping.test.ts:210` → `rejects.toMatchObject({ name:'ConstraintError' })`.
- `utils/interactionValidation.test.ts:120` → `expect(INTERACTION_ERRORS).toEqual({...})` with the 8 sentences at `src/utils/interactionValidation.ts:179-188`.
- `utils/offlineErrorHandler.test.ts:31` → add `toMatchObject({ name:'OfflineError', operation:'test', isRetryable:true, message:"You're offline. Please check your connection and try again." })`; `:188` `toBe("You're offline. Changes will sync when reconnected.")`; `:192` `toBe("You're offline. Please check your connection and try again.")`.

### G6 — H10 src (`test(src): constrain shape-only assertions`)
- `components/DisplayNameSetup/__tests__/DisplayNameSetup.test.tsx:117-124` → fake Date pinned to `2026-09-12T15:30:00.000Z`, `updated_at` `toBe` that string; restore real timers.
- `constants/__tests__/moodDisplay.test.ts:6-12` → `it.each([mood, icon, label])` from `src/constants/moodDisplay.ts:33-44`, `toEqual({ icon, label })`.
- `utils/__tests__/dateUtils.test.ts:39-41` → `vi.setSystemTime(new Date(2026,2,15,12,0,0))`; `getRelativeTime(new Date(2026,2,12,12,0,0).toISOString())` `toBe('Mar 12')`.

### G7 — H3 unit (`test(unit): table-drive conditional assertions`)
Move each ternary/if into table columns or split; assert unconditionally.
- `App.eventsSession.test.tsx:431/439` split: has-name (profile `chosen`/'Updated Name' → `app-container`, then `events-empty-placeholder`); no-name (`unset`, metadata 'Metadata Name' → 'Set your display name' stays, `app-container` and `events-empty-placeholder` absent). `:460/463` split notified (`userId: USER_ID`, `app-container`) / not (`null`, 'Sign in'); both assert `authSessionVersion` and `console.error('[App] Auth check failed:', error)`.
- `a11y/whiteOnColorContrast.test.ts:643,657` → `expect(failingByKey).toEqual(new Map([...KNOWN_BELOW_FLOOR].map(([k,e]) => [k, e.count])))` and `expect(failingStops).toEqual(new Map(KNOWN_GRADIENT_BELOW_FLOOR))` (adapt to the real value shapes).
- `api/checkConstraintMapping.test.ts:285` → ADOPTERS columns `wrapped/outerName/outerCode`: createEvent `true/'EventWriteError'/'transport'`; sendPoke and moodApi.create `false/'SupabaseServiceError'/'23514'`.
- `api/errorHandlers.test.ts:218` → expected-message column (`undefined` → `'Database error:   Injected create failure \n'`; with context → prefixed `'[EventsService.createEvent] '`).
- `components/AdminPanel.accountData.test.tsx:123` → `[['edit','admin-edit-form'],['delete','admin-delete-dialog']]`.
- `config/playwrightReporting.test.ts:35` → expected reporter arrays per flag (`playwright.config.ts:133-140`).
- `services/eventsService.test.ts:430` → `[eventDate, window]` rows `['2026-09-11','past']`, `['2026-09-12','upcoming']`; assert `pagination.todayISO === '2026-09-12'` and the other window `{ hasMore:false, cursor:null }`.
- `services/photoService.idempotency.test.ts:182` → `['23514','Some values are not allowed - check length and format limits']`, `['23502','Upload failed - no photo returned']`.
- `services/swMoodSync.test.ts:90-104` → `fireBackgroundSync` default no longer swallows; `:132` becomes `await expect(fireBackgroundSync()).rejects.toThrow('mood sync lock held by another context')` then its no-write checks; drop now-redundant `{ swallow: false }`.
- `stores/eventsSlice.test.ts:211` → `[kind, perform, expectedEvents]` (add/edit `[saved]`, delete `[]`).
- `stores/interactionsSlice.localCopy.test.ts:480` → `[['sendPoke','sent-poke'],['sendKiss','sent-kiss']]`.
- `stores/interactionsSubscription.test.ts:594` → `await expect(pending).rejects.toThrow('Cannot subscribe: account changed during partner lookup')`; `expect(subscriptions).toHaveLength(0)`.
- `stores/loaderIdentityGuards.test.ts:1901-1912` → rows success `{status:'success'}`/`[aEvent]`/`null`; failure `{status:'failure',error:'CURRENT-SESSION-FAILURE'}`/`[]`/`'CURRENT-SESSION-FAILURE'`.
- `stores/notesSlice.offlineQueue.test.ts:1294` → rows `[delay, upserts, timers]`: 5000/2/1, 10000/3/1, 20000/4/1, 40000/5/1, 60000/6/1, 60000/7/1, 60000/8/0; `until` on every row.
- `stores/notesSlice.sessionGuard.test.ts:395` → `await expect(inFlight).resolves.toBeUndefined()` (stale path returns, `notesSlice.ts:1770-1773`).
- `utils/offlineErrorHandler.test.ts:112` → `rejects.toMatchObject({ name:'OfflineError', operation:'sync-data' })`; `:153` `toEqual({ success:false, offline:true, message:"You're offline. Please check your connection and try again.", retry: fn })`; `:166` `toEqual({ success:false, offline:false, error:new Error('boom'), message:'boom' })`; `:177` `toEqual({ success:false, offline:false, error:new Error('string error'), message:'An error occurred' })`.

### G8 — H3 src (`test(src): table-drive conditional assertions`)
- `src/api/auth/__tests__/authServices.test.ts:172,211,272,300` → tables carrying `sideEffect` (`mockStoreAuthToken`/`mockClearAuthToken`), `session` (`listenerSession`/`null`) and `message` (`'[AuthService] Failed to update stored auth token:'` / `'...clear stored auth token:'`); `:211` two explicit rows with first/second event, session, effect; `:300` split into "resolves" (`errorLog` not called) and "rejects" (`toHaveBeenCalledWith(message, tokenError)`) tables. Apply the same table to the sibling at `:197/:204`.
- `src/components/MoodTracker/__tests__/moodArrayGuards.test.tsx:571` → `[kind, read, expected]`; calendar aria-label `'September 12, 2026 - sad, tired, sad mood. Press enter to view details.'`. `:580` split: history/partner/modal `it.each` with testids `mood-history-item`/`partner-mood-display`/`mood-detail-modal` null; calendar `data-has-mood='false'`; tracker no `'Selected:'`; use `getByRole('textbox')` not `querySelector('textarea')?.value ?? ''`.
- `src/components/Settings/__tests__/EventsSettings.test.tsx` — add helper `regionLabels()` over `events-settings-load-region` h4s (never throws). `:791-908` Unicode describe.each rows (mode, initialEvents, opener, writeAction, otherAction, leadingArgs, savedId `'created-1'`/`'mine'`, labels/descriptions after refusal `[]`/`['Original event']`,`['Original description']`). `:1016-1039` add `expectedError` column (invalid-response gets the full refresh sentence from `EventsSettings.tsx:1156-1158`). `:1299-1531` save-reconciliation rows (kind, initialEvents, opener, writeAction, forbiddenAction, leadingArgs, submitLabel `'Add'`/`'Update'`, labelsAfterRefreshFailure `[]`/`['Original event']`, loadingDuringRetry `true`/`false`, labelsDuringRetry); `:1493` asserts `Boolean(queryByTestId('events-settings-loading'))` equals the column (corrections item). `:1406-1447` rows with `labels` and `emptyText` (`'No events to display in this part of your history.'`/`null`). `:2001-2019` rows edit `events-form-submit`/`events-form-refresh`, delete `events-delete-confirm`/`events-delete-refresh`.
- `.../EventsSettings.focus.test.tsx:319-368` → rows add (`[]`, `addEvent`, `events-settings-empty-add`, openerSurvives false, loading true) / edit (`[makeEvent({id:'mine'})]`, `editEvent`, `event-edit-mine`, true, false); assert both unconditionally (corrections item).
- `.../EventsSettings.lifetime.test.tsx:143-148` helper takes `{ opener, confirm, refresh }` from rows (edit: `event-edit-mine`/`events-form-submit`/`events-form-refresh`; delete: `event-delete-mine`/`events-delete-confirm`/`events-delete-refresh`); `:211-227` add `settledEvents`/`expectedTestId` (`event-row-current` / `events-settings-empty`); `:232-260` unroll 3 steps (loadEvents calls 3,4,5; failure steps: load-error present, retry enabled+focused; success: load-error absent, empty present, `events-settings-add` focused).
- `.../EventsSettings.pagination.test.tsx:163-180` → `notice` column (`null` or the sentence at `EventsSettings.tsx:642-644`); `expect(queryByTestId('events-settings-history-notice')?.textContent ?? null).toBe(notice)`.

### G9 — H3 e2e (`test(e2e): table-drive conditional assertions`)
- `tests/e2e/auth/display-name-setup.spec.ts:318-322` → seed a known chosen name through `supabaseAdmin` (``Prefill ${stamp}``) after `renamed` is recorded and before `goto`; `await expect(field).toHaveValue(seededName)` unconditionally. Keep the afterEach restore.
- `tests/e2e/auth/token-persistence-overlap.spec.ts:42-175` → `sequential` as its own test; the other 5 scenarios loop over a per-scenario table (dispatch list, put/delete/get counts, transaction-created total, action-started list, notification list in order, non-null token labels, checkpoints, finalToken, older/newer, writes). Assert list lengths before every loop (`:62` action-started is the corrections item; also `:74`, `:85`); check close-after-commit only over write dispatches after asserting their count (`db.get` does not await `tx.done`, `src/sw-db.ts:155`); assert token labels before shape. Table values in the investigation are UNVERIFIED — read one run's `<scenario>-native-trace` attachment before pinning. Keep all 6 titles.
- `tests/e2e/errors/check-error-path-consistency.spec.ts:94-162` → `send` as its own test; `accept`/`decline` loop over a table (write URL, button, `requestJson` `{ p_request_id: requestId }`, remaining `[Accept, Decline]`). Send expects `{ from_user_id, to_user_id, status:'pending' }` and remaining `[Send Request]`. Keep titles and annotations.
- `tests/e2e/navigation/theme-sweep.spec.ts:190` → `sweep()` keeps common checks; new `assertNoLightSurfaces` called only from dark tests; generate light and dark tests explicitly. Keep 14 titles/screenshots.
- `tests/e2e/settings/events-history-pagination.spec.ts:39` → `{ POST: 201, PATCH: 200 } as const`; `:125-137` rows `{0, rows 0, empty 1}`, `{50, 50, 0}`; `:166-169` `const [own, partner] = seeded` with ownerId premises, edit counts 1 / 0.
- `tests/e2e/settings/events-persistence.spec.ts:106-135` → split helper into `openAddEventForm`, `pickEventIcon` (always clicks + asserts checked), `fillEventDescription`, `submitNewEvent`; call explicitly.
- `tests/e2e/settings/events-refresh-unmount.spec.ts:170-208` → table `{ id, outcome, statuses:[200,200]/[400,400], ids:(w)=>[w.id] / ()=>[], error:null / injectedLoadError }`.

### G10 — corrections, src vacuous checks (`test(src): make vacuous checks able to fail`)
- `src/hooks/__tests__/useNetworkStatus.test.ts:321-341` → `vi.getTimerCount()` 1 after online event, 0 after unmount (confirm the 1 by running); clearing at `src/hooks/useNetworkStatus.ts:109`.
- `src/hooks/__tests__/useRealtimeMessages.test.ts` — every `subscribeCallback?.(...)` (≈`:481,515,550,584,618,632,905,912,955,979,1024,1084,1121,1168`) → `expect(subscribeCallback).toBeTypeOf('function')` first (or an asserting `emit` helper), then call it without `?.`.
- `src/utils/__tests__/backgroundSync.test.ts:360` → spy `logger.debug`; `toHaveBeenCalledWith('[BackgroundSync] Service Worker completed background sync:', { successCount: 5, failCount: 1 })`; `mockCallback` `toHaveBeenCalledExactlyOnceWith()` (`src/utils/backgroundSync.ts:78-84`).

### G11 — corrections, api (`test(api): assert logged results and real premises`)
- `tests/api/couple-broadcast-authorization.spec.ts:295-300` → `expect(legacyResult).toBe('ok')` and reword `:27-29`, `:291-292` (it pins that `send()` hides the denial; it cannot catch a switch back). `:420-425` → `expect(publicSend).toBe('ok')`. `:430-448` → `expect(restResponse.status).toBe(202)`. `await` any `log.info` left on these lines.
- `tests/api/profile-name-email-ownership.spec.ts:52-62` → `seeded.error` null, `seeded.data` not null, then the premise.
- `tests/api/pkce-code-exchange.spec.ts:178-181` → `toMatchObject({ name:'AuthPKCECodeVerifierMissingError', code:'pkce_code_verifier_not_found', status:400 })`; `:196-199` → `{ name:'AuthApiError', status:400, code:'bad_code_verifier' }` (UNVERIFIED — confirm with a run).

### G12 — corrections, false coverage `tests/e2e/home/error-boundary.spec.ts` (`test(e2e): trigger the view error boundary`)
- Replace both bodies (duplicates of `home/routing.spec.ts`). Trigger via `page.route('**/src/components/PhotoGallery/PhotoGallery.tsx*', …)` (dev server, `playwright.config.ts:178`; boundary `src/components/ViewErrorBoundary/ViewErrorBoundary.tsx`, wraps lazy views at `src/App.tsx:821-840`). Test A: `route.abort()` → `view-error-boundary` visible with heading "Can't load this page offline", `nav-dock` visible, `error-go-home` → `time-together` visible. Test B: fulfill `text/javascript` body `throw new Error("E2E forced view failure")` → heading `Error loading photos` and that message. Do not assert Try Again recovers (React.lazy caches the rejection). Rewrite the header comment.

### G13 — corrections, false coverage `tests/e2e/auth/login.spec.ts:143` (`test(e2e): sign in before checking session persistence`)
- Rewrite: worker pair via `getWorkerPairEmails()` (`tests/support/auth/worker-pool.ts:104`), password `TEST_USER_PASSWORD`, suppress splash via `lastWelcomeView`, sign in through the form as `account-data.spec.ts:94-101`; expect `app-container` visible, `login-screen` count 0, stored session user (`sb-127-auth-token`, pattern at `auth/implicit-fragment-rejection.spec.ts:21,58`) equals the worker `userId`; `page.reload()`; assert all three again.

## Tasks & Acceptance

**Execution:**
- G1–G13 in order, one commit per group, each file edited per the Code Map above.
- `_bmad-output/specs/spec-test-review-remediation/stories/1-make-every-test-able-to-fail.md` -- append `## Critical Break Evidence` for G1–G4 -- proves each CRITICAL fix can fail.

**Acceptance Criteria:**
- Given any fixed C3 test, when its named source line is broken as the Code Map says, then that test fails; restored, it passes.
- Given every H3 row, when the file is read, then no `if`, `else` or ternary on a case parameter selects what is asserted or its expected value.
- Given every H10 row, when read, then the assertion constrains a value (literal, exact message/code, or identity), not only type/class/truthiness/bare `toThrow()`.
- Given the corrections items in G3, G7 (swMoodSync), G10–G13, when the behaviour they name breaks, then the test fails (no log-only result, swallowed rejection, optional-chained stimulus or undefined===undefined premise remains).
- Given the finished branch, when lint, typecheck and affected suites run, then all pass (typecheck may show only the worktree's pre-existing TS2883 errors in `tests/support/merged-fixtures.ts`).

## Spec Change Log

## Review Triage Log

### 2026-09-25 — Review pass
- verdicts: 34 findings — high 0, medium 1, low 16, false 16, maybe-false 1
- findings:
  - `[low]` `[patch]` Blind: useRealtimeMessages doc comment now sits on the new type, not validNote — moved the type and emitStatus helper above the comment (a3c51f31).
  - `[medium]` `[patch]` Blind: check-error-path `expect(remaining).toHaveLength(2)` asserts a test-local constant — dropped the column and length check; Accept/Decline asserted directly (a3c51f31).
  - `[low]` `[patch]` Blind: error-boundary titles no longer describe the bodies — retitled both tests to what they prove (a3c51f31).
  - `[low]` `[patch]` Blind: error-boundary header says the dock "stays usable" but only visibility is checked — reworded to "stays visible" (a3c51f31).
  - `[low]` `[patch]` Blind: offlineMessageHonesty title claims "every importer" but importedNames reads only named imports — title and comment narrowed to named importers (a3c51f31).
  - `[low]` `[defer]` Blind: customMessageService deviation from the Code Map unrecorded and planImport's version check is dead — the test is correct (schema refuses 2.0 first, src/validation/schemas.ts:139); the dead guard is pre-existing and deferred; recorded in Auto Run Result.
  - `[low]` `[reject]` Blind: story file does not record departures (14th commit, moodNormalization `(%s)` retitle) — fix edits the spec; recorded in Auto Run Result instead; the `(%s)` suffix is needed for distinct it.each names and changes no behaviour.
  - `[false]` `[reject]` Blind: CRITICAL evidence uncommitted and UNVERIFIED values unconfirmed — the story file is committed at finalize; pkce, useNetworkStatus and token-persistence values were confirmed by runs (51 Playwright passed; 2770 unit passed; token-persistence 30/30 in the implementer's run).
  - `[low]` `[defer]` Blind: authServices console.error spy leaks if a test fails — pre-existing restore-at-end pattern; cleanup-on-failure is story 4.
  - `[low]` `[patch]` Blind: EventsSettings reconcile test still picks its input with a hasSavedRow ternary — added a refreshedEvents column (a3c51f31).
  - `[low]` `[patch]` Blind: haptics reads calls[0][0] without checking call count — added toHaveBeenCalledTimes(1) before each read (a3c51f31).
  - `[low]` `[patch]` Blind: checkConstraintMapping identity check fails with no context and lost `cause` — cause identity is implied (mappedErrorOf returns error.cause, :163-165); added an explicit expect message (a3c51f31).
  - `[medium]` `[patch]` Edge: check-error-path `remaining` length check cannot fail — same root cause as the Blind finding; patched there.
  - `[low]` `[patch]` Edge: offlineMessageHonesty scan misses namespace/default+named/re-export imports — same root cause as the Blind title finding; title narrowed.
  - `[low]` `[patch]` Edge: backgroundSync logger.debug spy leaks if setup throws before the try — try now starts right after spyOn (a3c51f31).
  - `[low]` `[reject]` Edge: login.spec hard-codes `sb-127-auth-token` — matches the existing precedent in auth/implicit-fragment-rejection.spec.ts and .env.test's fixed 127.0.0.1; deriving it adds logic for a host no config uses.
  - `[low]` `[reject]` Edge: error-boundary route only matches the Vite dev module path — playwright.config.ts always starts the dev server and no workflow sets BASE_URL; against a bundle it fails loudly, not vacuously.
  - `[low]` `[patch]` Edge: whiteOnColorContrast message blames an allowlist entry when a new unlisted failure appears — both messages reworded to cover both cases (a3c51f31).
  - `[low]` `[defer]` Edge: customMessageService pins the schema message, planImport check is dead — grouped with the Blind finding; deferred.
  - `[low]` `[patch]` Edge: EventsSettings hasSavedRow ternary still chooses input — grouped with the Blind finding; patched.
  - `[false]` `[reject]` Edge: login.spec rewrite removed signed-out reload coverage — still covered by login.spec.ts:14 (signed-out load) and auth/logout.spec.ts:104-106 (reload after sign-out shows login).
  - `[medium]` `[patch]` VerificationGap other: check-error-path `remaining` length check can never fail — grouped; patched.
  - `[low]` `[defer]` VerificationGap other: customMessageService version check unreachable — grouped; deferred.
  - `[false]` `[reject]` Intent: offlineMessageHonesty length checks still compare literals — the same test now also asserts the src importer scan, so it no longer asserts only on its own literals; corrections.md sanctions keeping the guard.
  - `[false]` `[reject]` Intent: LoveNoteMessage observes a useState spy rather than React output — React 19 emits no unmounted-update signal; the setter spy is the repo's precedent (EventsSettings.lifetime) and each guard break made its test fail.
  - `[false]` `[reject]` Intent: couple-broadcast pins an SDK quirk — corrections.md's defect was that the send() difference was only logged; it is now asserted and the header no longer overclaims.
  - `[low]` `[patch]` Intent: error-boundary titles mismatch (and dev-server-only trigger) — titles patched with the Blind finding; the dev-server part rejected as in the Edge finding.
  - `[false]` `[reject]` Intent: CRITICAL evidence stored as uncommitted prose — committed with the story file at finalize.
  - `[low]` `[defer]` Intent: two expected values sit at a different layer than the Code Map (customMessageService schema message, moodNormalization RangeError) — both are the real observables; moodNormalization is in Design Notes; the dead guard is deferred.
  - `[false]` `[reject]` Intent: checks moved to global/instrumentation layers (getTimerCount, logger.debug, storage key) — each fails when its named behaviour breaks (useNetworkStatus break verified: "expected 1 to be +0").
  - `[maybe-false]` `[defer]` Intent: A3 leftovers (stale deviation comment, interactionsSubscription microtask drains) — owned by stories 6 and 2; both deferred, the drain one as medium (unverified).
  - `[low]` `[reject]` Intent: placeholder rewrites overlap existing coverage and names are generic — corrections.md directs real assertions against the named function; renaming is story 8 (L5).
  - `[false]` `[reject]` Intent: case-parameter branches remain in setup (moodArrayGuards display(), App.eventsSession :497) — they choose setup, not what is asserted, and the original review did not flag them.
  - `[false]` `[reject]` Intent: lint/typecheck/suite runs unrecorded — recorded in Auto Run Result below.

## Design Notes

- `src/utils/moodGrouping.ts:66` `getDateLabel` divides elapsed ms by 86400000 from local midnight, so just after spring-forward it labels yesterday "Today". Story 1's rewritten tests avoid DST dates; the bug is deferred (story 2 owns the DST row at `src/utils/__tests__/moodGrouping.test.ts:8`).
- `moodSyncPayload.ts:62-63` never fires for `new Date('bad')`; `toISOString` throws first. The test pins the real observable (RangeError), not the unreachable guard message.
- H3 table shape example:
  ```ts
  it.each([
    ['23514', 'Some values are not allowed - check length and format limits'],
    ['23502', 'Upload failed - no photo returned'],
  ])('routes %s through the real service into the store result', async (code, message) => {
    // ... same body, no ternary
    expect(result).toMatchObject({ error: message });
  });
  ```

## Verification

**Commands:**
- `npm run lint` -- expected: exit 0.
- `npm run typecheck` -- expected: no errors other than TS2883 in `tests/support/merged-fixtures.ts`.
- `npx vitest run <each changed unit/src test file>` then `npm run test:unit` -- expected: all pass.
- `npx playwright test <each changed e2e/api spec>` (local Supabase is running) -- expected: all pass; api specs run in the `api` project.
- `deno` is not needed (no Edge Function test changed).

## Critical Break Evidence

Each break was applied to the working tree only, run, then restored from a copy (`git diff --stat` empty for the source file afterwards) and re-run green. No break was committed.

**G1 — `dateFormat.test.ts`** (`npx vitest run tests/unit/utils/dateFormat.test.ts`)
- Break: `formatDateISO` body in `src/utils/dateUtils.ts` → `return date.toISOString().split('T')[0];`
- Both tests fail: `tests/unit/utils/dateFormat.test.ts:19:58` `expected '2026-09-26' to be '2026-09-25'`; `:27:65` `expected '2026-03-08' to be '2026-03-07'`. Restored: 2 passed.

**G1 — `moodGrouping.test.ts`** (`npx vitest run tests/unit/utils/moodGrouping.test.ts`)
- Break: `src/utils/moodGrouping.ts` `date.toDateString()` → `date.toISOString().slice(0, 10)`. "should group moods by date" fails at `tests/unit/utils/moodGrouping.test.ts:47:20` `expected [ …(3) ×2 ] to deeply equal [ …(3) ×3 ]`.
- Break: early `if (moods.length === 0) return [{ date: new Date(), dateLabel: 'Today', moods: [] }];`. "should handle empty mood arrays" fails at `:58:34` `expected [ { …(3) } ] to deeply equal []`. Restored: 2 passed.

**G2 — `offlineMessageHonesty.test.ts`** (`npx vitest run tests/unit/api/offlineMessageHonesty.test.ts`)
- Break: add `import { handleNetworkError } from '../api/errorHandlers';` to `src/utils/moodGrouping.ts`.
- "covers every module in the list and finds every importer in src" fails at `tests/unit/api/offlineMessageHonesty.test.ts:159:25` `expected [ 'src/api/moodApi.ts', …(3) ] to deeply equal [ 'src/api/moodApi.ts', …(2) ]`. Restored: 11 passed.

**G3 — `LoveNoteMessage.test.tsx`** (`npx vitest run src/components/love-notes/__tests__/LoveNoteMessage.test.tsx`)
- Break `LoveNoteMessage.tsx` text guard → `{(sanitizedContent || hasImage) && (`: "should render image-only message without text bubble" fails at `:695:58` `expected document not to contain element, found <p class="text-[15px] …">`.
- Break signed-URL guard `if (isMounted && ownsSession())` → `if (true)`: "during signed URL fetch" fails at `:765:36` `expected "vi.fn()" to not be called at all, but actually been called 4 times`.
- Break retry guard `if (isMountedRef.current)` (after the refreshed `getSignedImageUrl`) → `if (true)`: "during error retry" fails at `:820:36` `… been called 2 times`.
- Break catch guard `if (isMounted)` → `if (true)`: "when fetch fails" fails at `:858:36` `… been called 2 times`.
- Restored: 39 passed.

**G4 — `haptics.test.ts`** (`npx vitest run src/utils/__tests__/haptics.test.ts`)
- Break `src/utils/haptics.ts:65` → `navigator.vibrate(80)`: "save haptic (50ms) is longer than selection haptic (15ms)" fails at `src/utils/__tests__/haptics.test.ts:155:33` (now `:157:33` after the review patch added a call-count check) `expected 80 to be 15`.
- Break error pattern → `[100, 60, 100]`: "error haptic has distinctive pattern different from success" fails at `:170:25` (now `:172:25`) `expected [ 100, 60, 100 ] to deeply equal [ 100, 50, 100 ]`.
- Restored: 10 passed.

## Auto Run Result

Status: done

**Summary:** Every C3, H3 and H10 row in findings-e2e/src/unit (api and cross-cutting have none) and the story-1 corrections items (log-only checks, swallowed errors, vacuous premises, false-coverage specs) now assert values the code under test produced, with expected values in parameter tables instead of if/ternary. The only app change is `data-testid="love-note-text"` in `LoveNoteMessage.tsx`. No corrected test exposed an app bug.

**Commits (15):** G1 e386b28a, G2 fc84e1ef, G3 081834e2, G4 ce6abb82, G5 f322c976, G6 cce552db, G7 dfb65e06, G8 759c53f9, G9 07cd898c, G10 4bf09447, G11 cc0659b7, G12 6b4e80e8, G13 c87db052; plus 2015ce9e (offlineErrorHandler online-success guard found while verifying) and a3c51f31 (review patches).

**Files changed (57):** unit and src Vitest files per the Code Map; e2e: display-name-setup, login, token-persistence-overlap, check-error-path-consistency, error-boundary, theme-sweep, events-history-pagination, events-persistence, events-refresh-unmount; api: couple-broadcast-authorization, pkce-code-exchange, profile-name-email-ownership; app: `src/components/love-notes/LoveNoteMessage.tsx` (test id).

**Departures from the Code Map:** `customMessageService.ownership` pins the schema's "Invalid version. Please select a valid option." (planImport's own check is unreachable — deferred); the moodArrayGuards tracker row clicks `mood-add-note-toggle` before reading the textbox; `moodNormalization` title gained a `(%s)` suffix for it.each.

**Review:** 34 findings — patched 13 rows in 9 fixes (1 medium, 8 low entries), deferred 5 items (4 from review, 1 from planning), rejected 16 (reasons in the triage log). Patched counts by entry verdict: high 0, medium 1, low 8. Follow-up review recommended: false (no high, fewer than two medium patched).

**Verification:** `npm run lint` exit 0; `npm run typecheck` exit 0, no errors; `npm run test:unit` 2770/2770 passed; `npx playwright test` on the 11 changed e2e/api specs (excluding token-persistence) 51 passed; token-persistence-overlap 6/6 and 30/30 with `--repeat-each=5` in the implementer's run. CRITICAL break evidence is above.

**Residual risks:** `token-persistence-overlap.spec.ts` lists no tests when run inside a loop worktree (it reads package versions from `<worktree>/node_modules`, which does not exist); it runs normally in CI and the main checkout. Its pinned table came from observed traces, so a future SDK or idb change will fail it by design.

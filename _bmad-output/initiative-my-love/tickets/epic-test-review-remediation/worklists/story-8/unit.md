# Story 8 plan: tests/unit (66 rows)

Tally: 66 rows. 1 already fixed. 2 are false positives, each fixed with a harmless change. 8 suite rows duplicate folder rows and are fixed once with them. Every other row needs a fix. Line numbers are current (worktree at 744ef0f7).

### tests/unit/App.callbackNotice.test.tsx
- L3 ~237 `expect(screen.getByText('Loading...')).toBeInTheDocument()` → `expect(screen.getByTestId('auth-loading-screen')).toBeInTheDocument()` [app hook: src/App.tsx:579 outer `<div className="flex min-h-screen …">` of the `authLoading` branch, add data-testid="auth-loading-screen"]

### tests/unit/App.eventsSession.test.tsx
- L3 ~221 `expectKitPlaceholder`: `placeholder.querySelector('p')` → `within(placeholder).getByTestId(\`${testId}-message\`)`, still `.toHaveClass('text-muted')`. Add `within` to the `@testing-library/react` import. [app hooks: src/App.tsx:782 `<p>` inside `events-load-error` add data-testid="events-load-error-message"; src/App.tsx:793 `<p>` inside `events-empty-placeholder` add data-testid="events-empty-placeholder-message"]
- M3 + L3 ~259 'installs the initial authenticated session when no notification supersedes it': add a describe-local helper `renderPendingLookup()` that sets up the `lookup` deferred and `auth.getSession.mockReturnValueOnce`, calls `controlHomeLoads()`, captures `ownership`, renders `<App />`, and returns `{ lookup, requests, loadEvents, ownership }`. Split into three tests:
  - 'shows the kit heart, not an emoji, on the auth loader while the session lookup is pending': `const loader = screen.getByTestId('auth-loading-screen')`; `expect(within(loader).getByTestId('auth-loading-icon')).toHaveClass('text-accent')`; `expect(loader.textContent).not.toMatch(/\p{Extended_Pictographic}/u)`. [app hook: src/App.tsx:581 `<Heart>` add data-testid="auth-loading-icon"]
  - 'installs the initial authenticated session when no notification supersedes it': `getByTestId('auth-loading-screen')` present, then resolve; `queryByTestId('auth-loading-screen')` absent, `app-container` present, the store `toMatchObject({ userId, isAuthenticated, authSessionVersion: ownership + 1 })`.
  - 'loads Home events once for the installed session and shows the result': resolve the lookup, `loadEvents` toHaveBeenCalledTimes(1), resolve `requests[0]`, `events-empty-placeholder` present.
- L3 ~522 'App data loader' test: `screen.getByText('Loading your data...').parentElement!` + `querySelector('svg')` → `const loader = screen.getByTestId('app-data-loading-screen')`; `expect(within(loader).getByTestId('app-data-loading-icon')).toHaveClass('text-accent')`; keep the emoji check on `loader.textContent`. [app hooks: src/App.tsx:632 outer div of the `isLoading` branch add data-testid="app-data-loading-screen"; src/App.tsx:634 `<Heart>` add data-testid="app-data-loading-icon"]. The `queryByText('Loading...')` at ~518 can become `queryByTestId('auth-loading-screen')` in the same edit.
- L1 ~698/708/709/713 'does not re-open setup when a read raised before the name was saved lands after': switch the setup lookups to `screen.getByRole('button', { name: 'Set your display name' })` and `queryByRole(...)`. The mock at ~95 renders a `<button>`, so the role query matches it. The click at 708 is the flagged line; convert all four in this test for consistency.

### tests/unit/App.localCopyRefresh.test.tsx
- L1 ~250 `await screen.findByText('Set your display name')` → `await screen.findByRole('button', { name: 'Set your display name' })`. The mock at ~95 renders a `<button>`.

### tests/unit/api/interactionService.test.ts
- L5 ~378 'is re-thrown ahead of logSupabaseError, so it is not logged as a Supabase failure' → 'reports the empty body without logging it as a Supabase failure'. Keep the comment.
- L5 ~475 'still maps a send through handleSupabaseError, unchanged' → 'tells the sender a denied send is a Row Level Security permission failure'

### tests/unit/components/AdminPanel.accountData.test.tsx
- L1 ~85 `row()` helper: `screen.getByText(text).closest('tr')!` → `screen.getByRole('row', { name: new RegExp(text) })`. `MessageRow` renders a `<tr>`, and dom-accessibility-api takes a row's name from its contents (the `allowsNameFromContent` list includes `row`). Every caller's text is regex-safe ('Account A message', 'Account B message').
- M3 ~119 it.each 'isolates A/B/A lists and removes the outgoing %s preview' (dedupes suite row 243). Split into three tests:
  - it.each (same table) 'isolates A/B/A lists and removes the outgoing %s preview': every UI assertion. Initial `getAllByText` length 1; preview open; after `switchAccount(B)`, A's text gone, both previews gone, B's text shown; after `switchAccount(A)`, B's text gone.
  - "deletes the outgoing account's saved copy on each switch and keeps the incoming one's": `switchAccount(B)`, then `waitFor(readMessageData(A) null)` and `diskRow(bId, B)` defined; `switchAccount(A)`, then `waitFor(readMessageData(B) null)`.
  - "lists A's own row once after switching back and refreshing from the server": `switchAccount(B)`, `switchAccount(A)`, the `fetchCustomMessages.mockResolvedValueOnce` block, both loads, `getAllByText('Account A message')` length 1.
- M3 ~150 'keeps deletion pending, prevents dismissal and duplicate submits, then closes after persisted success'. Add a helper `openGatedDelete(user)` that renders `panel()`, sets `currentMessage`, sets up the gated `deleteRemote` spy, clicks the row delete button, then clicks confirm. It returns `{ gate, remove }`. Split into three tests:
  - 'keeps the delete dialog busy and undismissable while the delete is in flight': click cancel and the backdrop, `waitFor(remove called)`, dialog `aria-busy="true"`, cancel disabled, `diskRow(aId)` still defined.
  - 'sends a single delete for repeated confirm clicks': click confirm a second time, `waitFor(remove toHaveBeenCalledTimes(1))`, resolve the gate, wait for the dialog to close, `remove` still called once.
  - 'closes and removes the row from disk, store and list after the server accepts the delete': resolve the gate, `waitFor` the dialog to go, `diskRow` undefined, store has no `aId`, `queryByText` null, `currentMessage.text` 'Shared daily'.
- L1 ~282 `screen.queryByText('Not yet', { selector: 'td' })` toBeNull → `expect(screen.getAllByTestId('message-row-text').map((cell) => cell.textContent)).not.toContain('Not yet')`. `message-row-text` is at MessageRow.tsx:43, and the table is present because A's row exists.

### tests/unit/components/DailyMessage.favoriteError.test.tsx
- L3 ~91 `chip.querySelector('svg.lucide-heart')` not null → `expect(within(chip).getByTestId('message-category-icon')).toHaveClass('lucide-heart')`. This keeps the heart-specific check. Import `within`. [app hook: src/components/DailyMessage/DailyMessage.tsx:286 `<categoryChip.Icon …>` add data-testid="message-category-icon"]

### tests/unit/components/LoginScreen.callbackNotice.test.tsx
- already fixed: row :117 L1 `querySelector('form')`. The test at ~113-117 now clicks `getByTestId('submit-button')` (story 5, df12601d), and no `querySelector`/`form` lookup remains in the file.

### tests/unit/config/playwrightReporting.test.ts
- M3 ~53 'connects shard blob production and upload to the matching merge inputs' (dedupes suite row 269). Hoist `const workflow = readFileSync('.github/workflows/test.yml', 'utf8')` and `job(name)` into describe scope, or a `workflowJob(name)` helper. Split per job:
  - 'e2e-tests: each of the 2 shards writes a blob report and uploads it under its shard name': the 5 `shards` assertions (name, `shard: [1, 2]`, `E2E_BLOB_REPORT … --shard`, artifact name, path/if-no-files/retention).
  - 'e2e-tests: the shard-count comment cites both measurement runs': `SHARD_MEASUREMENT_RUN_ID` and `HISTORICAL_BASELINE_RUN_ID`.
  - 'merge-reports: downloads every shard blob, requires both, and uploads the merged HTML report': the 8 `merge` assertions.
  - 'burn-in: runs its own 3-shard matrix without blob reports': the 2 `job('burn-in')` assertions.
  - 'test.yml no longer references the removed scripture specs': the 2 workflow-wide `not.toContain` checks.

### tests/unit/hooks/usePhotoImage.test.ts
- M3 ~124 'online and not cached: downloads, caches under the refusal rule, shows it'. Split into two tests:
  - 'online and not cached: downloads the image and shows it': `waitFor` status 'ready'; `downloadPhoto` calledWith PATH.
  - 'online and not cached: caches the download under the refusal rule for the current session': `waitFor` status 'ready', `cachePhotoImage` called once, and the session/path/blob assertions (userId, `isCurrent()`, `photos()`, path, blob text).

### tests/unit/services/accountDataApis.test.ts
- L5 ~120 it.each name `'%s'` → `'%s refuses offline with an AccountDataError before any request'`

### tests/unit/services/coupleSettingsService.test.ts
- L7 ~159 (false positive; this change stops the rule firing): 'saveStartDate refuses offline before any request' replaces the `.catch((error) => error)` capture with the file's `rejects` dialect and keeps the instance check. Code: `const refusal = coupleSettingsService.saveStartDate(LOW, HIGH, '2025-10-04T22:00:00.000Z'); await expect(refusal).rejects.toBeInstanceOf(AccountDataError); await expect(refusal).rejects.toMatchObject({ code: 'offline' }); expect(calls).toHaveLength(0);`. It is one call, awaited twice.

### tests/unit/services/dbSchema.test.ts
- L1 ~1030 `clickDialogButton` (dedupes suite row 282): body → `await user.click(within(dialog).getByRole('button', { name }))`. `getByRole` throws if the button is missing, which replaces the `toBeDefined` check. Add `import { within } from '@testing-library/react'`. The buttons are plain `<button>` elements with text (dbSchema.ts:566, :576).
- L5 ~1218 'should have correct indexes on core stores' → 'indexes messages by category and date but not by user, and moods by user and date'
- L5 ~1239 'should have correct core store names' → 'names the core stores messages, moods, sw-auth, local-copies, image-cache and note-queue'
- L5 ~1252 'should export correct database name' → "names the database 'my-love-db'"
- L5 ~1256 'should export correct database version' → 'is at schema version 15, after custom messages moved onto the message-data copy'

### tests/unit/services/moodNormalization.test.ts
- M3 ~59 'returns independent display copies and equivalent fingerprints without changing raw data'. Add a helper `legacySource()` that returns `{ source: raw('unknown', ['sad', null, 'sad']), before: structuredClone(source) }`. Split into three tests:
  - 'returns a display copy that shares no arrays with the raw entry': display is not source, `display.moods` is not `source.moods`, push to `display.moods`, source toEqual before.
  - 'builds the sync payload from the normalized moods without changing the raw entry': `moodSyncPayload` toMatchObject, then source toEqual before.
  - 'fingerprints the raw and display entries identically': fingerprint equality, then source toEqual before.
- M3 ~80 'normalizes scoped display reads while keeping raw invalid rows in both pending queues' (dedupes suite row 289). Add a helper `seedMixedRows()` that returns `{ mixed, hidden, other }` from the three `seedRaw` calls. Split into four tests:
  - "shows only the recognized moods of A's rows in A's display reads": `getAllForUser(A)` ids, `getMoodForDate` 15 and 14, `getMoodsInRange` length 1.
  - "returns another account's row only to that account's display read": `getAllForUser(B)` ids equal `[other.id]`.
  - 'returns raw rows unchanged from get()': `get(mixed.id)`, `get(hidden.id)`.
  - 'keeps raw invalid rows in both pending queues': `getUnsyncedMoods(A)` and `getPendingMoods(A)` ids.
- M3 ~115 'serializes concurrent saves on one owner/date and preserves UI validation errors' (dedupes suite row 290). Split into four tests:
  - 'serializes concurrent saves on one owner/date into one row': the first 3 assertions.
  - 'refuses an empty mood list with a UI validation error': `rejects.toSatisfy(isValidationError)`.
  - 'refuses a save with no owner': `saveForDate('', …)` `rejects.toThrow()`.
  - "refuses B's edit of a date only A has saved": first `await moodService.saveForDate(A, date, ['sad'])`, then `saveForDate(B, date, ['happy'], '', true)` `rejects.toThrow('not found')`. The seed keeps the original state, where A's row exists.
  - The three refusals use different matchers, so write them as three `it`s rather than an `it.each`.

### tests/unit/services/moodService.test.ts
- L5 ~31 'creates a mood entry with correct fields' → "creates an unsynced entry for the user with the mood as primary and today's date"

### tests/unit/services/photoService.idempotency.test.ts
- M3 ~180 it.each 'routes %s through the real service into the store result'. Add a helper `storeWithFailingInsert(code)` that creates the store, sets userId, sets `backend.errorCode = code` and `backend.failNextInsert = true`, and returns the store. Keep the same `[code, expected]` table and split into three it.each tests:
  - 'routes %s through the real service into the store result': result toEqual `{ success: false, error: expected }` and store `error` is expected.
  - 'rolls back the stored object and row after a %s failure': first failing upload, then `objects.size` 0 and `rows` length 0.
  - 'a retry under the same key after a %s failure lands one row': first failing upload, retry resolves `{ success: true }`, `rows[0].storage_path`, `rows` length 1.

### tests/unit/services/swMoodSync.test.ts
- M3 ~200 'sends normalized values while retaining failure accounting for invalid siblings'. Wrap it in `describe('a batch with one invalid sibling')` with a helper `syncMixedBatch()`. The helper builds invalid/valid, mocks `getPendingMoods`, `fetchMock` and `matchAll`, awaits `fireBackgroundSync()`, and returns `{ invalid, valid, postMessage }`. Split into four tests:
  - 'reports one success and one failure to the open clients': postMessage.
  - 'sends only the valid mood, with normalized values': fetch once plus the body toMatchObject.
  - 'marks only the valid mood synced, under its fingerprint': `markMoodSynced` times 1 plus calledWith.
  - 'leaves the invalid source row unmodified': `invalid.mood` is 'unknown'.

### tests/unit/stores/accountDataSlices.test.ts
- M3 ~711 'offline: shows the reason, changes nothing, and sign-out clears the message'. Add a helper `failFavoriteOffline()` that seeds, mocks the rejection, silences console.error, and runs `toggleFavorite`. It returns the id. Split into two tests:
  - 'offline: shows the reason and changes nothing': `favoriteError` /offline/, `copyOf(A)` null, `favoriteIds` does not contain the id.
  - 'offline: sign-out clears the favorite error': precondition `favoriteError` /offline/, then `clearAuth()`, then `favoriteError` null.

### tests/unit/stores/eventsSlice.test.ts
- M3 ~153 'keeps rows and cursors on failure, retries the same page, and isolates write errors' (suite row 304). Add a helper `failFirstHistoryPage()` that creates the store, sets events/pagination, rejects once, and awaits `loadMoreEvents()`. It returns `{ store, initialEvents, initialPagination, result }`. Split into three tests:
  - 'keeps rows and cursors on a failed page and reports it as the history error': result is failure, events toBe initial, pagination toBe initial, `eventsError` null, `eventsHistoryError` 'history failed'.
  - 'a failed write does not touch the history error': the `createEvent` rejection plus `addEvent`, then `eventsHistoryError` is still 'history failed'.
  - 'retries the same page after a failure and clears the history error': resolve once, `loadMoreEvents`, calls equal `[[initialPagination],[initialPagination]]`, `eventsHistoryError` null, `eventsIsLoadingMore` false.

### tests/unit/stores/interactionsSlice.localCopy.test.ts
- L5 ~416 'registers loadInteractionHistory(100) as the kind refresher' → 'refreshing the interactions copy brings the last 100 interactions into the list, the unviewed count and the saved copy'

### tests/unit/stores/interactionsSubscription.test.ts
- M3 ~126 'forwards every service status and keeps isSubscribed aligned through recovery' (dedupes suite row 307). Add a helper `subscribe(store, onStatusChange = vi.fn())` that returns `{ unsubscribe, subscription: subscriptions[0] }`. Split into three tests:
  - 'subscribes for the signed-in user and forwards every service status, keeping isSubscribed aligned through recovery': `subscription.userId`, initial false, then SUBSCRIBED, CHANNEL_ERROR, TIMED_OUT and SUBSCRIBED with each isSubscribed check, and the `onStatusChange.mock.calls` list.
  - 'maps a delivered record into interactions and counts it unviewed': `reportStatus('SUBSCRIBED')`, `reportInteraction`, the mapped toEqual, `unviewedCount` 1.
  - 'unsubscribing tears down the service subscription and clears isSubscribed': `reportStatus('SUBSCRIBED')`, precondition isSubscribed true, `unsubscribe()`, `subscription.unsubscribe` called once, isSubscribed false.

### tests/unit/stores/loaderIdentityGuards.test.ts
- M3 ~1212 describe 'importCustomMessages' › 'stamps the imported rows with A and never writes under C'. Add a helper `importAcrossSwitchToC()` covering everything through `creating.settle(...)`; it returns `inFlight`. Split into four tests:
  - "still reports the import result to the caller after a switch to C": `await expect(inFlight).resolves.toEqual({ imported: 1, skipped: 0 })`.
  - 'stamps the imported rows with A, captured before the switch': `await inFlight`, then `customCreate` calledWith A.
  - "judges duplicates against A's copy, never C's": `await inFlight`, then `readLocalCopy` not called with (C, 'message-data').
  - "leaves C's lists and saved copy untouched": `await inFlight`, then `customMessages`, `messages` and `messageDataWrites()` [].
- The describe 'when the identity has not changed' (~2138) has ten "writes normally" names. Exact renames:
  - L5 ~2139 'loadPartner writes normally' → "a partner load shows the linked partner and saves it to the account's partner copy"
  - L5 ~2152 'fetchNotes writes normally' → "a notes fetch shows the account's notes and stops loading"
  - L5 ~2163 'loadMessages writes normally' → "a messages load shows the bundled pool plus the account's saved custom message"
  - L5 ~2175 'loadCustomMessages writes normally' → "a custom-messages load lists the account's saved custom message and marks the list loaded"
  - L5 ~2186 'createCustomMessage writes normally' → "a created custom message is listed, saved to the account's copy, and the rotation pool re-read"
  - L5 + M3 ~2203 'updateCustomMessage and deleteCustomMessage write normally'. Add a helper `loadACustomMessage()` that calls `savedMessageData({ [A]: aCopy() })` and awaits `loadCustomMessages()`. Split into two tests:
    - "an edited custom message shows its new text and is saved to the account's copy": mock the update, `updateCustomMessage`, `customMessages[0].text` is 'A-EDITED', `messageDataWrites()` toHaveLength(1).
    - "a deleted custom message leaves the list and the account's copy is saved": mock the delete, `deleteCustomMessage(7)`, `customMessages` [], `messageDataWrites()` toHaveLength(1).
    - The original combined count of 2 becomes 1 per action, which is stricter.
  - L5 ~2239 'importCustomMessages writes normally' → "an import reports one imported row, saves it to the account's copy and re-reads the rotation pool"
  - L5 ~2252 'loadEvents writes normally' → "an events load shows the account's events and stops loading"
  - L5 ~2261 'uploadPhoto writes normally' → "an uploaded photo resolves success and joins the gallery as the account's own, with no signed URL"
  - L5 ~2339 'deletePhoto writes normally' → 'a deleted photo leaves the gallery'

### tests/unit/stores/notesSlice.idempotency.test.ts
- M3 ~216 'shows CHECK failure for send and retry, then clears it on success with the same key and blob' (dedupes suite row 319). Add two helpers:
  - `failCheckSend(store)` mocks the upload, sets `failNextWrite` and `writeError = checkError`, awaits `sendNote('hello', file)` resolving undefined, and returns `notes[0]`.
  - `failCheckRetry(store, failed)` sets `notesError` null and `failNextWrite`, then awaits a retry resolving undefined.
  - Split into four tests:
  - 'a CHECK failure on send marks the note failed, keeps its image and shows the friendly banner': `failed.error` true, `imageBlob` defined, `notesError` friendly.
  - 'a CHECK failure on send deletes the uploaded image': `deleteLoveNoteImage` calledWith `${USER_ID}/image.jpg`.
  - 'a CHECK failure on retry shows the banner again and keeps the same image blob': send fail, then retry fail; `notesError` friendly, `notes[0].imageBlob` toBe `failed.imageBlob`.
  - "a retry that lands clears the banner and stores one row under the note's tempId": send fail, retry fail, `writeError = null`, retry; `notesError` null, rows 1, `idempotency_key` is tempId, `notes[0].error` false.

### tests/unit/stores/notesSlice.offlineQueue.test.ts
- M3 ~395 'reconnect: the queue is sent in order, each once, into state and copy, and each is broadcast'. This is the false positive: it asserts one invariant, a delivered queue. To stop the rule firing, move the assertions after `drainQueuedNotes()` into a named helper, `async function expectQueueDeliveredOnceInOrder(store, keys)`, next to `sendThreeOffline`. The test body becomes arrange, act, then `await expectQueueDeliveredOnceInOrder(store, keys)`. Every assertion is kept, including the `vi.waitFor` on `copyIds`.
- M3 ~772 'server rejection: the note is marked failed with the banner, later notes still send, and Retry resends under the same key' (dedupes suite row 324). Add a helper `rejectFirstOfThree()`: `sendThreeOffline`, `failedKey`, `setOnline(true)`, `outcomes = [{ reject: '23514' }]`, await drain. It returns `{ store, failedKey }`. Split into four tests:
  - 'server rejection: the note and its queue row are marked failed, with the banner': `notes[0]` toMatchObject, `notesError` FRIENDLY_CHECK, `listQueuedNotes(A)` failed row.
  - 'server rejection: the notes after the rejected one still send': `rows` contents are ['two','three'].
  - 'server rejection: a later trigger does not resend the failed note': drain again, `upserts` is 3.
  - 'server rejection: Retry resends under the same key and clears the failure': `retryFailedMessage(failedKey)`, rows contain ['one', failedKey], rows length 3, `notesError` null, every note is clean, `queuedIds` [].
- M3 ~1467 'a session change during the insert: the row is deleted, no state write, and the same account still broadcasts'. Add a helper `insertAcrossSameAccountRelogin()` covering everything through `drainQueuedNotes()`; it returns `{ store, fresh }`. Split into three tests:
  - 'a session change during the insert writes nothing into the new session's notes': `notes` toBe fresh.
  - 'a session change during the insert still removes the sent row from the queue': `queuedIds()` [].
  - 'a session change during the insert still broadcasts for the same account': `sendEphemeralBroadcast` calledWith.

### tests/unit/stores/settingsSlice.initializeApp.test.ts
- M3 ~171 'loads default messages only when IndexedDB has no messages'. Add a helper `initializeEmptyDb()` covering the mocks plus `buildTestStore()` and `initializeApp()`; it returns `{ store, updateCurrentMessage, seededMessages }`. Split into three tests:
  - 'seeds the bundled defaults when IndexedDB has no messages': `loadDefaultMessages` times 1, `addMessages` times 1 plus calledWith.
  - "re-reads the shared bundled rows after seeding and reads the account's rows from its copy": `getAllMessages` times 2 plus nth 1 and nth 2, `readMessageData(SIGNED_IN_USER)`.
  - 'publishes the seeded pool and picks a current message': `messages` toEqual `unfavorited(seeded)`, `updateCurrentMessage` times 1.
- M3 ~241 'withholds the stale pool and re-reads under C when the account changes mid-flight (seeded)'. Add a helper `switchToCDuringSeededInit()` covering everything through `await inFlight`; it returns `{ store, updateCurrentMessage, loadMessagesRequestedBy, lastLoadSettled, handoffRead }`. Split into four tests:
  - 'withholds the stale pool when the account changes mid-flight (seeded)': `messages` [], no 'A-OUTGOING-CUSTOM', `updateCurrentMessage` not called, `isLoading` false.
  - "hands off a re-read under C and never reads the outgoing account's copy (seeded)": `loadMessagesRequestedBy` [C], `getAllMessages` nth 1 and nth 2, `readMessageData` C, not SIGNED_IN_USER.
  - "publishes C's pool once the handoff read lands (seeded)": settle `cIncomingPool()`, `lastLoadSettled()`, `messages` toEqual `unfavorited(incoming)` and not [], `updateCurrentMessage` times 1.
  - 'latches initialization after the handoff, so a second initializeApp reads nothing (seeded)': settle, `lastLoadSettled()`, `getAllMessages.mockClear()`, `initializeApp()`, not called.

### tests/unit/stores/signOutClearsAccountState.test.ts
- L5 ~866 'signedOutState() and this test agree on which fields exist' → 'sign-out resets exactly the account fields this suite lists, so a newly added field cannot go unasserted'

### tests/unit/utils/messageRotation.test.ts
- L5 ~101 (describe getMessageForDate) 'returns same result as getDailyMessage' → 'shows the same message for a date as that date's daily message'

### tests/unit/utils/messageValidation.test.ts
- L5 ~38 'exports MAX_MESSAGE_LENGTH as 1000' → 'caps a message at 1000 characters'
- L5 ~71 'handles empty string' → 'returns an empty string unchanged'

### tests/unit/utils/offlineErrorHandler.test.ts
- L5 ~199 'OFFLINE_ERROR_MESSAGE is defined' → "tells an offline user their changes will sync when they reconnect"
- L5 ~203 'OFFLINE_RETRY_MESSAGE is defined' → 'tells an offline user to check the connection and try again'

## App hooks
- src/App.tsx:579: outer `<div className="flex min-h-screen items-center justify-center">` of the `if (authLoading)` branch → `data-testid="auth-loading-screen"`. **Shared with the e2e group:** tests/e2e/auth/bootstrap-notification-order.spec.ts (10 `getByText('Loading...')` rows) should use the same id.
- src/App.tsx:581: `<Heart … aria-hidden="true" />` in the auth loader → `data-testid="auth-loading-icon"`
- src/App.tsx:632: outer div of the `if (isLoading)` branch → `data-testid="app-data-loading-screen"`
- src/App.tsx:634: `<Heart>` in the data loader → `data-testid="app-data-loading-icon"`
- src/App.tsx:782: `<p className="text-sm text-muted">` inside `events-load-error` → `data-testid="events-load-error-message"`
- src/App.tsx:793: `<p className="text-sm text-muted">` inside `events-empty-placeholder` → `data-testid="events-empty-placeholder-message"`
- src/components/DailyMessage/DailyMessage.tsx:286: `<categoryChip.Icon className="h-3.5 w-3.5" aria-hidden="true" />` → `data-testid="message-category-icon"`

lucide-react forwards unknown props to the `<svg>`, so a `data-testid` on `<Heart>` or `<categoryChip.Icon>` lands on the svg. No component in src/ puts a test id on an icon yet, so these would be the first. No test mocks lucide-react.

## Hazards
- **Shared loader test id.** The e2e investigator also covers the auth "Loading..." loader. Both plans must use `auth-loading-screen`, and App.tsx should be edited once.
- **`getByRole('row', { name: RegExp })` in AdminPanel.** This relies on the row's name coming from its contents; dom-accessibility-api supports that for `row`. The name also includes 'Custom', the category, 'Edit message' and 'Delete message', so match with an unanchored regex, never an exact string. If happy-dom returns an empty name, the fallback is `screen.getAllByTestId('admin-message-row').find((r) => within(r).getByTestId('message-row-text').textContent === text)`, with an explicit `expect(...).toBeDefined()`.
- **Splits that change the arrange sequence:**
  - moodNormalization: the "not found" refusal must seed A's row first, which the original had via the concurrent saves.
  - notesSlice.offlineQueue: in the rejection split, the Retry test no longer runs an intervening second drain. The rows length is still 3 (two sent, plus one retried).
  - eventsSlice: the retry test drops the intervening failed `addEvent`.
  - loaderIdentityGuards: the update/delete split changes the combined `toHaveLength(2)` to 1 per action. That assumes `loadCustomMessages` writes no message-data copy, which the original count of 2 implies.
- **Timing-sensitive helpers:**
  - App.eventsSession: the auth-loader heart test must assert before resolving the lookup, and the other two resolve it themselves.
  - settingsSlice: the handoff helpers must stop at `await inFlight` before settling `handoffRead`, because the "withheld" and "handoff issued" assertions run while that read is still pending.
  - loaderIdentityGuards: the `importAcrossSwitchToC` helper must `waitFor(customCreate called)` before settling.
- **Mocked components:**
  - DisplayNameSetup is mocked as a `<button>` in both App.eventsSession and App.localCopyRefresh, so the role query matches the mock, not the real modal.
  - LoginScreen is mocked as `<p>Sign in</p>` there. Leave those `getByText('Sign in')` calls alone; they were not flagged.
- **Unflagged queries left alone:** App.eventsSession still has other `queryByText('Loading...')` calls (~294, 332, 354, 365, 387, 424, 459, 502), and dbSchema's `getBlockedDialog` uses `document.querySelector('[role="dialog"]')`. No row flags them. Converting them to the new ids would be consistent, but they are out of the listed rows.
- **swMoodSync `matchAll`:** the helper sets `matchAll` with `mockResolvedValueOnce`, per test. `beforeEach` runs `vi.clearAllMocks()`, so each test must call the helper, never share a result.

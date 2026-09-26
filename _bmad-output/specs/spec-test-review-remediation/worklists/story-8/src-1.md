# Story 8 plan — src group 1 (love-notes, shared, hooks, utils, api co-located Vitest)

126 rows → 124 to fix (deduped below), 2 already fixed, 0 false positives. Line numbers are current (worktree HEAD 744ef0f7).
Every app change is a `data-testid` only (listed in `## App hooks`). No assertion is removed; class/attribute assertions stay, only the *lookup* changes.

### src/api/auth/__tests__/authServices.test.ts
- M3 ~169 'applies token side effects in onAuthStateChange for sign-in and sign-out events' (rows 1,2): add a local helper inside the describe
  `async function fireSignInThenSignOut()` = build the same `session` (user-456 / new-access-token / new-refresh-token / 777), `const listener = vi.fn(); const unsubscribe = onAuthStateChange(listener);` throw if `authStateCallback` null, fire `SIGNED_IN` then `SIGNED_OUT`, `await vi.waitFor(() => expect(mockClearAuthToken).toHaveBeenCalled())`, return `{ session, listener, unsubscribe }`. Replace the test with four:
  - 'persists the token when onAuthStateChange reports a sign-in' → `expect(mockStoreAuthToken).toHaveBeenCalledWith({accessToken:'new-access-token', refreshToken:'new-refresh-token', expiresAt:777, userId:'user-456'})`
  - 'clears the stored token when onAuthStateChange reports a sign-out' → `expect(mockClearAuthToken).toHaveBeenCalled()` (the waitFor in the helper stays too)
  - 'delivers the sign-in session, then null for the sign-out, to the listener' → both `toHaveBeenNthCalledWith` lines
  - 'unsubscribe releases the Supabase auth subscription' → `unsubscribe(); expect(mockUnsubscribe).toHaveBeenCalledTimes(1)`

### src/components/love-notes/__tests__/FailedNoteRemoval.test.tsx
- L1 ~168 `within(dialog).getByText(/failed to send\. It will be deleted from this device/)` → `expect(dialog).toHaveTextContent(/failed to send\. It will be deleted from this device/)` (`dialog` is the `note-remove-confirmation` element, which is the `role="dialog"` node).
- L3 ~174 `expect(screen.queryByText('this one was refused')).toBeNull()` → `const remaining = screen.getAllByTestId('love-note-text'); expect(remaining).toHaveLength(1); expect(remaining[0]).toHaveTextContent('this one arrived');` (stronger: exactly the sent note is left).
- L1 ~185 `within(dialog).getByText('Cancel')` → `within(dialog).getByRole('button', { name: 'Cancel' })` (rows 5 and 7, dedupe).
- L1 ~224 `within(dialog).getByText(/your partner keeps their copy/i)` → `expect(dialog).toHaveTextContent(/your partner keeps their copy/i)`.

### src/components/love-notes/__tests__/FullScreenImageViewer.test.tsx (L5 renames)
- ~43 'should render image when isOpen is true' → 'shows the picture full screen when opened'
- ~51 'should not render when isOpen is false' → 'shows nothing while closed'
- ~57 'should not render when imageUrl is null' → 'shows no dialog when there is no picture'
- ~63 'should call onClose when X button is clicked' → 'closes when the close button is clicked'
- ~74 'should call onClose when overlay is clicked' → 'closes when the backdrop is clicked'
- ~101 'should call onClose when Escape key is pressed' → 'closes on Escape'
- ~172 'should have proper accessibility attributes' → 'is exposed as a modal dialog named "Full screen image viewer"'
- ~180 'should remove keydown listener when closed' → 'ignores Escape once it has been closed'

### src/components/love-notes/__tests__/ImagePreview.test.tsx
- L3 ~71 `getByText('2.0 MB')` → `expect(screen.getByTestId('image-preview-original-size')).toHaveTextContent(/^2\.0 MB$/)` [app hook: ImagePreview.tsx:121]
- L3 ~83 `getByText('~512.0 KB')` → `expect(screen.getByTestId('image-preview-compressed-size')).toHaveTextContent(/^~512\.0 KB$/)` [app hook: ImagePreview.tsx:123]
- L1 ~95 `getByText('(large file)')` → `expect(screen.getByTestId('image-preview-large-file')).toHaveTextContent('(large file)')`; ~107 `queryByText('(large file)')` → `expect(screen.queryByTestId('image-preview-large-file')).not.toBeInTheDocument()` [app hook: ImagePreview.tsx:125]
- L1 ~142 `getByText('Compressing...')` → `expect(screen.getByRole('status')).toHaveTextContent('Compressing...')` (overlay already has `role="status"`, ImagePreview.tsx:108 — no app change); ~150 → `expect(screen.queryByRole('status')).not.toBeInTheDocument()`
- L3 ~173/180 `getByText('500 B')` / `getByText('50.0 KB')` → `expect(screen.getByTestId('image-preview-original-size')).toHaveTextContent(/^500 B$/)` / `(/^50\.0 KB$/)`
- L5 ~110 'should call onRemove when remove button clicked' → 'removes the selected picture when Remove is clicked'
- L5 ~137 'should show compression overlay when isCompressing is true' → 'shows Compressing... over the picture while it compresses'
- L5 ~145 'should not show compression overlay when isCompressing is false' → 'shows no compressing overlay once compression is done'
- L5 ~153 'should revoke object URL on unmount' → 'releases the preview image when unmounted'
- L5 ~167 'should format file sizes correctly' → 'shows small sizes in B and larger ones in KB'

### src/components/love-notes/__tests__/LoveNoteMessage.test.tsx
Existing hook from story 1: `data-testid="love-note-text"` on the text `<p>` (LoveNoteMessage.tsx:411). New hooks below.
- L3 ~149 `getByText('Hello love!')` → `expect(screen.getByTestId('love-note-text')).toHaveTextContent('Hello love!')`
- L3 ~155 `getByText(/You/)` ('should render sender name and timestamp') → `expect(screen.getByTestId('love-note-caption')).toHaveTextContent(/^You · .+$/)` [app hook: LoveNoteMessage.tsx:319 inner `<span>`]
- L3 ~229-230 XSS: `queryByText('<script>')` / `getByText('Hello')` → `const text = screen.getByTestId('love-note-text'); expect(text).toHaveTextContent(/^Hello$/); expect(text).not.toHaveTextContent('<script>');`
- L1 ~192/205/568/642 `querySelector('.rounded-\\[20px\\]')` (rows 27,43,44,46,47) → `screen.getByTestId('love-note-bubble')`; all `toHaveClass` assertions (incl. `max-w-[78%]`, `rounded-br-md`, outline classes) unchanged [app hook: LoveNoteMessage.tsx:353 bubble `<div>`]
- L1 status line (rows 26,35) [app hook: `data-testid="love-note-status"` on BOTH spans, LoveNoteMessage.tsx:420 (Sending...) and :425 (Waiting to send); mutually exclusive]:
  - ~191 `queryByText('Sending...')` not in doc (own styling test; message not sending) → `expect(screen.queryByTestId('love-note-status')).not.toBeInTheDocument()`
  - ~564 `const sending = screen.getByText('Sending...')` → `const sending = screen.getByTestId('love-note-status'); expect(sending).toHaveTextContent('Sending...')`, keep aria-live / text-muted asserts
  - ~583 `getByText('Waiting to send')` → `const waiting = screen.getByTestId('love-note-status'); expect(waiting).toHaveTextContent('Waiting to send')`; ~586 `queryByText('Sending...')` → `expect(waiting).not.toHaveTextContent('Sending...')`
  - ~595-596 → `const status = screen.getByTestId('love-note-status'); expect(status).toHaveTextContent('Sending...'); expect(status).not.toHaveTextContent('Waiting to send')`
  - ~611 `queryByText('Waiting to send')` → `expect(screen.queryByTestId('love-note-status')).not.toBeInTheDocument()`
  - ~626 `queryByText('Sending...')` → `expect(screen.queryByTestId('love-note-status')).not.toBeInTheDocument()`
- L1 ~286/299 `document.querySelector('.animate-spin')` (rows 30,45) → `screen.getByTestId('love-note-image-loading')` in the waitFor; after resolve `expect(screen.queryByTestId('love-note-image-loading')).not.toBeInTheDocument()` [app hook: LoveNoteMessage.tsx:368 loading `<div>`]
- L1 ~310/403/547 `getByText('Failed to load image')` (row 31) → `expect(screen.getByTestId('love-note-image-error')).toHaveTextContent('Failed to load image')` [app hook: LoveNoteMessage.tsx:374 error `<div>`]
- L1 ~323/625 `getByText('Uploading...')` (row 33) → `expect(screen.getByTestId('love-note-image-uploading')).toHaveTextContent('Uploading...')` [app hook: LoveNoteMessage.tsx:398 overlay `<div>`]
- L1 ~638 `getByText(/Failed to send/)` (row 36) → get `const retry = screen.getByRole('button', { name: 'Retry sending message' })` first, then `expect(retry).toHaveTextContent(/Failed to send/)`; keep `toHaveClass('text-danger')`
- L5 ~186 'should apply own message styling when isOwnMessage is true' → 'shows your own note as a filled bubble on the right'
- L5 ~200 'should apply partner message styling when isOwnMessage is false' → 'shows a partner note as an outlined bubble on the left'
- L5 ~235 'should fetch signed URL for server image' → 'loads a stored picture by its storage path'
- L5 ~314 'should show uploading overlay when imageUploading is true' → 'shows Uploading... over a picture that is still uploading'
- L5 ~463 'revokes the object URL on unmount' → 'releases the cached picture when the note unmounts'
- L5 ~646 'should call onRetry when retry button clicked' → 'retries the failed note by its temp id when Retry is tapped'
- L5 ~703 'should have proper aria-label with sender and time' → 'names the note by its sender and time for screen readers'
- L5 ~727 'should not update state after unmount during signed URL fetch' → 'ignores a signed URL that arrives after unmount'
- L5 ~762 'should not update state after unmount during error retry' → 'ignores a retried signed URL that arrives after unmount'
- L5 ~809 'should not update state after unmount when fetch fails' → 'logs but ignores a signed-URL failure that settles after unmount'
- already fixed: rows 38, 48 (tagName 'P' + 'text-base') — ~698 now asserts `queryByTestId('love-note-text')` absent (story 1); row 24's "L651" occurrence is the same line.

### src/components/love-notes/__tests__/LoveNotes.realtimeStatus.test.tsx
- L1 ~127/173/189 `line|notice.querySelector('.bg-good'|'.bg-muted'|'.bg-danger')` (rows 49–52) → `expect(within(line).getByTestId('realtime-connection-status-dot')).toHaveClass('bg-good')` (resp. `within(notice)…toHaveClass('bg-muted')` / `('bg-danger')`) [app hooks: LoveNotes.tsx:169 and :191 dot `<span>`s]

### src/components/love-notes/__tests__/MessageInput.test.tsx
- L3/L1 every `document.querySelector('input[type="file"]') as HTMLInputElement` (~133,146,167,187,204,221,265,339,364,396,451,529 — rows 53,58–64,67) → `screen.getByTestId('message-input-file') as HTMLInputElement` [app hook: MessageInput.tsx:249 hidden `<input type="file">`]. Not a label: the input is `aria-hidden`.
- L1 ~306/313 `sendButton.querySelector('.animate-spin')` (rows 54,65,66) → `within(sendButton).getByTestId('message-input-send-spinner')` / `within(sendButton).queryByTestId('message-input-send-spinner')` toBeNull [app hook: MessageInput.tsx:280 `<LoaderCircle>`; lucide spreads rest props onto the svg]. Import `within`.
- L5 ~317 'should call sendNote with text content' → 'sends the typed text as a note'
- L5 ~332 'should call sendNote with image file' → 'sends a selected picture with no caption'
- L5 ~356 'should call sendNote with both text and image' → 'sends the caption together with the selected picture'

### src/components/love-notes/__tests__/NoteRemoval.test.tsx
- L1 all 12 `screen.getByText('Cancel')` / `screen.queryByText('Cancel')` (~193,222,264,317,353,354,357,374,393,421,501,502; rows 71,73–81) → `screen.getByRole('button', { name: 'Cancel' })` / `screen.queryByRole('button', { name: 'Cancel' })`.
- L1 ~158-159 → `const dialog = screen.getByRole('dialog'); expect(dialog).toHaveTextContent(/your partner keeps their copy/i); expect(dialog).toHaveTextContent(/cannot undo/i);`
- L1 ~173-177 → `const dialog = screen.getByRole('dialog'); expect(dialog).toHaveTextContent('This message failed to send. It will be deleted from this device.'); expect(dialog).not.toHaveTextContent(/your partner keeps their copy/i); expect(dialog).toHaveTextContent(/cannot undo/i);`
- L1 ~432 `screen.getByRole('dialog').querySelector('[tabindex="-1"]')` (rows 72,82) → `within(screen.getByRole('dialog')).getByTestId('note-remove-panel')` [app hook: NoteRemoveConfirmation.tsx:186 panel `<div ref={panelRef} tabIndex={-1}>`]

### src/components/shared/__tests__/kitDialogs.test.tsx
- L3 ~111-113 `heading.parentElement` / `panel.parentElement` → `const scrim = screen.getByRole('dialog', { name: 'Delete Anniversary?' }); const panel = screen.getByTestId('anniversary-delete-panel'); expect(scrim).toContainElement(panel);` keep `toHaveClass(...)` on panel and `expectSafeScrim(scrim)` [app hook: AnniversarySettings.tsx:310 delete panel `motion.div`]
- L3 ~129 `scrim.firstElementChild` → `const panel = screen.getByTestId('note-remove-panel'); expect(scrim).toContainElement(panel);` keep class asserts (same hook as NoteRemoval)

### src/components/shared/__tests__/kitSurfaces.test.tsx
Structural/tag/copy lookups (rows 86–90) → test ids; every `toHaveClass` kept.
- SyncToast ~116 `toast.querySelector('svg')` → `within(toast).getByTestId('sync-toast-icon')`; ~117 `screen.getByText(message)` → `const text = screen.getByTestId('sync-toast-message'); expect(text.textContent).toBe(message); expect(text).toHaveClass('text-ink')` [hooks SyncToast.tsx:126 icon, :127 span]
- Network offline ~134-138: `indicator.firstElementChild` → `screen.getByTestId('network-status-banner')` (+ `expect(indicator).toContainElement(banner)`); `banner.querySelector('span')` → `within(banner).getByTestId('network-status-dot')`; `banner.querySelector('svg')` → `within(banner).getByTestId('network-status-icon')`; `getByText('Offline')` → `const label = screen.getByTestId('network-status-label'); expect(label).toHaveTextContent('Offline'); expect(label).toHaveClass('text-ink')`
- Network connecting ~149-152: same three ids.
- Network online ~161-162: `indicator.querySelector('span'|'svg')` → `within(indicator).getByTestId('network-status-dot'|'network-status-icon')`
  [hooks NetworkStatusIndicator.tsx:111 banner div, :115 and :140 dots, :121 and :144 icons, :128 label span]
- ErrorBoundary ~177-181: `title.parentElement` → `screen.getByTestId('error-boundary-card')` + `expect(card).toContainElement(title)`; `card.parentElement` → `screen.getByTestId('error-boundary-fallback')` (toHaveClass('bg-page') + toContainElement(card)); `card.firstElementChild` → `screen.getByTestId('error-boundary-icon')`; `getByText('boom')` → `screen.getByTestId('error-boundary-message')` with `expect(msg.textContent).toBe('boom')` then the class assert. Same message id at ~215 (`expect(screen.getByTestId('error-boundary-message').textContent).toBe(shown)`) and ~227. [hooks ErrorBoundary.tsx:54,55,56,68]
- ViewErrorBoundary ~242-250: `fallback.firstElementChild` → `screen.getByTestId('view-error-card')`; `card.firstElementChild` → `screen.getByTestId('view-error-icon')`; `getByText('render failed')` → `view-error-message` (textContent toBe 'render failed' + classes); ~283 `getByText(shown)` → `expect(screen.getByTestId('view-error-message').textContent).toBe(shown)`; ~267 `queryByText('Failed to fetch dynamically imported module')` → `expect(screen.queryByTestId('view-error-message')).not.toBeInTheDocument(); expect(screen.getByTestId('view-error-boundary')).not.toHaveTextContent('Failed to fetch dynamically imported module');` [hooks ViewErrorBoundary.tsx:39,40,52]
- WelcomeSplash ~297-308: `heading.parentElement` → `screen.getByTestId('welcome-card')` (+ toContainElement(heading)); `heading.nextElementSibling` → `screen.getByTestId('welcome-caption')`; `splash.firstElementChild` → `screen.getByTestId('welcome-heart-rain')`; `rain.querySelectorAll('svg')` length 15 + `rain.children` loop → `const drops = within(rain).getAllByTestId('welcome-heart-drop'); expect(drops).toHaveLength(15); for (const drop of drops) { expect(drop).toHaveClass('text-accent'); expect(within(drop).getByTestId('welcome-heart-drop-icon')).toBeInstanceOf(SVGSVGElement); }`; `continueButton.querySelector('svg')` → `within(continueButton).getByTestId('welcome-continue-icon')` [hooks WelcomeSplash.tsx:31,33,56,66,88,113]
- DisplayNameSetup ~323 `getByText('What would you like to be called?')` → `const subtitle = screen.getByTestId('display-name-subtitle'); expect(subtitle).toHaveTextContent('What would you like to be called?'); expect(subtitle).toHaveClass('text-sm','text-muted')`; ~325 `getByText('3-30 characters')` → `display-name-hint` same pattern (row 87); ~345 `container.querySelector('form')!` → `screen.getByTestId('display-name-form')` (keep the fireEvent.submit and its comment); ~350 `error.querySelector('svg')` → `within(error).getByTestId('display-name-error-icon')` [hooks DisplayNameSetup.tsx:250,257,265,289]
- M3 ~232 'renders the view error on a kit card with primary Try Again and secondary Go Home' (row 84): helper `function renderViewError(onNavigateHome = vi.fn())` renders the same tree and returns `{ container, onNavigateHome }`. Split into 'renders the view error on a kit card with primary Try Again and secondary Go Home' (all class asserts + `expectOnKit`) / 'Go Home on the view error takes the person home' (userEvent click on `error-go-home` → `onNavigateHome` called once).
- M3 ~288 'renders a page ground, lucide heart rain, a kit card and a primary Continue' (row 85): helper `function renderSplash(onContinue = vi.fn())`. Split into same name (ground/heading/card/caption/rain/Continue classes + icon + `expectOnKit`) / 'Continue on the welcome splash continues once' (click `welcome-continue-button` → `onContinue` called once).

### src/components/shared/__tests__/photoDialogsA11y.test.tsx
- L1 ~236 `findByText('This may take a moment')` → `expect(await screen.findByRole('heading', { name: 'Compressing & Saving...' })).toBeInTheDocument()` (heading of the uploading step, PhotoUpload.tsx:521; no app change). Keep the close-disabled assert.
- L5 ~139 'calls onClose on Escape' → 'closes on Escape'

### src/hooks/__tests__/useNetworkStatus.test.ts (L5)
- ~138 'should add online and offline event listeners on mount' → 'listens for the browser's online and offline events once mounted'
- ~145 'should remove event listeners on unmount' → 'stops listening for online and offline events after unmount'
- ~265 'should handle rapid online/offline toggling' → 'settles online after rapid offline/online toggling'
- ~291 'should handle debounce cancellation on new online event' → 'stays offline when an offline event cancels a pending online confirmation'
- ~321 'should clear timeout on unmount' → 'leaves no pending online confirmation behind after unmount'

### src/hooks/__tests__/usePartnerMood.test.ts (L5)
- ~68 'subscribes to partner mood updates via Broadcast' → 'listens for the partner's live mood updates once mounted'
- ~150 'unsubscribes on unmount' → 'stops receiving mood updates after unmount'
- ~167 'sets error state when getLatestPartnerMood rejects' → 'reports a load error and no mood when the partner mood cannot be read'
- ~187 'sets disconnected status when subscribeMoodUpdates rejects' → 'reports disconnected with an error when live updates cannot start'

### src/hooks/__tests__/useRealtimeMessages.rejoin.test.ts
- M3 ~177 'replaces the errored channel with a new one that actually joins' (row 102): add two local helpers: `async function mountJoining()` (the act/renderHook/runOnlyPendingTimersAsync block; returns `unmount`) and `async function failTransportAndWaitOutBackoff()` (`harness.sockets[0].onerror?.(new Error('transport blew up'))` in act, then `advanceTimersByTimeAsync(1000)` in act). Tests:
  - keep 'replaces the errored channel with a new one that actually joins': mountJoining, pre-error asserts (lines 185-196), fail, `first.state` errored, then channel-replacement + registry asserts (212-219) + wire-order asserts (236-247), unmount.
  - 'reinstalls the Realtime token before the replacement channel joins': mountJoining → failTransportAndWaitOutBackoff → `expect(harness.setAuth).toHaveBeenCalledTimes(2)` → unmount. Move the comment at 221.
  - 'does not look the partner up again before the replacement joins': same arrange → `expect(harness.getPartnerId).toHaveBeenCalledTimes(1)` → unmount. Move the comment at 224-228 (drop "asserted here for convenience" wording).

### src/hooks/__tests__/useRealtimeMessages.test.ts
- M3 ~864 're-installs the Realtime token before every retry' (rows 103,112): inside 'Error Handling and Retry Logic' add helper `async function mountAndRetryOnce()` = the recording `subscribeCallbacks` channel (with `mocks.order.push('subscribe')`), render+runOnlyPending, emit CHANNEL_ERROR on `[0]`, advance 1000; returns `{ subscribeCallbacks }`. Keep the long comment on why callbacks are recorded as an array. Tests:
  - 're-installs the Realtime token before every retry' → `expect(mocks.order).toEqual(['setAuth','subscribe','setAuth','subscribe'])`
  - 'hands the status callback to the retried join' → `toHaveLength(2)` + `[1]` toBeTypeOf('function')
  - 'does not look the partner up again before the retried join' → `expect(mocks.getPartnerId).toHaveBeenCalledTimes(1)`
  - 're-takes the partner snapshot when the retried join reports SUBSCRIBED' → capture `before`, emit SUBSCRIBED on `[1]` + runOnlyPending, `+1`
  - 'restarts the backoff after the retried join reports SUBSCRIBED' → emit SUBSCRIBED on `[1]` (+runOnlyPending), emit CHANNEL_ERROR on `[1]`, advance 1000, `expect(subscribeCallbacks).toHaveLength(3)`
- M3 ~1097 'attempts no join when the retry token install rejects' (rows 104,113): wrap in nested `describe('when the retry token install rejects', …)` (depth 3, M7-safe) with `beforeEach`: `unhandled = vi.fn(); process.on('unhandledRejection', unhandled); consoleError = vi.spyOn(console,'error').mockImplementation(()=>{})` and `afterEach`: `process.off(...)`, `consoleError.mockRestore()`. Helper `async function mountThenFailRetryTokenInstall()` = channel mock w/ retained `subscribeCallback`, render+runOnlyPending, `mocks.setAuth.mockRejectedValueOnce(tokenFailure)`, emit CHANNEL_ERROR, advance 1000; returns `{ supabase, mockChannel, tokenFailure, emitError: () => emitStatus(subscribeCallback, 'CHANNEL_ERROR', new Error('Connection failed')) }`. Tests:
  - 'attempts no join and releases nothing when the retry token install rejects' → the first-join premise asserts (subscribe 1, channel 1) must run BEFORE the failure, so the helper takes an optional `afterFirstJoin?: () => void` callback, or this test inlines the helper steps; then channel 1, subscribe 1, `removeChannel` not called.
  - 'logs a rejected retry token install instead of throwing it' → `consoleError` calledWith('[useRealtimeMessages] Retry setup failed:', tokenFailure); then `vi.useRealTimers(); await new Promise(r => setImmediate(r)); expect(unhandled).not.toHaveBeenCalled();` (keep the setImmediate comment)
  - 'schedules no further attempt on its own after the token install rejects' → advance 30000, channel 1, subscribe 1
  - 'retries at the second backoff step on the next CHANNEL_ERROR' → advance 30000 (kept so the sequence matches the original), `emitError()`, advance 2000, removeChannel 1, channel 2, subscribe 2
- L5 ~134 'should subscribe to a PRIVATE broadcast channel on mount' → 'joins only the private love-notes topic for this user on mount'
- L5 ~396 'should listen for broadcast new_message events' → 'receives new notes broadcast on the love-notes topic'
- L5 ~419 'should unsubscribe on unmount' → 'releases the love-notes channel on unmount'
- L5 ~437 'should not subscribe when enabled is false' → 'opens no channel while disabled, and one once enabled'
- L5 ~644 'should reset retry count on successful subscription' → 'restarts the backoff at 1s after a successful rejoin'
- L5 ~1192 'should clear retry timeout on unmount' → 'does not retry after unmount'
- L5 ~1274 'should call onNewMessage callback when message received' → 'delivers a partner note to the thread and to the caller'

### src/utils/__tests__/backgroundSync.test.ts (L5)
- ~151 'should handle multiple sync tag registrations' → 'registers each tag it is given, in order'
- ~175 'should handle registration errors gracefully' → 'logs and resolves when the sync registration fails'
- ~190 'should setup message listener and call callback on BACKGROUND_SYNC_COMPLETED' → 'runs the refresh when the worker reports a completed background sync'
- ~235 'should handle messages with no data gracefully' → 'ignores a worker message with no data'
- ~252 'should return cleanup function that removes listener' → 'stops listening for worker messages after cleanup'
- ~267 'should handle callback errors gracefully' → 'logs when the post-sync refresh fails'
- ~292 'should setup multiple listeners independently' → 'registers one worker message listener per caller'
- ~302 'should cleanup only the specific listener' → 'cleanup removes only its own caller's listener'
- ~317 'should handle concurrent sync registrations' → 'registers every tag requested concurrently'
- ~347 'should preserve message event data integrity' → 'logs the worker's sync counts unchanged and runs the refresh once'

### src/utils/__tests__/moodGrouping.test.ts (L5)
- ~36 'groups moods by date correctly' → 'groups today's moods apart from yesterday's, today first'
- ~80 'handles empty mood array' → 'returns no groups for no moods'
- ~85 'handles multiple moods on the same day' → 'keeps several moods from one day in a single group'

## App hooks
All `data-testid` additions; none collide with an existing id (grepped `src` + `tests`).
- src/components/love-notes/LoveNoteMessage.tsx:319 caption inner `<span>` (`{senderName} · {formattedTime}`) → `data-testid="love-note-caption"`
- LoveNoteMessage.tsx:353 bubble `<div className="max-w-[78%] overflow-hidden rounded-[20px] …">` → `data-testid="love-note-bubble"` (**e2e**: `tests/e2e/notes/notes-kit.spec.ts:170` `getByText(uniqueMessage).locator('xpath=../..')` can become `message.getByTestId('love-note-bubble')`)
- LoveNoteMessage.tsx:368 image-loading `<div>` → `data-testid="love-note-image-loading"`
- LoveNoteMessage.tsx:374 image-error `<div>` → `data-testid="love-note-image-error"`
- LoveNoteMessage.tsx:398 uploading overlay `<div>` → `data-testid="love-note-image-uploading"`
- LoveNoteMessage.tsx:420 and :425 status `<span>`s (Sending... / Waiting to send) → both `data-testid="love-note-status"`
- src/components/love-notes/LoveNotes.tsx:169 and :191 status dot `<span>`s → both `data-testid="realtime-connection-status-dot"`
- src/components/love-notes/MessageInput.tsx:249 hidden `<input type="file">` → `data-testid="message-input-file"` (**e2e**: `tests/e2e/offline/needs-a-connection.spec.ts` also uses `input[type="file"]`)
- MessageInput.tsx:280 `<LoaderCircle … className="animate-spin">` → `data-testid="message-input-send-spinner"`
- src/components/love-notes/NoteRemoveConfirmation.tsx:186 panel `<div ref={panelRef} tabIndex={-1}>` → `data-testid="note-remove-panel"`
- src/components/love-notes/ImagePreview.tsx:121 / :123 / :125 size spans → `image-preview-original-size` / `image-preview-compressed-size` / `image-preview-large-file`
- src/components/Settings/AnniversarySettings.tsx:310 delete-dialog panel `motion.div` → `data-testid="anniversary-delete-panel"`
- src/components/shared/SyncToast.tsx:126 `<Icon>` → `sync-toast-icon`; :127 message `<span>` → `sync-toast-message`
- src/components/shared/NetworkStatusIndicator.tsx:111 banner `<div>` → `network-status-banner`; :115 and :140 dot `<span>` → `network-status-dot`; :121 and :144 `<IconComponent>` → `network-status-icon`; :128 label `<span>` → `network-status-label`
- src/components/ErrorBoundary/ErrorBoundary.tsx:54 root `<div>` → `error-boundary-fallback`; :55 card → `error-boundary-card`; :56 icon tile → `error-boundary-icon`; :68 message `<p>` → `error-boundary-message`
- src/components/ViewErrorBoundary/ViewErrorBoundary.tsx:39 card → `view-error-card`; :40 icon tile → `view-error-icon`; :52 message `<p>` → `view-error-message`
- src/components/WelcomeSplash/WelcomeSplash.tsx:31 rain `<div>` → `welcome-heart-rain`; :33 each drop `motion.div` → `welcome-heart-drop`; :56 drop `<Heart>` → `welcome-heart-drop-icon`; :66 card `<div>` → `welcome-card`; :88 caption `motion.p` → `welcome-caption`; :113 `<ArrowRight>` → `welcome-continue-icon`
- src/components/DisplayNameSetup/DisplayNameSetup.tsx:250 subtitle `<p>` → `display-name-subtitle`; :257 `<form>` → `display-name-form`; :265 `<CircleAlert>` → `display-name-error-icon`; :289 hint `<p>` → `display-name-hint`

## Hazards
- Shared hooks across groups: `note-remove-panel` (NoteRemoval.test + kitDialogs.test); `love-note-bubble` (LoveNoteMessage.test + e2e notes-kit XPath); `message-input-file` (MessageInput.test + e2e needs-a-connection). Add each once.
- `love-note-status` sits on two mutually exclusive spans: always assert its text, never presence alone, or "Waiting" vs "Sending" stops being distinguished.
- kitSurfaces `expectOnKit(container.innerHTML)` scans every attribute: a new test id must not match `\b(from|via|to)-[a-z]`, `#hex`, the palette regex or `dark:`. All ids above were checked against it; don't rename them to e.g. `to-…`.
- kitSurfaces/kitDialogs mock Motion as plain tags that pass through unknown props, so test ids on `m.div`/`motion.div` reach the DOM; lucide icons spread rest props onto the `<svg>` (verified in lucide-react `Icon.mjs`).
- useRealtimeMessages ~1097 split: the unhandled-rejection check needs real timers for one `setImmediate` turn (fake timers stub it); the outer afterEach calling `useRealTimers()` again is harmless. The original first-join premise asserts must still run *before* the failure. The recovery test keeps the 30 s idle advance so its timer sequence is identical to the original.
- useRealtimeMessages ~864 split: `re-takes the snapshot` and `restarts the backoff` both need `subscribeCallbacks[1]` from the retried join; the helper must use the array-recording fake, not the retained-callback one (the comment explains why).
- rejoin.test split tests each drive a real RealtimeClient; each must `unmount()` so the file's afterEach timer drain doesn't cross into the next test's registry entry.
- FailedNoteRemoval L3 replacement asserts exactly one remaining `love-note-text`, which relies on MessageList rendering both rows in happy-dom (it already does — `bubbleWith` finds both).
- Adjacent, not in rows (observations only, not edited): FullScreenImageViewer.test ~81 finds the overlay by `tagName !== 'BUTTON'`; LoveNotes.realtimeStatus.test ~126 `within(row).getByText('Connected')`.

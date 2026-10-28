# Story 8 plan — e2e / api / Deno handler group

106 rows. None already fixed (every flagged line still carries its defect as of the current tree). None of these rows is listed as a false positive in `corrections.md`. The folder and suite rows collapse to **~62 distinct fixes** once deduped. Line numbers below are **current** (`~`). Catalog lines are given as `cat:` where they differ.

Conventions used throughout:
- **Page-level absence checks.** `page.getByText(x)).toHaveCount(0)` becomes `await expect(page.getByRole('main')).not.toContainText(x, { ignoreCase: true })`. There is exactly one `<main>` (App.tsx:740), and every view renders inside it. `ignoreCase` keeps getByText's default case-insensitivity, and substring matching is at least as strict as the original check. A negated text assertion passes on a missing element, so every use must follow an assertion in the same test that proves the view rendered. Each spot listed below already has one.
- **Priority markers.** Every new or split test name carries `[P#]`. Split tests keep the parent's priority, so `test:p1` (which greps `[P0]|[P1]`) loses nothing.

---

### supabase/functions/upload-love-note-image/handler.test.ts
- **M4** (cat:196): 26 top-level `Deno.test` plus the 8-case loop, with no grouping. The fix is 4 `Deno.test` groups with `t.step`. Do **not** use `jsr:@std/testing/bdd`, because it is not in DENO_DIR: `~/Library/Caches/deno/remote/https/jsr.io` holds only `@std/assert/1.0.19` and `@std/internal/1.0.14`, so a new import would need the network under `deno test --no-lock`. Convert each group's tests to `await t.step('<same name>', async () => { …body unchanged… })`:
  - `Deno.test('declared length is decided from headers alone', async (t) => {…})` covers ~196–307. The loop at ~290 becomes `for (const declared of […]) await t.step(\`a non-integer Content-Length (${JSON.stringify(declared)}) is refused with 400\`, async () => {…})`.
  - `Deno.test('streaming does not trust the header', …)` covers ~325–494. It includes the three "never calls arrayBuffer…" cases. `trapUnboundedReads` (~415) stays at module level.
  - `Deno.test('format and content', …)` covers ~518–579 plus the two new tests from M3 below.
  - `Deno.test('unchanged paths', …)` covers ~597–683.
  - Delete the four `// ---- section` comment banners, since the group names replace them. Every step must be `await`ed.
- **M3** ~554 `'a normal octet-stream upload succeeds with the uploader-prefixed path'`: split three ways. Shared arrange goes in a module helper `async function uploadPng(size = 64 * 1024)` that returns `{ client, bytes, response }` (fakeClient + pngBytes + chunked countedStream + handleUpload).
  - **A** keeps the name. It asserts status 200, `success`, `storagePath === uploadCalls[0].path`, `size`, the `${userId}/` prefix, and `uploadCalls[0].contentType === 'image/png'`.
  - **B** `'a successful upload reports the remaining rate-limit allowance in its body and header'` asserts status 200, `body.rateLimitRemaining === RATE_LIMIT_MAX_UPLOADS - 1` and the `X-RateLimit-Remaining` header.
  - **C** `'a successful upload carries the CORS allow-origin header'` asserts status 200 and `Access-Control-Allow-Origin === '*'`.

### tests/api/events-wire-contract.spec.ts
- **M3** ~309 `DE.5-API-004`: move the schema-strictness block (~367–380) into a **new test in the same spec**, `'[P1] DE.5-API-004b the test-local EventRow schema accepts the real representation and rejects an undeclared column'`. There is no strong reason for a unit test: the control must be the real PostgREST representation, and a unit test would have to hard-code a row, which is weaker.
  - 004b does its own `resolveOwnPair` + `clearPairEvents` + the same POST with `Prefer: return=representation`. Use a new const label `SCHEMA_PROBE_LABEL = 'Events Wire Schema Probe'`, and assert `status` 201 as the premise.
  - It then runs the six schema `expect`s unchanged.
  - The existing `afterEach(clearOwnPairEvents)` cleans up.
  - 004 keeps everything else.
- **M3** ~539 `DE.5-API-008`: move the teardown-scoping block (~622–643, from `log.step('Confirm shared cleanup…')` to `remainingPairRows` 0) into `'[P1] DE.5-API-008b the shared pair teardown deletes this pair\'s events and leaves an outsider\'s row'`.
  - Its arrange: `resolveOwnPair` + `clearPairEvents`, then `seedEvents` for the same two pair rows (use new labels) with `expect(seeded).toHaveLength(2)`. Then `createOutsiderClient(supabaseAdmin, 'events-wire-teardown-outsider')` and `seedEvent` for the outsider witness row, inside the try.
  - Then call `clearOwnPairEvents` and run the four asserts unchanged.
  - Copy 008's try/catch/finally outsider-cleanup-plus-AggregateError block verbatim, or lift it into a file-local helper `withOutsider(supabaseAdmin, name, body)` used by both tests. Outsider rows cascade on user delete (`events.user_id … on delete cascade`).
  - 008 keeps the positive control, the empty read and the still-there check.

### tests/api/interaction-authorization.spec.ts
- **M3** ~135 `'[P0] a received interaction is viewed-only for its recipient'`. This deduplicates the folder row (cat:135, five subjects) and the suite row. Split into four tests, all `[P0]`.
  - Shared arrange: lift `patch(apiRequest, token, id, body)`, `readRow(supabaseAdmin, id)`, `seedPokes(apiRequest, authToken, userId, partnerId, ids)` (the POST loop with `expect(status).toBe(201)`) and `outsiderToken(outsider)` (the getSession + `toBeTruthy` check) into file-level helpers.
  - Also add cleanup helpers `deleteRows(apiRequest, ids, failures)` and `deleteOutsider(outsider, failures)`, each wrapping its own try/push. Every test ends with `throwCollected(failures, '<test-specific message>')`, which keeps story 4's separate-try cleanup pattern.
  - **A** keeps the name. It covers column immutability plus the recipient's write surface: mark viewed persists, the five forgeries are refused and change nothing, the combined patch is refused whole, and the recipient DELETE returns 403 with the row still present.
    - A still needs the outsider, whose ids serve as forgery values.
    - Its rows are `viewedRowId`, `untouchedRowId` and `forgedRowId`, all deleted at cleanup.
  - **B** `'[P0] neither the sender nor an outsider can mark a received interaction viewed'` seeds one row, runs the two-token loop (204, `viewed` false), then cleans up the row and the outsider.
  - **C** `'[P0] the anon key is refused on GET, POST and PATCH of interactions'` seeds one row and runs the anon loop (401 + 42501) plus the final `viewed` false check. It needs no outsider.
  - **D** `'[P0] an outsider reads none of the couple\'s interactions'` seeds two rows and asserts the outsider GET is 200 with `[]`.

### tests/e2e/account-data/cross-device.spec.ts
- **M3** ~37. This deduplicates the folder row (cat:36) and the suite row. Split into three `[P1]` tests, each with its own 120 s timeout (`test.setTimeout` stays at describe level):
  - `'[P1] a favorite made in one context appears in a fresh one'`
  - `'[P1] a custom message made in one context appears in a fresh one'`
  - `'[P1] an anniversary made in one context appears in a fresh one'`
- Shared arrange as module helpers:
  - `resolveWorkerAccount(supabaseAdmin)` covers ~43–48.
  - `clearTable(supabaseAdmin, table, userId, { soft })` is the old `clear`, per table. Each test clears **only the table it writes**: hard before, soft in `finally`. The custom and anniversary reads assert an exact one-row array, so the pre-clear is required.
  - `newBareContext(browser, testInfo)` covers ~64–75.
  - `signInFresh(second, email)` covers ~117–129 and includes the `FAVORITES_READ` 200 and `app-container` checks.
- Each test's `finally` keeps: `second.close().catch`, `page.close().catch`, then the soft clear.
- Assertions per test:
  - Favorite: ~80–94 and ~131–136.
  - Custom: ~96–102 and ~138–148.
  - Anniversary: ~104–114 and ~150–162.
- **L1** ~106 (cat:103/104): `#anniversary-label` becomes `page.getByRole('dialog', { name: 'Add Anniversary' }).getByLabel('Label')`.
- **L1** ~107: `#anniversary-date` becomes `….getByLabel('Date')`. Scope it to the dialog, because the Settings page also has wedding and birthday date fields.
- **L3** ~114 (cat:111) and ~162 (cat:129): `getByText(anniversaryLabel)` becomes `page.getByRole('heading', { level: 4, name: anniversaryLabel })`. The same change applies on `fresh`. AnniversarySettings.tsx:141 renders the label as an `<h4>`.

### tests/e2e/auth/bootstrap-notification-order.spec.ts
- **L3** at all 12 occurrences: ~27, 40, 83, 90, 125, 130, 162, 172, 196, 199, 225, 232. `page.getByText('Loading...', { exact: true })` becomes `page.getByTestId('auth-loading-screen')`, with the same `toBeVisible` / `not.toBeVisible`.
  - [app hook: src/App.tsx:579 outer `<div className="flex min-h-screen items-center justify-center">` add `data-testid="auth-loading-screen"`]
  - The harness mounts the real `App` (tests/support/harnesses/auth-bootstrap-notification-order.tsx:5).
  - Suggest a local `const authLoader = (page: Page) => page.getByTestId('auth-loading-screen')`.

### tests/e2e/auth/login-kit.spec.ts
- **L1/L3** ~53 (cat:53; deduplicates rows 27 and 30): replace `page.getByText('My Love', { exact: true })` with `page.getByTestId('login-wordmark')`.
  - The suggested `getByRole('heading')` is **wrong** here. The font check needs the `<span class="font-lora">`, and `getComputedStyle(h1).fontFamily` is not Lora, so that locator would fail the test.
  - [app hook: src/components/LoginScreen/LoginScreen.tsx:199 `<span className="font-lora …">` add `data-testid="login-wordmark"`]
  - Keep the heading-role assertion on line ~52 as is.
- **L3** ~56: `await expect(page.getByTestId('login-tagline')).toHaveText('Welcome back — sign in to continue')`.
  - [app hook: LoginScreen.tsx:203 `<p className="text-[15px] text-muted">` add `data-testid="login-tagline"`]
- **L3** ~58: `root.locator('form').locator('..')` becomes `page.getByTestId('login-card')`.
  - [app hook: LoginScreen.tsx:206 `<div className="grid gap-3.5 rounded-[20px] …">` add `data-testid="login-card"`]

### tests/e2e/auth/logout.spec.ts
- **L5** ~110: `'[P0] should clear account state through signedOutState on logout'` becomes `'[P0] signing out empties the account\'s notes, photos, moods, events and partner from the store'`.

### tests/e2e/auth/token-persistence-overlap.spec.ts
- **M4** (deduplicates rows 33 and 34): wrap the test at ~336 and the loop at ~340–363 in `test.describe('Native auth token persistence', () => { … })`. The module-level `test.use` at ~14 can stay.
- **L2**: `'[P2] characterizes native auth token persistence: sequential'` and `'[P2] characterizes native auth token persistence: ' + scenario`. These are characterization tests of browser behaviour, hence P2.
  - The evidence file is keyed on `scenario`, not the title (~331), and a repo grep finds no other reference to the title, so renaming is safe.

### tests/e2e/errors/check-error-path-consistency.spec.ts
- **L3** ~41 (cat:39): `await expect(page.getByTestId('notes-error-banner')).toHaveText(friendlyCheck)`.
  - [app hook: src/components/love-notes/LoveNotes.tsx:212 `<p className="flex-1 text-sm text-danger" role="alert">` add `data-testid="notes-error-banner"`]
- **L3** ~42 (cat:40): `await expect(page.getByRole('main')).not.toContainText(checkError.message)`. The premise is `bubble` toHaveCount(1) on the line above. This covers both the banner and the bubble.
- **L3** ~63 (cat:61): `expect(page.getByTestId('notes-error-banner')).toHaveText(friendlyCheck)`.
- **L3** ~92 (cat:90): `await expect(page.getByTestId('notes-error-banner')).toHaveCount(0)`, plus `await expect(page.getByRole('main')).not.toContainText(friendlyCheck)`. The premise is `bubble` visible at ~90.

### tests/e2e/home/events.spec.ts
- **M3** ~52 (cat:48) `'[P0] shows own and partner future events, hides a past one, and leaves other cards unchanged'`: split into three `[P0]` tests.
  - Shared arrange as module helpers:
    - `openHome(page, interceptNetworkCall)`: the `UPCOMING_EVENTS_READ` intercept + goto + 200.
    - Seed consts `FUTURE_MEETUP` / `PAST_MEETUP` / `PARTNER_MEETUP`, holding the three current `seedEvent` payloads minus `userId`.
  - Each test starts with `resolveOwnPair` + `clearPairEvents`. The file-level `afterEach(clearOwnPairEvents)` stays.
  - **A** `'[P0] shows own and partner future events soonest first, each with its own icon'` seeds future and partner, then asserts ~99–123.
  - **B** `'[P0] a past event renders nowhere on Home, and "Event passed" never appears'` seeds past and future. Future is kept as the load witness, so first `expect(page.getByTestId('event-countdown-future-meetup-e2e')).toBeVisible()`. Then it asserts ~133–138, using the L3 fixes below.
  - **C** `'[P0] TimeTogether, both birthday cards and the wedding card render alongside events'` seeds future, asserts the future card visible, then ~127–130.
- **L3** ~134, 135, 138 (cat:129/130/133): `page.getByText('Past Meetup E2E' | 'Past event description' | 'Event passed')).toHaveCount(0)` becomes `expect(page.getByRole('main')).not.toContainText(<same>, { ignoreCase: true })`.
- **L3** ~158 (cat:150): same fix for `'Event passed'`. The premise is the placeholder visible at ~157.
- **L3** ~244–246 (cat:229–231): same fix for `'Old Meetup E2E'`, `'Older Meetup E2E'` and `'Event passed'`. The premise is the placeholder visible at ~243.
- **L3** ~381–382 (cat:360/361): same fix for `'Seventh event description'` and `'Old Meetup E2E'`. The premise is the first card visible at ~368.

### tests/e2e/home/home-kit.spec.ts
- **M3** ~97 (cat:61) `should render the countdown cards on one kit card and value style in ${colorScheme}`: split into five tests inside the same `for (colorScheme)` loop, each calling the existing `openHome`.
  - **A** keeps the name and runs the COUNTDOWN_CARDS loop, ~103–132.
  - **B** `'[P1] should render the daily message on the kit card in ${colorScheme}'` covers ~135–138.
  - **C** `'[P1] should tint your birthday tile accent and your partner\'s tile partner in ${colorScheme}'` covers ~142–147.
  - **D** `'[P1] should show the dateless wedding as Date TBD in muted in ${colorScheme}'` covers ~150–153.
  - **E** `'[P1] should set the two birthday cards side by side at phone width in ${colorScheme}'` covers ~156–160.
- **L3** ~233 (cat:185): `page.getByText('Upcoming', { exact: true })` becomes `page.getByRole('heading', { level: 2, name: 'Upcoming', exact: true })`. App.tsx:756 renders it as an `<h2>`.

### tests/e2e/home/persisted-events-strip.spec.ts
- **L3** ~95, 96 (cat:88/89): `expect(page.getByRole('main')).not.toContainText(stale.label | stale.description, { ignoreCase: true })`. The premise is `realCard` visible at ~89.
- **L3** ~101 (cat:94): `page.getByText('Something went wrong')` becomes `page.getByRole('heading', { name: 'Something went wrong' })`, keeping `toHaveCount(0)`. ErrorBoundary.tsx:59 renders it as an `<h1>`. `main` cannot be used here, because the boundary replaces app-container.
- **L3** ~171 (cat:157): main-scoped `not.toContainText(staleEvent.label, { ignoreCase: true })`. The premise is `time-together` visible.
- **L3** ~180 (cat:166): the same fix for `staleMood.note`. The premise is `mood-tracker` visible at ~174.
- **L3** ~186 (cat:172): `await expect(page.getByTestId('mood-selected-summary').filter({ hasText: 'Selected: Sad' })).toHaveCount(0)`. The `hasText` string keeps getByText's case-insensitive substring semantics.
  - [app hook: src/components/MoodTracker/MoodTracker.tsx:432 `<span className="min-w-0">` (the "Selected: …" summary) add `data-testid="mood-selected-summary"`]

### tests/e2e/mood/mood-kit.spec.ts
- **L3** ~141 (cat:138): `page.getByTestId('mood-tab-tracker').locator('..')` becomes `page.getByTestId('mood-tabs')`.
  - [app hook: MoodTracker.tsx:298 `<div className="flex rounded-full bg-card2 p-1">` add `data-testid="mood-tabs"`]
- **L3** ~209 (cat:206): `await expect(page.getByTestId('mood-selected-summary')).toHaveText(/Selected:.*Happy/)`.

### tests/e2e/mood/mood-tracker.spec.ts
- **L3** ~48: `await expect(page.getByTestId('mood-selected-summary')).toHaveText(/Selected:.*Happy/i)`.

### tests/e2e/notes/love-notes.spec.ts
- **L3** ~46 (cat:29): in the `.or()` branch, `page.getByText('No messages to show')` becomes `page.getByRole('heading', { level: 3, name: 'No messages to show' })`. MessageList.tsx:463 renders it as an `<h3>`. No app change is needed.

### tests/e2e/notes/notes-kit.spec.ts
- **L3** ~170 (cat:150): `message.getByText(uniqueMessage).locator('xpath=../..')` becomes `message.getByTestId('love-note-bubble')`.
  - [app hook: src/components/love-notes/LoveNoteMessage.tsx:353 the bubble `<div className={\`max-w-[78%] overflow-hidden rounded-[20px] …\`}>` add `data-testid="love-note-bubble"`]

### tests/e2e/offline/* — L2 (every unmarked e2e test; all P1: offline-first data paths and needs-a-connection refusals)
- love-notes-offline-send ~110: `'[P1] three notes sent offline survive a reload and reach the partner once each, in order'`.
- interactions-offline-copy:
  - ~92: `'[P1] history loaded online is listed offline after a reload, with the badge'`
  - ~146: `'[P1] a poke sent while offline appears after reconnect without a reload'`
- events-offline-copy ~89: `'[P1] events loaded once online are listed offline on Home and in Settings'`.
- birthdays-wedding-offline:
  - ~107: `'[P1] the cards from one online session show when the server cannot be reached'`
  - ~190: `'[P1] an offline birthday edit is refused with a needs-a-connection message and changes nothing'`
- photos-offline:
  - ~219: `'[P1] after one online session every photo is listed and every image shows offline'`
  - ~286: `'[P1] with storage refused, the oldest image is left out and shows a placeholder offline'`
- love-notes-offline-copy:
  - ~155: `'[P1] a thread loaded online is listed offline after a reload, image included'`
  - ~232: `'[P1] a note written while offline appears after reconnect without a reload'`
- account-data-offline-copy:
  - ~126: `'[P1] an anniversary from one online session is shown when the server cannot be reached'`
  - ~188: `'[P1] a favorite added on the server while offline appears after reconnect'`
  - ~243: `'[P1] a favorite and a custom message from one online session are shown when the server cannot be reached'`
- mood-offline-copy:
  - ~146: `'[P1] a device with an empty moods store shows earlier server moods in the calendar'`
  - ~231: `'[P1] partner moods loaded online are listed offline after a reload'`
- partner-offline-copy ~52: `'[P1] a linked user sees the saved partner offline, never the Connect UI'`.
- couple-settings-offline:
  - ~105: `'[P1] the start date from one online session is shown when the server cannot be reached'`
  - ~169: `'[P1] an offline edit is refused with a needs-a-connection message and changes nothing'`
- needs-a-connection prefixes `[P1] ` onto every test at ~126, 166, 249, 318, 412 (the `${type}` loop, which yields 2 tests), 528, 561 and 600. The ~668 test is renamed by the split below.

### tests/e2e/offline/account-data-offline-copy.spec.ts
- **L3** ~158, ~178 (cat:141/155): `page.getByText(label)` becomes `page.getByRole('heading', { level: 4, name: label })`, using the Settings anniversary `<h4>`.

### tests/e2e/offline/needs-a-connection.spec.ts
- **L3** ~513 (cat:449): in `attachPicture`, `page.locator('input[type="file"][accept*="image/"]')` becomes `page.getByTestId('message-input-file')`. This matches the `photo-upload-file-input` and `import-file-input` convention.
  - [app hook: src/components/love-notes/MessageInput.tsx:249 hidden `<input type="file" …>` add `data-testid="message-input-file"`]
- **L3** ~551 (cat:486): `page.getByText('Failed to send. Try again.')` becomes `page.getByRole('alert').filter({ hasText: 'Failed to send. Try again.' })`, keeping `toHaveCount(0)`. The text renders only in MessageInput's `role="alert"` div at :289, so this is equivalent and needs no hook.
- **M3** ~668 (cat:597) `'shows the offline indicator, and create, edit, delete and import are refused'`: split into four `[P1]` tests inside the existing describe.
  - Shared arrange: move `stampedTexts` to a file-level `stampedCustomTexts(supabaseAdmin, userId, stamp)`, and add `openEditorOffline(page, interceptNetworkCall, saved)`. The helper runs ~686–702 (create the saved row online, row visible, indicator count 0, `goOffline`, indicator `data-status` offline) and returns `row`. Every test therefore still asserts the indicator.
  - Add `expectNothingSaved(page, watch, row, texts, saved)`, which runs ~748–752: `watch.stop()`, requests `[]`, one stamped row, row visible, texts `[saved]`.
  - Each test arms `watchSupabaseRequests(page)` after the helper and keeps `try { … } finally { setOffline(false); soft-delete stamped rows }`, which is the current finally.
  - The four tests:
    - `'[P1] creating a custom message offline is refused and the typed text stays'` covers ~705–710.
    - `'[P1] editing a custom message offline is refused'` covers ~713–717.
    - `'[P1] deleting a custom message offline is refused in the dialog'` covers ~720–724.
    - `'[P1] importing custom messages offline is refused with an alert naming the connection'` covers ~727–746.

### tests/e2e/offline/partner-offline-copy.spec.ts
- **L3** ~85 (cat:76): `page.getByText('Connect with Your Partner')` becomes `page.getByRole('heading', { level: 1, name: 'Connect with Your Partner' })`, keeping `toHaveCount(0)`. PartnerMoodView.tsx:426 renders it as an `<h1>`.

### tests/e2e/offline/photos-offline.spec.ts
- **M7** ~292 (cat:284): the nesting is callback > put fn > if > if > if. Extract a module helper `async function installImageCacheQuota(page: Page, capacity: number)` that calls `page.addInitScript((cap) => {…}, capacity)`.
  - Inside the script, define `const reserve = (id: string) => { if (held.has(id)) return; if (held.size >= cap) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError'); held.add(id); };`.
  - `proto.put` then reads `if (this.name === 'image-cache') { const row = value as {userId:string;path:string}; reserve(JSON.stringify([row.userId, row.path])); }`, so the maximum depth is 3.
  - The test calls `await installImageCacheQuota(page, 2)` along with the existing comment.
  - The helper functions must be declared **inside** the init-script callback, because addInitScript serialises only the function.

### tests/e2e/partner/partner-kit.spec.ts
- **M3** ~89 (cat:86): split three ways inside the `for (colorScheme)` loop.
  - Shared arrange: a module helper `openConnectedPartner(page, interceptNetworkCall, colorScheme)` runs ~95–132 (the four stubs, viewport, emulateMedia, goto, `Promise.all`, view visible) and returns `view`.
  - **A** keeps the name and covers ~135–165: title, ground, mood cards, the 44 px refresh, tiles, overflow, chrome emoji.
  - **B** `'[P1] should show the Fart toast on the kit card with no emoji in ${colorScheme}'` covers ~168–174.
  - **C** `'[P1] should open the History sheet on the kit card inside the viewport in ${colorScheme}'` covers ~178–193.

### tests/e2e/settings/birthdays-wedding.spec.ts
- **M3** ~74 (cat:64; deduplicates rows 98 and 99): split into three `[P1]` tests.
  - Each test runs `resolveOwnPair` + `resetPair` before its try and `finally { partnerContext?.close().catch(()=>{}); resetPair }`, as now.
  - Each pins its own `clockAnchorAvoidingLeapDay([10, 40])`.
  - Shared helpers: `openPartnerSettings(browser, baseURL, authOptions, partnerUserIdentifier, anchor)` covers ~111–122 and returns `{ context, page }`. `openThisHome(page, interceptNetworkCall, anchor)` covers ~101–106.
  - **A** `'[P1] a birthday the partner saves in Settings shows on this Home after reload'` covers the Home "Not set yet" / "Set it in Settings" checks, the partner birthday save (~124–140), the reload and the partner-card h3 / '9 days' checks.
  - **B** `'[P1] a wedding date the partner saves shows on this Home, and clearing it brings back Date TBD'` covers Home 'Date TBD', the wedding save (~142–154, with the dynamic `pairRowExists` status), the reload, '39 days', then clear and reload back to 'Date TBD' (~200–220).
  - **C** `'[P1] each countdown card runs a live clock that fits the card at phone width'` needs both dates set. Seed them via `supabaseAdmin`: `users.update({ birthday })` on the partner, and `couple_settings.upsert({ user_a, user_b, wedding_date }, { onConflict: 'user_a,user_b' })` using the ordered pair. Then open Home and wait on `PARTNER_RECORD_READ`/`COUPLE_SETTINGS_READ`. Then run ~176–198 (setViewport, live clock ticks, half/full-width geometry).
    - Fallback: reuse the partner-UI save helpers if admin seeding is disliked.

### tests/e2e/settings/events-crud.spec.ts
- **M3** ~105 (cat:101) `'[P0] adds, shows on Home, edits, deletes, and lands on the empty state'`: split into four `[P0]` tests.
  - Shared arrange: a module helper `addEventFromSettings(page, interceptNetworkCall, { label, date, description, icon })` runs ~121–141, including the POST 201, form closed and the row date/description checks. Keep rows **created through the UI**, as the file header promises.
  - Each test runs `resolveOwnPair` + `clearPairEvents` + `openSettingsFromHome` + empty-state visible. The file `afterEach(clearOwnPairEvents)` cleans up.
  - **A** `'[P0] adds an event from the empty state and lists it'` covers ~117–141.
  - **B** `'[P0] an event added in Settings shows on Home with no reload'` adds, then runs ~144–154.
  - **C** `'[P0] editing an event changes its label and date in the list and on Home'` adds, goes home and asserts the old card visible (premise for the old-card-gone check), then runs ~157–186.
  - **D** `'[P0] deleting an event behind a confirmation lands on the empty state with its add control'` adds, then runs ~188–203.
- **L3** ~410 (cat:412): `page.getByText('Settings Bygone E2E')` becomes `expect(page.getByRole('main')).not.toContainText('Settings Bygone E2E', { ignoreCase: true })`. The premise is the witness card visible at ~408.

### tests/e2e/settings/events-history-pagination.spec.ts
- **M4** (deduplicates rows 102 and 103): wrap everything from `beforeEach` (~92) to the end (~298) in `test.describe('Settings events history pagination', () => { … })`, including the `for` loop at ~174.
- **M3** ~192 (cat:139): split three ways, all `[P1]`.
  - Shared arrange as module helpers:
    - `tiedSpecs()` returns `{ windowRows, specs }` (~201–207).
    - `expectedOrder(seeded, specs)` covers ~209–211.
    - `pageThroughTiedHistory(page, interceptNetworkCall, total)` covers ~212–219: openSettings, count `2*PAGE_SIZE`, two `loadHistory` calls, load-more enabled and notice visible, then load-more gone.
  - **A** `'[P1] tied dates and microseconds stay ordered through repeated Settings pages'` seeds, pages through, then runs ~220–223.
  - **B** `'[P1] Settings shows Edit only on this account\'s own events'` seeds `[{ dayOffset: 10, label: 'Owned edit probe' }, { dayOffset: 11, label: 'Partner edit probe', owner: 'partner' }]`, opens settings, then runs ~225–229.
  - **C** `'[P1] Home keeps the six nearest of many tied upcoming cards after paging history'` seeds the same tied specs and pages through. Paging through is kept so the store-count `2*PAGE_SIZE` check still proves that Home re-reads over the paged-in history. It then runs ~231–247.

### tests/e2e/settings/settings-kit.spec.ts
- **L3** ~67 (cat:64): `page.getByTestId('events-settings').locator('..')` becomes `page.getByTestId('settings-countdowns-card')`.
  - [app hook: src/components/Settings/Settings.tsx:670 `<div className={CARD}>` (wraps EventsSettings + AnniversarySettings) add `data-testid="settings-countdowns-card"`]
- **L3** ~69 (cat:67): `signOut.locator('..')` becomes `page.getByTestId('settings-sign-out-card')`.
  - [app hook: Settings.tsx:725 `<div className={CARD}>` (Sign out card) add `data-testid="settings-sign-out-card"`]

---

## App hooks
| File:line | Element | Add |
|---|---|---|
| src/App.tsx:579 | auth loader outer `<div className="flex min-h-screen …">` | `data-testid="auth-loading-screen"` |
| src/components/LoginScreen/LoginScreen.tsx:199 | wordmark `<span className="font-lora …">` | `data-testid="login-wordmark"` |
| src/components/LoginScreen/LoginScreen.tsx:203 | tagline `<p>` | `data-testid="login-tagline"` |
| src/components/LoginScreen/LoginScreen.tsx:206 | form card `<div className="grid gap-3.5 rounded-[20px] …">` | `data-testid="login-card"` |
| src/components/love-notes/LoveNotes.tsx:212 | error banner `<p role="alert">` | `data-testid="notes-error-banner"` |
| src/components/love-notes/LoveNoteMessage.tsx:353 | bubble `<div className="max-w-[78%] overflow-hidden rounded-[20px] …">` | `data-testid="love-note-bubble"` |
| src/components/love-notes/MessageInput.tsx:249 | hidden `<input type="file">` | `data-testid="message-input-file"` |
| src/components/MoodTracker/MoodTracker.tsx:298 | segmented track `<div className="flex rounded-full bg-card2 p-1">` | `data-testid="mood-tabs"` |
| src/components/MoodTracker/MoodTracker.tsx:432 | "Selected: …" `<span className="min-w-0">` | `data-testid="mood-selected-summary"` |
| src/components/Settings/Settings.tsx:670 | Countdowns `<div className={CARD}>` | `data-testid="settings-countdowns-card"` |
| src/components/Settings/Settings.tsx:725 | Sign out `<div className={CARD}>` | `data-testid="settings-sign-out-card"` |

No `toMatchSnapshot` exists anywhere in `src` or `tests`, so the added attributes break no snapshot.

## Hazards
- **Shared with other investigators.**
  - `auth-loading-screen` is the id to give the tests/unit rows too: `tests/unit/App.eventsSession.test.tsx:265-272` uses `getByText('Loading...').parentElement` and then `querySelector('svg')`, and `App.callbackNotice.test.tsx:237` also reads the loader. The id sits on the same element that `.parentElement` reaches today, so the svg lookup still works.
  - `love-note-bubble`: the src group's LoveNoteMessage C3 row (corrections.md) asks for "a test id on the text bubble". Agree on one id and one element. The unit test already uses `love-note-text` for the `<p>`, so the bubble id should go on the outer div at :353.
- **Vacuous negation.** `expect(locator).not.toContainText()` passes when the locator matches nothing. Every main-scoped absence check above must keep a prior positive assertion in the same test (listed per row). ErrorBoundary copy cannot use `main`, because the boundary replaces the whole app-container.
- **Case sensitivity.** getByText defaults to case-insensitive; keep `{ ignoreCase: true }` on the replacements.
- **Deno.** `jsr:@std/testing` is not cached, so use `t.step`, and `await` every step or Deno fails the parent with "step not awaited". Moving tests into steps changes the reporter output: 4 top-level tests with nested steps instead of 33 flat tests. CI parses no counts (test.yml:205 runs only the command).
- **Split runtime.** events-history C re-seeds 208 rows. Birthdays-wedding A and B each open a second browser context. Home-kit grows from 2 tests to 10 (each an `openHome`), and partner-kit from 2 to 6. `fullyParallel: true` spreads splits across workers; every split test uses only its worker's pair or account, so no cross-test state is shared.
- **birthdays-wedding C** admin seeding may *create* the pair's `couple_settings` row (`resetPair` then keeps it with `wedding_date` null). B already computes its expected 201/200 dynamically via `pairRowExists`, so it tolerates this. The row has `relationship_start` null, so TimeTogether is unaffected (UNVERIFIED — check that Home shows no difference between a missing row and a null-start row).
- **addInitScript** (photos M7): the quota helpers must live inside the serialised callback. A module-level function referenced from the callback is undefined in the page.
- **events-crud C** must assert the old card visible on Home before editing. Otherwise the "old card gone" check is vacuous. The original got this for free from the preceding Home step.
- **Observations, not in rows** (out of scope; not fixed): home-kit `el.firstElementChild` at ~145 (L3-shaped) and `h3 + div` at ~123/150. birthdays-wedding `h3 + div` / `h3 ~ span`. events.spec `card.locator('svg')` / `h3 ~ p`. `[data-testid^="event-row-"]` / `[data-testid^="mood-button-"]` prefix CSS in events-crud, events-history-pagination and mood-kit.

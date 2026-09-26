# Plan src2 — story 8, rows-src2.txt (121 rows)

Totals: 121 rows → 118 fixed by this plan (after dedupe ~85 distinct edits), 1 already fixed (moodArrayGuards textarea → getByRole('textbox')), 2 verified false positives given a harmless change (DisplayNameSetup :183 L5 rename; MoodHistoryTimeline :68 L3 re-scoped to existing 'mood-note' test id). Line numbers below are current ("~"), located by content.
Parts: A = DisplayNameSetup, InteractionHistory, LoginScreen, MoodTracker, PartnerMoodView, PhotoUpload, PokeKissInterface; B = PhotoGallery, RelationshipTimers; C = Settings.

### src/components/DisplayNameSetup/__tests__/DisplayNameSetup.test.tsx
- L3 ~90 `submitPastNativeValidation`: `fireEvent.submit(container.querySelector('form')!)` → `fireEvent.submit(screen.getByTestId('display-name-form'))`; drop the now-unused `container` destructure (keep the trailing "raw submit: …" comment). [app hook: src/components/DisplayNameSetup/DisplayNameSetup.tsx:257 `<form className="grid gap-5" …>` add `data-testid="display-name-form"`]
- L5 FALSE POSITIVE (catalog :183) ~193 'offline: refused before getUser() or the write, with the offline reason inline' → 'offline: refuses before reading the session or writing, with the offline reason inline' (harmless rename: drops the function name the rule keys on; assertions unchanged).
- L5 ~341 'closes through onCancel without writing anything' → 'Cancel closes the form without writing anything'
- L5 ~364 'closes through onCancel when Escape is pressed' → 'Escape closes the form without writing anything'

### src/components/InteractionHistory/__tests__/InteractionHistory.test.tsx
- L3 ~46 `queryByText('Loading interactions...')` → `queryByTestId('interaction-history-loading')` `.not.toBeInTheDocument()`.
- L3 ~54-55 `getByText('Loading interactions...')` → `expect(screen.getByTestId('interaction-history-loading')).toHaveTextContent('Loading interactions...')`; `queryByText('No interactions yet')` → `queryByTestId('interaction-history-empty')` `.not.toBeInTheDocument()`.
  [app hooks: src/components/InteractionHistory/InteractionHistory.tsx:133 loading `<div className="flex flex-col items-center gap-3 py-10 text-center">` add `data-testid="interaction-history-loading"`; :140 empty-state `<div className="flex flex-col items-center gap-2 py-10 text-center">` add `data-testid="interaction-history-empty"`]

### src/components/LoginScreen/__tests__/LoginScreen.kit.test.tsx
(rows 6, 7, 10, 11 dedupe to the lookups below; rows 8, 9 are the two M3 splits.) Import `within` from `@testing-library/react`.
- L3/L1 lookups, applied inside whichever split test now holds them:
  - ~50 `heading.querySelector('svg')` → `within(heading).getByTestId('login-heading-icon')` (same `toHaveClass('text-accent','fill-current')`).
  - ~63-64 `container.querySelector('form')!` / `form.parentElement!` → `const card = screen.getByTestId('login-card'); expect(card).toContainElement(screen.getByTestId('login-form'));` then existing class + Google containment asserts on `card`.
  - ~76 `expect(google.querySelector('svg')).toBeNull()` → `expect(google.innerHTML).not.toMatch(/<svg\b/)` (keeps "no svg at all"; do NOT use `not.toContainHTML('<svg')` — jest-dom normalises it to `<svg></svg>` and it passes vacuously).
  - ~81 `contact.parentElement` → `const footer = screen.getByTestId('login-footer'); expect(footer).toContainElement(contact); expect(footer).toHaveTextContent('Need an account? Contact admin');`
  - ~97 `fireEvent.submit(container.querySelector('form')!)` → `fireEvent.submit(screen.getByTestId('login-form'))` (keep comment).
  - ~103 `error.querySelector('svg')` not null → `expect(within(error).getByTestId('login-error-icon')).toBeInTheDocument()`.
  - ~104 and ~173 `container.querySelector('.bg-card')` → `screen.getByTestId('login-card')` (`toContainElement(error)` / `(notice)`).
  - ~132 `submit.querySelector('svg')` → `within(submit).getByTestId('submit-button-spinner')` `.toHaveClass('animate-spin')`.
  - ~172 `notice.querySelector('svg')` not null → `expect(within(notice).getByTestId('login-notice-icon')).toBeInTheDocument()`.
- M3 ~43 'renders the artboard: wordmark heading, subtitle, one kit card, footer': split, each test does its own `render(<LoginScreen />)`:
  - 'paints the page and the wordmark heading on the kit' — root `bg-page` (46-47), heading + heading icon (49-50), `getByText('My Love')` classes (51-57), subtitle classes (58-61).
  - 'holds the form and the Google pill in one kit card' — card lookup/classes + form + Google containment (63-66 as rewritten).
  - 'renders Sign in as the pink primary' — 68-70.
  - 'renders Continue with Google as the neutral pill with no brand logo' — 72-76.
  - 'renders the OR divider and the Contact admin footer link' — 78-81 (footer rewritten).
  - 'renders both fields on the kit field surface, not invalid' — 83-89 loop.
  - 'leaves nothing off-kit in the rendered sign-in markup' — `const { container } = render(...)`; `expectOnKit(container.innerHTML)` (91).
- M3 ~120 'keeps the mapped credential message and shows a lucide spinner while signing in': shared arrange → local helper `async function startPendingSignIn(user: UserEvent)` (setup `settle` via `actions.signIn.mockReturnValue(new Promise(...))`, render, type email `person@example.com` + password `wrong-pass`, click submit; returns `{ container, settle }`). Import `type UserEvent`.
  - 'shows a lucide spinner and locks the email field while signing in' — 130-133 (submit text 'Signing in...', spinner testid + `animate-spin`, email disabled).
  - 'maps invalid credentials to the friendly message on the kit' — `await act(async () => settle({ error: { message: 'Invalid login credentials' }, session: null }))`, then 138-141 (login-error text + `expectOnKit`).
  [app hooks: src/components/LoginScreen/LoginScreen.tsx — see App hooks]

### src/components/MoodTracker/__tests__/MoodHistoryTimeline.test.tsx
- L1 ~75 and ~93 `getAllByText('Today')` → `getAllByRole('heading', { name: 'Today' })` (as ~108 already does); ~139 `getByText('Today')` → `getByRole('heading', { name: 'Today' })`.
- L3 FALSE POSITIVE (catalog :68) ~76-77 `getByText('evening')`/`getByText('morning')`: harmless re-scope to the existing note test id: `expect(screen.getAllByTestId('mood-note').map((n) => n.textContent).sort()).toEqual(['evening', 'morning']);` (replaces both lines; also proves exactly two notes render — stronger, not weaker).
- L5 ~112 'renders a date header row through the module-scope row component' → 'renders the date header and the mood row beneath it'.

### src/components/MoodTracker/__tests__/MoodHistoryTimeline.identity.test.tsx
- L5 ~66 'passes the same row component across re-renders' → 'does not remount visible rows when the timeline re-renders'.

### src/components/MoodTracker/__tests__/moodArrayGuards.test.tsx
(rows 16, 17, 18 dedupe.) Import `within`.
- Constants ~161/163: `HAPPY_ICON = 'lucide-smile'`, `TIRED_ICON = 'lucide-battery'` (drop the leading dot; now class names asserted, not selectors; keep doc comments).
- L3/L1 ~172-173 (history, it.each): `icons.querySelectorAll('svg')` → `within(icons).getAllByTestId(/^mood-icon-/)` `.toHaveLength(1)`; `icons.querySelector(HAPPY_ICON)` not null → `expect(within(icons).getByTestId('mood-icon-happy')).toHaveClass(HAPPY_ICON)`.
- ~182-184 (history multi): same: `getAllByTestId(/^mood-icon-/)` length 2; `getByTestId('mood-icon-happy')` `toHaveClass(HAPPY_ICON)`; `getByTestId('mood-icon-tired')` `toHaveClass(TIRED_ICON)`.
- ~206-208 (partner, it.each): `chips.children` → `within(chips).getAllByTestId('partner-mood-chip')` length 1; icon → `within(chips).getByTestId('mood-icon-happy')` `toHaveClass(HAPPY_ICON)`.
- ~216-220 (partner multi): `const chipEls = within(chips).getAllByTestId('partner-mood-chip')`; length 2; `chipEls[0]` 'Happy', `chipEls[1]` 'Tired'; icons as above (happy + tired).
- L1 ~272-277 `avatar()` helper: body → `return screen.getByTestId('partner-mood-avatar');` (update its doc comment).
- ~289 `avatar().querySelector('.lucide-user')` toBeNull → `expect(within(avatar()).queryByTestId('partner-mood-avatar-icon')).not.toBeInTheDocument()`; ~317 not null → `expect(within(avatar()).getByTestId('partner-mood-avatar-icon')).toBeInTheDocument()`.
- already fixed: row 19 (suite :585 `container.querySelector('textarea')`) — ~606 now `expect(screen.getByRole('textbox')).toHaveValue('')`.

### src/components/PartnerMoodView/__tests__/PartnerMoodView.kit.test.tsx
(rows 20, 23, 24, 25, 27, 28 dedupe to the L1 bullets; rows 21, 22 one M3; row 26 one M3.)
- L1 ~113 `getByText('Recent moods')` → `getByRole('heading', { level: 2, name: 'Recent moods' })`.
- L1 ~132 `getByText('Feeling right now')` → `within(screen.getByTestId('partner-mood-card')).getByRole('heading', { level: 2, name: 'Feeling right now' })`.
- L1 ~134 `queryByText('Recent moods')` → `queryByRole('heading', { name: 'Recent moods' })`.
- L1 ~251 `queryByText('Connect with Your Partner')` → `queryByRole('heading', { level: 1, name: 'Connect with Your Partner' })`; ~259 `getByText(...)` → `getByRole('heading', { level: 1, name: 'Connect with Your Partner' })`.
- M3 ~92 'puts the newest mood in the current card and the rest in Recent moods': shared arrange → local helper `renderSeveral()` { `state = makeState({ partnerMoods: SEVERAL }); render(<PartnerMoodView />); const current = screen.getAllByTestId('partner-mood-card')[0]; const list = screen.getByTestId('partner-mood-list'); return { current, list, rows: within(list).getAllByTestId('partner-mood-card') }; }`.
  - keep name 'puts the newest mood in the current card and the rest in Recent moods' — 98-113 (cards length 3, current contents, list exclusion, rows 2 + texts, Recent moods heading via role).
  - 'titles the page with the partner display name' — 96.
  - 'dates the current card by full weekday and the Recent rows by short day' — 116-117 (keep the comment).
  - 'places the action tiles between the current card and Recent moods' — 120-122.
  - 'enables refresh when online' (async) — 124 `await findByTestId(...)).toBeEnabled()`.
- M3 ~147 'reads Offline, disables refresh and shows the offline notice when offline with no moods': shared arrange → helper `renderOfflineWithPendingRead()` (the `finishRead` capture + `makeState({ syncStatus: { isOnline: false }, fetchPartnerMoods: … })` + render; returns `() => finishRead()`).
  - 'reads Offline in the status line when offline' — 155.
  - 'disables refresh when offline' — 156.
  - 'shows the offline notice and the empty state only after the saved copy is read, offline with no moods' (async) — 158-163 including the pre-read absence check and comment.

### src/components/PhotoUpload/__tests__/PhotoUpload.autoClose.test.tsx
- L1 ~95/98 in `uploadToSuccess`: loop guard `!screen.queryByText('Photo uploaded successfully!')` → `!screen.queryByRole('heading', { level: 3, name: 'Photo uploaded!' })`; final check → `expect(screen.getByRole('heading', { level: 3, name: 'Photo uploaded!' })).toBeInTheDocument();` plus keep the copy claim: `expect(screen.getByRole('dialog', { name: 'Upload Photo' })).toHaveTextContent('Photo uploaded successfully!');`. No app change (success step h3 at PhotoUpload.tsx:535; dialog named by `photo-upload-title`). Keep the "Not findByText" comment, reworded to "Not findBy*".

### src/components/PhotoUpload/__tests__/PhotoUpload.offline.test.tsx
- M3 ~63 (rows 70, 71): shared arrange → helper `async function refuseOffline(user: UserEvent)` { render `<PhotoUpload isOpen onClose={vi.fn()} />`; `pickPhoto(user)`; `vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)`; click `photo-upload-submit-button` }.
  - 'refuses Upload with the offline reason; nothing is compressed or uploaded' — 71-74.
  - 'Retry after an offline refusal returns to the preview with the same photo' — click `photo-upload-retry`, then 78-79.
  Each test creates its own `userEvent.setup()`.

### src/components/PhotoUpload/__tests__/PhotoUpload.validation.test.tsx
- M3 ~57 (rows 72, 73): shared arrange → helper `async function rejectGif()` { `const user = userEvent.setup({ applyAccept: false })` (keep the applyAccept comment in the helper); render; `input`; `gif`; `validateImageFile.mockReturnValueOnce({ valid: false, error: REJECTION })`; `await user.upload(input, gif)`; return `{ user, input, gif }` }.
  - 'says why a picked file was rejected and stays on the select step' — 68-69.
  - 'clears the input after a rejection so the same file can be re-picked' — 72-73 (with comment), then 77-80 (second rejection of the same gif fires a change: `validateImageFile` called 2 times, alert still REJECTION).
  - 'clears the error when a valid file is picked after a rejection' — precondition `expect(screen.getByRole('alert')).toHaveTextContent(REJECTION)` (new, strengthens), then 82-86.

### src/components/PokeKissInterface/__tests__/PokeKissInterface.test.tsx
- L1 ~235 `getByText('Send a little something')` → `getByRole('heading', { level: 2, name: 'Send a little something' })` (h2 at PokeKissInterface.tsx:367-372; not mocked in this file).

### src/components/PhotoGallery/__tests__/PhotoGallery.kit.test.tsx
(rows 29-41)
- M3 ~71 'renders the title, count subtitle and a header Upload pill that is not fixed' (rows 34, 36, dedup): split into four tests, each calling `renderGallery()` (beforeEach already seeds 12 photos + names):
  - 'renders the title and the count subtitle with the partner name' — asserts :75 heading, :76-78 subtitle text.
  - 'shows a labelled header Upload pill that is not fixed' — :80 getByTestId upload, :81 aria-label, :82 not fixed, :83 text 'Upload'.
  - 'calls onUploadClick once when the header Upload pill is pressed' — `const user = userEvent.setup()`; :80 lookup, :85 click, :86 toHaveBeenCalledTimes(1).
  - 'lays the grid out in three columns at every width' — :88-91 (grid-cols-3, gap-1.5, no sm/md/lg cols).
- L5 ~94 'hands the header Upload to uploadButtonRef, for the upload dialog focus return' → 'gives the upload dialog the header Upload button to return focus to'.
- L3/L1 ~157, ~163, ~181 owner initial via `querySelector('[aria-hidden="true"]')` (rows 30, 37, 39, 41): → `within(own).getByTestId('photo-grid-item-owner-initial').textContent).toBe('J')` (same for partner 'H' at :163, and `within(badge)...` '🌸' at :181). [app hook: src/components/PhotoGallery/PhotoGridItem.tsx:137 `<span aria-hidden="true">` add data-testid="photo-grid-item-owner-initial"]
- L1 ~158, ~164 sr-only text via `.sr-only` (rows 31, 38, 40): → `const ownText = within(own).getByTestId('photo-grid-item-owner-text'); expect(ownText.textContent).toBe('Uploaded by you'); expect(ownText).toHaveClass('sr-only');` (partner: 'Uploaded by Harper'). The added toHaveClass keeps the guard the class selector gave implicitly. [app hook: PhotoGridItem.tsx:138 `<span id={ownerTextId} className="sr-only">` add data-testid="photo-grid-item-owner-text"]
- L1 ~168-172 uploader via `document.getElementById(tile.getAttribute('aria-describedby'))` (row 32): delete the `describedText` helper; → `expect(ownTile).toHaveAccessibleDescription('Uploaded by you'); expect(partnerTile).toHaveAccessibleDescription('Uploaded by Harper');` (jest-dom; already used in repo, e.g. DisplayNameSetup.test.tsx). Keep the comment at :166-167.
- L1 ~193 and ~215 'Your shared album' by copy (row 33): → `expect(within(empty).getByTestId('photo-gallery-subtitle').textContent).toBe('Your shared album')`; :215 same with `within(wrapper)`. Existing testid at PhotoGallery.tsx:141 — no app change.
- M3 ~186 'shows the empty card and no header Upload' (row 35): split into
  - 'shows the empty card and no header Upload' — keeps :191-201 (heading, subtitle, 'No photos yet' heading, no upload-fab, no photo-gallery, button text 'Upload a photo', button bg-fill); no userEvent.
  - 'calls onUploadClick once when the empty-state Upload button is pressed' — `userEvent.setup()`; `listPhotos.mockResolvedValue([])`; `const onUploadClick = await renderGallery()`; `within(screen.getByTestId('photo-gallery-empty-state')).getByTestId('photo-gallery-empty-upload-button')`, click, :203 toHaveBeenCalledTimes(1).

### src/components/PhotoGallery/__tests__/PhotoImageStates.test.tsx
(rows 42-54) Systematic fix: test ids for the three unlabelled states (tile pulse, viewer spinner, viewer load error) and the position counter; the delete confirmation by `getByRole('dialog', { name: 'Delete Photo?' })` (the dialog is `role="dialog" aria-labelledby="photo-viewer-delete-title"` → h3 "Delete Photo?", PhotoViewer.tsx:715-730; PhotoViewer.focus.test.tsx:315 already queries it this way). One absence matcher: `.not.toBeInTheDocument()`.
- L1 ~106, ~114 `.animate-pulse` (rows 42, 48, 49): :106 → `expect(within(tile).queryByTestId('photo-grid-item-loading')).not.toBeInTheDocument()`; :114 → `expect(within(tile).getByTestId('photo-grid-item-loading')).toHaveClass('animate-pulse')`. [app hook: src/components/PhotoGallery/PhotoGridItem.tsx:99 `<div className="absolute inset-0 animate-pulse bg-card2" />` add data-testid="photo-grid-item-loading"]
- L1 ~152 `overlay.querySelector('.animate-spin')` (rows 44, 50): → `expect(within(overlay).getByTestId('photo-viewer-loading-spinner')).toHaveClass('animate-spin')`. [app hook: src/components/PhotoGallery/PhotoViewer.tsx:638 `<LoaderCircle className="h-12 w-12 animate-spin text-white" />` add data-testid="photo-viewer-loading-spinner" (lucide spreads props onto the svg)]
- L1 ~135, ~142, ~246, ~253 'Failed to load photo' by copy (row 43): presence → `expect(screen.getByTestId('photo-viewer-load-error')).toHaveTextContent('Failed to load photo')`; absence → `expect(screen.queryByTestId('photo-viewer-load-error')).not.toBeInTheDocument()`. [app hook: PhotoViewer.tsx:643 error wrapper `<div className="absolute inset-0 flex flex-col items-center justify-center text-white">` add data-testid="photo-viewer-load-error"]. Retry stays `getByRole('button', { name: 'Retry' })`.
- L1 ~174, ~185, ~255, ~306 position counter by copy (row 45): → `expect(screen.getByTestId('photo-viewer-position')).toHaveTextContent(/Photo 1 of 2 •/)` (same regexes: 2 of 3, 2 of 2, 2 of 2). [app hook: PhotoViewer.tsx:693 `<div className="mb-1 text-sm text-muted">` (the "Photo {n} of {m} •" line) add data-testid="photo-viewer-position"]
- L1 ~220, ~232, ~278, ~286 'Delete Photo?' by copy (rows 46, 51-54): presence → `expect(screen.getByRole('dialog', { name: 'Delete Photo?' })).toBeInTheDocument()`; absence (:232, :286) → `expect(screen.queryByRole('dialog', { name: 'Delete Photo?' })).not.toBeInTheDocument()`. No app change.
- L7 ~234 mixed absence matchers (row 47): convert every `.toBeNull()` absence to `.not.toBeInTheDocument()`: :106 and :142/:253 (handled above), :115 `within(tile).queryByTestId('photo-grid-item-not-saved')`, :136 and :153 `screen.queryByAltText('cap-0')`. After this the file has no `toBeNull`/`not.toBeNull`.

### src/components/PhotoGallery/__tests__/PhotoViewer.focus.test.tsx
(rows 55-68) Systematic fix: every 'Delete Photo?' text lookup → dialog by role+name; the Delete button's spinner → test id.
- L1 'Delete Photo?' by copy (rows 56, 59-68 — the "12 times" count is stale; current sites are 10): presence `findByText`/`getByText('Delete Photo?')` at ~118, ~151, ~260, ~363 → `await screen.findByRole('dialog', { name: 'Delete Photo?' })`; ~223 → `screen.getByRole('dialog', { name: 'Delete Photo?' })`; absence `queryByText('Delete Photo?')` at ~155, ~227, ~243, ~338, ~357 → `screen.queryByRole('dialog', { name: 'Delete Photo?' })` (keep `.not.toBeInTheDocument()`). Viewer's own dialog is named "Photo viewer", so the name filter is unambiguous.
- L1 ~203, ~208 `deleteButton.querySelector('.animate-spin')` (rows 58, 62, 63): → ~203 `expect(within(deleteButton).queryByTestId('photo-viewer-delete-spinner')).not.toBeInTheDocument()`; ~208 `expect(within(deleteButton).getByTestId('photo-viewer-delete-spinner')).toHaveClass('animate-spin')`. Add `within` to the testing-library import. [app hook: src/components/PhotoGallery/PhotoViewer.tsx:774 `<LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />` add data-testid="photo-viewer-delete-spinner"]
- L5 ~180 'runs onClose exactly once per Escape when focus is inside the container' → 'closes the viewer only once per Escape press when focus is inside it'.
- M3 ~192 'deletes exactly one photo on a double-tap of Delete' (row 55): add local helper in the describe
  `async function openPendingDelete()` — `deletePhotoMock.mockClear(); let resolveDelete!: (d: boolean) => void; deletePhotoMock.mockReturnValue(new Promise<boolean>((r) => (resolveDelete = r)));` renders `<PhotoViewer photos={TWO_PHOTOS} selectedPhotoId="photo-2" onClose={vi.fn()} />`, `const user = userEvent.setup()`, clicks 'Delete photo', returns `{ user, deleteButton: await screen.findByRole('button', { name: 'Delete' }), resolve: () => resolveDelete(true) }`. Split:
  - 'deletes exactly one photo on a double-tap of Delete' — spinner absent before (~203), dblClick, calledTimes(1) (~206), spinner shown (~208), calledWith('photo-2') (~209), deleteButton disabled (~215); `resolve()`; waitFor dialog gone (~227); `deletePhotoMock.mockReset()`.
  - 'keeps the confirmation open when Cancel or Escape is pressed while the delete is pending' — `await user.click(deleteButton)`; premise `expect(deletePhotoMock).toHaveBeenCalledTimes(1)` + `expect(deleteButton).toBeDisabled()`; cancel not disabled (~217), click cancel (~218), activeElement is cancel (~221), Escape (~222), dialog still present (~223); `resolve()`; waitFor dialog gone (~227) so the pending finally settles inside the test; `deletePhotoMock.mockReset()`. Keep the comment block (~210-214, ~219-220) with this test.

### src/components/RelationshipTimers/__tests__/CountdownCards.test.tsx
(rows 75-90) Systematic fix: test ids inside the shared `CountdownCard` (tile, icon, value, clock, description — fixed strings, always scoped with `within(card)`), label by `getByRole('heading', { level: 3 })`, and a card-level testId for the anniversary card so `firstElementChild` goes too. Replace the helper block (:38-41) with:
```ts
const tileOf = (card: HTMLElement) => within(card).getByTestId('countdown-tile');
const iconOf = (card: HTMLElement) => within(card).getByTestId('countdown-icon');
const labelOf = (card: HTMLElement) => within(card).getByRole('heading', { level: 3 });
const valueOf = (card: HTMLElement) => within(card).getByTestId('countdown-value');
const clockOf = (card: HTMLElement) => within(card).queryByTestId('countdown-clock');
```
(add `within` to the '@testing-library/react' import). Keep exact `.textContent).toBe(...)` everywhere — do not switch to substring `toHaveTextContent` (the :89 comment says why). Keep the file's `toBeNull()` absence style (it is consistent).
- L1 `h3 + div` value (rows 75, 80, 82, 84, 85, 86, 88): sites :90, :108, :149, :164-165, :179, :190, :201, :210, :242, :262, :270, :332, :341, :356, :374, :418 → `valueOf(card)` (e.g. :90 `expect(valueOf(card).textContent).toBe('1 day')`; :108/:356 `const value = valueOf(card)`; :164 `expect(valueOf(birthday).textContent).toBe(valueOf(event).textContent)`; :418 `valueOf(screen.getByTestId('event-countdown-wedding')).textContent`).
- L1 `h3 ~ span` clock (rows 76, 81, 87, 89): sites :91, :180, :191, :196, :202, :211, :216, :227, :228, :243, :263, :271, :333 → `clockOf(card)?.textContent).toBe(...)`; null checks :202, :271 → `expect(clockOf(card)).toBeNull()`; :227/:228 → `expect(clockOf(screen.getByTestId('event-countdown-today'))).toBeNull()` / `...('event-countdown-wedding')`.
- L1 `h3` label (rows 78, 83): sites :148, :241, :288, :316, :331, :340, :355, :373, :410, :414 → `labelOf(card).textContent).toBe(...)`; :410 → `labelOf(screen.getByTestId('birthday-countdown-self')).textContent`.
- L1 `svg` in tile (row 77): :127 → `expect(iconOf(card)).toHaveClass('lucide-sparkles')`; :244 → `expect(iconOf(card)).toHaveClass('lucide-calendar')`. (The lucide class is the thing proven — which icon — so it stays as the assertion, just not the locator.)
- L1 `p` for the absent hint (row 79): :375 → `expect(within(card).queryByTestId('countdown-description')).toBeNull()`.
- L3 (no row, same systematic fix) `firstElementChild` for the anniversary card at :124, :240, :261, :269 → `screen.getByTestId('anniversary-countdown-1')` (:124), `'anniversary-countdown-2'` (:240), `'anniversary-countdown-3'` (:261, :269); drop the `wrapper` local at :123. `tileOf` no longer uses firstElementChild.
- M3 ~400 'linked: both birthday cards side by side, labelled with display names, then the wedding' (row 90): add `function renderLinked()` inside the describe (the `useAppStore.setState({ ownProfile: SAM, partner: PARTNER, coupleSettings: { ...LINKED, weddingDate: '2026-06-12' } })` + `render(<BirthdayWeddingCards />)`); split into
  - 'linked: shows both birthday cards side by side' — :409 grid-cols-2.
  - 'linked: labels each birthday card with its display name, the partner card in partner tint' — :410-415 (self 'Sam turns 27', partner 'Pat turns 26', partner tile bg-ptint/text-partner).
  - 'linked: counts down to the wedding date' — :416 comment + :417-419 '87 days'.
  The describe's afterEach already resets the store, so each test is independent.

### src/components/Settings/__tests__/AnniversarySettings.a11y.test.tsx
- L1 ~222 (row 91) in 'editing a field drops its error, leaving the other field’s in place': replace `expect(screen.queryByText('Anniversary label cannot be empty')).toBeNull();` with
  `expect(screen.getByRole('alert')).toHaveTextContent('Date is required');` and `expect(screen.getByRole('alert')).not.toHaveTextContent('Anniversary label cannot be empty');` (getByRole throws if the label alert survives as a 2nd alert → stronger). Leave the file's other `toBeNull()` calls alone (no L7 row here).

### src/components/Settings/__tests__/AnniversarySettings.date.test.tsx
- L3 ~45-46 (row 92) getByText('November 26, 2025') / queryByText('November 25, 2025'): after the app hook, use
  `const shown = screen.getByTestId('anniversary-row-date-1');` `expect(shown.textContent).toBe('November 26, 2025');` `expect(shown).not.toHaveTextContent('November 25, 2025');` [app hook: src/components/Settings/AnniversarySettings.tsx:142 `<p className={ITEM_META}>` add `data-testid={`anniversary-row-date-${anniversary.id}`}`]. (Not `anniversary-date-…`: `id="anniversary-date"` is already the form's date input, used by tests/e2e/account-data/cross-device.spec.ts:107.)

### src/components/Settings/__tests__/AnniversarySettings.writes.test.tsx
- L5 ~73 (row 93) 'editing calls updateAnniversary with the row’s id and the form data, then closes' → 'editing saves the changes to the row it was opened from, then closes the form'.
- L7 ~89 (row 94): `expect(screen.queryByRole('heading', { name: 'Edit Anniversary' })).toBeNull()` → `.not.toBeInTheDocument()` (only `toBeNull` in the file).
- L1 ~102 (row 95) 'a rejected add…': `expect(await screen.findByText(OFFLINE)).toBeInTheDocument();` → `expect(await screen.findByRole('alert')).toHaveTextContent(OFFLINE);` (form-level error box is `role="alert"`, AnniversarySettings.tsx:525; no field errors in this flow).
- L1 ~119 (row 96) 'retrying the same add…': `await screen.findByText(OFFLINE);` → `expect(await screen.findByRole('alert')).toHaveTextContent(OFFLINE);`
- L1 ~144 (row 97) 'a rejected update…': same replacement as row 95.
- L1 ~160 (row 98) 'a rejected delete…': `screen.getByText('First date')` → `screen.getByRole('heading', { level: 4, name: 'First date' })` (as line 182 does).

### src/components/Settings/__tests__/EventsSettings.focus.test.tsx
- L7 ~332 and ~552 (row 100): `.not.toBeDisabled()` → `.toBeEnabled()` (`events-form-submit` at 332, `events-delete-cancel` at 552); matches `toBeEnabled()` at ~394.
- M3 ~339-403 (rows 99, 101) it.each 'focuses Refresh after an uncertain $kind and the header after reconciliation': hoist the table to a const `UNCERTAIN_SAVES` (same two objects) and add a local helper inside `describe('EventsSettings form focus')`:
  `async function arrangeUncertainSave({ initialEvents, writeAction })` = everything from `const user = userEvent.setup()` through `await user.click(screen.getByTestId('events-form-submit'))` **plus** `await waitFor(() => expect(screen.getByTestId('events-form-refresh')).toHaveFocus())`; returns `{ user, loadEvents, uncertain, opener, finishRefresh: () => finishRefresh() }` (closure, since `finishRefresh` is assigned only when the 2nd loadEvents runs). Also `async function reconcile(user)` = `await user.click(screen.getByRole('button', { name: 'Refresh events' })); await waitFor(() => expect(screen.queryByTestId('events-form')).not.toBeInTheDocument());`. Then five `it.each(UNCERTAIN_SAVES)` tests:
  - 'focuses an enabled Refresh after an uncertain $kind' — (helper's waitFor focus) + `expect(refresh).toBeEnabled()` + `expect(opener.isConnected).toBe(true)`.
  - 'explains an uncertain $kind in an alert' — `expect(screen.getByRole('alert')).toHaveTextContent(/may already have been saved/i)`.
  - 'wraps Tab between Refresh and Close after an uncertain $kind' — `user.tab()` → close has focus; `user.tab({ shift: true })` → refresh has focus.
  - 'focuses the header Add after reconciling an uncertain $kind' — `reconcile(user)`; `opener.isConnected` toBe openerSurvives; `Boolean(queryByTestId('events-settings-loading'))` toBe loadingAfterRefresh; add has focus; `act(finishRefresh)`; `opener.isConnected` toBe openerSurvives; add still has focus.
  - 'reloads once and shows the saved row after reconciling an uncertain $kind' — `reconcile(user)`; `loadEvents` toHaveBeenCalledTimes(2); `act(finishRefresh)`; `event-row-mine` toHaveTextContent('Saved event'); `uncertain` toHaveBeenCalledTimes(1).
  Every original assertion appears once; order within each test is unchanged.

### src/components/Settings/__tests__/EventsSettings.pagination.test.tsx
- L5 ~174 (row 103) 'uses raw continuation flags: upcoming=$upcoming, past=$past' → 'offers Load more history only when either direction has more: upcoming=$upcoming, past=$past'.
- L1 ~196 (row 104): `expect(screen.queryByText(/No events yet/)).not.toBeInTheDocument()` → `expect(screen.getByTestId('events-settings-empty')).not.toHaveTextContent(/No events yet/)` (the copy is only ever rendered inside that element, EventsSettings.tsx:535-543).
- M3 ~200-237 (rows 102, 105) 'keeps loaded rows while busy, blocks duplicates, and makes a deep own row editable': add helpers after `activateHistory`:
  `async function startHistoryLoad()` → `const user = userEvent.setup(); const pending = deferredLoad(); const loadMoreEvents = vi.fn(() => startPendingHistory(pending)); setStore({ loadMoreEvents }); await renderSection(); return { user, pending, loadMoreEvents };`
  `async function settleDeepPage(pending)` → the `deep` event + `settleHistory(pending, loadOk, { events: [deep, makeEvent(), makeEvent('partner','user-partner')], eventsPagination: pagination(false,false) })`.
  Split into (each calls `startHistoryLoad()` itself):
  - 'exposes the history status as a polite, atomic status region' — status role/aria-live/aria-atomic (no activation needed).
  - 'keeps loaded rows on screen while a history page loads' — `activateHistory`; button accessible name 'Loading history…'; disabled; status text 'Loading history…'; load-region aria-busy 'true'; `event-row-mine` present.
  - 'blocks a duplicate history request while one is in flight' — activate; `user.click(button)`; loadMoreEvents called once.
  - 'parks focus on the header Add and announces exhaustion when the last page lands' — activate; `document.body.focus()` (+ its happy-dom comment); body has focus; `settleDeepPage`; aria-busy 'false'; load-more absent; add has focus; status '3 events loaded. No more history to load.'.
  - 'makes a deep own row from history editable, but not a partner row' — activate; `settleDeepPage`; `event-edit-partner` absent; click 'Edit Event deep'; date '1999-12-31'; description 'Details deep'.

### src/components/Settings/__tests__/EventsSettings.test.tsx
- M3 ~461 (row 106) 'keeps the form write failure when its pending mount load succeeds': extract `async function failSaveDuringMountLoad(user)` (in `describe('EventsSettings list states')`) = setStore(...) + render + openAddForm + fillForm + submitForm + `waitFor(form-error has 'This event did not save')`; returns `{ finishLoad: () => finishLoad() }`. Split:
  - keep name 'keeps the form write failure when its pending mount load succeeds' — helper's waitFor; `act(finishLoad)`; load-error absent; form present; form-error text.
  - 'marks only the load region busy, not the section or the open form, while the mount load is pending' — helper; `loadRegion` aria-busy 'true'; `events-settings` has no aria-busy; loadRegion not.toContainElement(form-error).
- M3 ~572 (row 107) 'shows the truthful empty state and moves focus to Add after a successful Retry': extract `function arrangeEmptyRetry()` (setStore with the two-step loadEvents + clearEventsError; returns `{ loadEvents, clearEventsError, finishRetry: () => finishRetry() }`) and `async function retryFromNotice(user, loadEvents)` = `await renderSection(); await user.click(screen.getByTestId('events-settings-retry')); await waitFor(() => expect(loadEvents).toHaveBeenCalledTimes(2));`. Split:
  - 'clears the stored load error before the Retry reload starts' — clearEventsError called once; `invocationCallOrder[0] < loadEvents invocationCallOrder[1]`.
  - 'swaps Retry for the loading indicator, then shows the truthful empty state after a successful Retry' — waitFor loading present; retry absent; `act(finishRetry)`; waitFor load-error absent; empty present.
  - 'moves focus to Add after a successful Retry' — `act(finishRetry)`; waitFor activeElement is `events-settings-add`.
  (The `waitFor(loadEvents ×2)` inside `retryFromNotice` is needed before `finishRetry`, which is a no-op until the 2nd load runs.)
- L5 ~1211 (row 110) 'routes the save through editEvent with the row id' → 'saves an edit to the row it was opened from rather than adding a new event'.
- L3 ~1469, ~1493 (row 111) `screen.getByTestId('events-form-label').closest('form')!` → `screen.getByTestId('events-form-element')` [app hook: src/components/Settings/EventsSettings.tsx:983 `<form onSubmit={handleSubmit} …>` add `data-testid="events-form-element"`; `events-form` is already the dialog backdrop].
- M3 ~1568 (row 108) 'keeps the form closed after refresh fails and recovers through the list Retry' (inside `describe.each … $kind save reconciliation`): add two helpers beside `prepareForm`:
  `async function startReconciliationRefresh(user)` = deferreds `refresh`/`retry`, `loadEvents` mocked-once ×2, `saveAction().mockResolvedValueOnce(UNREADABLE)`, renderSection, prepareForm, submitForm, waitFor refresh button, `user.click(events-form-refresh)`; returns `{ loadEvents, refresh, retry }`.
  `async function failRefresh(refresh)` = the `act` that patches `eventsError: 'Refresh failed'` and resolves failure.
  Split:
  - 'keeps the form closed with one retryable notice when the reconciliation refresh fails' — start; form absent; loadEvents ×2; failRefresh; load-error count 1 + its text; form absent; `regionLabels()` = labelsAfterRefreshFailure; `expectWrites(1)`; Retry button enabled.
  - 'recovers the saved row through the list Retry after the refresh fails' — start; failRefresh; `user.click(getByRole('button', { name: 'Retry' }))`; loadEvents ×3; loading = loadingDuringRetry; `regionLabels()` = labelsDuringRetry; resolve retry (act); `renderedLabels()` = ['Recovered saved event']; load-error absent; retry absent; form absent; loadEvents ×3; `expectWrites(1)`.
  Destructure `labelsAfterRefreshFailure`/`loadingDuringRetry`/`labelsDuringRetry` as today (already in the callback params).
- M3 ~1700 (row 109) 'keeps the row and shows the returned message when the delete is rejected': extract `async function rejectDeleteAsNotFound(user)` (setStore with not-found removeEvent, renderSection, click delete, click confirm, waitFor alert text). Split:
  - keep name — alert text (helper); confirmation present; `event-row-mine` present; `events-delete-confirm` absent.
  - 'styles the stale-delete Refresh as the kit primary action' — `events-delete-refresh` toHaveClass('bg-fill','text-white') and not.toHaveClass('bg-red-500') (keep the comment).
- L1/L3 ~1922, ~1971 (rows 111, 112, 113) `…querySelector('[tabindex="-1"]')` → `screen.getByTestId('events-form-panel')` / `screen.getByTestId('events-delete-panel')` [app hooks: EventsSettings.tsx:957-960 form `<motion.div ref={panelRef} tabIndex={-1}` add `data-testid="events-form-panel"`; EventsSettings.tsx:1331-1333 delete `<motion.div ref={panelRef} tabIndex={-1}` add `data-testid="events-delete-panel"`]. Stronger: getByTestId throws when absent, where querySelector returned null. The file's motion mock spreads remaining props, so the attribute renders.

### src/components/Settings/__tests__/Settings.displayName.test.tsx
- M3 ~177 (rows 114, 115) 'shows the saved name without a reload': in `describe('completing the form re-reads the row')` add `async function saveNameAs(user, name)` = click change, clear, type `name`, `backend.lookupOwnDisplayName.mockResolvedValue({ status: 'chosen', displayName: name })` (keep the comment), click submit, `await waitFor(() => expect(nameRow().textContent).toBe(name))`. Each test: `const user = userEvent.setup(); await renderSettings('Jessie'); await saveNameAs(user, 'Casey');` then:
  - 'shows the saved name without a reload' — (helper's waitFor row 'Casey'); form `display-name-setup` absent; `lookupOwnDisplayName` called ×2.
  - 'writes the new name to the users row' — `backend.updatePayload` toMatchObject({ display_name: 'Casey' }).
  - 'refreshes Home’s profile copy so its birthday card shows the new name' — `refreshLocalCopy` toHaveBeenCalledWith('profile') (keep comment).

### src/components/Settings/__tests__/Settings.kit.test.tsx
- L1 ~79-80 (rows 116, 117) `queryByText(/Event Countdowns/)` / `(/Anniversary Countdowns/)` → `expect(screen.getByTestId('settings-view')).not.toHaveTextContent(/Event Countdowns/)` and same for `/Anniversary Countdowns/` (test-id scoped, still page-wide; a heading-role query would narrow what the absence proves). `settings-view` exists at Settings.tsx:590.
- L1 ~97 (row 118) version copy → `expect(screen.getByTestId('settings-version').textContent).toBe(`Version ${pkg.version} · made for the two of you`)` [app hook: src/components/Settings/Settings.tsx:699 `<p className="text-[13px] text-muted">Version {__APP_VERSION__} …` add `data-testid="settings-version"`].
- L1 ~104 (row 119) redundant `queryByText('Replay welcome message')`: do not delete; → `expect(screen.getByTestId('settings-view')).not.toHaveTextContent('Replay welcome message')`.
- L1 ~158, ~166 (row 120) 'Signed in' and L3 ~159, 165, 177, 188, 199 (row 121) 'person@example.com' [app hooks: Settings.tsx:613 identity row `<div className={ROW}>` add `data-testid="settings-identity"`; Settings.tsx:623 `<p …>{userEmail}</p>` add `data-testid="settings-email"`]:
  - 'renders no identity row when the user has no email' → `expect(screen.queryByTestId('settings-identity')).not.toBeInTheDocument();` plus keep both absence claims as `expect(screen.getByTestId('settings-view')).not.toHaveTextContent('Signed in')` / `.not.toHaveTextContent('person@example.com')`.
  - 'renders the identity row with the display name initial…' → `expect((await screen.findByTestId('settings-email')).textContent).toBe('person@example.com'); expect(screen.getByTestId('settings-identity')).toHaveTextContent('Signed in');` (avatar assertion unchanged).
  - ~177, ~188, ~199 (avatar-initial tests): `expect(await screen.findByText('person@example.com')).toBeInTheDocument()` → `expect((await screen.findByTestId('settings-email')).textContent).toBe('person@example.com')`.

## App hooks

(part A)
- src/components/DisplayNameSetup/DisplayNameSetup.tsx:257 `<form className="grid gap-5" onSubmit={handleSubmit}>` → add `data-testid="display-name-form"`.
- src/components/InteractionHistory/InteractionHistory.tsx:133 loading wrapper div → `data-testid="interaction-history-loading"`; :140 empty-state wrapper div → `data-testid="interaction-history-empty"`.
- src/components/LoginScreen/LoginScreen.tsx:
  - :194 `<Heart …>` in the h1 → `data-testid="login-heading-icon"`
  - :206 card `<div className="grid gap-3.5 rounded-[20px] border border-line bg-card p-5 shadow-card">` → `data-testid="login-card"`
  - :214 `<Info …>` in the notice → `data-testid="login-notice-icon"`
  - :219 `<form className="grid gap-3.5" …>` → `data-testid="login-form"`
  - :227 `<CircleAlert …>` in the error → `data-testid="login-error-icon"`
  - :280 `<LoaderCircle …>` inside submit-button → `data-testid="submit-button-spinner"`
  - :316 footer `<p className="text-center text-sm text-muted">` → `data-testid="login-footer"`
- src/components/MoodTracker/MoodHistoryItem.tsx:58 `<Icon key=… className="h-5 w-5" aria-hidden="true" />` → `data-testid={`mood-icon-${m}`}`.
- src/components/MoodTracker/PartnerMoodDisplay.tsx:
  - :136-139 avatar `<div … bg-partner … aria-hidden="true">` → `data-testid="partner-mood-avatar"`
  - :145 `<User className="h-5 w-5" aria-hidden="true" />` → `data-testid="partner-mood-avatar-icon"`
  - :180-182 chip `<span key=… className={`flex h-8.5 …`}>` → `data-testid="partner-mood-chip"`
  - :184 `<Icon className="h-4.25 w-4.25" aria-hidden="true" />` → `data-testid={`mood-icon-${m}`}`
- No hook needed: PartnerMoodView, PhotoUpload, PokeKissInterface, MoodHistoryTimeline (role locators / existing ids).


(part B)
- src/components/PhotoGallery/PhotoGridItem.tsx:99 — pulse `<div className="absolute inset-0 animate-pulse bg-card2" />`: data-testid="photo-grid-item-loading"
- src/components/PhotoGallery/PhotoGridItem.tsx:137 — owner initial `<span aria-hidden="true">`: data-testid="photo-grid-item-owner-initial"
- src/components/PhotoGallery/PhotoGridItem.tsx:138 — owner text `<span id={ownerTextId} className="sr-only">`: data-testid="photo-grid-item-owner-text"
- src/components/PhotoGallery/PhotoViewer.tsx:638 — image loading `<LoaderCircle ... animate-spin ...>`: data-testid="photo-viewer-loading-spinner"
- src/components/PhotoGallery/PhotoViewer.tsx:643 — load-error wrapper div (holds "Failed to load photo" + Retry): data-testid="photo-viewer-load-error"
- src/components/PhotoGallery/PhotoViewer.tsx:693 — "Photo {n} of {m} •" div: data-testid="photo-viewer-position"
- src/components/PhotoGallery/PhotoViewer.tsx:774 — Delete button `<LoaderCircle ... animate-spin aria-hidden>`: data-testid="photo-viewer-delete-spinner"
- src/components/RelationshipTimers/CountdownCard.tsx:69 — icon tile div: data-testid="countdown-tile"
- src/components/RelationshipTimers/CountdownCard.tsx:74 — `<Icon ...>`: data-testid="countdown-icon"
- src/components/RelationshipTimers/CountdownCard.tsx:78 — value div: data-testid="countdown-value"
- src/components/RelationshipTimers/CountdownCard.tsx:84 — trailing clock `<span>`: data-testid="countdown-clock"
- src/components/RelationshipTimers/CountdownCard.tsx:89 — description `<p>`: data-testid="countdown-description"
- src/components/CountdownTimer/CountdownTimer.tsx:169 — `<CountdownCard>` in AnniversaryCard: add prop testId={`anniversary-countdown-${anniversary.id}`} (renders as data-testid on the card root)


(part C)
- src/components/Settings/AnniversarySettings.tsx:142 — list row date `<p className={ITEM_META}>` → `data-testid={`anniversary-row-date-${anniversary.id}`}`
- src/components/Settings/EventsSettings.tsx:957-960 — form dialog panel `<motion.div ref={panelRef} tabIndex={-1}` → `data-testid="events-form-panel"`
- src/components/Settings/EventsSettings.tsx:983 — `<form onSubmit={handleSubmit} …>` → `data-testid="events-form-element"`
- src/components/Settings/EventsSettings.tsx:1331-1333 — delete dialog panel `<motion.div ref={panelRef} tabIndex={-1}` → `data-testid="events-delete-panel"`
- src/components/Settings/Settings.tsx:613 — identity row `<div className={ROW}>` (inside `{userEmail && (…)}`) → `data-testid="settings-identity"`
- src/components/Settings/Settings.tsx:623 — email `<p>{userEmail}</p>` → `data-testid="settings-email"`
- src/components/Settings/Settings.tsx:699 — About version `<p>` → `data-testid="settings-version"`
(Proposed ids grep-checked: none exist in src/ or tests/.)


## Hazards

(part A)
- lucide-react forwards `data-testid` to the `<svg>`; confirmed by pattern only (UNVERIFIED by run) — first moodArrayGuards/LoginScreen run confirms.
- moodArrayGuards: `mood-icon-${m}` is the same id in MoodHistoryItem and PartnerMoodDisplay; fine per-render because each test renders one component, but a test rendering both would see duplicates — always scope with `within(...)`.
- moodArrayGuards icon identity: the lucide class is kept as an assertion (`toHaveClass(HAPPY_ICON)`) on the test-id-located icon, so the "happy renders the smile icon" guarantee is not lost; the icon count now counts `mood-icon-*` rather than every svg (a stray non-mood svg in `mood-emoji` would no longer be caught — none exists today).
- LoginScreen card: `form.parentElement === card` becomes `card` contains `login-form` (descendant, not direct child). Equivalent for the kit claim "one card holds the form"; call it out in review.
- LoginScreen "no Google logo": use a regex on `google.innerHTML`; `not.toContainHTML('<svg')` is vacuous.
- LoginScreen spinner split: the spinner test ends with `signIn` pending forever (same as the existing Google-pending test); the credential test must `act()` the settle before asserting.
- PartnerMoodView splits: the offline split tests A/B end with `fetchPartnerMoods` unresolved; `cleanup()` in beforeEach handles unmount. The 'enables refresh when online' test must stay async (`findByTestId`); the other SEVERAL splits are sync like the existing single-mood test.
- PhotoUpload.autoClose runs under fake `setTimeout`: keep the polling loop (`queryByRole`, no `findBy*`), or the auto-close timer the file measures advances.
- MoodHistoryTimeline FP fix sorts note texts, so it does not depend on the timeline's row order.

(part B)
- CountdownCard is shared by BirthdayCountdown, EventCountdown, TimeTogether and CountdownTimer; Home renders several at once, so the inner ids repeat on the page — always `within(card)`, never `screen.getByTestId('countdown-value')`. Keep the markup (h3 / `h3 + div` / `h3 ~ span` / only `<p>`) unchanged: E2E still uses those structural selectors (`tests/e2e/settings/birthdays-wedding.spec.ts:178-228`, `tests/e2e/home/home-kit.spec.ts:123,150`, `tests/e2e/home/events.spec.ts:284` counts `h3 ~ p`). The doc comment at CountdownCard.tsx:14-17 ("Structure is load-bearing for tests") stays true; optionally append that the unit tests use the new test ids — comment-only.
- lucide icons forward `data-testid` to the `<svg>`; CountdownCards.test mocks only `motion/react`, not lucide, so `lucide-sparkles`/`lucide-calendar` classes remain real.
- PhotoViewer is also rendered by PhotoGallery and by other suites (e.g. photoDialogsA11y.test.tsx); the hooks are additive. Two `role="dialog"` elements exist while the confirmation is open ("Photo viewer" and "Delete Photo?") — always pass `name`.
- PhotoGridItem renders once per tile in PhotoGallery.kit (up to 20) — the new owner ids repeat; scope with `within(badge)`/`within(tile)`.
- PhotoViewer.focus M3 split: the second test uses a single click instead of dblClick; its premise asserts (calledTimes(1), Delete disabled) prove the request is pending before Cancel/Escape. Both halves must resolve the pending delete and wait for the dialog to close, or the pending `finally` runs after unmount; both keep the trailing `deletePhotoMock.mockReset()` because that describe has no beforeEach.
- PhotoGallery.kit splits: `renderGallery()` returns the `onUploadClick` spy; the empty-state click test must set `listPhotos.mockResolvedValue([])` itself.
- `toHaveAccessibleDescription` relies on happy-dom resolving `aria-describedby` by id; it already works in DisplayNameSetup.test.tsx and Settings tests, but run the file to confirm.

(part C)
- EventsSettings.focus uncertain-save split: `loadEvents.mockImplementationOnce(...)` must be installed AFTER `renderSection()` (the mount load consumes the default), exactly as now; `finishRefresh` is only assigned when the 2nd load runs, so return it as a closure, not a value. The Tab-wrap test must not click Refresh (Refresh closes the form).
- EventsSettings.pagination focus test: `document.body.focus()` must stay before `settleDeepPage` — the header-focus assertion depends on focus having dropped to body.
- EventsSettings.test 'marks only the load region busy…' ends with the mount load still pending (never resolved). That is what the original did at that point; the promise never settles so no act() warning, but if the implementer sees one, finish with `await act(async () => finishLoad())` (no assertion removed).
- EventsSettings.test 'swaps Retry…'/'moves focus to Add…': call `finishRetry` only after `loadEvents` ×2 (inside `retryFromNotice`), else it is a no-op and the test hangs on waitFor.
- EventsSettings.test is 2188 lines; these splits add ~80 lines. Story 9 (H5) splits the file later — do not split it here.
- Corrections.md "real defect" `EventsSettings.test.tsx:1493` ("the add row asserts nothing at that step") sits in 'blocks direct and keyboard submissions…' next to the row-111 `closest('form')` edit; whoever owns that defect edits the same test. Corrections `EventsSettings.focus.test.tsx:363` (conditional expect) is already gone: the current it.each uses `expect(Boolean(...)).toBe(loadingAfterRefresh)`.
- AnniversarySettings.writes 174-175 still use `queryByText(/No anniversaries yet/)` / `(/Anniversary Countdowns/)`; no row in this group covers them — out of scope, observation only.
- `settings-view` scoping for absence checks assumes EventsSettings/AnniversarySettings render inside it (they do; Settings.kit mounts the real ones).
- Settings.tsx and EventsSettings.tsx are shared with other groups' tests (Settings.birthdayWedding / togetherSince / mobileDataPhotos, EventsSettings.errorIsolation / lifetime, e2e settings specs); adding data-testids does not change their behaviour.
- LoginScreen 'no Google logo': the replacement for `google.querySelector('svg')` is a regex on `google.innerHTML`; it is still a markup check (no role/test id can express 'no svg at all'), so a reviewer may still flag it — it is the least fragile form that keeps the claim.

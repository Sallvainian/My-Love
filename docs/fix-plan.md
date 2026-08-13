# Fix Plan

_Generated 2026-07-25. Triage of the 89 findings in [health-audit.md](./health-audit.md)._

## How this was categorized

The audit says what is wrong. This says **how we work on it** — sorted by what each item needs from you,
not by how bad it is. Severity is still shown on every row.

42 findings that looked like easy fixes were re-checked against the source before being called easy: each
was opened, its callers grepped, its covering tests located, and its proposed fix tested for hidden
alternatives. **24 held up. 15 were demoted to "needs a decision"** — almost always because the audit's fix
text said "either X or Y" and the two options are not interchangeable. **3 were demoted to "bigger code work".**

The remaining 47 are categorized from the audit's own fix text, not re-verified. Entries that were
re-checked against source are marked _(verified)_; everything else was not.

## Duplicates merged

Five pairs describe the same defect twice, so **89 findings are 84 distinct work items**.
One pair the audit itself missed.

| Folded away | Into | Why |
| --- | --- | --- |
| `users-rls-breaks-partner-search` | `partner-search-rls-dead` | Same code, same policy, same remedy. Its unique contribution — a pgTAP regression test for the users SELECT policy — folds into the survivor. |
| `stale-visit-countdowns` | `hardcoded-past-visit-dates` | Both cite `src/config/relationshipDates.ts:52` and describe the same two "Event passed" cards. No residual content in either. |
| `gallery-grid-keeps-deleted-photo` | `photo-delete-stuck-viewer` | Not spotted in the audit. One stale array (`PhotoGallery.tsx:33`) causes both symptoms — the grid keeping the thumbnail and the viewer's permanent spinner. One change fixes both. |
| `together-bookmarks-never-persisted` | `together-bookmarks-not-persisted` | Both cite the same `handleBookmarkToggle` callback at `ReadingContainer.tsx:193-203`. Carry over the one detail only the medium one states: the userId passed to `toggleBookmark` must be the authenticated user, not `session.userId`. |
| `store-not-reset-on-signout` | `logout-leaves-user-data` | Both cite `authSlice.ts:43` — the whole three-field `clearAuth`. Carry over its additive detail: tear down the interactions realtime channel on sign-out. |

## Categories

| Category | Items | What it needs |
| --- | --- | --- |
| **1 · Easy fixes** | 24 | One obvious implementation, at most a few files, no SQL, nothing for you to decide. Each was checked against the real source before landing here. |
| **2 · Needs a decision from you** | 33 | The fix has two or more implementations that produce materially different behaviour. Someone has to choose; an implementer guessing is how features end up half-built. |
| **3 · Database migrations** | 11 | Requires SQL applied to the production database. Different deploy path, larger blast radius, and several are security fixes. |
| **4 · Bigger code work** | 14 | Fully specified — nothing to decide — but touches shared architecture or many files. Not a one-sitting job. |
| **5 · Action only you can take** | 1 | Not a code change. |
| **6 · Test coverage** | 1 | No behaviour change; closes the gap that let other defects ship. |
| _Merged duplicates_ | 5 | — |
| **Total** | **89** | |

## 1 · Easy fixes

One obvious implementation, at most a few files, no SQL, nothing for you to decide. Each was checked against the real source before landing here.

All 24 were verified against source. Each entry below carries the exact edit, the files it touches, and the
tests that cover the code — precise enough to hand to an implementer with no further reading.

| # | Severity | Finding | Files |
| --- | --- | --- | --- |
| 1 | High | Favoriting a past message snaps the card back to today | 1 |
| 2 | High | Editing today's mood INSERTs a new Supabase row every time instead of updating the existing one | 1 |
| 3 | High | Photo upload modal always shows "Photo uploaded! ✨" — photosSlice.uploadPhoto never throws | 2 |
| 4 | High | Gallery uploads send the raw file — compression is never called on the live upload path | 1 |
| 5 | Medium | The authenticated app shell has no error boundary — one render throw is an unrecoverable white screen | 3 |
| 6 | Medium | Entering via /admin skips route setup, disabling browser Back/Forward for the whole session | 1 |
| 7 | Medium | Rehydrated settings bypass SettingsSchema — the pre-hydration validator only checks truthiness | 2 |
| 8 | Medium | navigateToNextMessage sets currentMessage to null on a cache miss, wedging the home screen | 1 |
| 9 | Medium | Birthday card shows the wrong upcoming age on the birthday itself | 1 |
| 10 | Medium | Realtime broadcast handler drops mood_types, collapsing the partner's multi-mood entry to a single emoji | 1 |
| 11 | Medium | Timeline shows 'No mood history yet' instead of the error whenever the first page fails to load | 2 |
| 12 | Medium | Failed love-note sends orphan the uploaded image in storage, and retry uploads a second copy | 1 |
| 13 | Medium | useLoveNotes is mounted twice, causing a duplicate initial fetch and two realtime subscriptions on the same topic | 1 |
| 14 | Medium | unviewedCount counts the user's own outgoing pokes as unviewed notifications | 1 |
| 15 | Medium | A failed reflection-summary save shows the user nothing — the Continue button just stops working | 3 |
| 16 | Medium | The report's error banner and Retry button are dead code — a failed fetch renders a blank report instead | 1 |
| 17 | Medium | Couple stats never refresh after completing a session — the overview still shows the pre-session numbers | 1 |
| 18 | Low | setView pushes a browser history entry even when the view is unchanged | 1 |
| 19 | Low | App subscribes to the entire Zustand store, re-rendering the whole tree on every store write | 3 |
| 20 | Low | Manually re-viewing the welcome splash resets the 60-minute auto-display timer, contrary to the stated intent | 1 |
| 21 | Low | Anniversary countdown shows "364 days" on the anniversary itself instead of "Today is X!" | 1 |
| 22 | Low | getRelativeTime uses wall-clock hours while date headers use calendar days — the same mood reads 'Yesterday' under a 'Nov 15' header | 2 |
| 23 | Low | Realtime channel leaks when the partner view unmounts before the subscribe promise resolves | 2 |
| 24 | Low | lock_in_status_changed is applied without checking step_index, so a superseded lock shows a false 'partner is ready' on the next verse | 2 |

### A1. Favoriting a past message snaps the card back to today

**High** · `src/stores/slices/messagesSlice.ts:126` · `favorite-jumps-back-to-today`

**What you see:** User swipes back three days, finds a message they love, taps the heart — the heart animation fires and the card immediately animates away and replaces itself with today's message. Their place in history is lost.

**Do this:** In `createMessagesSlice`'s `toggleFavorite` (src/stores/slices/messagesSlice.ts:109-130), delete lines 124-126 — the blank line, the comment `// Update current message if it's the one being favorited`, and the call `get().updateCurrentMessage();`. Nothing else changes: the `set()` at lines 113-123 already updates both `messages` (line 115 flips `isFavorite`) and `messageHistory.favoriteIds` (lines 119-121), and the `try/catch` stays. Do NOT add the `shownMessages` re-resolve — nothing reads `currentMessage.isFavorite` anywhere in src/ (only messagesSlice.ts:95/115/119, storage.ts:270/275, customMessageService.ts:75 and data/defaultMessages.ts write it), so refreshing `currentMessage` has no observable effect. `updateCurrentMessage` keeps its other caller, settingsSlice.ts:148 in `initializeApp`.

**Files:** `src/stores/slices/messagesSlice.ts`

**Tests over this code:** tests/unit/stores/settingsSlice.initializeApp.test.ts asserts `expect(updateCurrentMessage).toHaveBeenCalledTimes(1)` (lines 100, 124) but it builds a hand-rolled store with a `vi.fn()` for `updateCurrentMessage` and exercises only `initializeApp` — it never calls `toggleFavorite`, so it is unaffected. No unit test imports messagesSlice; no e2e test under tests/e2e/ mentions favorite/heart (grep found only unrelated "heartbeat" hits in scripture specs).

### A2. Editing today's mood INSERTs a new Supabase row every time instead of updating the existing one

**High** · `src/api/moodSyncService.ts:93` · `mood-edit-inserts-new-row`

**What you see:** Every time the user changes their mood or note for today, the partner's mood list gains another entry for today. After three tweaks the partner sees four separate 'today' cards, and the Timeline tab shows four rows under the 'Today' header.

**Do this:** src/api/moodSyncService.ts only. In `MoodSyncService.syncMood` (line 75), keep the `isOnline()` guard (77-79) and the `moodInsert` construction (83-90), then replace line 93 `const syncedMood = await moodApi.create(moodInsert);` with:
```
let syncedMood: SupabaseMoodRecord;

if (mood.supabaseId) {
  try {
    syncedMood = await moodApi.update(mood.supabaseId, {
      mood_type: moodInsert.mood_type,
      mood_types: moodInsert.mood_types,
      note: moodInsert.note,
    });
  } catch (error) {
    if ((error as { code?: string }).code === 'PGRST116') {
      syncedMood = await moodApi.create(moodInsert);
    } else {
      throw error;
    }
  }
} else {
  syncedMood = await moodApi.create(moodInsert);
}
```
Leave the broadcast block (96-101) and `return syncedMood;` (103) untouched. Deliberately omit `user_id` and `created_at` from the update payload so the row's original log time survives an edit (`moodService.updateMood` refreshes `timestamp` to `new Date()` at moodService.ts:132, and the partner derives the displayed date from `created_at` at moodSlice.ts:307/318). The PGRST116 probe is duck-typed rather than `instanceof` because `SupabaseServiceError` is module-private in src/api/errorHandlers.ts:16 — but it carries a public `code` field (line 17) populated from the PostgrestError by `handleSupabaseError` (errorHandlers.ts:72), and `'PGRST116'` is already in its message map at line 66. `(error as { code?: string })` satisfies the no-explicit-any rule. `syncMoodWithRetry` (line 269) and `markAsSynced(mood.id, syncedMood.id)` (line 223) need no change: on the update path `syncedMood.id === mood.supabaseId`, so the local row is re-marked with the same id. Optionally add `mood_types: z.array(MoodTypeSchema).optional(),` to `MoodUpdateSchema` (supabaseSchemas.ts:137-144) for consistency — it is not required for the fix.

**Files:** `src/api/moodSyncService.ts`

**Tests over this code:** None found. There is no test file for moodSyncService or moodApi. tests/unit/stores/moodSlice.test.ts mocks the whole module (`vi.mock('@/api/moodSyncService', ...)` at line 14), so it never exercises the real `syncMood`. tests/unit/services/moodService.test.ts covers only IndexedDB CRUD (create/updateMood/getMoodForDate/getUnsyncedMoods/markAsSynced). tests/e2e/mood/mood-tracker.spec.ts and tests/e2e/partner/partner-mood.spec.ts do not assert row counts in Supabase.

> **Order:** do `mood-sync-double-write` first. Both rewrite moodSyncService.syncMood's single write statement (`const syncedMood = await moodApi.create(moodInsert);`, line 93). mood-sync-double-write's remedy is a client-generated stable `id` plus `upsert(moodInsert, { onConflict: 'id', ignoreDuplicates: true })`. Land that alone and every edit of today's mood becomes a silent no-op — the row already exists, so ignoreDuplicates discards the new note and mood_types. The identity scheme has to be designed with the create-vs-update branch in the same change: stable id first, then branch on `mood.supabaseId` to update rather than ignore.

### A3. Photo upload modal always shows "Photo uploaded! ✨" — photosSlice.uploadPhoto never throws

**High** · `src/components/PhotoUpload/PhotoUpload.tsx:89` · `photo-upload-false-success`

**What you see:** User uploads a photo that the server rejects (over the bucket's 10MB limit, quota above 95%, RLS failure, network drop). The modal shows the green check and "Photo uploaded! ✨", auto-closes after 3s, and the photo is nowhere in the gallery. No error is ever shown.

**Do this:** (1) src/stores/slices/photosSlice.ts — change the interface member on line 34 from `uploadPhoto: (input: PhotoUploadInput) => Promise<void>;` to `=> Promise<boolean>;`. In the implementation starting line 62: change the bare `return;` on line 76 (quota >= 95 branch) to `return false;`; add `return true;` as the last statement of the `try` block, after the post-upload quota check that ends at line 116; add `return false;` as the last statement of the `catch` block, after the `set({...})` that ends at line 123. No other slice method changes. (2) src/components/PhotoUpload/PhotoUpload.tsx — in `handleUpload`, replace line 87 `await uploadPhoto(input);` with:
```
const uploaded = await uploadPhoto(input);

if (!uploaded) {
  setError(useAppStore.getState().error || 'Failed to upload photo');
  setStep('error');
  return;
}
```
`useAppStore` is already imported on line 4. Read the message via `getState()` rather than destructuring `error` from `useAppStore()` on line 14 — the handler's closure would capture a stale value, and `error` is a key shared with appSlice's global error (appSlice.ts:21/26), so a live subscription would also render unrelated app errors inside the photo modal. `setStep('error')` makes the existing error panel at PhotoUpload.tsx:364-371 render (it is gated on `step === 'preview' || step === 'error'` at line 251) and shows the existing Retry button at lines 392-400. Do not change hooks/usePhotos.ts:35 — `async (input) => { await uploadPhotoAction(input); }` (lines 103-108) stays type-correct when the action returns a boolean.

**Files:** `src/stores/slices/photosSlice.ts`, `src/components/PhotoUpload/PhotoUpload.tsx`

**Tests over this code:** tests/e2e/photos/photo-upload.spec.ts only opens the modal and selects a file (asserts `photo-upload-preview-image` and `photo-upload-submit-button` at lines 82-83) — it never submits, so it is unaffected. tests/e2e/photos/photo-gallery.spec.ts does not touch the upload slice. No unit test exists for photosSlice or PhotoUpload (tests/unit/stores/ contains only moodSlice, scriptureReadingSlice*, settingsSlice.initializeApp).

### A4. Gallery uploads send the raw file — compression is never called on the live upload path

**High** · `src/components/PhotoUpload/PhotoUpload.tsx:77` · `gallery-upload-skips-compression`

**What you see:** Every gallery photo is stored at full original size. The modal claims "Will compress to ~X KB" and "Compressing and saving...", but a 8MB phone photo consumes 8MB of the 1GB quota. Anything over 10MB is silently rejected by the bucket (and, per the finding above, still reported as success).

**Do this:** src/components/PhotoUpload/PhotoUpload.tsx only. (1) Add `import { imageCompressionService } from '../../services/imageCompressionService';` after line 3. (2) In `handleFileSelect`, replace the bespoke checks on lines 36-48 (the `validTypes` array + `maxSize = 50 * 1024 * 1024` gate and its 'File size must be less than 50MB' message) with the service's own validator, mirroring PhotoUploader.tsx:145-155:
```
const validation = imageCompressionService.validateImageFile(file);
if (!validation.valid) {
  setError(validation.error || 'Invalid file');
  return;
}
if (validation.warning) {
  setWarning(validation.warning);
}
```
This enforces the 25MB limit and the JPEG/PNG/WebP allow-list from a single source (imageCompressionService.ts:137-160) and populates the already-rendered warning panel at lines 374-381. (3) In `handleUpload`, keep the existing `img` load at lines 67-74 (it supplies the fallback dimensions) and insert `const result = await imageCompressionService.compressImage(selectedFile);` immediately before line 76, then rewrite the input literal at lines 76-83 as:
```
const input = {
  file: result.blob,
  filename: selectedFile.name,
  caption: caption.trim() || undefined,
  mimeType: result.blob.type as 'image/jpeg' | 'image/png' | 'image/webp',
  width: result.width || img.naturalWidth,
  height: result.height || img.naturalHeight,
};
```
Leave `URL.revokeObjectURL(imageUrl)` at line 85 where it is. Do NOT delete src/components/photos/PhotoUploader.tsx as part of this change — it is unreferenced (grep for `PhotoUploader` outside its own file returns nothing) and belongs to the separate dead-code finding. Note this edit overlaps findings `photo-upload-false-success` in the same `handleUpload` function; apply both together.

Context worth knowing: the `photos` storage bucket has a hard 10MB cap (supabase/migrations/20251203190800_create_photos_table.sql:86 `VALUES ('photos', 'photos', false, 10485760)  -- 10MB limit`), which compression at 2048px/0.8 quality (config/images.ts:16-22) comfortably clears.

**Files:** `src/components/PhotoUpload/PhotoUpload.tsx`

**Tests over this code:** tests/e2e/photos/photo-upload.spec.ts uses a 1x1 JPEG well under both limits and stops at the preview step (lines 75-84) — unaffected by the gate change or the compression call. No unit tests cover imageCompressionService, PhotoUpload, or PhotoUploader. tests/unit/utils/ and tests/unit/services/ contain nothing photo-related.

### A5. The authenticated app shell has no error boundary — one render throw is an unrecoverable white screen

**Medium** · `src/main.tsx:44` · `no-root-error-boundary`

**What you see:** Any uncaught error in the home view, the bottom navigation, the photo modals, or in one of App's own effects blanks the entire page. No message, no Try Again, no Clear Storage button — the only escape is for the user to know to clear site data manually.

**Do this:** 1) src/main.tsx — add `import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary';` to the import block at the top of the file. Then change the render call at lines 41-47 to:
```tsx
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LazyMotion features={domAnimation}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </LazyMotion>
  </StrictMode>
);
```
2) src/App.tsx — `ErrorBoundary` is already imported at line 3. In the `App` component's final `return` (line 516 `return (` through line 607 `);`), wrap the `<div className="min-h-screen pb-16" data-testid="app-container">` block in `<ErrorBoundary>` … `</ErrorBoundary>` and re-indent the wrapped JSX by 2 spaces. Do not move or rename `data-testid="app-container"` (line 517) — E2E selectors depend on it.
3) src/utils/themes.ts — in `getTheme` (lines 66-68), change the body `return themes[themeName];` to `return themes[themeName] ?? themes.sunset;`. This compiles cleanly: `noUncheckedIndexedAccess` is not enabled in tsconfig.app.json, and `@typescript-eslint/no-unnecessary-condition` is not in eslint.config.js (only `tseslint.configs.recommended`, no type-checked preset), so the `??` will not be flagged. Note this same one-line edit is also requested by the `hydrated-settings-unvalidated` finding — do it once.

**Files:** `src/main.tsx`, `src/App.tsx`, `src/utils/themes.ts`

**Tests over this code:** None found. `grep -rn "utils/themes|applyTheme|getTheme"` over src and tests returns only src/App.tsx:22,310 and src/utils/themes.ts itself — no test imports it. No unit test imports src/main.tsx or src/App.tsx (only src/**/__tests__ for scripture-reading, Navigation, love-notes, hooks, services, api/auth exist). E2E specs (tests/e2e/**) select by data-testid (`app-container`, `bottom-navigation`, `nav-*`, `login-screen`), all of which stay in place under the new wrappers.

### A6. Entering via /admin skips route setup, disabling browser Back/Forward for the whole session

**Medium** · `src/App.tsx:147` · `admin-route-kills-popstate`

**What you see:** After a user opens the admin panel and clicks "Exit Admin", the browser's Back and Forward buttons stop working for the rest of the session — the URL in the address bar changes but the rendered view does not, leaving URL and UI permanently out of sync.

**Do this:** In src/App.tsx, inside the routing `useEffect` that starts at line 143, change lines 144-148 from:
```ts
    // Check admin route
    if (window.location.pathname.includes('/admin')) {
      setShowAdmin(true);
      return; // Don't set up navigation listeners for admin panel
    }
```
to:
```ts
    // Check admin route (does not short-circuit: routing must still be wired up
    // so Back/Forward keeps working after the user exits the admin panel)
    if (window.location.pathname.includes('/admin')) {
      setShowAdmin(true);
    }
```
Everything from line 150 (`const routePath = getRoutePath(...)`) through the cleanup at 187-189 then runs unconditionally, so `setView(initialView, true)` (line 164) resolves `/admin` to `'home'` via the fallback chain at 152-163 and the `popstate` listener at line 185 is always installed. Leave the dep array `[setView]` (line 190) unchanged — `setShowAdmin` is a stable setState. Do NOT derive `showAdmin` from the URL; keeping it as state at line 110 preserves today's behaviour that Back does not close the admin panel (the `if (showAdmin)` branch at line 505 still wins over `currentView`).

**Files:** `src/App.tsx`

**Tests over this code:** tests/e2e/navigation/routing.spec.ts holds the 3 tests that cover this code ('[P0] should load correct view from direct URL' line 17, '[P0] should support browser back button' line 27, '[P0] should fallback to home view for unknown routes' line 48). None of them visits /admin, and for non-admin paths the code path is byte-identical after the change, so they are unaffected. `grep -rn "/admin" tests` returns no matches — there is no admin E2E coverage at all. Adjacent pre-existing bug, out of scope and NOT part of this fix: `handleAdminExit` at App.tsx:490 does `window.history.pushState({}, '', window.location.pathname.replace('/admin', ''))`, which in dev (pathname `/admin`) produces an empty-string URL that resolves back to the current URL, so the address bar does not actually change.

### A7. Rehydrated settings bypass SettingsSchema — the pre-hydration validator only checks truthiness

**Medium** · `src/stores/useAppStore.ts:31` · `hydrated-settings-unvalidated`

**What you see:** Structurally invalid settings restored from localStorage flow straight into the store and are then used as if validated, producing a hard crash in an effect rather than a graceful fallback.

**Do this:** 1) src/stores/useAppStore.ts — add `import { SettingsSchema } from '../validation/schemas';` to the import block (after line 3, `import { logger } from '../utils/logger';`). Then inside the custom `getItem` (lines 87-115), between the `validateHydratedState` block that ends at line 106 and the existing `return str;` at line 109, insert:
```ts
            // Schema-validate persisted settings; drop just `settings` on failure
            // so Zustand's shallow merge falls back to the settingsSlice defaults.
            if (data.state?.settings) {
              const settingsResult = SettingsSchema.safeParse(data.state.settings);
              if (!settingsResult.success) {
                console.error(
                  '[Storage] Persisted settings failed schema validation:',
                  settingsResult.error.issues
                );
                console.warn('[Storage] Dropping persisted settings - defaults will be used');
                delete data.state.settings;
                return JSON.stringify(data);
              }
            }
```
This is safe with the default persist merge (`{...currentState, ...persistedState}`): with `settings` absent from the persisted object, the slice default at src/stores/slices/settingsSlice.ts:55-71 survives. `data` is already implicitly-any from `JSON.parse(str)` at line 93, so no explicit `any` is introduced and the `no-explicit-any` rule is not triggered. zod v4 (`import { z } from 'zod/v4'`, schemas.ts:1) provides `safeParse` and `error.issues`.
2) src/utils/themes.ts — in `getTheme` (lines 66-68) change `return themes[themeName];` to `return themes[themeName] ?? themes.sunset;`. This is the same one-line edit requested by the `no-root-error-boundary` finding; apply it once.

**Files:** `src/stores/useAppStore.ts`, `src/utils/themes.ts`

**Tests over this code:** tests/unit/stores/settingsSlice.initializeApp.test.ts is the only settings-store unit test and it builds a standalone store with `create<TestState>()` composing `createSettingsSlice` directly (lines 32-56) — it never touches `useAppStore` or the persist middleware, so it is unaffected. Files importing `useAppStore` in tests (tests/unit/hooks/useScriptureBroadcast.test.ts, useScriptureBroadcast.reconnect.test.ts, src/components/scripture-reading/__tests__/{ScriptureOverview,LobbyContainer,ReadingContainer,SoloReadingFlow}.test.tsx, src/hooks/__tests__/useRealtimeMessages.test.ts) run against an empty happy-dom localStorage, so `getItem` returns null before reaching the new code. E2E is safe: I decoded tests/.auth/user.json and its persisted `my-love-storage` settings are `{themeName:'sunset', notificationTime:'09:00', relationship:{startDate:'2025-10-18', partnerName:'Gracie', anniversaries:[]}, customization:{...}, notifications:{...}}`, which satisfies SettingsSchema in full. tests/support/helpers/scripture-cache.ts:18 only removes the key. No test asserts on the current `getItem` return value.

> **Order:** do `theme-system-unreachable` first. hydrated-settings-unvalidated and no-root-error-boundary both ask for a fallback in themes.ts:66-68 (`return themes[themeName]` with no guard). theme-system-unreachable option (a) is to 'delete the unused theme machinery (setTheme, the non-sunset entries in themes.ts)' — which changes what the fallback should be and may remove the lookup entirely. Pick the theme direction first so the guard is written once against the surviving shape.

### A8. navigateToNextMessage sets currentMessage to null on a cache miss, wedging the home screen

**Medium** · `src/stores/slices/messagesSlice.ts:304` · `forward-nav-null-message-wedge`

**What you see:** The message card disappears and is replaced by the pulsing "Loading your daily message..." spinner, then 10 seconds later by the red "Failed to load message" screen. The rest of the home screen (timers) keeps working, so it looks like the message feature crashed.

**Do this:** src/stores/slices/messagesSlice.ts, inside `navigateToNextMessage` (declared line 265). Replace lines 293-305 (the block from the comment `// Load message for target date (should be cached)` through the closing `});` of the `set` call) with:

```ts
    // Load message for target date (compute + cache on miss, mirroring navigateToPreviousMessage)
    const updatedShownMessages = new Map(messageHistory.shownMessages);
    let messageId = updatedShownMessages.get(dateString);

    if (!messageId) {
      const message = getDailyMessage(rotationPool, targetDate);
      messageId = message.id;
      updatedShownMessages.set(dateString, messageId);
    }

    // Update state
    set({
      messageHistory: {
        ...messageHistory,
        currentIndex: newIndex,
        shownMessages: updatedShownMessages,
      },
      currentDayOffset: newIndex, // Keep for backward compatibility
    });

    // Update currentMessage to trigger UI re-render
    const targetMessage = messages.find((m) => m.id === messageId);
    if (targetMessage) {
      set({ currentMessage: targetMessage });
    }
```

Notes: `messageId` changes from `const` to `let`. `getDailyMessage` is already imported at line 26; `rotationPool` is already computed at line 271 and `targetDate`/`dateString` at lines 289-291. The trailing `logger.debug` at line 307 still references `dateString` and `messageId`, both still in scope. No other line changes.

**Files:** `src/stores/slices/messagesSlice.ts`

**Tests over this code:** None found. `grep -rln "navigateToNext|navigateToPrevious" tests src --include="*.test.ts" --include="*.test.tsx" --include="*.spec.ts" --include="*.spec.tsx"` returns no matches (rc=1). tests/unit/utils/messageRotation.test.ts exercises `getDailyMessage`/`getAvailableHistoryDays` directly and is unaffected. No unit test file exists for messagesSlice (tests/unit/stores/ contains only moodSlice, scriptureReadingSlice.*, settingsSlice.initializeApp).

### A9. Birthday card shows the wrong upcoming age on the birthday itself

**Medium** · `src/config/relationshipDates.ts:75` · `birthday-age-off-by-one`

**What you see:** On the birthday, the card correctly says "Happy Birthday! 🎉" but the subtitle reads "Turning 30" when the person is actually turning 29 that day — one year too high, all day long.

**Do this:** src/config/relationshipDates.ts, function `getNextBirthday` (lines 67-80). Insert after line 69 (`const thisYear = today.getFullYear();`):

```ts
  const startOfToday = new Date(thisYear, today.getMonth(), today.getDate());
```

and change line 75 from `if (birthdayThisYear <= today) {` to `if (birthdayThisYear < startOfToday) {`. Update the comment on line 74 to `// If birthday has already passed this year, use next year`. Return type stays `Date`; `getUpcomingAge` (line 85) needs no change and then yields the correct age.

Consumer check — src/components/RelationshipTimers/BirthdayCountdown.tsx:28-32 calls `getNextBirthday` then `calculateTimeDifference(now, nextBirthday)`. On the birthday itself `nextBirthday` is now midnight today, so `timeDiff.isPast` becomes true and `totalDays` (line 65) becomes 0. That is not rendered: line 107 branches on `isBirthdayToday` (computed independently at line 32 as a month/day match) and the true branch renders only "Happy Birthday! 🎉" at lines 113-115. The `totalDays`/hh:mm:ss block at lines 118-129 is the else branch, unreached on the birthday. No other consumer exists (`grep -rn "getNextBirthday|getUpcomingAge"` over src and tests returns only relationshipDates.ts and BirthdayCountdown.tsx).

**Files:** `src/config/relationshipDates.ts`

**Tests over this code:** None found. `grep -rln "relationshipDates|birthday-countdown|Turning" tests src --include="*.test.ts" --include="*.test.tsx" --include="*.spec.ts" --include="*.spec.tsx"` returns nothing. tests/e2e-archive/home-view.spec.ts:31 has a `[P0] should display countdown timers` test but that directory is outside every playwright project testDir and does not run.

### A10. Realtime broadcast handler drops mood_types, collapsing the partner's multi-mood entry to a single emoji

**Medium** · `src/api/moodSyncService.ts:370` · `partner-broadcast-drops-mood-types`

**What you see:** When the partner logs 'Happy + Grateful + Loved' the live update shows only '😊 Happy'. After a manual refresh or app reload the same entry correctly shows '😊✨❤️ Happy, Grateful, Loved' — so the display silently changes meaning behind the user's back.

**Do this:** In `subscribeToPartnerMoods` in src/api/moodSyncService.ts, inside the `.on('broadcast', { event: 'new_mood' }, (payload) => {...})` handler, insert one line after line 373 (`mood_type: payload.payload.mood_type,`) and before line 374 (`note: payload.payload.note,`):
```
          mood_types: payload.payload.mood_types,
```
Type-safe as written: `SupabaseMoodRecord` is `SupabaseMood` (src/api/moodSyncService.ts:25), whose `mood_types` field is `z.array(MoodTypeSchema).nullable().optional()` (src/api/validation/supabaseSchemas.ts:115), and `payload.payload` is loosely typed by supabase-js, matching how the five sibling properties already compile. No `any` annotation is introduced, so the no-explicit-any ESLint rule is unaffected. Do NOT add the `safeParse` wrapper in the same change: `SupabaseMoodSchema` requires `id` and `user_id` to be valid UUIDs and `created_at`/`updated_at` to be non-undefined, so a parse gate would silently swallow legitimate broadcasts unless the send side is audited too — that belongs in a separate change.

**Files:** `src/api/moodSyncService.ts`

**Tests over this code:** None found. src/hooks/__tests__/usePartnerMood.test.ts is the only test touching this area and it mocks `moodSyncService.subscribeToPartnerMoods` wholesale (lines 94-100, 139-145, 228), capturing the callback and invoking it with hand-built `SupabaseMoodRecord` objects — the broadcast handler body at line 366-380 is never executed. There is no moodSyncService test file.

### A11. Timeline shows 'No mood history yet' instead of the error whenever the first page fails to load

**Medium** · `src/components/MoodTracker/MoodHistoryTimeline.tsx:165` · `timeline-error-unreachable`

**What you see:** When mood history fails to load — offline, expired session, or any Supabase error — the Timeline tab tells the user 'No mood history yet / Start logging your moods to see your emotional journey'. A user with months of logged moods is told they have none, with no error and no retry affordance.

**Do this:** 1. src/hooks/useMoodHistory.ts — lift the async function out of the effect. Replace lines 51-72 with:
```
  const loadInitialMoods = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await moodApi.getMoodHistory(userId, 0, PAGE_SIZE);

      setMoods(data);
      setHasMore(data.length === PAGE_SIZE);
      setOffset(PAGE_SIZE);
    } catch (err) {
      console.error('[useMoodHistory] Failed to load initial moods:', err);
      setError(err instanceof Error ? err.message : 'Failed to load mood history');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadInitialMoods();
  }, [loadInitialMoods]);
```
`useCallback` is already imported at line 10. Add `retry: () => Promise<void>;` to the `UseMoodHistoryReturn` interface after `loadMore` (line 20), and add `retry: loadInitialMoods,` to the returned object (lines 94-100).
2. src/components/MoodTracker/MoodHistoryTimeline.tsx — change line 112 to `const { moods, isLoading, hasMore, loadMore, error, retry } = useMoodHistory(userId);`. Then swap the two guard blocks: move the whole `if (error) { ... }` block currently at lines 169-180 so it sits immediately above the `// Show empty state` comment at line 164, leaving the `if (!isLoading && moods.length === 0)` block second. Inside the error block, after the `<p>{error}</p>` at line 177, add a retry button matching the codebase's existing primary-button styling (same classes as src/components/PhotoGallery/PhotoGallery.tsx:216):
```
        <button
          onClick={() => void retry()}
          className="mt-4 rounded-lg bg-pink-500 px-6 py-3 font-medium text-white transition-colors hover:bg-pink-600"
          data-testid="mood-history-retry"
        >
          Try Again
        </button>
```
Behaviour note: this changes nothing for the already-populated case — when `moods.length > 0` and `loadMore` fails, the error block already replaced the list before this change too.

**Files:** `src/components/MoodTracker/MoodHistoryTimeline.tsx`, `src/hooks/useMoodHistory.ts`

**Tests over this code:** No unit tests exist for MoodHistoryTimeline or useMoodHistory (no such files in the `*.test.ts(x)` inventory; no test references the `empty-mood-history-state`, `error-state`, or `mood-history-timeline` testids). The only test that exercises the component is tests/e2e/mood/mood-tracker.spec.ts:52 '[P0] 4.1-E2E-003 should display mood history', which asserts only that `mood-history-section` and the 'Mood Timeline' heading are visible after clicking `mood-tab-timeline` — unaffected by the reorder.

### A12. Failed love-note sends orphan the uploaded image in storage, and retry uploads a second copy

**Medium** · `src/stores/slices/notesSlice.ts:349` · `orphaned-love-note-images`

**What you see:** Every love note whose image uploads successfully but whose row insert then fails leaves a permanently unreferenced file in the `love-notes-images` bucket. Each retry adds another. Nothing ever reclaims them; storage usage grows with no user-visible cause.

**Do this:** All edits in src/stores/slices/notesSlice.ts.

1. Line 22 — widen the existing import:
   `import { deleteLoveNoteImage, uploadCompressedBlob } from '../../services/loveNoteImageService';`

2. After `revokePreviewUrlsFromNotes` (i.e. after line 61, before `export const createNotesSlice`) add a module-level helper:
```ts
/**
 * Helper: Best-effort delete of an image whose love_notes row insert failed.
 * Swallows delete errors — the note is already marked failed and the user-facing
 * error must not be masked by a storage cleanup failure.
 */
async function discardOrphanedImage(storagePath: string | null): Promise<void> {
  if (!storagePath) return;
  try {
    await deleteLoveNoteImage(storagePath);
    logger.debug('[NotesSlice] Deleted orphaned image after failed insert:', storagePath);
  } catch (deleteError) {
    console.warn('[NotesSlice] Failed to delete orphaned image:', storagePath, deleteError);
  }
}
```
(`logger` is already imported at line 24; `console.warn` is permitted — eslint.config.js:63 allows warn/error.)

3. In `sendNote`, inside the `if (error) {` block that opens at line 379, insert as the FIRST statement (immediately before the `set((state) => ({` at line 381):
   `await discardOrphanedImage(storagePath);`
   `storagePath` is already in scope (declared line 333) and `sendNote` is already async.

4. In `retryFailedMessage`, inside the `if (error) {` block that opens at line 532, insert as the FIRST statement (immediately before the `set((state) => ({` at line 534):
   `await discardOrphanedImage(storagePath);`
   `storagePath` is already in scope (declared line 500) and the function is async.

Optional hardening (same file, still trivial): the outer `catch` of `sendNote` at line 443 can also be reached after a successful upload if the insert `fetch` itself throws. To cover it, move the `let storagePath: string | null = null;` declaration from line 333 up to the first line of the `sendNote` body (line 275, before the outer `try`), delete the inner declaration, and add `await discardOrphanedImage(storagePath);` as the first statement of the catch at line 444. Do NOT also implement the "cache storagePath and reuse on retry" idea — it conflicts with deleting on failure.

**Files:** `src/stores/slices/notesSlice.ts`

**Tests over this code:** No unit tests cover notesSlice (tests/unit/stores/ contains only moodSlice, scriptureReadingSlice*, settingsSlice). src/services/__tests__/loveNoteImageService.test.ts:369 tests `deleteLoveNoteImage` directly and is unaffected. tests/e2e/notes/love-notes.spec.ts test 4.2-E2E-003 sends a text-only message, so `storagePath` is null and the new code path is a no-op. No test risk found.

> **Order:** do `image-only-note-violates-check` first. Both change notesSlice.ts:378-392. The CHECK-constraint migration (`char_length(content) >= 1 OR image_url IS NOT NULL`) removes the failure mode that generates most orphans, so it determines how much of that branch is even reachable, and image-only-note-violates-check's own fix text already includes the deleteLoveNoteImage call. Landing the orphan cleanup first means editing the branch twice and re-testing a path the migration is about to make rare.

### A13. useLoveNotes is mounted twice, causing a duplicate initial fetch and two realtime subscriptions on the same topic

**Medium** · `src/components/love-notes/MessageInput.tsx:48` · `duplicate-lovenotes-hook`

**What you see:** Every visit to Love Notes issues two identical 50-row `love_notes` queries and opens two Realtime channels on the same `love-notes:{userId}` topic. Incoming messages run the handler twice (deduped by id, so no visible duplicate) and the arrival vibration is triggered twice.

**Do this:** src/components/love-notes/MessageInput.tsx, line 48. Change:
```ts
  const { sendNote } = useLoveNotes();
```
to:
```ts
  // autoFetch=false: the LoveNotes container owns the initial fetch and the
  // realtime subscription (useLoveNotes gates both on this flag).
  const { sendNote } = useLoveNotes(false);
```
Nothing else changes. Do not touch src/components/love-notes/LoveNotes.tsx — it must keep `useLoveNotes()` (default true) as the single owner.

Why this spelling over `useAppStore((s) => s.sendNote)`: both produce the same runtime behaviour, but the store-selector variant requires rewriting the module mock at src/components/love-notes/__tests__/MessageInput.test.tsx:28-32 (`vi.mock('../../../hooks/useLoveNotes', ...)`) into a `useAppStore` mock, turning a 1-line fix into 2 files. The `useLoveNotes(false)` mock is argument-agnostic, so all 8 `mockSendNote` assertions keep passing untouched.

**Files:** `src/components/love-notes/MessageInput.tsx`

**Tests over this code:** src/components/love-notes/__tests__/MessageInput.test.tsx mocks the whole `useLoveNotes` module with an arg-ignoring factory (lines 28-32), so passing `false` changes nothing there — assertions at lines 280, 304, 332, 410, 421 still pass. src/hooks/__tests__/useRealtimeMessages.test.ts tests the hook in isolation and is unaffected. tests/e2e/notes/love-notes.spec.ts waits for a single `**/rest/v1/love_notes**` GET (lines 17-24, 37-43, 53-58) — still satisfied by the one remaining fetch. No test risk found.

### A14. unviewedCount counts the user's own outgoing pokes as unviewed notifications

**Medium** · `src/stores/slices/interactionsSlice.ts:181` · `unviewed-count-includes-sent`

**What you see:** You send your partner a kiss, open the History modal, close it, and the heart FAB now shows a '1' badge announcing '1 unviewed interaction' — for a kiss you sent yourself. The count stays inflated until your partner happens to open their app and view it.

**Do this:** All edits in src/stores/slices/interactionsSlice.ts.

1. Replace `getUnviewedInteractions` (lines 152-155) with:
```ts
  getUnviewedInteractions: () => {
    const { interactions, userId } = get();
    return interactions.filter(
      (interaction) => !interaction.viewed && interaction.toUserId === userId
    );
  },
```

2. In `loadInteractionHistory`, replace line 181:
```ts
      const unviewedCount = interactions.filter((i) => !i.viewed).length;
```
with:
```ts
      const unviewedCount = interactions.filter(
        (i) => !i.viewed && i.toUserId === currentUserId
      ).length;
```
`currentUserId` is already bound at line 167. Also update the comment on line 180 to `// Calculate unviewed count (received-and-unviewed only — outgoing rows are never notifications)`.

No other counter needs touching: `addIncomingInteraction` (line 244) only fires from the realtime subscription, which is filtered `to_user_id=eq.${userId}` (interactionService.ts:190), and `sendPoke`/`sendKiss` (lines 86, 119) push into `interactions` without incrementing `unviewedCount`.

**Files:** `src/stores/slices/interactionsSlice.ts`

**Tests over this code:** Searched tests/ and all src/**/__tests__ for `interactionsSlice`, `unviewedCount`, `loadInteractionHistory`, `getUnviewedInteractions` — none found. tests/unit/utils/interactionValidation.test.ts only exercises `validateInteraction`. tests/e2e/partner/partner-mood.spec.ts:83-88 asserts only FAB/poke/kiss button visibility, not the badge. None found.

### A15. A failed reflection-summary save shows the user nothing — the Continue button just stops working

**Medium** · `src/components/scripture-reading/hooks/useReportPhase.ts:131` · `reflection-submit-silent-failure`

**What you see:** If the reflection write fails, the user taps Continue, the button greys for a moment and then re-enables, and nothing else happens. No error, no retry hint, no phase change. Their rating, note and standout-verse selections live only in `ReflectionSummary` local state and are lost on refresh or app backgrounding.

**Do this:** 1) src/components/scripture-reading/hooks/useReportPhase.ts — after line 71 (`const [isSubmittingSummary, setIsSubmittingSummary] = useState(false);`) add `const [summarySubmitError, setSummarySubmitError] = useState<string | null>(null);`. In `handleReflectionSummarySubmit` (starts line 86) add `setSummarySubmitError(null);` immediately after `setIsSubmittingSummary(true);` (line 89). In the phase-advance catch (lines 123-129), after the `handleScriptureError({...})` call add `setSummarySubmitError('Your reflection was saved, but we could not open your report. Tap Continue to try again.');`. In the outer catch (lines 130-135), after `handleScriptureError({...})` add `setSummarySubmitError('We could not save your reflection. Tap Continue to try again.');`. Leave the bookmark-sharing catch (lines 111-117) alone — that write is non-blocking. Add `summarySubmitError,` to the returned object next to `isSubmittingSummary` (line 486).
2) src/components/scripture-reading/hooks/useSoloReadingFlow.ts — in the `// From report` block add `summarySubmitError: report.summarySubmitError,` right after line 134 (`isSubmittingSummary: report.isSubmittingSummary,`).
3) src/components/scripture-reading/containers/SoloReadingFlow.tsx — inside the reflection branch, in the `<div className="mx-auto flex max-w-md flex-1 flex-col justify-center px-4">` at line 55, immediately before `<ReflectionSummary ...>` (line 56), render:
```tsx
{flow.summarySubmitError && (
  <div
    role="alert"
    data-testid="scripture-reflection-submit-error"
    className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
  >
    {flow.summarySubmitError}
  </div>
)}
```
This reuses the exact banner markup/classes already used at ReportPhaseView.tsx:224-240, so nothing new is designed. No changes to ReflectionSummary.tsx.

**Files:** `src/components/scripture-reading/hooks/useReportPhase.ts`, `src/components/scripture-reading/hooks/useSoloReadingFlow.ts`, `src/components/scripture-reading/containers/SoloReadingFlow.tsx`

**Tests over this code:** src/components/scripture-reading/__tests__/SoloReadingFlow.test.tsx — 'Story 2.2: Reflection Summary' (lines 1085-1159, incl. 2.2-CMP-018 at 1102) and 'Story 2.2: Double-Submit Guard' (line 1663). Both only assert positive presence plus `queryByText('Reflection summary coming in Story 2.2')` is null, so a conditionally-rendered banner (null on the happy path) does not affect them. tests/e2e/scripture/scripture-reflection-2.2.spec.ts and scripture-reflection-2.2-errors.spec.ts drive successful reflection submits (the 500 in the errors spec is injected on the PATCH *after* compose, line 43-49), so neither trips the new banner.

### A16. The report's error banner and Retry button are dead code — a failed fetch renders a blank report instead

**Medium** · `src/components/scripture-reading/hooks/useReportPhase.ts:406` · `report-load-error-unreachable`

**What you see:** If the report fetch fails, the user sees a fully-rendered Daily Prayer Report with no ratings, no bookmarks, no standout verses and no partner message — indistinguishable from a legitimately empty session — with no error message and no retry.

**Do this:** src/services/scriptureReadingService.ts only. For each of the three private fetchers, split the body into a throwing method plus the existing swallowing wrapper:
1) Replace `fetchAndCacheReflections` (lines 722-743) with `private async fetchReflectionsOrThrow(sessionId: string): Promise<ScriptureReflection[]>` containing the current body **minus** the try/catch (keep `if (error) throw error;`, the `z.array(SupabaseReflectionSchema).parse(data ?? [])`, the cache loop and `return locals;`), then keep `private async fetchAndCacheReflections(sessionId: string)` as `try { return await this.fetchReflectionsOrThrow(sessionId); } catch (error) { console.error('[ScriptureService] Failed to fetch reflections from server:', error); return []; }`.
2) Same split for `fetchAndCacheBookmarks` (lines 745-766) → `fetchBookmarksOrThrow`, and `fetchAndCacheMessages` (lines 768-789) → `fetchMessagesOrThrow`, preserving the existing console.error strings.
3) In `getSessionReportData` (lines 939-943) change the `Promise.all` members to `this.fetchReflectionsOrThrow(sessionId)`, `this.fetchBookmarksOrThrow(sessionId)`, `this.fetchMessagesOrThrow(sessionId)`.
No change to useReportPhase.ts — its existing catch (line 404) + `setReportLoadError` + the Retry UI at ReportPhaseView.tsx:224-240 then engage. Callers of `getReflectionsBySession`/`getBookmarksBySession`/`getMessagesBySession` and the three `refresh*FromServer` helpers (lines 814-836) keep calling the swallowing wrappers, so their behaviour is unchanged. Behaviour note to record in the PR: a failure of *any* leg (network, PostgREST error, or a Zod parse failure on one malformed row) now yields the error banner instead of a partial report — that is the finding's stated intent.

**Files:** `src/services/scriptureReadingService.ts`

**Tests over this code:** tests/unit/services/scriptureReadingService.cache.test.ts — `getBookmarksBySession` (lines 477-510), `toggleBookmark` (592-640) and `getMessagesBySession` (695-730) all drive the cache-miss path with `{ data: [...], error: null }`; none assert `[]` on a server error, and none call `getSessionReportData`. src/components/scripture-reading/__tests__/SoloReadingFlow.test.tsx 2.3-INT-008 (line 1368) and 2.3-INT-009 (1386) mock `getSessionReportData` directly (line 116), so they are untouched and keep passing — they become genuinely representative rather than fictional.

### A17. Couple stats never refresh after completing a session — the overview still shows the pre-session numbers

**Medium** · `src/components/scripture-reading/containers/ScriptureOverview.tsx:222` · `stats-stale-after-session`

**What you see:** Finish a scripture session, tap Return to Overview, and "Sessions Completed", "Steps Completed", "Last Completed", "Average Rating" and "Bookmarks Saved" all still show the values from before the session. The user has to leave the Scripture tab and come back (or reload) to see their session counted.

**Do this:** src/components/scripture-reading/containers/ScriptureOverview.tsx only. (1) Line 28: change `import { useCallback, useEffect, useState } from 'react';` to `import { useCallback, useEffect, useRef, useState } from 'react';`. (2) Immediately after the existing stats effect (ends line 222), insert:
```tsx
  // Refresh stats when a session ends so the overview reflects the session just completed
  const prevSessionIdRef = useRef<string | null>(null);
  useEffect(() => {
    const prevSessionId = prevSessionIdRef.current;
    prevSessionIdRef.current = session?.id ?? null;
    if (prevSessionId && !session && isOnline) {
      void loadCoupleStats();
    }
  }, [session, isOnline, loadCoupleStats]);
```
`session`, `isOnline` and `loadCoupleStats` are already in scope (lines 146, 183, 196). Comparing `session?.id` rather than the object keeps the ref write cheap while the effect still re-runs on every session mutation; the RPC only fires on the non-null → null edge, which covers Return to Overview, save-and-exit and the lobby back button. Do NOT add `void get().loadCoupleStats()` to `exitSession` (scriptureReadingSlice.ts:271-273): it would fire the RPC while offline and its unit-test service mock (tests/unit/stores/scriptureReadingSlice.test.ts:28-46) has no `getCoupleStats`.

**Files:** `src/components/scripture-reading/containers/ScriptureOverview.tsx`

**Tests over this code:** src/components/scripture-reading/__tests__/ScriptureOverview.test.tsx supplies `loadCoupleStats: mockLoadCoupleStats` (lines 67, 96) but never asserts on it, and at mount `prevSessionIdRef` is null so no extra call fires. tests/e2e/scripture/scripture-stats.spec.ts:29 ('[P0] stats after completing a session') masks the bug today because `ensureOverview` does `page.goto('/scripture?fresh=true')` (tests/support/helpers.ts:403), remounting the component — it keeps passing, just with one more RPC available. tests/unit/stores/scriptureReadingSlice.test.ts:224 ('exitSession') and scriptureReadingSlice.reconnect.test.ts:233 are only at risk under the rejected slice-side option; the plan above leaves the slice untouched.

### A18. setView pushes a browser history entry even when the view is unchanged

**Low** · `src/stores/slices/navigationSlice.ts:56` · `setview-duplicate-history`

**What you see:** Tapping the same bottom-nav tab repeatedly (a very common gesture — people tap the active tab to "go back to the top") stacks up identical history entries. The Android back button and browser Back then require one press per tap before the user can leave the view or exit the app.

**Do this:** In `createNavigationSlice.setView` (src/stores/slices/navigationSlice.ts:39-59), replace line 56 `window.history.pushState({ view }, '', fullPath);` with:
```ts
      // Tapping the already-active tab must not stack an identical history entry —
      // it would cost one Back press per tap before the user can leave the view.
      if (window.location.pathname === fullPath) {
        window.history.replaceState({ view }, '', fullPath);
      } else {
        window.history.pushState({ view }, '', fullPath);
      }
```
Leave `set({ currentView: view })` on line 40, the `pathMap`/`base`/`fullPath` computation on lines 44-55, and the `logger.info` on line 57 exactly as they are. Do not take the alternative early-return (`if (get().currentView === view && !skipHistory) return;`): it skips the URL rewrite, so a session that started on an unrecognised path would keep that path in the address bar when the user taps Home. Note the comparison is against `fullPath`, which already includes `import.meta.env.BASE_URL` (line 54-55), so it is correct under the production `/My-Love/` base as well as dev `/`.

**Files:** `src/stores/slices/navigationSlice.ts`

**Tests over this code:** None found. `grep -rn "setView|navigationSlice|pushState" tests src/components/Navigation/__tests__` returns nothing — there is no unit test for navigationSlice, and src/components/Navigation/__tests__/BottomNavigation.test.tsx only asserts on a mocked `onViewChange` prop, never touching history. The E2E specs that use the bottom nav — tests/e2e/navigation/routing.spec.ts:27-46 ("[P0] should support browser back button": home → photos → mood → `page.goBack()` → `**/photos`) and tests/e2e/home/routing.spec.ts:31-46 — always tap a different tab than the current view, so every transition still takes the `pushState` branch.

### A19. App subscribes to the entire Zustand store, re-rendering the whole tree on every store write

**Low** · `src/App.tsx:78` · `app-subscribes-whole-store`

**What you see:** Every single state change anywhere in the app — each incoming love note over realtime, each scripture presence heartbeat, each photo load, each `updateSyncStatus` tick — re-renders `App` and its whole unmemoized subtree (NetworkStatusIndicator, SyncToast, BottomNavigation, the active view, PhotoUpload, PhotoCarousel). On the Notes and Scripture views this is a continuous render storm.

**Do this:** 1) src/App.tsx — add `import { useShallow } from 'zustand/react/shallow';` next to the existing store import on line 8. Replace the destructure at lines 69-78 inside `function App()` with:
```ts
  const { settings, isLoading, currentView, isOnline } = useAppStore(
    useShallow((s) => ({
      settings: s.settings,
      isLoading: s.isLoading,
      currentView: s.currentView,
      isOnline: s.syncStatus.isOnline,
    }))
  );
  const initializeApp = useAppStore((s) => s.initializeApp);
  const setView = useAppStore((s) => s.setView);
  const syncPendingMoods = useAppStore((s) => s.syncPendingMoods);
  const updateSyncStatus = useAppStore((s) => s.updateSyncStatus);
```
Select `s.syncStatus.isOnline` rather than the whole `syncStatus` object because App only reads `.isOnline` (lines 352 and 362) and `updateSyncStatus` spreads a fresh object every tick (moodSlice.ts:176-177, 214-215, 245-246, 260-261), so subscribing to the object would not remove the tick re-renders. `syncStatus` is never null (moodSlice.ts:52-57 initialises it), so `s.syncStatus.isOnline` is safe.
Then in the same file change `syncStatus.isOnline` → `isOnline` at line 352 (`if (syncStatus.isOnline && session)`) and line 362 (same expression inside the setInterval callback), and change the dep array on line 375 from `[syncPendingMoods, syncStatus.isOnline, session]` to `[syncPendingMoods, isOnline, session]`.
2) src/components/AdminPanel/AdminPanel.tsx — replace lines 16-17 in `AdminPanel` with four one-field selectors:
```ts
  const customMessagesLoaded = useAppStore((s) => s.customMessagesLoaded);
  const loadCustomMessages = useAppStore((s) => s.loadCustomMessages);
  const exportCustomMessages = useAppStore((s) => s.exportCustomMessages);
  const importCustomMessages = useAppStore((s) => s.importCustomMessages);
```
The `useEffect` dep array on line 28 (`[customMessagesLoaded, loadCustomMessages]`) is unchanged and stays valid — Zustand action identities are stable across sets.
3) src/components/AdminPanel/MessageList.tsx — replace line 14 in `MessageList` with:
```ts
  const messages = useAppStore((s) => s.messages);
  const customMessages = useAppStore((s) => s.customMessages);
```
The two `useMemo` blocks on lines 20-33 and 36-51 already depend on `[messages, customMessages]` and need no change.
Style: 2-space indent, single quotes, parenthesized arrow params, semicolons — matches the existing `useShallow` call sites.

**Files:** `src/App.tsx`, `src/components/AdminPanel/AdminPanel.tsx`, `src/components/AdminPanel/MessageList.tsx`

**Tests over this code:** No unit tests cover these files — I enumerated every `*.test.*`/`*.spec.*` under src/ and tests/; the only component unit tests are src/components/love-notes/__tests__/*, src/components/Navigation/__tests__/BottomNavigation.test.tsx, and src/components/scripture-reading/__tests__/*. None import App, AdminPanel, or MessageList. E2E specs that boot App (tests/e2e/home/routing.spec.ts, tests/e2e/navigation/routing.spec.ts, tests/e2e/home/error-boundary.spec.ts, tests/e2e/home/welcome-splash.spec.ts) assert on rendered testids only and are unaffected since output is identical.

### A20. Manually re-viewing the welcome splash resets the 60-minute auto-display timer, contrary to the stated intent

**Low** · `src/App.tsx:477` · `manual-splash-resets-timer`

**What you see:** After tapping the heart FAB to re-read the welcome message, the automatic splash that was about to appear is pushed back another full hour.

**Do this:** src/App.tsx, three edits, all inside `function App()`:
1. After line 109 (`const [showSplash, setShowSplash] = useState(shouldShowWelcome);`) add:
```ts
  const [splashSource, setSplashSource] = useState<'auto' | 'manual'>('auto');
```
2. In `handleContinue` (lines 475-479), guard the write so the body becomes:
```ts
  const handleContinue = () => {
    // Only the automatic splash resets the 60-minute timer
    if (splashSource === 'auto') {
      localStorage.setItem(LAST_WELCOME_VIEW_KEY, Date.now().toString());
    }
    setSplashSource('auto');
    setShowSplash(false);
  };
```
3. In `showWelcomeManually` (lines 482-484), add the source marker before showing:
```ts
  const showWelcomeManually = () => {
    setSplashSource('manual');
    setShowSplash(true);
  };
```
`useState` is already imported at line 1. `splashSource` defaults to `'auto'`, which is correct for the first-visit path where `useState(shouldShowWelcome)` opens the splash on mount. (The reset to `'auto'` in step 2 is belt-and-braces — `showWelcomeManually` is the only other writer of `showSplash` — but keeps the state honest; omitting it produces identical behaviour, so it is a style choice, not a decision.)

**Files:** `src/App.tsx`

**Tests over this code:** tests/e2e/home/welcome-splash.spec.ts is the only spec covering this flow: both tests (`[P0] should show welcome splash on first visit`, `[P0] should dismiss splash and show main app`) remove `lastWelcomeView` and dismiss the automatic splash, so `splashSource` is `'auto'` and the localStorage write still happens. tests/e2e/home/routing.spec.ts:13, tests/e2e/navigation/routing.spec.ts:13, tests/e2e/home/error-boundary.spec.ts:14, tests/support/auth/supabase-auth-provider.ts:153 and tests/support/fixtures/together-mode.ts:132 all pre-seed `lastWelcomeView` to skip the splash entirely and are unaffected. No unit test touches App.tsx.

### A21. Anniversary countdown shows "364 days" on the anniversary itself instead of "Today is X!"

**Low** · `src/utils/countdownService.ts:93` · `anniversary-never-shows-today`

**What you see:** On the actual day of an anniversary the card reads "364 days, 23 hours, 59 minutes until <label>" with the plain calendar icon. The "Today is <label>!" text and the celebration animation are effectively unreachable — they can only appear during the final minute before midnight of the preceding day.

**Do this:** src/utils/countdownService.ts, two functions.

(1) `getNextAnniversaryDate` (lines 79-103). After line 80 (`const today = new Date();`) add:
```ts
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
```
and change line 93 from `if (nextDate <= today) {` to `if (nextDate < startOfToday) {`. Leave lines 94-99 (next-year + leap-year handling) untouched.

(2) `getUpcomingAnniversaries` (lines 49-70) MUST also change or the fix is invisible — its filter at line 65 is `.filter(({ nextDate }) => nextDate > now)`, which would drop today's anniversary (midnight today is not `> now`) and the card would vanish instead of saying "Today is X!". Replace line 57 `const now = new Date();` with:
```ts
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
```
and line 65 with `.filter(({ nextDate }) => nextDate >= startOfToday)`. Removing `now` is required, not optional — ESLint `no-unused-vars` would flag it otherwise.

No change to `calculateTimeRemaining`, `shouldTriggerCelebration`, or `formatCountdownDisplay`. Resulting behaviour on the anniversary day: the card stays in the list, `timeRemaining` is all zeros, CountdownCard (src/components/CountdownTimer/CountdownTimer.tsx:156-225) renders the Sparkles icon, `Today is <label>!`, and hides the days/hours/min breakdown; `updateCelebration` (lines 76-96) fires the 3s CelebrationAnimation once via the `activeCelebrationRef` guard.

**Files:** `src/utils/countdownService.ts`

**Tests over this code:** None found. `grep -rln "countdownService|countdown-timer|celebration-animation" tests` returns nothing, and there is no unit test file for countdownService (tests/unit/utils/ contains dateFormat, interactionValidation, messageRotation, messageValidation, moodGrouping, offlineErrorHandler). The only src consumer is src/components/CountdownTimer/CountdownTimer.tsx (lines 52, 59-61, 158), which has no test file.

### A22. getRelativeTime uses wall-clock hours while date headers use calendar days — the same mood reads 'Yesterday' under a 'Nov 15' header

**Low** · `src/utils/dateUtils.ts:23` · `relative-time-wallclock-vs-calendar`

**What you see:** In the Timeline, a mood logged Monday evening, viewed early Wednesday morning, appears under a header reading 'Nov 15' (Monday) but its own timestamp reads 'Yesterday'. On the Mood tab, the partner's Monday-evening mood is labelled 'Yesterday' on Wednesday morning.

**Do this:** 1. src/utils/dateUtils.ts — rewrite the body of `getRelativeTime` (lines 17-31) to:
```
export function getRelativeTime(timestamp: string): string {
  const now = new Date();
  const past = new Date(timestamp);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = getDaysSince(past);

  if (diffDays === 0) {
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    return `${diffHours}h ago`;
  }
  if (diffDays === 1) return 'Yesterday';

  return formatShortDate(past);
}
```
`getDaysSince` (line 176) and `formatShortDate` (line 91) are both module-local function declarations, so no import or export change is needed. Consumers are src/components/MoodTracker/MoodHistoryItem.tsx:71 and src/components/MoodTracker/PartnerMoodDisplay.tsx:112; the return type stays `string`, so neither needs edits.
2. src/utils/__tests__/dateUtils.test.ts — two existing tests become clock-of-day dependent under the new logic and MUST be pinned with `vi.setSystemTime`, matching the pattern already used in the `formatRelativeDate` block (lines 43-91):
   - line 15-18 ('returns hours for timestamps < 24 hours ago') uses `Date.now() - 5 * 3600000`; if the suite runs before 05:00 local that lands on the previous calendar day and now returns 'Yesterday'. Wrap with `vi.setSystemTime(new Date(2026, 2, 15, 12, 0, 0))` and build the timestamp as `new Date(2026, 2, 15, 7, 0, 0)`.
   - line 20-23 ('returns "Yesterday" for timestamps 1 day ago') uses `Date.now() - 25 * 3600000`; before 01:00 local that is two calendar days back. Pin to `new Date(2026, 2, 15, 12, 0, 0)` with a timestamp of `new Date(2026, 2, 14, 11, 0, 0)`.
   Add `beforeEach`/`afterEach` with `vi.useRealTimers()` to the `getRelativeTime` describe block (it currently has none; the `formatRelativeDate` block at line 44 already does).
3. Add the regression test named in the finding, inside the `getRelativeTime` describe:
```
  it('does not say "Yesterday" for a mood two calendar days old', () => {
    vi.setSystemTime(new Date(2026, 2, 18, 1, 0, 0)); // Wednesday 01:00
    const monEvening = new Date(2026, 2, 16, 18, 0, 0); // Monday 18:00
    expect(getRelativeTime(monEvening.toISOString())).not.toBe('Yesterday');
  });
```
Accepted behaviour change to state in the PR: a mood logged at 23:00 and viewed at 01:00 now reads 'Yesterday' instead of '2h ago' — which is what makes it agree with the 'Yesterday' date header.

**Files:** `src/utils/dateUtils.ts`, `src/utils/__tests__/dateUtils.test.ts`

**Tests over this code:** src/utils/__tests__/dateUtils.test.ts lines 15-18 and 20-23 will break intermittently unless updated as described above — this is the only test file importing `getRelativeTime` (line 2). src/utils/__tests__/moodGrouping.test.ts and tests/unit/utils/moodGrouping.test.ts cover `getDateLabel`, which this change does not touch. tests/unit/utils/dateFormat.test.ts does not import dateUtils' relative-time helpers.

### A23. Realtime channel leaks when the partner view unmounts before the subscribe promise resolves

**Low** · `src/components/PokeKissInterface/PokeKissInterface.tsx:131` · `realtime-channel-leak-fast-unmount`

**What you see:** Navigating in and out of the Partner tab quickly accumulates orphaned Supabase Realtime channels for the session. Each is an open websocket topic that is never removed, and older ones become unremovable — over a long session this counts against the connection's channel budget and can stop new subscriptions from establishing.

**Do this:** A. src/api/interactionService.ts
1. Delete line 55 (`private realtimeChannel: RealtimeChannel | null = null;`) and delete line 11 (`import type { RealtimeChannel } from '@supabase/supabase-js';`) — line 55 is its only use in this file, so leaving it trips no-unused-vars.
2. Replace the body of `subscribeInteractions` (lines 181-208) with a closure-owned, per-call channel and an idempotent unsubscribe:
```ts
    // Each subscription owns its own channel so racing subscribe/unsubscribe
    // cycles can be torn down independently.
    const channel = supabase
      .channel(`incoming-interactions:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'interactions',
          filter: `to_user_id=eq.${userId}`,
        },
        (payload) => {
          logger.info('[InteractionService] Received interaction:', payload.new);
          callback(payload.new as SupabaseInteractionRecord);
        }
      )
      .subscribe((status) => {
        logger.info('[InteractionService] Realtime subscription status:', status);
      });

    let removed = false;
    return () => {
      if (removed) return;
      removed = true;
      supabase.removeChannel(channel);
      logger.info('[InteractionService] Unsubscribed from interactions');
    };
```
The topic rename is safe: grep shows `'incoming-interactions'` appears only at interactionService.ts:183, and no migration grants/denies realtime topic authorization for it (the `realtime.messages` policies in supabase/migrations are scripture-only), and the channel is not `private`.

B. src/components/PokeKissInterface/PokeKissInterface.tsx
3. Delete the two refs at lines 88-89 (`subscriptionRef`, `isSubscribingRef`).
4. Replace the entire effect at lines 119-149 with:
```ts
  // Subscribe to real-time interactions on mount
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    subscribeToInteractions()
      .then((fn) => {
        if (cancelled) {
          // Unmounted before the subscribe promise resolved — tear down now.
          fn();
          return;
        }
        unsubscribe = fn;
        logger.info('[PokeKissInterface] Subscribed to real-time interactions');
      })
      .catch((error) => {
        console.error('[PokeKissInterface] Failed to subscribe:', error);
      });

    return () => {
      cancelled = true;
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
        logger.debug('[PokeKissInterface] Unsubscribed from interactions');
      }
    };
  }, [subscribeToInteractions]);
```
IMPORTANT — do NOT keep the `if (isSubscribingRef.current || subscriptionRef.current) { ... return; }` guard in any form. Combined with the `cancelled` flag it produces a worse bug: under StrictMode the first mount's promise self-cancels while the second mount early-returns, leaving the component with no subscription at all. The per-effect `cancelled` flag plus per-call channels makes the guard unnecessary (subscribe → unsubscribe → subscribe is correct and cheap).
The explicit `let unsubscribe: (() => void) | null = null;` annotation is required — without it TS strict infers `null` and the `if (unsubscribe)` check in the cleanup closure fails to compile. `logger` is already imported at line 28; `console.error` is allowed by eslint.config.js:63.

Leave the store wrapper at interactionsSlice.ts:219-223 unchanged — the inner unsubscribe is now idempotent, and `isSubscribed` is write-only.

**Files:** `src/api/interactionService.ts`, `src/components/PokeKissInterface/PokeKissInterface.tsx`

**Tests over this code:** No unit tests exist for PokeKissInterface or InteractionService (searched all *.test.ts/*.test.tsx under src and tests — the only interaction-adjacent file is tests/unit/utils/interactionValidation.test.ts, which tests `validateInteraction` only). tests/e2e/partner/partner-mood.spec.ts:80-88 renders PartnerMoodView and asserts `partner-mood-view`, `fab-main-button`, `poke-button`, `kiss-button` visibility; the subscription lifecycle is not asserted and subscribe failures are caught, so it stays green. None found.

### A24. lock_in_status_changed is applied without checking step_index, so a superseded lock shows a false 'partner is ready' on the next verse

**Low** · `src/hooks/useScriptureBroadcast.ts:147` · `lock-status-ignores-step-index`

**What you see:** Right after a verse advances, the user can see a green '[Partner] is ready' check on the new verse even though the partner has not locked in yet. The user waits for a step advance that will not happen until the partner actually taps, and if they tap first they are the one left on 'Waiting for X...' — the opposite of what the indicator implied.

**Do this:** In src/hooks/useScriptureBroadcast.ts, inside the `.on('broadcast', { event: 'lock_in_status_changed' }, …)` handler (lines 137-149), insert as the first two statements of the callback body, before the `identityRef.current` destructure on line 142:
```ts
          // Drop superseded locks: a lock broadcast for a step we have already left
          // would show a false "partner is ready" on the new verse.
          const liveStepIndex = useAppStore.getState().session?.currentStepIndex ?? null;
          if (liveStepIndex === null || msg.payload.step_index !== liveStepIndex) return;
```
Read the step through `useAppStore.getState()` rather than `identityRef.current` on purpose: `identityRef` is refreshed in an effect (lines 91-93) and would still hold the pre-advance step if the `state_updated` and the stale `lock_in_status_changed` arrive in the same task — which is precisely the race being fixed. `useAppStore` is already imported at line 28; no selector, no signature and no slice change, so `onPartnerLockInChanged: (locked: boolean) => void` (src/stores/slices/scriptureReadingSlice.ts:145, 960-962) stays as is. Then in tests/unit/hooks/useScriptureBroadcast.test.ts: change line 76 to `session: { userId: 'user-1', currentStepIndex: 0 },` and replace the mock at lines 79-83 with a callable that also exposes getState:
```ts
vi.mock('../../../src/stores/useAppStore', () => ({
  useAppStore: Object.assign(
    vi.fn((selector: (state: typeof mockStoreState) => unknown) => selector(mockStoreState)),
    { getState: () => mockStoreState }
  ),
}));
```
Add one regression test next to the existing one at line 238: fire `broadcastHandlers['lock_in_status_changed']?.({ payload: { step_index: 0, user1_locked: false, user2_locked: true } })` after setting `mockStoreState.session.currentStepIndex = 1`, and assert `expect(mockOnPartnerLockInChanged).not.toHaveBeenCalled()`.

**Files:** `src/hooks/useScriptureBroadcast.ts`, `tests/unit/hooks/useScriptureBroadcast.test.ts`

**Tests over this code:** tests/unit/hooks/useScriptureBroadcast.test.ts:238-249 ("[P1] maps lock_in_status_changed payload to partner lock state") is the one test that exercises this handler; it sends `step_index: 0`, so it keeps passing once `currentStepIndex: 0` is added to the mock session — but it fails hard without the `getState` addition to the useAppStore mock. tests/unit/hooks/useScriptureBroadcast.reconnect.test.ts:56-58 also mocks useAppStore without `getState`, but never fires `lock_in_status_changed`, so it is unaffected (adding `getState` there too is harmless). tests/unit/stores/scriptureReadingSlice.lockin.test.ts:131-149 tests `onPartnerLockInChanged` directly and is untouched because the signature does not change.

## 2 · Needs a decision from you

The fix has two or more implementations that produce materially different behaviour. Someone has to choose; an implementer guessing is how features end up half-built.

The 14 marked **(verified)** come with the exact question and its options, worked out against the source.
The rest are flagged by the audit's own fix text.

### B1. Five modules open the same IndexedDB at version 5; two use bespoke upgrade callbacks, and the first opener permanently decides which stores exist _(verified)_

**Critical** · `src/services/storage.ts:37` · `idb-partial-schema-race`

**What you see:** On a fresh browser profile, mood tracking is permanently broken: every attempt to save a mood throws and the entry never persists. Depending on which module opens first, scripture offline caching and/or background-sync auth-token storage are also dead. Clearing site data is the only recovery, and the user gets no hint that is what is needed.

**The question:** Every installation created since v5 shipped already has a truncated database (only `messages` + `photos`), and routing the two stray `openDB` calls through `upgradeDb` fixes fresh installs only — existing users stay broken. How should existing installs recover? (a) Bump DB_VERSION 5→6 and restructure `upgradeDb` so each store is created behind an unconditional `if (!db.objectStoreNames.contains(...))` check rather than an `oldVersion <` gate — self-heals with no data loss, but changes the IndexedDB schema version and the meaning of the migration gates; (b) On open, detect a missing store and `indexedDB.deleteDatabase('my-love-db')` then reopen — simple, but discards unsynced local moods and the photo/message cache; (c) Ship Part A only and accept that existing users must clear site data.

**Why it can't be decided for you:** The routing half is mechanical, but the recovery half is not: `upgradeDb` gates every store creation on `oldVersion < N` (dbSchema.ts:208/230/247/257/263), so a database already stuck at v5 with only `messages`+`photos` runs zero branches and stays broken no matter where the `upgrade` callback comes from. Healing existing installs requires either bumping `DB_VERSION` (dbSchema.ts:173 `export const DB_VERSION = 5;` — an IndexedDB schema-version change) or deleting/recreating the database, which loses unsynced local moods.

### B2. Sign-out clears only 3 auth fields; all user-scoped state survives and can never be re-initialized

**High** · `src/stores/slices/authSlice.ts:43` · `logout-leaves-user-data`

**What you see:** On a device where both partners sign in, the second user sees the first user's mood history, is told they "already logged a mood today" (pre-filled with the other person's moods and note), and any pending sync fails silently forever — the pending-mood badge never clears.

**Options in the audit:** Add a `resetUserScopedState()` action that `clearAuth` (or a new `signOutCleanup` in App.tsx's SIGNED_OUT branch) calls: reset `moods`, `partnerMoods`, `syncStatus`, `messageHistory`, `notes`, `photos`, `partner*` and `scripture*` slices to their initial values, call `useAppStore.persist.clearStorage()`, and call `storageService.clearAllData()` (already exists at src/services/storage.ts:303) plus a `moodService.clear()`. Separately, drop the module-level `isInitializing`/`isInitialized` in settingsSlice.ts:49-50 in favour of store state keyed by `userId`, and reset `hasInitialized.current = false` in App.tsx's signed-out branch so `initializeApp()` re-runs per session. Add a `session` guard to the `handleOnline` sync at App.tsx:323.

### B3. Three production tables exist in no migration, and the generated types are stale

**High** · `supabase/migrations/` · `schema-drift-untracked-tables`

**What you see:** Any database rebuilt from the repo differs from production. Local dev, CI, and any new environment are missing three tables and their 14 RLS policies.

**Options in the audit:** Decide per table. If `daily_love_messages` / `notifications` / `push_subscriptions` are wanted, capture them with `supabase db diff` into a new migration and regenerate `src/types/database.types.ts`. If they are abandoned experiments, drop them in a migration so production matches the repo. Either way add a CI step that fails on drift (`supabase db diff --linked` producing output).

### B4. Calendar reads only device-local IndexedDB and is never hydrated from Supabase — history is empty on any second device

**High** · `src/components/MoodHistory/MoodHistoryCalendar.tsx:68` · `calendar-local-only-history`

**What you see:** A user who installs the PWA on a second device (or clears site data, or has IndexedDB evicted under storage pressure) sees a completely blank mood calendar and a 'pending sync' count of 0, while the Timeline tab in the same app shows the full history. Two tabs of the same feature disagree about how many moods the user has logged.

**Options in the audit:** Add a hydration step to `moodSlice.loadMoods` (src/stores/slices/moodSlice.ts:153): when online, call `moodApi.fetchByDateRange` (already written, src/api/moodApi.ts:193) for the relevant window and upsert any server rows missing locally into IndexedDB keyed on `supabaseId`, then read back from IndexedDB. Alternatively, and more simply, switch `MoodHistoryCalendar.loadMoodsForMonth` (line 62-90) to read from Supabase via `moodApi.fetchByDateRange` with the IndexedDB result merged in for not-yet-synced entries, so calendar and timeline share one source of truth.

### B5. Deleting a photo in PhotoViewer leaves the deleted photo on screen behind a permanent spinner

**High** · `src/components/PhotoGallery/PhotoViewer.tsx:302` · `photo-delete-stuck-viewer`

**What you see:** User opens a photo that is not the last in the list, taps the trash icon, confirms Delete. The dialog closes and the viewer shows a black screen with a spinning loader that never stops — still on the photo that was just deleted.

**Options in the audit:** Lift photo list ownership: have PhotoViewer read `photos` from the store (as PhotoCarousel does) instead of taking a stale prop, or have PhotoGallery pass a `onPhotoDeleted(id)` callback that removes the id from its local `photos` state. Then clamp `currentIndex` against the new length, and close the viewer when the list becomes empty. Also surface the error — `deletePhoto` never throws, so the `catch` at line 309 is unreachable dead code.

> **Order:** decide/do `photo-editor-unreachable` first. photo-editor-unreachable is a fork in the road: 'Either point PhotoGallery's tap handler at selectPhoto(photo.id) and delete PhotoViewer, or add an edit button to PhotoViewer and delete PhotoCarousel/PhotoCarouselControls.' photo-delete-stuck-viewer's fix edits PhotoViewer.tsx (lift photo ownership, clamp currentIndex, surface the delete error). If the first branch is chosen, that work is thrown away with the file. Decide which viewer survives before investing in either one.

### B6. unviewedCount is never seeded on app start, so interactions received while the app was closed produce no badge _(verified)_

**High** · `src/stores/slices/interactionsSlice.ts:62` · `unviewed-badge-never-initialized`

**What you see:** Your partner pokes you overnight. You open the app the next morning, go to the Partner tab, and the heart FAB shows no notification badge. The poke is invisible unless you happen to open the History modal.

**The question:** Seeding the badge at mount needs a semantics call on what `unviewedCount` counts and what tapping it does. (a) Received-only (filter `toUserId === userId` in both `loadInteractionHistory`'s count at interactionsSlice.ts:181 and `getUnviewedInteractions` at line 152) — the badge means "pokes waiting for you", which matches the aria-label "N unviewed interactions" at PokeKissInterface.tsx:414, but it changes today's realtime-driven count semantics; (b) keep counting both directions and only seed the number, accepting that tapping the badge can replay and mark-viewed the user's OWN sent poke, wiping the partner's badge; (c) seed count-only via `getUnviewedInteractions(userId)` without populating `interactions`, accepting a badge that renders but does nothing when tapped.

**Why it can't be decided for you:** The two options offered are not interchangeable, and each is broken in a different way. Option (b), `loadUnviewedCount()` via `InteractionService.getUnviewedInteractions` (interactionService.ts:277-289, correctly filtered `.eq('to_user_id', userId).eq('viewed', false)`), seeds only the number — but `handleBadgeClick` reads the local array (`const unviewed = getUnviewedInteractions();` PokeKissInterface.tsx:243) and bails on `if (unviewed.length === 0) return;`, so the badge would render and be permanently unclickable. Option (a), `loadInteractionHistory()`, populates `interactions` but computes `const unviewedCount = interactions.filter((i) => !i.viewed).length` (interactionsSlice.ts:181) over a query that is `.or(from_user_id.eq.${userId},to_user_id.eq.${userId})` (interactionService.ts:234) — so the user's own sent-but-unseen pokes inflate the badge, and `handleBadgeClick` can pick one of them and `markInteractionViewed` it (line 256), clearing the partner's badge instead.

> **Order:** decide/do `unviewed-count-includes-sent` first. unviewed-badge-never-initialized makes the badge appear on launch by seeding from loadInteractionHistory or getUnviewedInteractions. Both of those are the uncounted-predicate paths: interactionsSlice.ts:181 counts every unviewed row including the user's own outgoing pokes (which sendPoke/sendKiss push into `interactions` optimistically at lines 86-88 and 119-121 with viewed=false). Seed first and you ship a badge that is wrong on every single app start — strictly worse than no badge. Fix the recipient predicate, then turn on seeding.

### B7. "Waiting for your partner's reflections" never resolves, and a completed report can never be reopened

**High** · `src/components/scripture-reading/hooks/useReportPhase.ts:414` · `report-one-shot-no-refresh`

**What you see:** The first partner to finish sits on the report showing a pulsing "Waiting for <name>'s reflections" that never updates, even after the partner finishes minutes later. Tapping "Return to Overview" then makes the report — including the partner's message — permanently unreachable.

**Options in the audit:** Subscribe to Postgres changes (or poll every ~10 s while `reportSubPhase === 'report' && !reportData.isPartnerComplete`) and re-run `getSessionReportData`. Separately, always render a manual "Refresh" control on the report, and add a way back in: relax `checkForActiveSession` to also surface today's completed session, or add a session-history entry point on `ScriptureOverview` backed by `getUserSessions`.

### B8. Refreshing the page during a together session orphans it and silently creates a second, unlinked session

**High** · `src/stores/slices/scriptureReadingSlice.ts:303` · `together-session-lost-on-reload`

**What you see:** After a refresh, an OS-triggered PWA restart, or a service-worker update mid-session, the user lands on the Scripture overview with no resume prompt. Tapping Together puts them in a brand-new empty lobby while their partner is still sitting in the old session, waiting. The two are now permanently unable to see each other, and the old session row stays in_progress forever.

**Options in the audit:** Drop the `mode === 'solo'` filter in checkForActiveSession and let the overview offer resume for together sessions too (routing on mode+phase the way ScriptureOverview already does at lines 291-325). Relax the reuse predicate in scripture_create_session to any in_progress together session for the pair, or add a dedicated scripture_rejoin_session RPC. Belt-and-braces: persist `session.id` (id only, not the whole snapshot) so a reload can re-hydrate via loadSession.

> **Order:** decide/do `reconnect-loads-stale-cached-session` first. together-session-lost-on-reload's belt-and-braces step is to 'persist session.id so a reload can re-hydrate via loadSession'. loadSession is precisely the cache-first path reconnect-loads-stale-cached-session identifies as returning the stale IndexedDB row and rewinding phase/step. Build reload recovery on top of it before it is made server-first and the recovery restores a session that is behind the server — the same rewind, now on every reload. Make getSession/loadSession version-aware or server-first first.

### B9. Reconnect resync calls loadSession, which returns the stale IndexedDB row and rewinds the session to lobby/step 0

**High** · `src/services/scriptureReadingService.ts:226` · `reconnect-loads-stale-cached-session`

**What you see:** When the partner reconnects (or the broadcast channel re-subscribes after an error), the reader is bounced out of the current verse back to Verse 1 — and, because countdownStartedAt is never cleared, briefly back through the countdown screen. If the follow-up network refresh fails (which is exactly the situation a reconnect implies), they stay on Verse 1 with a stale version, and their next 'Ready for next verse' tap fails with a red 'Cannot lock in: step mismatch' toast.

**Options in the audit:** Give `getSession` a server-first (or `forceRefresh`) mode and use it from the reconnect paths in ReadingContainer.tsx:110 and useScriptureBroadcast.ts:173 — a resync must not be served from cache. Alternatively have `loadSession` only accept the cached row when its `version` is >= the version already in the store, and clear `countdownStartedAt` in `updatePhase('reading')` so a phase blip cannot re-enter the countdown screen.

### B10. Presence declares the partner gone after two missed heartbeats, and reports the local client's own channel error as a partner disconnect

**High** · `src/hooks/useScripturePresence.ts:181` · `presence-no-grace-period-and-self-blame`

**What you see:** A user whose partner simply locked their phone — or a user whose own connection hiccups — gets a full-screen 'Partner reconnecting...' backdrop within 20 seconds, escalating at 30 seconds to 'Your partner seems to have stepped away' with an End Session button that terminates the session for both people. Nothing in the UI distinguishes 'my connection died' from 'their connection died'.

**Options in the audit:** In useScripturePresence, track consecutive missed heartbeats (require ~3 misses / 35s, and pause the stale timer while document.visibilityState === 'hidden') before flipping isPartnerConnected. Use `channel.httpSend('presence_update', ...)` as an explicit REST fallback and stop nulling channelRef on CHANNEL_ERROR until the replacement channel subscribes, so heartbeats keep flowing during a WS blip. Split local-connection health out of PartnerPresenceInfo: the CHANNEL_ERROR branch should set a `isChannelSubscribed:false` / 'you are offline' state, not isPartnerConnected:false, and DisconnectionOverlay should not offer End Session for a purely local fault.

### B11. DisplayNameSetup is an inescapable full-screen gate — no skip, no logout, and it fails offline _(verified)_

**Medium** · `src/App.tsx:443` · `displayname-gate-no-escape`

**What you see:** A signed-in user whose account has no `user_metadata.display_name` is locked out of the entire app — including every offline-capable feature — whenever the display-name write can't succeed. There is no cancel, no skip, and no sign-out button, so they can't even get back to the login screen.

**The question:** When a signed-in user has no `user_metadata.display_name` and the write can't reach Supabase, what should they be able to do? (a) Skip — let them into the full app now and re-prompt later, which means display name becomes optional everywhere it is read; (b) Sign out only — keep the gate hard but give them an escape back to the login screen; (c) Overlay — render the whole app shell behind the modal so offline features stay usable while the modal is up. Each needs different UI and different downstream handling of a missing display name.

**Why it can't be decided for you:** The fix text literally offers two mutually exclusive designs ("Render DisplayNameSetup as an overlay ... **or** add a 'Skip for now' and a 'Sign out' button") that produce materially different user-visible behaviour, and both require new UI. Worse, the third clause — "queue the `updateUser` write for retry when back online" — is an offline-queue integration for a Supabase Auth call, not a UI tweak. `src/components/DisplayNameSetup/DisplayNameSetup.tsx:62-66` calls `supabase.auth.updateUser` inline with no queue path, and the component has exactly one action (the submit button at lines 160-194) and no props for skip/sign-out (`DisplayNameSetupProps` at lines 22-27 is `{ isOpen, onComplete }`).

### B12. A failed sign-out is swallowed — the user stays logged in with zero feedback _(verified)_

**Medium** · `src/App.tsx:126` · `signout-error-swallowed`

**What you see:** The user taps Logout while offline or during a network blip. The button greys out for a moment, comes back, and nothing else happens — they are still fully signed in with no indication that logout failed. On a shared device they will reasonably believe they signed out.

**The question:** When sign-out fails (offline / server error), what should happen? (a) Keep the session and surface an error message telling the user they are still signed in; (b) fall back to `supabase.auth.signOut({ scope: 'local' })` so the device session is dropped even though the server session survives; or (c) (a) plus an explicit "Sign out on this device anyway" action. And if a message is shown, should it be a new generic error toast component, a generalised `SyncToast`, or an inline banner near the logout button?

**Why it can't be decided for you:** Confirmed not fixed — `src/App.tsx:123-129` is `try { await signOut(); } catch (error) { console.error('[App] Sign-out failed:', error); } finally { setIsSigningOut(false); }` with no user-visible output. But the fix's second clause is a real behavioural fork: "Also consider calling `supabase.auth.signOut({ scope: 'local' })` as a fallback" changes the outcome from "still signed in + error message" to "actually signed out on this device" — opposite results on a shared device. Separately there is no reusable error toast: `SyncToast` is typed to `SyncResult = { successCount: number; failCount: number }` (src/components/shared/SyncToast.tsx:14-17) and every message string is sync-specific (lines 78-118), and the store's `error` field (src/stores/slices/appSlice.ts:21,26) is currently rendered nowhere — App.tsx:69-78 does not even destructure it. So "reuse setError and render it" means designing a new UI surface.

### B13. The 4-theme system has no UI entry point, and 163 dark: variants fight the light-only theme

**Medium** · `src/stores/slices/settingsSlice.ts:244` · `theme-system-unreachable`

**What you see:** Users can never change the theme — the app is permanently 'sunset' and three of the four themes are dead code. Worse, a user whose OS is set to dark mode gets a broken-looking screen: dark-grey timer cards and dark modals sitting on a light pink gradient page background, under a solid white bottom navigation bar.

**Options in the audit:** Pick one direction and finish it. Either (a) delete the unused theme machinery (`setTheme`, the non-sunset entries in `themes.ts`) and commit to `dark:` + OS preference, adding dark variants to `BottomNavigation.tsx:19` and making `applyTheme` emit a dark gradient under `prefers-color-scheme: dark`; or (b) keep the theme system, add `darkMode: ['class']` to `tailwind.config.js`, have `applyTheme` toggle a `dark` class on `documentElement` based on the selected theme, and expose `setTheme` through a settings UI.

### B14. Retry on the "Failed to load message" screen is a guaranteed no-op and leaves a permanent spinner _(verified)_

**Medium** · `src/components/DailyMessage/DailyMessage.tsx:130` · `retry-button-dead`

**What you see:** User hits the red "Failed to load message" screen, taps Retry, and the app drops back to the "Loading your daily message..." spinner and stays there forever. Nothing is retried; only a full page reload recovers.

**The question:** When the user taps Retry on the "Failed to load message" screen, should the app (a) reset the module-level init guards in settingsSlice and run the full `initializeApp()` again — re-opening IndexedDB, re-seeding default messages if the store is empty, and clearing `error` — or (b) do a lighter recovery that only calls `loadMessages()` + `updateCurrentMessage()` and leaves IndexedDB init and the `error` string alone? (a) recovers from a failed `storageService.init()`; (b) cannot.

**Why it can't be decided for you:** The fix text literally offers two alternatives ("either export a `resetInitialization()` ... or have the Retry button call `loadMessages()` + `updateCurrentMessage()` directly") and they are not stylistically equivalent: option A re-runs `storageService.init()`, the default-message seeding branch (src/stores/slices/settingsSlice.ts:120-145) and `get().setError(null)` at line 90; option B does none of those and leaves `error` set. In the storage-init-failure case the two produce different user-visible outcomes.

### B15. Welcome FAB sits on top of the bottom navigation and covers the last tabs on mobile _(verified)_

**Medium** · `src/components/WelcomeButton/WelcomeButton.tsx:13` · `welcome-fab-covers-bottom-nav`

**What you see:** On a phone-width home screen the pink heart FAB overlaps the Scripture and Logout tabs of the bottom nav; tapping those icons opens the welcome splash instead of navigating/signing out.

**The question:** Keep the welcome re-view control as a floating action button and just raise it clear of the bottom nav, or remove the FAB and move the trigger into the message card's action row next to Favorite/Share? If the FAB is kept: fixed `bottom-24`, or `bottom-[calc(4rem+env(safe-area-inset-bottom)+1rem)]` so it also clears the iOS home indicator?

**Why it can't be decided for you:** The fix text offers two materially different routes — "Raise the FAB above the nav (e.g. `bottom-24` / `bottom-[calc(4rem+env(safe-area-inset-bottom)+1rem)]`), or move the re-view trigger into the message card itself." The second is a new UI surface, and even within the first the two suggested values differ on notched iOS devices. The bundled nav class-name fix is unambiguous, but its value determines whether the calc() offset is even correct.

### B16. Settings screen (the only anniversary UI) is never rendered, so the anniversary countdown can never appear

**Medium** · `src/components/Settings/Settings.tsx:20` · `settings-screen-unreachable`

**What you see:** There is no way for the user to add, edit or delete an anniversary anywhere in the app, and the anniversary countdown card advertised on the home screen never shows up.

**Options in the audit:** Add 'settings' to ViewType in navigationSlice.ts, a nav entry (or a gear button in the home header), and a lazy `{currentView === 'settings' && <Settings />}` branch in App.tsx alongside the other views — or delete Settings/AnniversarySettings/CountdownTimer/countdownService if the feature is abandoned. Do not leave 830 lines of unreachable UI in the bundle.

### B17. Home screen permanently shows two "Event passed" visit cards from hardcoded 2025 dates

**Medium** · `src/config/relationshipDates.ts:52` · `hardcoded-past-visit-dates`

**What you see:** Two of the four countdown cards on the home screen read "Next Visit — Event passed" and "Following Visit — Event passed", permanently, and the user has no way to update them from inside the app.

**Options in the audit:** Move visits/wedding/birthdays/datingStart into settings (they already have a persisted home in settingsSlice) with editing UI in the Settings screen, and hide or collapse events whose date has passed. At minimum, filter out past visits in App.tsx so stale cards do not accumulate.

### B18. Custom love messages never leave the device

**Medium** · `src/services/customMessageService.ts:1` · `custom-messages-device-local`

**What you see:** Messages written in the Admin Panel are invisible to the partner, do not appear on the user's other devices, and are lost if browser storage is cleared.

**Options in the audit:** Either wire `customMessageService` to the existing `daily_love_messages` table (dual-write, treat IndexedDB as cache), or state in the Admin Panel UI that custom messages are device-local. The current state silently implies sync that does not exist.

> **Order:** decide/do `schema-drift-untracked-tables` first. custom-messages-device-local's fix is to 'wire customMessageService to the existing daily_love_messages table'. `grep -rn 'daily_love_messages' supabase/migrations/*.sql` returns nothing and the table is absent from src/types/database.types.ts — it exists only in production. Writing client code against it now means code that works in production and fails in local dev, CI and any rebuilt environment, with no generated types to compile against. Capture the table in a migration and regenerate types first.

### B19. Service-worker background sync stamps every pending mood with the currently stored token's userId, not the mood's own userId _(verified)_

**Medium** · `src/sw.ts:192` · `sw-sync-attributes-mood-to-wrong-user`

**What you see:** On a shared device, a mood (and its private note) logged offline by user A gets uploaded to Supabase as user B's mood after A signs out and B signs in. It then shows in B's mood history and is broadcast to B's partner. A's mood is marked synced locally, so A never re-syncs it.

**The question:** On sign-out, what should happen to mood entries in IndexedDB that have not yet synced to Supabase? (a) Leave them and just make the service worker skip moods whose userId != the stored token's userId, so they sync when that user signs back in on this device — no data loss, but user A's mood text stays readable in user B's IndexedDB; (b) Delete the entire local moods store on sign-out — strongest privacy on a shared device, but user A permanently loses any mood logged offline and never uploaded; (c) Delete only already-synced moods and keep pending ones — a middle ground that needs a new moodService method and leaves some data behind.

**Why it can't be decided for you:** The bug and the SW-side guard are unambiguous (src/sw.ts:192 passes `authToken.userId` while the in-app path at src/api/moodSyncService.ts:84 uses `user_id: mood.userId`), but the fix text bundles "Independently, clear the local moods store on sign-out in actionService.signOut" — that permanently destroys user A's unsynced offline moods, and src/services/moodService.ts exposes no clear/deleteAll method (only create, updateMood, getMoodForDate, getMoodsInRange, getUnsyncedMoods, markAsSynced), so it also requires new API surface.

### B20. Debounced month navigation reads stale year/month, so two quick taps still move only one month _(verified)_

**Medium** · `src/components/MoodHistory/MoodHistoryCalendar.tsx:107` · `calendar-month-nav-debounce-stale`

**What you see:** Tapping the back-chevron three times quickly to reach a month a quarter ago moves the calendar back exactly one month. Every single tap also feels broken because nothing at all happens for 300ms — no header change, no loading skeleton.

**The question:** How should rapid prev/next month taps behave? (a) Update the month header immediately on every tap and debounce only the IndexedDB query — three taps jump three months with instant header feedback, but for ~300ms the new month is rendered with the previous month's mood dots unless a loading skeleton is forced on; (b) Update the month immediately AND show the loading skeleton immediately on month change, so no stale dots are ever shown but the grid flashes skeleton on every tap; (c) Keep the 300ms nav debounce (rapid taps intentionally collapse to one month) and accept that multi-tap navigation is a single step, fixing only the delayed-feedback complaint some other way.

**Why it can't be decided for you:** The fix text's primary suggestion does not actually fix the reported symptom: `handlePreviousMonth` (src/components/MoodHistory/MoodHistoryCalendar.tsx:102-112) calls `clearTimeout(navDebounceRef.current)` on every tap, so three quick taps cancel the first two timeouts and only one callback ever runs — making the update functional still moves exactly one month. Only the second, explicitly optional suggestion ("the debounce can also be dropped entirely") fixes it, and that changes visible behaviour during the debounce window.

### B21. Photo caption/tag editing has no entry point — PhotoCarousel, PhotoEditModal and PhotoDeleteConfirmation are unreachable

**Medium** · `src/components/PhotoCarousel/PhotoCarousel.tsx:132` · `photo-editor-unreachable`

**What you see:** There is no way to edit a photo's caption in the shipped app. Tapping a thumbnail opens PhotoViewer, which offers only close/navigate/delete — no edit button. Roughly 700 lines of edit UI ship in the bundle and can never be displayed.

**Options in the audit:** Pick one viewer. Either point PhotoGallery's tap handler at `selectPhoto(photo.id)` and delete PhotoViewer, or add an edit button to PhotoViewer that mounts PhotoEditModal and delete PhotoCarousel/PhotoCarouselControls. Whichever survives, wire the caption save through `photosSlice.updatePhoto` — and land the missing UPDATE RLS policy first, or the edit will save nothing.

### B22. The Fart button reports 'Fart sent!' but transmits nothing to the partner

**Medium** · `src/components/PokeKissInterface/PokeKissInterface.tsx:234` · `fart-never-sent`

**What you see:** You tap Fart, see the 💩 animation and a '💨 Fart sent!' toast, and are then locked out for 30 minutes. Your partner receives nothing — no badge, no animation, no history entry, ever.

**Options in the audit:** Decide and make it honest. Either (a) extend the feature: migration to widen interactions_type_check to include 'fart', widen InteractionType and the FartAnimation dispatch in the incoming path, and route handleFart through a new sendFart store action mirroring sendPoke — or (b) drop the pretence: change the toast to something local ('💨 Nice one'), remove the 30-minute cooldown from the fart path since nothing is transmitted, and note in the component doc that fart is device-local.

### B23. A failed partner message is logged and discarded; messageSendFailed is computed but never reaches the UI _(verified)_

**Medium** · `src/components/scripture-reading/hooks/useReportPhase.ts:194` · `message-send-failure-swallowed`

**What you see:** The user writes a message to their partner, taps Send, and is moved straight to the report as if it succeeded. The message was never stored; the report simply omits the "Your message" block and gives no explanation.

**The question:** When the partner message write fails but the session still completes, what should the report show? (a) an informational, non-dismissible banner only — 'We couldn't deliver your message to <partner>' — cheapest, no retained text; (b) a dismissible banner with a one-tap Resend that re-posts the retained message text and then refetches the report so the 'Your message' block appears; or (c) keep the user on the compose screen with an inline error instead of advancing to the report, so the message is never silently lost.

**Why it can't be decided for you:** `messageSendFailed` is set at useReportPhase.ts:196 and returned at line 491, but useSoloReadingFlow.ts (lines 131-147) never re-exports it — confirmed dead. The plumbing is trivial; the proposed *resend* is not. The message text lives only in MessageCompose's local state, which unmounts on the transition to `report`, so a resend requires retaining the text in the hook, and after a successful resend the already-loaded `reportData` still omits `userMessage` unless the report is refetched (`reportReloadKey`, line 77). "Dismissible" adds another state. Those are user-visible product choices, not plumbing.

### B24. loadSession's background-refresh callback has no staleness guard and can revert a step or resurrect an exited session _(verified)_

**Medium** · `src/stores/slices/scriptureReadingSlice.ts:240` · `stale-session-refresh-clobber`

**What you see:** After tapping Continue on the resume prompt, the reading screen can jump backwards one verse; or, if the user exits quickly, they are yanked back out of the overview and into the reading flow they just left.

**The question:** When the fire-and-forget background refresh (or the VERSION_MISMATCH refetch) returns a row that is behind the user's local progress, what wins? (a) Server always wins, and we only add the session-id staleness guard — simplest, matches the documented "Server is Source of Truth" pattern, but the user can still see a one-verse jump backwards if the server read was stale; (b) local wins per-field when ahead — `currentStepIndex` via `Math.max`, `currentPhase` via a new explicit phase-rank order we would have to define — which never jumps backwards but can leave a together-mode client permanently ahead of its partner; (c) drop the whole refresh when the local step is ahead.

**Why it can't be decided for you:** The staleness guard half is unambiguous, but the second half — "merge rather than replace (preserve the locally-advanced currentStepIndex/currentPhase when they are ahead of the server)" — has no single implementation: `ScriptureSessionPhase` is `'lobby' | 'countdown' | 'reading' | 'reflection' | 'report' | 'complete'` (src/services/dbSchema.ts:26-33) with no ordering helper anywhere in the repo, so "ahead" for a phase has to be invented, and the service header explicitly documents the opposite policy: "Cache pattern (Solo Mode — Server is Source of Truth)" (src/services/scriptureReadingService.ts:145). Version-based merging is not available as a tiebreak either, because solo `advanceStep` calls `updateSession` with only `currentStepIndex` and never bumps `version` (src/stores/slices/scriptureReadingSlice.ts:382-384).

### B25. The report's "Your Reflections" ratings are always empty — the only reflection write uses stepIndex 17, the report reads stepIndex < 17

**Medium** · `src/components/scripture-reading/hooks/useReportPhase.ts:330` · `report-ratings-never-populated`

**What you see:** The "Your Reflections" section of the Daily Prayer Report lists all 17 verse references with no rating circle on any row, for every user in every session. The partner's side-by-side rating column never appears. The 1-5 rating the user actually gave on the reflection screen is stored but never shown back to them anywhere.

**Options in the audit:** Decide which behaviour is intended. If per-step ratings are wanted, add a rating control to the reading phase that calls `scriptureReadingService.addReflection(sessionId, stepIndex, ...)` for each step. If only the session-level rating exists, change `useReportPhase` to read the `stepIndex === MAX_STEPS` reflection's rating and render it as a single "Session rating" row in `DailyPrayerReport`, and drop the dead `stepIndex < MAX_STEPS` filters.

### B26. Both partners can pick the same role; nothing on the client or server prevents it, so roles never alternate complementarily

**Medium** · `supabase/migrations/20260301000200_remove_server_side_broadcasts.sql:72` · `duplicate-role-selection-allowed`

**What you see:** If both partners tap 'Reader', both see 'You're the Reader' on every even step and 'You're the Responder' on every odd step. Nobody is ever assigned the complementary part, so on every verse both people read the same text and the response prayer is never spoken — the core premise of together mode silently fails, with no warning anywhere.

**Options in the audit:** In scripture_select_role, raise when the partner's role column already equals p_role (or auto-assign the complement and return it in the snapshot), and add the partner's role to the returned snapshot. On the client, disable/annotate the role card the partner already took in LobbyContainer using the user1Role/user2Role already present in StateUpdatePayload, and show 'Partner is the Reader' next to the partner status block.

### B27. persist has version 0 and no migrate function — any future schema bump silently wipes user data _(verified)_

**Low** · `src/stores/useAppStore.ts:84` · `persist-no-migrate`

**What you see:** The first time anyone bumps `version` to migrate the persisted schema, every existing user silently loses their theme/relationship settings, favourited messages, entire daily-message history (`shownMessages`), and the localStorage copy of their moods. The only signal is a `console.error` that no user will ever see.

**The question:** What should the persist `migrate` do? Option A: a blanket passthrough (`migrate: (persistedState) => persistedState as PersistedState`) — future version bumps then preserve ALL old state untransformed, which defeats the point of versioning and can leave genuinely incompatible data in place. Option B: leave `version: 0` with no migrate and adopt a rule that `migrate` is authored at the moment the version is actually bumped, per schema change. Option C: keep version-0 behaviour but make the discard path visible (a user-facing "your settings were reset" notice) instead of the current console.error only. Note Option A is not a one-liner: `migrate`'s return type is the inferred `partialize` output (`{settings, isOnboarded, messageHistory: {…, shownMessages: [string, number][]}, moods}`), which `AppState` is NOT assignable to (AppState's `shownMessages` is a `Map`), so it requires extracting `partialize` (useAppStore.ts:119-141) into a named function with an explicit return type and casting through `ReturnType<typeof …>` under TS strict with `no-explicit-any`.

**Why it can't be decided for you:** Confirmed unfixed — `version: 0, // State schema version (matches test fixtures)` at src/stores/useAppStore.ts:84 with no `migrate` key anywhere in the persist options (lines 82-273). But the fix is not implementable as written. A `migrate` only runs on a version mismatch, and with only version 0 existing it is dead code until someone bumps the version — at which point what it must do depends entirely on the schema change being made. Also, "re-runs the Map deserialization logic" is redundant: `onRehydrateStorage` (lines 160-228) already rebuilds `shownMessages` into a Map after migrate. And the second clause — "Decouple `version` from the test fixtures" — has no target: grepping `version: 0` / `"version": 0` across src, tests, and scripts returns only useAppStore.ts:84 and an unrelated `SupabaseSessionSchema` assertion at tests/unit/validation/schemas.test.ts:150. No persist fixture exists to decouple.

### B28. Favorites are written to IndexedDB and localStorage independently and never reconciled _(verified)_

**Low** · `src/stores/slices/messagesSlice.ts:119` · `favorites-two-sources-of-truth`

**What you see:** After the app has cleared corrupted localStorage (a path it performs on its own), tapping the heart does nothing visible on the first tap — the icon stays unfilled — and the persisted favourite flag ends up inverted relative to what the user sees.

**The question:** Which store is authoritative for favourites, and what happens to the disagreeing side? Option A (what the fix implies): IndexedDB `Message.isFavorite` wins — rebuild `messageHistory.favoriteIds` from `messages` on every load, which silently DROPS any favourite that only ever landed in localStorage. Option B: union the two on load (favourite if either source says so) — never loses a favourite, but a message whose two sources disagree can never be un-favourited in one tap. Option C: delete `favoriteIds` as a source and have DailyMessage read `currentMessage.isFavorite` directly, making IndexedDB the single store — smallest surface, but `favoriteIds` is a persisted field of `MessageHistory` (src/types/index.ts:111) and becomes dead persisted data.

**Why it can't be decided for you:** The divergence is real and unfixed: the heart icon renders from localStorage (`messageHistory.favoriteIds.includes(currentMessage.id)`, DailyMessage.tsx:59) while the write and the add/remove branch both come from IndexedDB's `isFavorite` (messagesSlice.ts:111 and :119). But the fix text opens with "Pick one store" — a directional choice with materially different user-visible outcomes — and its concrete recipe is wrong about where to hook in: `loadMessages` (messagesSlice.ts:79) is only ever called from the custom-message CRUD paths (messagesSlice.ts:373, 407, 427, 514). App startup never calls it — `initializeApp` sets `messages` directly via `set({ messages: storedMessages })` at settingsSlice.ts:141 and :144. Rebuilding favoriteIds "after loadMessages" therefore leaves the exact reported cold-start symptom unfixed.

### B29. IndexedDB quota handling is specified and stubbed but never wired up; only localStorage is monitored, with a hardcoded 5MB estimate

**Low** · `src/services/BaseIndexedDBService.ts:302` · `indexeddb-quota-never-checked`

**What you see:** When IndexedDB hits its origin quota, writes throw a raw `QuotaExceededError` that surfaces as a generic failure. The user gets no warning as they approach the limit and no guidance about what to delete; the app just stops being able to save moods, messages and scripture cache entries.

**Options in the audit:** Replace `logStorageQuota`'s hardcoded 5MB accounting with `await navigator.storage.estimate()` (usage/quota covers IndexedDB, Cache Storage and localStorage together), expose it as an async `getStorageEstimate()`, and call it on a schedule rather than once at init. In `BaseIndexedDBService.add/update`, detect `error.name === 'QuotaExceededError'` and route to `handleQuotaExceeded()` so callers get a distinguishable error, then surface a user-facing "storage full" message in the mood/message write paths. If the 80%/95% thresholds from AC-4.1.9 are no longer wanted, delete the stub and the comment instead of leaving a specified behaviour unimplemented.

### B30. Two-thirds of supabaseSchemas.ts is unreferenced; the interactions and users Supabase boundaries have no runtime validation at all

**Low** · `src/api/validation/supabaseSchemas.ts:159` · `dead-supabase-zod-schemas`

**What you see:** Mood and scripture responses are schema-checked, but interaction, user/partner and photo rows flow from Supabase into Zustand state completely unvalidated. A column rename or type change on those tables produces `undefined` deep inside a component instead of a clean parse error at the API boundary, and the inconsistency makes it easy to assume validation exists where it does not.

**Options in the audit:** Pick one direction and make it consistent. Either wire the schemas up — `InteractionArraySchema.parse(data)` in `interactionService`'s fetch and realtime handlers, `UserArraySchema.parse(data)` in `partnerService.searchUsers`/`getPendingRequests`, `SupabasePhotoSchema` in `photoService`'s reads — or delete the unused exports so the file reflects reality. Regardless, rename one of the two `SupabaseMessageSchema` exports (e.g. `ScriptureMessageRowSchema` in `src/validation/schemas.ts:257`) to remove the collision.

### B31. photos/PhotoUploader.tsx is 482 lines of unreferenced upload code that has drifted from the live implementation

**Low** · `src/components/photos/PhotoUploader.tsx:45` · `dead-photouploader-drifted`

**What you see:** Two upload implementations exist with different behaviour; the better one is dead. A maintainer reading `PhotoUploader` would reasonably conclude uploads are compressed and have progress bars and retry toasts — none of which is true of the live `PhotoUpload`.

**Options in the audit:** Port the two things PhotoUploader gets right — calling `imageCompressionService.compressImage` and binding the progress bar to `uploadProgress` — into `PhotoUpload.tsx`, then delete `src/components/photos/PhotoUploader.tsx` and `src/hooks/usePhotos.ts`. While there, note that `photosSlice` declares `error` and `isLoading`-adjacent keys that collide with `appSlice`'s global `error` (appSlice.ts:26 `setError` is called from settingsSlice.ts:102,157), so photo errors and app-init errors overwrite each other; rename the photo ones to `photosError` / `clearPhotosError`.

> **Order:** decide/do `gallery-upload-skips-compression` first. dead-photouploader-drifted deletes src/components/photos/PhotoUploader.tsx and src/hooks/usePhotos.ts. gallery-upload-skips-compression's fix says to copy the compression call out of that very file — 'exactly as photos/PhotoUploader.tsx:171-181 already does' — into PhotoUpload.handleUpload. Delete first and the reference implementation is gone from the working tree. Port the compression (and the uploadProgress binding dead-photouploader-drifted also wants preserved) into PhotoUpload, verify it, then delete.

### B32. PokeKissInterface and InteractionHistory subscribe to the entire Zustand store _(verified)_

**Low** · `src/components/PokeKissInterface/PokeKissInterface.tsx:70` · `pokekiss-unsliced-store-subscription`

**What you see:** On the Partner tab, unrelated activity — mood sync ticks, scripture session state, love-note arrivals, network status flips — re-renders the FAB, all four animated action buttons, and the History modal subtree, contending with Framer Motion animations on low-end phones.

**The question:** Two coupled behaviour choices for the History modal: (1) When closed, should InteractionHistory return `null` outright — cheapest, but the modal loses its Framer Motion exit/close animation because AnimatePresence unmounts with it — or keep AnimatePresence mounted and only move the `getInteractionHistory(7)` call inside the `isOpen` branch, preserving the close animation? (2) Once the subscription is narrowed, should the open modal stay live when a poke/kiss arrives over realtime (requires subscribing to `state.interactions` and computing the 7-day filter in a `useMemo`, not calling the getter during render), or is a snapshot taken when the modal opens acceptable?

**Why it can't be decided for you:** The PokeKissInterface half is clean, but the InteractionHistory half has two blockers. (a) The fix text itself offers "early-return `null` when `!isOpen` ... or move the `getInteractionHistory(7)` call inside the open branch" — these are NOT equivalent: the component's entire body is `<AnimatePresence>{isOpen && ...}</AnimatePresence>` (InteractionHistory.tsx:79-203), so returning `null` unmounts AnimatePresence and destroys the modal's close/exit animation (`exit={{ opacity: 0, scale: 0.95, y: 20 }}`, line 97). (b) `getInteractionHistory` is a non-reactive getter reading `get().interactions` (interactionsSlice.ts:157-165). Today the modal stays live only because the bare `useAppStore()` re-renders it on every store write; narrowing to actions + `userId` would silently stop the open list from updating when `handleIncoming` pushes a new interaction (interactionsSlice.ts:243-244).

### B33. Presence heartbeat interval is replaced without being cleared, and the presence re-subscribe loop has no retry cap _(verified)_

**Low** · `src/hooks/useScripturePresence.ts:150` · `presence-interval-leak-and-unbounded-retry`

**What you see:** On a flaky connection the presence channel emits duplicate heartbeats (2x, 3x, ... per 10s) and, if the channel errors persistently — e.g. the session ended so the RLS policy on realtime.messages no longer matches, or the JWT expired — the hook spins in a tight re-subscribe loop: remove channel, getUser(), new channel, CHANNEL_ERROR, repeat, bounded only by network RTT. This burns battery and Realtime quota, and every iteration logs a console warning.

**The question:** What retry policy should the presence channel use after CHANNEL_ERROR? (a) Copy useScriptureBroadcast verbatim — flat cap of 5 immediate retries per mount, no backoff, no reset — consistent with the other channel, but after 5 errors the partner-position indicator stays dead until the user leaves and re-enters the reading screen; (b) cap plus exponential backoff (needs a base delay and ceiling picked, e.g. 1s doubling to 30s) with the counter reset on SUBSCRIBED, which recovers indefinitely across a long flaky session but has no hard ceiling on total retries; (c) cap plus backoff without the reset — bounded like (a) but gentler on battery and Realtime quota.

**Why it can't be decided for you:** The interval half is a genuine one-liner, but the retry half has no single implementation and the fix text contradicts itself: it says "mirror useScriptureBroadcast's guard", yet that hook has neither backoff nor a counter reset — it uses a flat `const MAX_BROADCAST_RETRIES = 5` (src/hooks/useScriptureBroadcast.ts:46) checked as `retryCount < MAX_BROADCAST_RETRIES` (lines 204, 221) and never resets on SUBSCRIBED. Adding "reset the counter on SUBSCRIBED" makes the cap per-flap rather than per-mount, which is a materially different outcome for a user on a flaky connection. The third clause, "stop retrying once the session id is gone from the store", also does not apply as written: the hook takes `sessionId` as a prop (src/hooks/useScripturePresence.ts:44) fed by `session?.id ?? null` (src/components/scripture-reading/containers/ReadingContainer.tsx:90-94) and deliberately reads no store at all.

## 3 · Database migrations

Requires SQL applied to the production database. Different deploy path, larger blast radius, and several are security fixes.

### C1. scripture_seed_test_data is SECURITY DEFINER with an inert production guard and a default PUBLIC execute grant

**Critical** · `supabase/migrations/20260309000001_at_reflection_preset.sql:41` · `seed-rpc-live-in-production`

**What you see:** Anyone holding the publishable anon key — which is shipped in the deployed JavaScript bundle at https://sallvainian.github.io/My-Love/ — can POST to `/rest/v1/rpc/scripture_seed_test_data` against the production database and insert an unbounded number of fabricated scripture sessions, step states, reflections and prayer messages attributed to the oldest account in `auth.users`. The real couple sees fake sessions and fake prayer messages in their history, and the row count can be driven arbitrarily high.

**Fix:** Two changes in a new migration. (1) `REVOKE ALL ON FUNCTION public.scripture_seed_test_data(INT, BOOLEAN, BOOLEAN, TEXT, INT[]) FROM PUBLIC, anon, authenticated;` and grant it only to `service_role`, so E2E seeding uses the service key rather than a user session. (2) Replace the string-compare guard with one that fails closed — e.g. `IF coalesce(current_setting('app.environment', true), 'production') <> 'local' THEN RAISE EXCEPTION`. Also clamp `p_session_count` (`IF p_session_count > 10 THEN RAISE EXCEPTION`). Add a pgTAP case in `supabase/tests/database/02_rls_policies.sql` asserting `anon` and `authenticated` cannot execute the function.

### C2. Partner search can never return a row under the current users RLS policy, making linking unreachable

**Critical** · `src/api/partnerService.ts:121` · `partner-search-rls-dead`

**What you see:** On the Partner tab, typing any name or email into the search box always shows 'No users found matching "..."'. There is no way to find, request, or link a partner through the app at all.

**Fix:** Add a SECURITY DEFINER RPC (e.g. `search_users(p_query text, p_limit int)`) in a new migration that queries public.users with RLS bypassed, returns only id/email/display_name, requires `char_length(p_query) >= 2`, excludes `auth.uid()` and any row with `partner_id IS NOT NULL`, and is granted only to `authenticated`. Rewrite PartnerService.searchUsers to call it via supabase.rpc instead of `.from('users')`. Do the same for the request enrichment in getPendingRequests — either a `get_pending_partner_requests()` RPC that joins users server-side, or widen the users SELECT policy to include rows referenced by a pending partner_request involving auth.uid(). While there, fix partnerService.ts:173 which discards the PostgREST error from the target-user lookup, so the 'This user already has a partner' pre-check silently never fires.

### C3. Partner mood broadcasts use a public Realtime channel, so any holder of the anon key can read mood notes and inject fake moods

**High** · `src/api/moodSyncService.ts:361` · `mood-broadcast-public-channel`

**What you see:** The private note a user attaches to a mood ("had a fight with my mom", up to 200 chars) is transmitted over a Realtime topic that anyone can join. A third party who reads the anon key out of the deployed bundle and knows or guesses a user UUID can subscribe to `mood-updates:{uuid}` and receive every mood that user's partner logs, and can also send a forged `new_mood` event that the victim's app accepts and renders as their partner's mood.

**Fix:** Add `private: true` to the channel config at both `moodSyncService.ts:124` and `moodSyncService.ts:361`, then add `realtime.messages` RLS policies modelled on 20260220000001_scripture_lobby_and_roles.sql:70-97: SELECT allowed when `topic like 'mood-updates:%'` and `split_part(topic,':',2)::uuid = auth.uid()` (you may only listen on your own channel), INSERT allowed when the topic UUID equals `public.get_my_partner_id()` (you may only publish to your partner's channel). Additionally, validate the received payload in the handler at line 366 — reject it unless `payload.user_id` matches the known partner id — so a forged message cannot reach state even if the channel config regresses.

### C4. Sending an image with no caption always fails — DB CHECK requires content length >= 1

**High** · `src/components/love-notes/MessageInput.tsx:131` · `image-only-note-violates-check`

**What you see:** User picks a photo, leaves the caption box empty, taps Send. The bubble appears, the image uploads, then it flips to a red-bordered "Failed to send · Tap to retry". Tapping retry re-uploads the image and fails again, forever. Text+image messages work fine, so it looks random to the user.

**Fix:** Either relax the constraint to allow empty content when `image_url IS NOT NULL` (new migration: drop `love_notes_content_check`, re-add as `CHECK (char_length(content) <= 1000 AND (char_length(content) >= 1 OR image_url IS NOT NULL))`), or have `notesSlice.sendNote` substitute a non-empty placeholder. The migration route is correct — the client already treats image-only as a supported case. Additionally, in `sendNote`'s insert-error branch (notesSlice.ts:379-392) call `deleteLoveNoteImage(storagePath)` so the failed attempt does not orphan a storage object.

### C5. love-notes broadcast channel is public — any authenticated user can read or forge another couple's messages

**High** · `src/stores/slices/notesSlice.ts:413` · `lovenotes-public-broadcast-channel`

**What you see:** Any signed-in account can subscribe to another user's love-notes topic and receive the full plaintext and image path of every note delivered to them in real time. The same account can broadcast a forged `new_message` payload into a victim's chat, which renders as a message from their partner.

**Fix:** Add `{ config: { private: true } }` to both `supabase.channel()` calls, and add a migration creating `realtime.messages` SELECT/INSERT policies scoped to `topic like 'love-notes:%'` where `split_part(topic, ':', 2)::uuid` is the caller or the caller's `partner_id` — mirroring the scripture policies. Also validate in `handleNewMessage` that `message.to_user_id === userId` before calling `addNote`.

### C6. scripture_sessions UPDATE policy has USING but no WITH CHECK, letting a member attach an arbitrary third party as user2

**Medium** · `supabase/migrations/20260128000001_scripture_reading.sql:147` · `scripture-session-update-no-with-check`

**What you see:** A session participant can add any user in the system as `user2_id` on their session. That third party then gains SELECT on the session row, SELECT on every reflection in it that is marked `is_shared`, SELECT on the prayer messages, and both send and receive rights on the private `scripture-session:{id}` and `scripture-presence:{id}` Realtime channels — including the ability to inject `state_updated` broadcasts that drive the other participant's UI.

**Fix:** Replace the policy with one that pins identity on both sides: `DROP POLICY scripture_sessions_update ON scripture_sessions; CREATE POLICY scripture_sessions_update ON scripture_sessions FOR UPDATE USING (user1_id = auth.uid() OR user2_id = auth.uid()) WITH CHECK (user1_id = auth.uid() OR user2_id = auth.uid());` — and, because membership is what grants access, forbid membership columns from being rewritten by clients at all: keep `user1_id`/`user2_id` mutable only through the existing SECURITY DEFINER join/convert RPCs. Add a pgTAP case asserting a member cannot set `user2_id` to a non-member.

### C7. Interaction realtime uses postgres_changes on a table no migration adds to supabase_realtime

**Medium** · `src/api/interactionService.ts:185` · `interactions-realtime-no-publication`

**What you see:** Partner sends a poke or kiss while you have the app open on the Partner tab. No badge appears on the heart FAB, no animation, nothing. The interaction only ever surfaces if you manually open the History modal.

**Fix:** Add a migration containing `ALTER PUBLICATION supabase_realtime ADD TABLE public.interactions;`. Unlike moods, the interactions RLS predicate is a flat `auth.uid() = from_user_id OR auth.uid() = to_user_id` that Realtime can evaluate, so postgres_changes is viable here once publication membership exists — no Broadcast rewrite needed. Also surface the subscribe status: interactionService.ts:197-199 only logs it, so a CHANNEL_ERROR leaves the UI silently non-live.

### C8. There is no way to unlink a partner, and a wrong link is permanently unrecoverable for both users

**Medium** · `supabase/migrations/20260205000001_fix_users_rls_recursion.sql:53` · `no-unlink-partner`

**What you see:** Accept a request from the wrong person (or from someone you later want to disconnect from) and both accounts are permanently bound. Neither user can unlink, and neither can ever link to anyone else — they must abandon their accounts or have an operator run SQL.

**Fix:** Add an `unlink_partner()` SECURITY DEFINER RPC in a new migration that clears partner_id on both `auth.uid()` and its current partner in one statement, declines any lingering pending partner_requests between them, and is granted only to `authenticated`. Expose it as `unlinkPartner()` on PartnerService and PartnerSlice, and add a confirm-guarded 'Disconnect partner' control to the connected state of PartnerMoodView. Cover it with a pgTAP test asserting both rows are cleared and that a third party cannot unlink someone else.

### C9. Interaction rate limiting is localStorage-only with no server-side or RLS-level guard

**Medium** · `src/components/PokeKissInterface/PokeKissInterface.tsx:44` · `interaction-rate-limit-client-only`

**What you see:** The advertised 30-minute cooldown is trivially defeated — clear localStorage, use a private window, or post directly to the REST endpoint — and the recipient can be flooded with pokes/kisses that all land in their history and badge with no server-side ceiling. Nothing bounds row growth on the interactions table either.

**Fix:** Enforce server-side. Add a migration with (a) `ALTER TABLE interactions ADD CONSTRAINT different_users CHECK (from_user_id <> to_user_id)`, (b) a WITH CHECK clause on the insert policy requiring `to_user_id = public.get_my_partner_id()` so interactions cannot be addressed to arbitrary user ids, and (c) a BEFORE INSERT trigger or a `send_interaction(type, to_user_id)` RPC that rejects when a row of the same (from_user_id, type) exists within the cooldown window. Keep the localStorage timer purely as UI affordance, and namespace its keys by userId so they do not leak across accounts on a shared device.

### C10. The avgRating precision migration silently reverted the couple-stats CTE optimization to four sequential scans

**Low** · `supabase/migrations/20260315044923_fix_avg_rating_precision.sql:38` · `couple-stats-cte-reverted`

**What you see:** `scripture_get_couple_stats` runs four independent filtered scans of `scripture_sessions` plus two joined aggregates on every Scripture-tab open, instead of the single CTE-based plan that was deliberately introduced.

**Fix:** Add a migration that re-applies the CTE body from `20260217184551_optimize_couple_stats_rpc.sql` with `round(avg(r.rating), 1)`. To stop the drift recurring, move this function into a declarative schema file rather than re-pasting the whole body in each fix migration.

### C11. Countdown compares a server epoch timestamp against the client's Date.now() with no skew correction

**Low** · `src/components/scripture-reading/session/Countdown.tsx:29` · `countdown-clock-skew`

**What you see:** The two partners do not see the same countdown. On a device whose clock runs ahead of the database, the countdown is skipped entirely and the reading phase starts instantly; on a device whose clock runs behind, the countdown starts at a nonsense digit — a 10s-slow clock renders a giant '13' and counts for 13 seconds while the partner has already been reading for 10.

**Fix:** Derive the countdown from a monotonic local anchor instead of an absolute server timestamp: have the RPC also return the server's `now()` alongside `countdown_started_at`, compute `skew = serverNow - Date.now()` once when the snapshot arrives, and store the countdown deadline as a client-local timestamp. Also clamp getDigit's result to <= 3 so a bad clock can never render an absurd digit, and either fix or delete the 'auto-corrects clock skew' claim in the docblock.

## 4 · Bigger code work

Fully specified — nothing to decide — but touches shared architecture or many files. Not a one-sitting job.

### D1. Service worker and in-app sync both POST the same queued mood on reconnect — no idempotency key, no DB uniqueness

**High** · `src/api/moodSyncService.ts:84` · `mood-sync-double-write`

**What you see:** After logging a mood while offline and then reconnecting, the same mood appears two (or more) times in the partner's mood list and in the Timeline tab. The duplicates are permanent — nothing ever reconciles or removes them.

**Fix:** Give each mood a stable client-generated identity at creation time. In `moodService.create` (src/services/moodService.ts:67) add a `clientId: crypto.randomUUID()` field to the stored entry and persist it in the IndexedDB record. Send it as the row `id` in both writers — `moodSyncService.syncMood` (line 84) and `sw.ts`'s `transformMoodForSupabase` (line 125) — and switch both inserts to an upsert with conflict-ignore semantics (`supabase.from('moods').upsert(moodInsert, { onConflict: 'id', ignoreDuplicates: true })` and `Prefer: resolution=ignore-duplicates` on the SW's REST call). Because `id` is the primary key, the second writer becomes a no-op and both converge on the same row.

### D2. Local mood store is global, not per-user, and survives sign-out — second account sees and overwrites the first account's moods

**High** · `src/stores/slices/moodSlice.ts:156` · `mood-idb-not-user-scoped`

**What you see:** On a browser where two accounts have both been used, the second user's Mood tab pre-fills with the first user's mood selection and note text, their Calendar shows the first user's mood history, and submitting a mood for today silently corrupts the first user's local entry while never syncing the second user's own mood.

**Fix:** Scope the local store by user. Add a `by-user-date` compound index in `upgradeDb` (src/services/dbSchema.ts) as a DB v6 upgrade and change the unique constraint from `date` alone to `[userId, date]`. Filter every read in `src/services/moodService.ts` (`getMoodsInRange`, `getUnsyncedMoods`) and `moodSlice.loadMoods` by the authenticated `userId`. Separately, clear the mood cache on sign-out: call `moodService.clear()` and reset `moods`/`partnerMoods` in the store from `App.tsx`'s `handleSignOut`, and drop `moods` from the `partialize` list in `src/stores/useAppStore.ts:132` (it is already the IndexedDB source of truth, so persisting it to localStorage only duplicates data and grows unbounded).

> **Order:** do `idb-partial-schema-race` first. mood-idb-not-user-scoped proposes 'Add a by-user-date compound index in upgradeDb (src/services/dbSchema.ts) as a DB v6 upgrade'. That upgrade only runs for openers that route through upgradeDb — moodService.ts:40-43 and scriptureReadingService.ts:166-169 do; storage.ts:37-86 and sw-db.ts:25 pass their own `upgrade` callbacks that handle only messages/photos/moods and know nothing about a v6 branch. Bump the version while those two bespoke callbacks exist and whichever module opens first decides whether the new index is created, reproducing exactly the corruption idb-partial-schema-race describes. Unify the upgrade path first.

### D3. session.userId is always user1_id, so for the partner every user-scoped write is RLS-denied and the whole report is inverted

**High** · `src/components/scripture-reading/hooks/useReportPhase.ts:192` · `together-report-identity`

**What you see:** The non-initiating partner (user2) can never send a Daily Prayer Report message — the insert is silently rejected — and their report shows user1's shared bookmarks and user1's standout verses labelled as their own, and user1's message rendered as "Your message to <partner>" instead of "A message from <partner>".

**Fix:** Stop using `session.userId` as "the current user". Add the authenticated id to the params of `useReportPhase`/`useSessionPersistence` (read `state.userId` from authSlice in `useSoloReadingFlow`) and use it for `addMessage`'s senderId, `toggleBookmark`'s userId, `updateSessionBookmarkSharing`'s userId, and every own-vs-partner filter in the `getSessionReportData` effect. Rename `ScriptureSession.userId` to `user1Id` in `src/services/dbSchema.ts` so the invariant can no longer be misread as "me".

### D4. Together-mode bookmarks are local component state only, so the reflection screen says you marked no verses

**High** · `src/components/scripture-reading/containers/ReadingContainer.tsx:193` · `together-bookmarks-not-persisted`

**What you see:** A user who bookmarks verses during a together session reaches the reflection screen and sees "You didn't mark any verses — that's okay" with no chips to select. Their bookmarks are gone, and the Daily Prayer Report shows no bookmark indicators.

**Fix:** Extract the debounced write from `useSessionPersistence.handleBookmarkToggle` into a shared hook and use it in `ReadingContainer` instead of the local-only `setBookmarkedSteps`, and seed `ReadingContainer`'s initial Set from `getBookmarksBySession` the same way `useSessionPersistence` does on mount.

> **Order:** do `together-report-identity` first. The bookmark-persistence fix has to pass a userId to scriptureReadingService.toggleBookmark. The pattern it is told to copy, useSessionPersistence.ts:88, does `const userId = session.userId` — which scriptureReadingService.ts:203 shows is populated from `validated.user1_id`. Copying that pattern before the identity fix hard-codes the same RLS-denied write into a second file. Do the rename and thread the authenticated `state.userId` through first, then extract the shared persistence hook.

### D5. Daily message never rolls over at midnight while the app stays open

**Medium** · `src/stores/slices/settingsSlice.ts:148` · `daily-message-no-midnight-rollover`

**What you see:** A user who leaves the installed PWA open (or backgrounded on a phone) past midnight still sees yesterday's message all of the next day, with no indication it is stale. Swiping back then shows that same message again as "yesterday".

**Fix:** Add a rollover watcher: in DailyMessage (or a small useDailyRollover hook) register a `visibilitychange` + `focus` listener plus a timeout scheduled for the next local midnight that calls updateCurrentMessage(). Also have updateCurrentMessage compare the cached formatDateISO(today) against messageHistory.lastShownDate so it can detect the day change and reset currentIndex to 0.

### D6. subscribeMoodUpdates returns an unsubscribe that closes over the singleton field, not the channel it created — channels leak and stay subscribed

**Medium** · `src/api/moodSyncService.ts:390` · `realtime-channel-singleton-leak`

**What you see:** Toggling connectivity (or navigating away) while a subscription is still being established leaves an orphaned Realtime channel open for the rest of the session. The Partner view then shows 'Disconnected' in the status pill even though a live channel is delivering broadcasts, and each subsequent reconnect stacks another zombie channel, so the 'just logged a mood' toast can fire several times for one partner mood.

**Fix:** Capture the channel in a local const inside `subscribeMoodUpdates` (src/api/moodSyncService.ts:360) and have the returned closure call `supabase.removeChannel(localChannel)` on that captured reference, guarded by an idempotency flag; drop the shared `this.realtimeChannel` field or make it a `Set` for diagnostics only. Separately, add an `isMounted` guard to `PartnerMoodView`'s effect (line 161-204) that calls `unsubscribeFn()` immediately when the effect has already been torn down, mirroring `usePartnerMood.ts:100-103`.

### D7. Chat pagination sentinel is at the bottom of the list, so opening Love Notes drains the whole history in a loop

**Medium** · `src/components/love-notes/MessageList.tsx:239` · `lovenotes-eager-loads-full-history`

**What you see:** Opening Love Notes on an account with a long history fires back-to-back `love_notes` queries (50 rows each) until the entire conversation is in memory, instead of one page. On a slow connection the chat visibly thrashes as it snaps to the bottom after each fetch.

**Fix:** Invert the loader: reserve index 0 as the unloaded sentinel when `hasMore` is true (shift `adjustedIndex` accordingly and make `isRowLoaded(0)` return `false`), so the load fires at the top. Then add scroll compensation after a prepend — capture the pre-fetch scroll offset and restore it plus the height of the inserted rows — and skip the auto-scroll-to-bottom effect when the length change came from `fetchOlderNotes` rather than a new message.

### D8. Clicking the badge can pick an outbound interaction; the mark-as-viewed write is blocked by RLS and the failure is swallowed

**Medium** · `src/components/PokeKissInterface/PokeKissInterface.tsx:246` · `badge-click-marks-sent-silently-fails`

**What you see:** You tap the notification badge expecting to see what your partner sent. Instead you get the animation for a poke you sent, the badge decrements, and after the next history refresh the same phantom count is back. The real received interaction is never shown or cleared.

**Fix:** Two changes. (1) Filter getUnviewedInteractions by `toUserId === get().userId` so only received rows are selectable. (2) Make markAsViewed detect the no-op: append `.select('id')` and throw if the returned array is empty, so a blocked write surfaces instead of being optimistically applied. Additionally, mark received rows viewed when the History modal renders them, so the badge has a bulk-clear path rather than one-at-a-time animation gating.

### D9. The shared 300 ms bookmark debounce collapses N taps into one server toggle, desyncing local and server state _(verified)_

**Medium** · `src/components/scripture-reading/hooks/useSessionPersistence.ts:109` · `bookmark-debounce-toggle-desync`

**What you see:** Double-tapping the bookmark flag leaves the verse looking un-bookmarked while the server records it as bookmarked (and vice-versa). Bookmarking two different verses in quick succession silently drops the first one entirely.

**Why it is here:** Confirmed: one shared `bookmarkDebounceRef` (useSessionPersistence.ts:40) is cleared on every tap regardless of step (lines 102-104), and the fired callback calls `toggleBookmark` (line 109), which flips whatever the server currently has — so N taps on one verse produce one flip, and a second verse tapped within 300 ms cancels the first verse's write entirely. But 'key the debounce by step index' alone does not fix the same-verse double-tap; that needs the second half, 'an explicit set-desired-state call', and no such service method exists — `scriptureReadingService` only offers `addBookmark` (line 374, plain insert) and `toggleBookmark` (line 411). So this is a new public service API + its IndexedDB cache write path + a rewritten hook + updating the service mock in the component test, and the revert-on-failure logic (lines 116-125) has to change from 'flip' to 'restore previous' or it reintroduces the same desync. Not a debounce-key one-liner.

**Plan:** 1) src/services/scriptureReadingService.ts — add next to `toggleBookmark` (after line 442): `async setBookmark(sessionId: string, stepIndex: number, userId: string, desired: boolean, shareWithPartner: boolean): Promise<void>`. When `desired` is true: `supabase.from('scripture_bookmarks').upsert({ session_id, step_index, user_id, share_with_partner }, { onConflict: 'session_id,step_index,user_id' }).select().single()` — the table already has `UNIQUE (session_id, step_index, user_id)` (supabase/migrations/20260128000001_scripture_reading.sql:86), so this needs no migration — then `SupabaseBookmarkSchema.parse(data)` → `toLocalBookmark` → `void this.cacheBookmark(local)`. When false: `.delete().eq('session_id', sessionId).eq('step_index', stepIndex).eq('user_id', userId)`, then look the row up via `getBookmarkByStep` (line 951) beforehand so `removeBookmarkFromCache(existing.id)` (line 647) can clear the IndexedDB entry. Throw `createScriptureError(ScriptureErrorCode.SYNC_FAILED, ...)` on error, matching lines 391-399. Keep `toggleBookmark` so its existing unit tests stay valid.
2) src/components/scripture-reading/hooks/useSessionPersistence.ts — replace `bookmarkDebounceRef` (line 40) with `const bookmarkTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());`; update the unmount cleanup (lines 43-47) to iterate and `clearTimeout` every entry, then `clear()`. In `handleBookmarkToggle` (line 84) capture the new desired value inside the `setBookmarkedSteps` updater into a local `let desired: boolean` (or mirror the Set in a ref), clear only `bookmarkTimersRef.current.get(stepIndex)`, and schedule a per-step timer that deletes its own map entry and calls `scriptureReadingService.setBookmark(sessionId, stepIndex, userId, desired, false)`. In the failure branch, replace the blind flip (lines 117-125) with a restore that only acts if the local value still equals `desired`.
3) src/components/scripture-reading/__tests__/SoloReadingFlow.test.tsx — add `setBookmark: (...args: unknown[]) => mockSetBookmark(...args)` to the service mock object at lines 109-117 (alongside `toggleBookmark` at line 111) or the hook will call `undefined`.
4) tests/unit/services/scriptureReadingService.cache.test.ts — add a `setBookmark` describe mirroring the `toggleBookmark` block (lines 592-640) for the upsert and delete paths.

### D10. fetchAndCacheUserSessions writes the querying user's id into the cached session row, contradicting the user1_id invariant _(verified)_

**Medium** · `src/services/scriptureReadingService.ts:710` · `session-cache-userid-inconsistent`

**What you see:** The same session row in IndexedDB holds different `userId` values depending on which fetch wrote it last, so own-vs-partner attribution in the report, bookmark writes, and the `isUser1` role/ready mapping after a reconnect can behave differently between runs for the same user and session.

**Why it is here:** The literal one-liner at src/services/scriptureReadingService.ts:710 also silently re-keys the IndexedDB `by-user` index, because the index keyPath is the same field: `sessionsStore.createIndex('by-user', 'userId')` (src/services/dbSchema.ts:265) and `getUserSessions` reads it with the caller's id — `db.getAllFromIndex('scripture-sessions', 'by-user', userId)` (src/services/scriptureReadingService.ts:241). And the fix's second clause ("rename the field to `user1Id`") requires changing that keyPath, which needs `DB_VERSION = 5` (src/services/dbSchema.ts:173) bumped to 6 plus a new `if (oldVersion < 6)` block, i.e. exactly the shared IndexedDB-schema change the easy criteria exclude.

**Plan:** Sequence it as two shippable steps, not one. Step 1 (one line, safe on its own): in `ScriptureReadingService.fetchAndCacheUserSessions` (src/services/scriptureReadingService.ts:699-720), line 710 `const locals = validated.map((row) => toLocalSession(row, userId));` becomes `const locals = validated.map((row) => toLocalSession(row, row.user1_id));`, matching the two other writers at lines 203 and 689. Note the consequence in the PR: after this, a user2 querying `getUserSessions(theirOwnId)` no longer gets together-mode rows back from the `by-user` index, so that path always round-trips to the server and returns [] offline — acceptable today only because the sole caller, `checkForActiveSession` (src/stores/slices/scriptureReadingSlice.ts:301-304), filters `s.mode === 'solo'`, and solo rows always have `user1_id === userId`. Step 2 (the rename, separate PR): rename `ScriptureSession.userId` → `user1Id` in src/services/dbSchema.ts:41, change `createIndex('by-user', 'userId')` to `'user1Id'`, bump `DB_VERSION` 5→6 at src/services/dbSchema.ts:173 and add an `if (oldVersion < 6)` block in `upgradeDb` that deletes and recreates the `by-user` index (existing cached rows still carry the old key, so they must be dropped or rewritten), then update `toLocalSession` (line 88-102), `isUser1` at src/stores/slices/scriptureReadingSlice.ts:607 and 770 with its comment at 766, and the selector `sessionUserId: state.session?.userId ?? null` at src/hooks/useScriptureBroadcast.ts:76.

> **Order:** do `together-report-identity` first. session-cache-userid-inconsistent's fix is one line — `toLocalSession(row, row.user1_id)` at scriptureReadingService.ts:710 — and its stated second half is 'rename the field to user1Id so no caller can mistake it for the current user', which is together-report-identity's fix. Doing the one-liner first without the rename leaves the misleading declaration at dbSchema.ts:42 ('userId: string; // Current user's ID') in place and the ten consumers still wrong; the rename pass would then have to revisit line 710 anyway.

### D11. Leaving the lobby with the back button leaves user_ready=true on the server, so the partner can start the session without you

**Medium** · `src/components/scripture-reading/containers/LobbyContainer.tsx:170` · `stale-ready-flag-after-lobby-exit`

**What you see:** A user who readies up, changes their mind and backs out of the lobby is later yanked into a live reading session (countdown, then Verse 1) without ever pressing 'I'm Ready' in that visit. If they do not re-enter, the partner instead gets pulled into a session alone and waits on a lock-in that will never come.

**Fix:** Make the lobby back button an explicit leave: await `toggleReady(false)` (and ideally a new `scripture_leave_lobby` RPC that also clears the caller's role and broadcasts) before calling exitSession. At minimum, have `exitSession` fire-and-forget scripture_toggle_ready(false) when session.mode === 'together' && currentPhase === 'lobby'.

### D12. Lobby actions taken before the broadcast channel subscribes are never sent to the partner, and there is no fallback

**Medium** · `src/hooks/useScriptureBroadcast.ts:179` · `broadcastfn-null-before-subscribed`

**What you see:** A user who taps a role and 'I'm Ready' within the first second of entering the lobby can start the countdown on their own device while the partner's lobby still reads 'X is not ready yet' — permanently. One partner ends up in the reading phase, the other is stuck in the lobby with no error and no way to recover except backing out.

**Fix:** Do not gate broadcasting on SUBSCRIBED. Wire `setBroadcastFn` as soon as the channel object exists and let supabase-js fall back to REST for non-joined channels (or call `channel.httpSend(event, payload)` explicitly), and buffer sends that fail. Additionally, disable the role/ready buttons (or show a 'connecting' state) until the channel reports SUBSCRIBED, and have the SUBSCRIBED handler always re-broadcast the current lobby snapshot, not just `partner_joined`.

### D13. The lobby has no presence or disconnection detection — a partner who leaves leaves the other waiting indefinitely

**Medium** · `src/components/scripture-reading/containers/LobbyContainer.tsx:199` · `lobby-has-no-presence-detection`

**What you see:** If the partner closes the app, loses connection, or never opens the session at all, the lobby shows 'Waiting for [partner]...' (or, worse, a stale '✓ [partner] has joined!' and '[partner] is not ready yet') forever. There is no timeout, no reconnecting state, and no prompt offering to continue solo after N seconds — the only exits are the back arrow or the small 'Continue solo' link.

**Fix:** Mount useScripturePresence in LobbyContainer too (it already accepts a sessionId and is view/step agnostic) and drive the joined/ready copy from it, so 'has joined' degrades to 'reconnecting…' when the heartbeat lapses. Add a lobby-level timeout (~60s) that surfaces a prominent 'Still waiting — continue solo?' prompt instead of the current tiny link.

### D14. Every countdown card re-renders once per second forever, including cards that can never change _(verified)_

**Low** · `src/components/RelationshipTimers/EventCountdown.tsx:108` · `event-countdown-idle-ticker`

**What you see:** The home tab runs six independent 1 Hz timers, each triggering a React re-render of a Framer Motion subtree, even for cards whose content is provably static — measurable battery/CPU drain on a phone left on the home screen.

**Why it is here:** The fix is two separable halves and the second is shared infrastructure. Half one (skip the interval when `!date` or when already past) is a genuine 4-line change confined to EventCountdown.tsx:107-110. Half two — "share a single app-level 1 Hz ticker (a small useNow() hook or context) instead of six independent intervals" — requires a new module plus rewiring all three timer components, each of which owns its own `setInterval(…, 1000)`: EventCountdown.tsx:108, BirthdayCountdown.tsx:61, TimeTogether.tsx:33. That is a new shared timing primitive every home-screen card depends on, and the "hook or context" alternatives have materially different implementations (a naive per-consumer `useNow()` creates six intervals again and fixes nothing; only a module-level shared subscription or a provider actually dedupes).

**Plan:** Ship the two halves separately.
HALF 1 (safe standalone, 1 file, do this now): in src/components/RelationshipTimers/EventCountdown.tsx replace the effect at lines 107-110 with:
```ts
  useEffect(() => {
    if (!date) return;
    if (timeDiff?.isPast) return;
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [date, timeDiff?.isPast, updateCountdown]);
```
This is provably correct here: `RELATIONSHIP_DATES.wedding` is `null` (src/config/relationshipDates.ts:45), so the Wedding card currently burns a 1 Hz render forever just to re-render the static `XX:XX:XX` placeholder at lines 142-145. Do not guard on `isEventToday` — the hours/minutes/seconds row (lines 166-170) is not rendered on the Today branch, but `isEventToday` must still be able to flip at midnight, and `isPast` covers that transition.
HALF 2 (the shared ticker, a separate change): create src/hooks/useNow.ts exporting a hook backed by ONE module-level `setInterval` plus a `Set` of subscribers (or `useSyncExternalStore` over that set), then replace the local interval + `updateCountdown` state machinery in EventCountdown.tsx (lines 89-110), BirthdayCountdown.tsx (lines 60-62 region), and TimeTogether.tsx (lines 32-34 region) with `const now = useNow();` and derive the display values with `useMemo`. Six cards then commit once per second at most instead of six times.

## 5 · Action only you can take

Not a code change.

### E1. Plaintext test-account password committed to a migration that runs against production

**High** · `supabase/migrations/20260316031209_create_claude_bot_config.sql:14` · `bot-password-committed`

**What you see:** A working password for a real account on the production Supabase project sits in the git history of a repository whose build is published to GitHub Pages. Anyone with repository read access — or anyone who obtains the history later — can sign in as that account and read/write whatever that account can reach through RLS.

**Fix:** Rotate the account password immediately (the committed one must be treated as compromised regardless of what happens next). Change the migration to seed only non-secret keys — or nothing at all — and have E2E setup read `CLAUDE_BOT_PASSWORD` from fnox locally and from GitHub Secrets in CI, writing it into `claude_bot_config` at test-setup time with the service-role key. Since the value is already in history, purge it or accept it as burned and never reuse it.

## 6 · Test coverage

No behaviour change; closes the gap that let other defects ship.

### F1. The entire offline sync and reconciliation layer (929 lines) has zero unit tests

**Medium** · `src/api/moodSyncService.ts:189` · `mood-sync-layer-untested`

**What you see:** The code that decides whether a user's offline-logged mood survives has no automated coverage, so the duplicate-write and duplicate-edit defects above shipped and are not caught by any of the 896 passing tests.

**Fix:** Add `tests/unit/api/moodSyncService.test.ts` with `supabase`, `moodApi` and `moodService` mocked, covering: (a) a mood carrying `supabaseId` must not produce a second `moodApi.create` call — the regression test for the edit-duplicates defect; (b) `syncPendingMoods` marks each success via `markAsSynced` with the returned server id and continues past a failing entry; (c) `syncMoodWithRetry` stops after 4 attempts and does not retry a permanent 42501 RLS rejection; (d) the broadcast receive handler preserves `mood_types`. Add `tests/unit/api/moodApi.test.ts` asserting the offline `isOnline()` guards throw and that a schema-invalid server response surfaces `ApiValidationError`.

## Work clusters

Groups that are cheaper and safer to fix in one pass than one at a time, because they share a root cause or
edit the same lines.

### Photo gallery: one list, two owners, two uploaders, two viewers

`gallery-grid-keeps-deleted-photo`· `photo-delete-stuck-viewer`· `photo-editor-unreachable`· `gallery-upload-skips-compression`· `photo-upload-false-success`· `dead-photouploader-drifted`

All six trace to the same structural mistake: the photo feature has duplicated ownership at every layer. PhotoGallery.tsx:33 keeps `const [photos, setPhotos] = useState<PhotoWithUrls[]>([])` alongside `const { photos: storePhotos } = useAppStore()` (line 30) and reconciles them only with `if (storePhotos.length > photos.length)` (line 106); PhotoViewer receives that stale array as a prop (PhotoGallery.tsx:315-316) while deleting through the store (PhotoViewer.tsx:41). Two viewers exist (PhotoViewer, mounted from PhotoGallery.tsx:8; PhotoCarousel, mounted at App.tsx:604 but gated on `selectPhoto` which grep shows is defined at photosSlice.ts:215 and called from nowhere). Two uploaders exist (PhotoUpload, live; photos/PhotoUploader.tsx, referenced by nothing). Fixing these one at a time means editing components that a sibling fix deletes. Decide the ownership model once (store as single source of truth, one viewer, one uploader), then all six collapse into that pass.

### Mood write path: no stable row identity in syncMood

`mood-sync-double-write`· `mood-edit-inserts-new-row`· `mood-sync-layer-untested`

moodSyncService.ts:75-104 has exactly one write path and it is unconditional: `const syncedMood = await moodApi.create(moodInsert)` (line 93). There is no branch on `mood.supabaseId` and no client-generated id, so both the re-sync case and the edit case produce extra rows. Both fixes rewrite the same 30 lines and must agree on the identity scheme — mood-sync-double-write proposes `upsert(..., { ignoreDuplicates: true })`, which would make mood-edit-inserts-new-row's update path a silent no-op if applied naively. mood-sync-layer-untested belongs here because its proposed test (a) is literally the regression test for mood-edit-inserts-new-row; writing the tests during this pass rather than after is what makes the pass verifiable.

### Shared-device data leakage: nothing is user-scoped locally

`logout-leaves-user-data`· `store-not-reset-on-signout`· `mood-idb-not-user-scoped`· `sw-sync-attributes-mood-to-wrong-user`· `idb-partial-schema-race`

authSlice.ts:43-49 `clearAuth` sets only `userId`, `userEmail`, `isAuthenticated` — nothing else is reset. The IndexedDB moods store is keyed globally (`moodsStore.createIndex('by-date', 'date', { unique: true })`, dbSchema.ts:252 — date alone, no userId), and the service worker re-stamps pending moods with whatever token is currently stored. These are three faces of one missing concept: a per-user data boundary. idb-partial-schema-race is in the cluster because the proposed fix for mood-idb-not-user-scoped is a v6 compound `[userId, date]` index, and dbSchema.ts's `upgradeDb` is bypassed by two of the five openers (storage.ts:38 and sw-db.ts:26 both pass bespoke `upgrade` callbacks that never create the moods/sw-auth/scripture stores), so a v6 bump lands inconsistently until that is unified.

### Realtime channel privacy: mood and love-notes topics are public

`mood-broadcast-public-channel`· `lovenotes-public-broadcast-channel`· `scripture-session-update-no-with-check`

The scripture feature already has the correct pattern — `private: true` at useScriptureBroadcast.ts:112 and useScripturePresence.ts:102, backed by realtime.messages SELECT/INSERT policies in 20260220000001_scripture_lobby_and_roles.sql:70-97. Mood and love-notes have neither: moodSyncService.ts:124 `supabase.channel(`mood-updates:${partnerId}`)` and :361 (config is `broadcast: { self: false }` only, no `private`), notesSlice.ts:413 and useRealtimeMessages.ts:68 for `love-notes:{id}`. Both need the same two-part change — client flag plus one realtime.messages policy migration modelled on the scripture one — so it is one migration and four call sites, not two projects. scripture-session-update-no-with-check joins the cluster because the scripture policies grant channel access by scripture_sessions membership, and that table's UPDATE policy (20260128000001_scripture_reading.sql:147) has USING with no WITH CHECK, so membership itself is forgeable — auditing the private-channel model without closing that hole leaves the pattern you are about to copy compromised.

### Realtime unsubscribe closes over a singleton field, not the channel

`realtime-channel-singleton-leak`· `realtime-channel-leak-fast-unmount`

Identical anti-pattern in two services. interactionService.ts:182 `this.realtimeChannel = supabase.channel('incoming-interactions')` then returns `() => { if (this.realtimeChannel) { supabase.removeChannel(this.realtimeChannel); ... } }` — the closure reads the mutable field, so a second subscribe orphans the first channel and the first unsubscribe removes the second. moodSyncService.ts:360-395 is the same shape with the same fixed channel name per user. One correction (capture the channel in a local const, make unsubscribe idempotent, name channels per-subscription) applied twice; doing them together keeps the two services from drifting again.

### Scripture: ScriptureSession.userId means user1_id, and callers read it as "me"

`together-report-identity`· `session-cache-userid-inconsistent`· `together-bookmarks-not-persisted`· `together-bookmarks-never-persisted`· `bookmark-debounce-toggle-desync`

dbSchema.ts:42 declares `userId: string; // Current user's ID`, but scriptureReadingService.ts:203 and :689 both call `toLocalSession(validated, validated.user1_id)` while :710 calls `toLocalSession(row, userId)` with the querying user — the field means two different things depending on which fetch wrote it. Every consumer then treats it as "me": useReportPhase.ts:192 `addMessage(session.id, session.userId, message)` and eight own-vs-partner filters at :330,338,342,354,355,358,366,385; useSessionPersistence.ts:88 `const userId = session.userId` feeding `toggleBookmark(sessionId, stepIndex, userId, false)` at :109. Fixing any one of these without the rename re-introduces the ambiguity at the next call site. bookmark-debounce-toggle-desync is included because it restructures the exact same `handleBookmarkToggle` callback (single `bookmarkDebounceRef` at useSessionPersistence.ts:101-127) that the bookmark-persistence fix must extract and share.

### Scripture report phase: six defects in one 450-line hook

`together-report-identity`· `report-ratings-never-populated`· `report-load-error-unreachable`· `report-one-shot-no-refresh`· `reflection-submit-silent-failure`· `message-send-failure-swallowed`

All six live in src/components/scripture-reading/hooks/useReportPhase.ts (lines 131, 192, 194, 330, 406, 414) and four of them are the same category of defect — a failure path that computes state the UI never renders. The load-error path already exists (`setReportLoadError('Unable to load your daily prayer report right now.')` at :406) but can never fire because the fetch legs swallow their own errors; `messageSendFailed` is computed and never surfaced. Rendering the errors requires threading state out through useSoloReadingFlow into SoloReadingFlow/ReportPhaseView once — do that plumbing a single time for all four rather than four times.

### Interactions badge: every stage of the notification path is broken

`unviewed-badge-never-initialized`· `unviewed-count-includes-sent`· `badge-click-marks-sent-silently-fails`· `interactions-realtime-no-publication`

The badge fails at seed, at count, at click, and at live update. `loadInteractionHistory` is called from exactly one place — InteractionHistory.tsx:41, inside the modal's open effect — so `unviewedCount: 0` (interactionsSlice.ts:62) is never seeded on launch. When it is called, interactionsSlice.ts:181 computes `interactions.filter((i) => !i.viewed).length` with no recipient predicate despite the comment on line 180 reading 'all unviewed received interactions'. `getUnviewedInteractions` (line 152-155) has the same omission, so PokeKissInterface.tsx:243 `const unviewed = getUnviewedInteractions()` can hand back an outbound row. And `grep -rn 'supabase_realtime|ALTER PUBLICATION' supabase/migrations/` returns nothing, so the `postgres_changes` subscription at interactionService.ts:181-198 delivers nothing ever. Fixing any one leaves the feature still non-functional end to end; only the set is shippable.

### PokeKissInterface.tsx: five findings in one component

`fart-never-sent`· `badge-click-marks-sent-silently-fails`· `interaction-rate-limit-client-only`· `realtime-channel-leak-fast-unmount`· `pokekiss-unsliced-store-subscription`

Same file (lines 44, 70, 131, 234, 246), and the fixes touch overlapping regions: the localStorage cooldown block at 42-56 and 82-84, the subscribe effect at 120-149, the store destructure at 63-70, and the send/badge handlers at 152-250. Reviewing this component once against all five is cheaper and less error-prone than five separate passes over 400 lines with Framer Motion animation state interleaved.

### Partner linking lifecycle has no server-side surface

`partner-search-rls-dead`· `users-rls-breaks-partner-search`· `no-unlink-partner`

One migration, 20260205000001_fix_users_rls_recursion.sql, is the source of both problems. Its SELECT policy (lines 28-37) is `id = auth.uid() OR id = public.get_my_partner_id() OR partner_id = auth.uid()`, which makes partnerService.searchUsers's `.from('users').neq('id', ...).or('email.ilike...')` (partnerService.ts:118-123) structurally unable to return a stranger. Its UPDATE WITH CHECK (lines 50-55) pins `partner_id IS NOT DISTINCT FROM public.get_my_partner_id()`, which is exactly why no client can ever clear a partner link. Both gaps need the same remedy shape — SECURITY DEFINER RPCs granted to `authenticated` that do the privileged read/write the policies deliberately forbid — so they are one migration and one PartnerService/partnerSlice edit.

### Settings and config exist in the store but have no UI host

`settings-screen-unreachable`· `stale-visit-countdowns`· `hardcoded-past-visit-dates`· `theme-system-unreachable`

`ViewType` is `'home' | 'photos' | 'mood' | 'partner' | 'notes' | 'scripture'` (navigationSlice.ts:18) — no 'settings' — and grep confirms nothing outside src/components/Settings/ imports Settings. Meanwhile relationshipDates.ts:48-61 hardcodes `new Date(2025, 10, 26)` and `new Date(2025, 11, 20)`, rendered unconditionally at App.tsx:549, and settingsSlice has `setTheme` plus `addAnniversary`/`removeAnniversary` that no component can reach. The preferred fix for all four is the same missing thing: a routed settings screen. Building it once serves the visit dates, the anniversary UI, and the theme picker.

### themes.ts has no fallback for an unknown theme name

`theme-system-unreachable`· `hydrated-settings-unvalidated`· `no-root-error-boundary`

Three findings independently propose guarding the same three lines: themes.ts:66-68 is `function getTheme(themeName: ThemeName): Theme { return themes[themeName]; }` and applyTheme immediately dereferences `theme.colors.primary` at :74. A junk themeName rehydrated from localStorage throws inside an effect, and with no error boundary above App that is the white screen. Add the fallback once — but decide theme-system-unreachable's direction first, since option (a) deletes three of the four theme entries.

### Daily-message home screen: currentMessage can go null and never recover

`forward-nav-null-message-wedge`· `retry-button-dead`· `favorite-jumps-back-to-today`· `daily-message-no-midnight-rollover`

These are the four ways `currentMessage` gets into a state the user cannot leave, and three of them route through the same `updateCurrentMessage()`/module-level init guard. settingsSlice.ts:49-50 declares `let isInitializing = false; let isInitialized = false;` at module scope, checked at :77 and :81 — so DailyMessage.tsx:130's Retry, which calls `initializeApp()`, returns immediately once initialization has ever succeeded. That is why the null-message wedge from messagesSlice.ts:304 is unrecoverable rather than merely annoying. Fix the wedge, the retry, and the favorite-resets-index behaviour in one pass over messagesSlice + the init guard.

### "Today" is compared against now() instead of start-of-day

`birthday-age-off-by-one`· `anniversary-never-shows-today`

Same arithmetic bug in two files. relationshipDates.ts:72-77 builds `birthdayThisYear = new Date(thisYear, birthday.month - 1, birthday.day)` — midnight — then rolls to next year when `birthdayThisYear <= today`, where `today = new Date()` is the current instant; so on the birthday itself the condition is true all day and getUpcomingAge returns one year too many. countdownService.ts:93 has the identical shape for anniversaries. One correction (compare against start-of-today, use `<` not `<=`), applied to both, plus one shared date helper so it cannot recur.

### Love notes send path

`image-only-note-violates-check`· `orphaned-love-note-images`· `duplicate-lovenotes-hook`· `lovenotes-eager-loads-full-history`

The first two edit the identical block — notesSlice.ts:378-392, the insert-error branch that marks the note failed and returns without cleaning up the already-uploaded storage object. `love_notes_content_check` is `CHECK (char_length(content) <= 1000 AND char_length(content) >= 1)` (20251206024345_remote_schema.sql:113), so image-only sends hit that branch on every attempt, which is what turns the orphan leak from theoretical into guaranteed. duplicate-lovenotes-hook and lovenotes-eager-loads-full-history are the other half of the same feature's load path and share the MessageList/useLoveNotes wiring.

### Scripture together: lobby handshake has no reliable transport or state

`broadcastfn-null-before-subscribed`· `duplicate-role-selection-allowed`· `stale-ready-flag-after-lobby-exit`· `lobby-has-no-presence-detection`

Four independent ways two partners end up with divergent lobby state: sends dropped before SUBSCRIBED, both users holding the same role, a ready flag left true on the server after backing out, and no liveness signal at all. Each fix touches LobbyContainer plus the ready/role RPC surface, and any one alone still leaves a lobby that can silently desynchronise, so they are only meaningfully testable together.

### Scripture session staleness: cache-first reads fight optimistic local state

`reconnect-loads-stale-cached-session`· `stale-session-refresh-clobber`· `together-session-lost-on-reload`· `lock-status-ignores-step-index`· `countdown-clock-skew`

All five are the same failure mode — a stale or unversioned value overwriting current session state. loadSession serves the IndexedDB row first and its background refresh (scriptureReadingSlice.ts:240) applies unconditionally with no session-id or version guard; the reconnect paths call the same cache-first getSession; lock_in_status_changed is applied without comparing step_index; the countdown trusts a raw server epoch against client Date.now(). A single staleness discipline (version/step/session-id guards on every asynchronous apply, server-first reads on reconnect) resolves the set; patching them individually produces five different guard conventions.

### Supabase migration hygiene

`seed-rpc-live-in-production`· `bot-password-committed`· `schema-drift-untracked-tables`· `couple-stats-cte-reverted`

Four symptoms of migrations being treated as scratch files rather than the schema of record: a SECURITY DEFINER seed RPC with a default PUBLIC grant, a plaintext production password in 20260316031209, three production tables (daily_love_messages, notifications, push_subscriptions) that grep confirms appear in no migration and in no generated type, and a function body re-pasted in a later fix migration that silently dropped the earlier CTE optimisation. The same corrective work — a drift-check CI step and a declarative-schema home for repeatedly-rewritten functions — covers all four.

### Zustand: components subscribe to the whole store

`app-subscribes-whole-store`· `pokekiss-unsliced-store-subscription`

Not one defect but one mechanical fix repeated. `grep -rn 'useAppStore()' src/` returns 16 non-test call sites, including App.tsx:78, PokeKissInterface.tsx:70, InteractionHistory.tsx:31, AdminPanel.tsx:17, MessageList.tsx:14, PhotoCarousel.tsx:27 and PartnerMoodView.tsx:94. The two findings name overlapping subsets of that list (app-subscribes-whole-store explicitly asks for AdminPanel and MessageList too). Sweep all 16 in one pass with narrow selectors or useShallow rather than fixing two and leaving fourteen.

## Ordering constraints

Cases where doing one first makes the other wrong or wasted.

| Do first | Before | Why |
| --- | --- | --- |
| `gallery-upload-skips-compression` | `dead-photouploader-drifted` | dead-photouploader-drifted deletes src/components/photos/PhotoUploader.tsx and src/hooks/usePhotos.ts. gallery-upload-skips-compression's fix says to copy the compression call out of that very file — 'exactly as photos/PhotoUploader.tsx:171-181 already does' — into PhotoUpload.handleUpload. Delete first and the reference implementation is gone from the working tree. Port the compression (and the uploadProgress binding dead-photouploader-drifted also wants preserved) into PhotoUpload, verify it, then delete. |
| `photo-editor-unreachable` | `photo-delete-stuck-viewer` | photo-editor-unreachable is a fork in the road: 'Either point PhotoGallery's tap handler at selectPhoto(photo.id) and delete PhotoViewer, or add an edit button to PhotoViewer and delete PhotoCarousel/PhotoCarouselControls.' photo-delete-stuck-viewer's fix edits PhotoViewer.tsx (lift photo ownership, clamp currentIndex, surface the delete error). If the first branch is chosen, that work is thrown away with the file. Decide which viewer survives before investing in either one. |
| `idb-partial-schema-race` | `mood-idb-not-user-scoped` | mood-idb-not-user-scoped proposes 'Add a by-user-date compound index in upgradeDb (src/services/dbSchema.ts) as a DB v6 upgrade'. That upgrade only runs for openers that route through upgradeDb — moodService.ts:40-43 and scriptureReadingService.ts:166-169 do; storage.ts:37-86 and sw-db.ts:25 pass their own `upgrade` callbacks that handle only messages/photos/moods and know nothing about a v6 branch. Bump the version while those two bespoke callbacks exist and whichever module opens first decides whether the new index is created, reproducing exactly the corruption idb-partial-schema-race describes. Unify the upgrade path first. |
| `mood-sync-double-write` | `mood-edit-inserts-new-row` | Both rewrite moodSyncService.syncMood's single write statement (`const syncedMood = await moodApi.create(moodInsert);`, line 93). mood-sync-double-write's remedy is a client-generated stable `id` plus `upsert(moodInsert, { onConflict: 'id', ignoreDuplicates: true })`. Land that alone and every edit of today's mood becomes a silent no-op — the row already exists, so ignoreDuplicates discards the new note and mood_types. The identity scheme has to be designed with the create-vs-update branch in the same change: stable id first, then branch on `mood.supabaseId` to update rather than ignore. |
| `together-report-identity` | `together-bookmarks-not-persisted` | The bookmark-persistence fix has to pass a userId to scriptureReadingService.toggleBookmark. The pattern it is told to copy, useSessionPersistence.ts:88, does `const userId = session.userId` — which scriptureReadingService.ts:203 shows is populated from `validated.user1_id`. Copying that pattern before the identity fix hard-codes the same RLS-denied write into a second file. Do the rename and thread the authenticated `state.userId` through first, then extract the shared persistence hook. |
| `together-report-identity` | `session-cache-userid-inconsistent` | session-cache-userid-inconsistent's fix is one line — `toLocalSession(row, row.user1_id)` at scriptureReadingService.ts:710 — and its stated second half is 'rename the field to user1Id so no caller can mistake it for the current user', which is together-report-identity's fix. Doing the one-liner first without the rename leaves the misleading declaration at dbSchema.ts:42 ('userId: string; // Current user's ID') in place and the ten consumers still wrong; the rename pass would then have to revisit line 710 anyway. |
| `unviewed-count-includes-sent` | `unviewed-badge-never-initialized` | unviewed-badge-never-initialized makes the badge appear on launch by seeding from loadInteractionHistory or getUnviewedInteractions. Both of those are the uncounted-predicate paths: interactionsSlice.ts:181 counts every unviewed row including the user's own outgoing pokes (which sendPoke/sendKiss push into `interactions` optimistically at lines 86-88 and 119-121 with viewed=false). Seed first and you ship a badge that is wrong on every single app start — strictly worse than no badge. Fix the recipient predicate, then turn on seeding. |
| `settings-screen-unreachable` | `stale-visit-countdowns` | The preferred fix for the visit-dates duplicate is 'move visits and the wedding date into settings.relationship and expose the existing addAnniversary/removeAnniversary actions through a small settings UI'. There is no settings UI to expose them through: ViewType is `'home' | 'photos' | 'mood' | 'partner' | 'notes' | 'scripture'` (navigationSlice.ts:18) and nothing outside src/components/Settings/ imports Settings. Until a settings route exists, only the fallback (filter past visits in App.tsx:549) is implementable — and doing the fallback first means redoing it when the screen lands. |
| `schema-drift-untracked-tables` | `custom-messages-device-local` | custom-messages-device-local's fix is to 'wire customMessageService to the existing daily_love_messages table'. `grep -rn 'daily_love_messages' supabase/migrations/*.sql` returns nothing and the table is absent from src/types/database.types.ts — it exists only in production. Writing client code against it now means code that works in production and fails in local dev, CI and any rebuilt environment, with no generated types to compile against. Capture the table in a migration and regenerate types first. |
| `image-only-note-violates-check` | `orphaned-love-note-images` | Both change notesSlice.ts:378-392. The CHECK-constraint migration (`char_length(content) >= 1 OR image_url IS NOT NULL`) removes the failure mode that generates most orphans, so it determines how much of that branch is even reachable, and image-only-note-violates-check's own fix text already includes the deleteLoveNoteImage call. Landing the orphan cleanup first means editing the branch twice and re-testing a path the migration is about to make rare. |
| `reconnect-loads-stale-cached-session` | `together-session-lost-on-reload` | together-session-lost-on-reload's belt-and-braces step is to 'persist session.id so a reload can re-hydrate via loadSession'. loadSession is precisely the cache-first path reconnect-loads-stale-cached-session identifies as returning the stale IndexedDB row and rewinding phase/step. Build reload recovery on top of it before it is made server-first and the recovery restores a session that is behind the server — the same rewind, now on every reload. Make getSession/loadSession version-aware or server-first first. |
| `theme-system-unreachable` | `hydrated-settings-unvalidated` | hydrated-settings-unvalidated and no-root-error-boundary both ask for a fallback in themes.ts:66-68 (`return themes[themeName]` with no guard). theme-system-unreachable option (a) is to 'delete the unused theme machinery (setTheme, the non-sunset entries in themes.ts)' — which changes what the fallback should be and may remove the lookup entirely. Pick the theme direction first so the guard is written once against the surviving shape. |


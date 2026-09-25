---
title: 'All photos viewable offline'
type: 'feature'
created: '2026-09-24'
status: 'done'
baseline_commit: 'bfea93ad2d9cf7ebece5c6ffa1b182d8ad577cb1'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/spec-unified-data-storage/SPEC.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Photos have no local copy. The gallery pages the server directly (`photoService.getPhotos` from `PhotoGallery.tsx`) and shows each image through a signed URL that expires after 3600 s, so offline the gallery is empty (CAP-5, CAP-1).

**Approach:** The whole photo list becomes local-copy kind `photos`: it is shown at once, then replaced by a full server read on signed-in start, on reconnect and when the gallery opens. After each successful read, a background fill downloads every photo image not yet cached into the per-account `image-cache` (keyed by storage path), newest first. Only when the browser refuses the write are the oldest cached photo images dropped. An image that is not cached and cannot be downloaded shows a placeholder. The gallery and viewer render from the store and never call the service themselves.

## Boundaries & Constraints

**Always:**
- The copy holds EVERY photo row, plain data, newest `created_at` first (ties by `id`), with `signedUrl: null`. A full read pages the server 500 rows at a time until a short page. A failed read changes nothing; only a complete successful read replaces the list and the copy, including an empty one.
- `loadPhotos` and the refresher capture `{ userId, authSessionVersion }` before the first await and re-check both before every state write, copy write, cache write and cache delete. This replaces `loadPhotos`'s `userId`-only guard; update the slice header.
- After a successful read, the cached images of photos that were in the previous copy but not in the new list are deleted. A confirmed delete removes that photo's cached image and rewrites the copy. A confirmed upload prepends to state and the copy.
- The fill:
  - one run per tab at a time; a trigger during a run makes it pass once more;
  - sequential, newest first, skips paths already cached;
  - stops when `navigator.onLine === false` or the session changes; a failed download of one photo is logged and skipped.
- Storage refusal (a `QuotaExceededError`, including an IndexedDB transaction aborted with one) while caching photo P: delete the cached image of the OLDEST photo in the list that is older than P and cached, then retry. When none is left, P is not cached and the fill stops. Only photo images are ever evicted, never love-note images. A write made while displaying an image follows the same rule and shows the image even when it cannot be cached.
- Display (grid tile and viewer): the cached Blob as an object URL, revoked when no longer shown; otherwise, online, download, cache and show; otherwise a placeholder that says the photo is not saved on this device. The list always shows every photo, whether or not its image is cached.
- Register the `photos` refresher, and stub it in both fake-session specs in this change: a no-op in `auth-bootstrap-notification-order.tsx` (restored on dispose), and `photos` in `login.spec.ts`'s `interceptNetworkCall` loop.

**Never:**
- No offline upload or delete, and no change to their online behaviour; "needs a connection" wording is story 11 (CAP-4).
- No fixed count or size cap, and no eviction without a storage refusal.
- No `navigator.storage.persist()` request, no new IndexedDB store or `DB_VERSION` bump, no DB migration, no service-worker change, no Realtime channel.
- No eviction of love-note images, and no change to love-note image caching (the deferred "image-cache never evicts" entry stays open for love notes).
- No new offline notice. CAP-8 is story 11.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First online start | Signed in, 60 photos, empty cache | List shown; all 60 images cached in the background, newest first | A failed download is skipped, retried next run |
| Offline reload | Copy and cache filled; offline | The gallery lists every photo and shows every image | N/A |
| Not cached, offline | Photo in the list, image not cached | Tile and viewer show the placeholder | N/A |
| Storage refused | Write refused while caching photo P | The oldest cached older photo's image is dropped and the write retried | No older one left: P stays uncached, fill stops |
| Server read fails | Online, list read errors | Copy and gallery unchanged | Logged |
| Photo removed elsewhere | Partner deleted a photo; reconnect | Gone from list and copy; its cached image deleted | N/A |
| Account switch | A signs out, B signs in | B never sees A's list or images | Existing `deleteAccountData` empties A's copy and images |
| Stale session | Session changes during a read or fill | No state, copy or cache write under the new session | N/A |

</frozen-after-approval>

## Code Map

- `src/services/photoService.ts`: `getPhotos` :244-285 signs every row; add `listAllPhotos()` (pages of 500, no signing, throws on failure) and `downloadPhoto(storagePath): Promise<Blob>` (Storage `download()` on the `photos` bucket :87, throws), modelled on `loveNoteImageService.downloadLoveNoteImage` :311. Remove `getPhotos`, `getSignedUrl(s)` and their tests only if no caller is left. Keep `uploadPhoto` and `deletePhoto` as they are.
- `src/services/imageCache.ts`: add `deleteCachedImages(userId, paths)` (throws) and an exported `isQuotaError(error)`. Update the header's FILL SOURCE line for photos.
- `src/services/photoImageCache.ts` (new): the fill, the refusal/eviction rule and the display-time cache write. Header documents both rules.
- `src/stores/slices/photosSlice.ts` (234 lines): kind `photos`, render-then-refresh `loadPhotos`, `registerLocalCopy`, the full identity guard, copy updates in `uploadPhoto` :65-156 and `deletePhoto` :187-219. Add any new account-scoped state (e.g. a loaded flag) to `signedOutState()` in `authSlice.ts:163-165`. Follow `eventsSlice.ts:275-288` and `interactionsSlice.ts:204` for the registration pattern.
- `src/components/PhotoGallery/PhotoGallery.tsx` :100-230: drop its own page list, offsets, `photoService` calls and the DW-201 refresh effect; render `store.photos`, revealing 20 more tiles per scroll step with the existing IntersectionObserver. Keep the skeleton, empty and error states.
- `src/components/PhotoGallery/PhotoGridItem.tsx:99-108` and `PhotoViewer.tsx:217-233, 457, 596-611`: take the image through a new hook `src/hooks/usePhotoImage.ts`, modelled on `LoveNoteMessage.tsx:122-241` (identity capture, cache → download → cache write, revoke on cleanup) minus its signed-URL fallback. The viewer's preload uses the same hook or cache read; its "Failed to load photo" + Retry stays for an online download failure.
- `src/stores/slices/authSlice.ts:64-75`: `deleteAccountData` already calls `deleteAccountImages` and `deleteAccountCopies`; no change expected.
- `tests/support/harnesses/auth-bootstrap-notification-order.tsx:208-229` and `tests/e2e/auth/login.spec.ts:111-124`: add the `photos` stubs.
- Tests to adjust: `PhotoGallery.pagination.test.tsx`, `PhotoGallery.kit.test.tsx`, `PhotoViewer.focus.test.tsx`, `photoDialogsA11y.test.tsx`, `loaderIdentityGuards.test.ts` (`loadPhotos`), `photoService.getPhotos.test.ts`. E2E templates: `tests/e2e/offline/love-notes-offline-copy.spec.ts` (`imageCached` :68-95, `goOffline` :97-100, REST+Storage abort :184-188) and `tests/e2e/photos/photo-gallery.spec.ts`.

## Tasks & Acceptance

**Execution:**
- [x] `src/services/photoService.ts` -- add `listAllPhotos` and `downloadPhoto`; remove now-dead signing/paging.
- [x] `src/services/imageCache.ts` -- add `deleteCachedImages` and `isQuotaError`; header.
- [x] `src/services/photoImageCache.ts` -- fill and refusal/eviction rules with header.
- [x] `src/stores/slices/photosSlice.ts` + `authSlice.ts` -- local copy, refresher, guards, upload/delete copy updates, prune; `signedOutState()` for new state.
- [x] `src/hooks/usePhotoImage.ts`, `PhotoGridItem.tsx`, `PhotoViewer.tsx` -- cached display and placeholder.
- [x] `src/components/PhotoGallery/PhotoGallery.tsx` -- render from the store.
- [x] Fake-session stubs -- both files.
- [x] Unit tests: `tests/unit/services/photoImageCache.test.ts` (newest-first fill, skip cached, single run + rerun, stop offline/stale session, refusal evicts oldest older cached photo and retries, stops when none left, never touches non-photo paths); `tests/unit/stores/photosSlice.localCopy.test.ts` (every matrix row, prune, upload/delete copy updates, stale-session paths); `usePhotoImage` hook test; `imageCache` additions; adjust the existing tests listed in the Code Map.
- [x] `tests/e2e/offline/photos-offline.spec.ts` -- load the gallery online, wait until every seeded photo's image is in `image-cache`, reload offline with REST and Storage aborted: every photo is listed and every image shows. Seed and delete its own photos via the service client.
- [x] `AGENTS.md` -- data-model pitfall: photos are no longer Supabase-only (list copy + per-account image cache, filled in the background). Docs-only commit.

**Acceptance Criteria:**
- Given one online session, when the device goes offline and the app reloads, then the gallery lists every photo and displays every image.
- Given storage refusal forced in a test, when the fill runs, then the oldest photo images are dropped first and the gallery still lists every photo, with placeholders for the dropped ones offline.
- Given the fake-session specs, when they run, then no photos request reaches the network-error monitor.

## Design Notes

The fill runs from the refresher, not only when the gallery opens, so "after one online session" holds even if the gallery was never opened. It is sequential so one start never floods Storage; a later start or reconnect resumes where it stopped because cached paths are skipped. Eviction is chosen from the photo list order, not by scanning `image-cache`, so love-note images sharing the store can never be picked.

## Verification

**Commands:**
- `npm run typecheck` -- expected: exit 0
- `npm run lint` -- expected: exit 0
- `npx vitest run tests/unit src` -- expected: all pass
- `npx playwright test tests/e2e/offline tests/e2e/photos tests/e2e/auth` (with `supabase start`) -- expected: all pass

## Implementation Notes

- `getPhotos`, `getSignedUrl` and `getSignedUrls` had no callers left and were removed; `photoService.getPhotos.test.ts` became `photoService.listAllPhotos.test.ts`.
- New slice state `photosLoaded` and `photosLoadError`, both in `signedOutState()`. `loadPhotos` sends the server read alongside the copy read, and replays an upload or delete confirmed while a read was in flight onto that read's answer.
- `PhotoViewer` clamps its index: a confirmed delete of the last photo drops the store row before the viewer steps back.
- `usePhotoImage` retries an `unavailable` or `error` image on the `online` event. The grid tile shows the placeholder for both; the viewer keeps "Failed to load photo" + Retry for an online download failure.
- The E2E spec forces storage refusal with an init script and needs the worker pair's album to hold only its own seeded photos.

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|---|
| 1 | blind, edge, verif-gap | The viewer tracks the open photo by index while the store list is replaced under it; the delete dialog can delete a different photo | medium | `PhotoViewer` gets the live `photos`; `loadPhotos` sets the server answer after the copy; delete uses `photos[currentIndex]` | patch |
| 2 | blind | `listAllPhotos` without a session reads as anon, RLS answers `[]`, and the album copy and cached images are wiped | medium | The old `getUser()` check was dropped; `photos` policies are not for anon; `[]` is saved and pruned | patch |
| 3 | verif-gap, edge | Viewer is blank with no spinner while an uncached photo downloads on first open | low | `isLoading` starts false; `motion.img` needs `image.url` | patch |
| 4 | edge | A photo deleted while its image downloads is cached as an orphan (hook never checks; fill checks before an await gap) | low | `usePhotoImage` calls `cachePhotoImage` with no membership check | patch |
| 5 | edge | The fill keeps downloading after a non-quota write failure, discarding every blob | low | `fillPass` returns only on `refused`/`stale`; one-line fix | patch |
| 6 | verif-gap | Retry in the viewer (retryKey) is untested through the component | medium | Pre-verified: every viewer test fakes the hook as `ready` | patch |
| 7 | verif-gap | `error`/`unavailable` status rendering in the tile and viewer is untested | medium | Pre-verified: component tests fake `ready`; E2E reaches only `unavailable` | patch |
| 8 | blind, edge | Dead `hasMore`/`onDeleted` props, '+' branches and a stale comment in `PhotoViewer`; stale `getPhotos` reference in `eventsService.ts:415` | low | The gallery no longer passes them; `getPhotos` was removed | patch |
| 9 | blind, edge | Offset paging can skip or repeat a row when the album changes between 500-row pages | low | Needs over 500 photos and a write between page reads; a skipped row returns on the next refresh | reject |
| 10 | blind | Fill and display download the same image in parallel | low | Efficiency only; the fix adds an in-flight map | reject |
| 11 | blind, edge | A corrupt cached Blob is never replaced | low | Needs Storage to serve a bad image; fix adds a delete-and-refetch branch | reject |
| 12 | blind | Sign-out between `isCurrent()` and the IndexedDB put leaves the outgoing account's image | low | Microtask window, same shape as love-note caching; fix needs a post-write check and cleanup | reject |
| 13 | blind | The E2E refusal fake throws synchronously and is not a real abort | low | `isQuotaError` unwraps both; unit-tested for the abort shape | reject |
| 14 | blind | Eviction search reads full Blobs | low | Runs only on a refusal; IDB returns a Blob handle | reject |
| 15 | blind, edge | Concurrent `loadPhotos` calls are not merged and can answer out of order | low | Two full reads milliseconds apart; the next refresh corrects it | reject |
| 16 | blind | The background fill ignores data saver | false | The intent requires every photo image to be cached | reject |
| 17 | blind | No indicator when a refresh fails over a saved list | low | CAP-8 offline notice is story 11 (Never) | reject |
| 18 | blind | Upload and delete are not blocked offline | low | CAP-4 is story 11 (Never) | reject |
| 19 | blind | `parseSavedPhotos` drops the whole copy on a null `width`/`height` | false | `width` and `height` are `NOT NULL` (`database.types.ts:408,413`); only this slice writes the copy | reject |
| 20 | blind | Each tile subscribes to `photos` and re-renders on list change | low | Only on list change; negligible | reject |
| 21 | edge | A transient online download error keeps the tile's placeholder until the `online` event or a remount | low | Needs a Storage failure while online; fix adds a retry timer or fill notification | reject |
| 22 | edge | A stalled download never ends the fill run | low | Needs a request that neither answers nor errors; fix adds a timeout | reject |

---
title: 'Love notes readable offline'
type: 'feature'
created: '2026-09-24'
status: 'done'
baseline_commit: 'cea179dfb92e3df667aea97395737e55fa2b5d5a'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/spec-unified-data-storage/SPEC.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The love-notes thread lives in memory only and loads only when the Notes screen mounts. After an offline reload the partner lookup fails first, so the screen shows an error and no notes (CAP-1). Nothing refreshes the thread on start or reconnect (CAP-2). Note images are shown through signed URLs that expire after 3600 s, so no image can be shown offline.

**Approach:** Love notes join the local-copy mechanism as kind `love-notes`. The Notes screen shows the saved copy first, before any partner lookup, and the server list then replaces it and is saved. A registered refresher runs on start and reconnect. Every confirmed change to the thread rewrites the copy: an incoming Realtime note, your own confirmed send or resend, a confirmed removal, and an older page. Note images get a per-account blob cache keyed by storage path, in a new IndexedDB store. The Notes screen fills it when an image is shown and reads from it first. Story 10 reuses this cache for photos.

## Boundaries & Constraints

**Always:** Follow the `localCopy.ts` header rules. Capture `{ userId, authSessionVersion }` before the first await, re-check both before every state, copy and image-cache write, and write under the captured `userId`.

The copy holds only confirmed server rows, stored as plain data with a shape guard. A copy that fails the guard is ignored whole. `notesPendingRemoval` filters it when applied. A failed server read changes nothing, and an empty server answer saves `[]`.

Use `lookupPartnerId()` in `fetchNotes`:
- `error` is a failed read and keeps the copy.
- `unlinked` keeps today's "Partner not configured" error.

When a read fails while the copy is on screen, leave `notesError` null so no error banner covers the saved thread. When the list is empty, set the error as today.

The image cache:
- stores Blobs keyed `[userId, storagePath]`;
- fetches with the Storage `download()` API, never through a signed URL key;
- lives in `src/services/dbSchema.ts` only, as `DB_VERSION` 13 with an existence gate.

Sign-out's `deleteAccountData` deletes the account's cached images. A failed image-cache write is logged and the image still shows.

**Never:**
- No offline sending or queue. Story 9 owns that. Today's refusal of offline sending stays.
- No change to the Realtime channel: no move to the `moodSyncService` registry and no new channel.
- No Zustand persist change.
- No new offline notice. CAP-8 is story 11.
- Pending, failed and optimistic notes, `imageBlob` and blob `imagePreviewUrl` never go into the copy.
- No image is prefetched for a note that is never shown.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Offline with copy | Thread loaded online earlier; reload offline; open Notes | Saved notes listed; no error banner | N/A |
| Offline image seen before | Image shown in an earlier online session | Shown from the image cache | N/A |
| Offline image never seen | No cached blob | Today's image-error placeholder | N/A |
| Offline no copy | Fresh device offline | Today's behaviour (empty with error) | N/A |
| Online start | Copy saved | Copy shown first, then the server list replaces it and is saved | Read failure keeps copy and state |
| Reconnect | Partner sent a note while offline | After `online`, the note appears without a reload | N/A |
| Incoming Realtime | Valid broadcast | Added as today, then the copy is rewritten | Copy write failure logged |
| Own send / resend confirmed | Online text or image note | The confirmed row is in state and in the copy | Failed send not saved |
| Removal confirmed | Note removed | Removed from state and from the copy | Failed removal: copy unchanged |
| Older page | `fetchOlderNotes` succeeds | Copy saves the whole confirmed list | N/A |
| Account switch | A's read, copy read or image fetch resolves after B signs in | Nothing is shown or written for A | Dropped |
| Malformed copy | Saved value fails the guard | Ignored; server read proceeds | Logged |
| Sign-out | A signs out | A's `love-notes` copy and cached images are deleted | Existing fire-and-forget |

</frozen-after-approval>

## Code Map

- `src/services/localCopy.ts`: API and consumer rules. Do not change it.
- `src/stores/slices/interactionsSlice.ts:62-207, 323-381`: the pattern to mirror. It has a kind constant, a saved shape and guard, the `…FreshFor` marker with `ownsSession`, `save…Copy`, and `registerLocalCopy`. Its copy-first load starts the server request, reads the copy, and applies the copy only if the session is not fresh yet and the list is empty. The slice returns from a closure.
- `src/stores/slices/notesSlice.ts`:
  - state :33-40;
  - `fetchNotes` :194-265 (it uses `getPartnerId` and has a local `ownsRequest`);
  - `fetchOlderNotes` :271-359;
  - `addNote` :365-378 (no session guard; add one before the copy write);
  - `sendNote` :428-627 and `retryFailedMessage` :634-788 (save the copy after the confirmed insert);
  - `removeNote` :801-919.
- `src/types/models.ts:17-34`: `LoveNote`. `image_url` holds the storage path. The client-only fields are `sending`, `error`, `tempId`, `imageUploading`, `imageBlob` and `imagePreviewUrl`.
- `src/api/supabaseClient.ts:315`: `lookupPartnerId()`, which returns `linked`/`unlinked`/`error`.
- `src/hooks/useLoveNotes.ts:131-151`: fetches on mount and mounts Realtime. Keep both.
- `src/hooks/useRealtimeMessages.ts:208-236`: an incoming broadcast goes to `addNote`. No change.
- `src/components/love-notes/LoveNotes.tsx:190-198`: the error banner.
- `src/components/love-notes/LoveNoteMessage.tsx`:
  - the image effect :115-170 prefers `imagePreviewUrl`, otherwise calls `getSignedImageUrl`;
  - `handleImageError` :172-200 retries with `forceRefresh`.
  - Read the cache first, and on a miss call `download()` and cache the result. Revoke the object URL on unmount. On a download failure, fall back to the existing signed-URL path.
- `src/services/loveNoteImageService.ts`: bucket `IMAGE_STORAGE.BUCKET_NAME`. The signed-URL Map stays for the fallback path.
- `src/services/dbSchema.ts:88-136, 283-291`: `StoredLocalCopy`, `DB_VERSION` 12, and the `local-copies` branch to copy for the new `image-cache` store (keyPath `['userId','path']`, `by-user` index). Update the version comment block.
- `src/stores/slices/authSlice.ts:62-72`: `deleteAccountData`. Add the image-cache deletion here. The notes fields are already in `signedOutState()` at :134-140.
- Fake-session stubs (a SPEC constraint):
  - `tests/support/harnesses/auth-bootstrap-notification-order.tsx:209-220`: add a no-op for `love-notes` and restore it on dispose.
  - `tests/e2e/auth/login.spec.ts:111-117`: add `love_notes_visible` to the table loop.
- Tests:
  - `tests/unit/stores/notesSlice.{addNoteDedupe,sessionGuard,idempotency,removal}.test.ts`;
  - `src/components/love-notes/__tests__/`;
  - E2E model: `tests/e2e/offline/interactions-offline-copy.spec.ts` (aborted REST reload, then `setOffline`, a raw IndexedDB read, `resolveOwnPair`).

## Tasks & Acceptance

**Execution:**
- [x] `src/services/dbSchema.ts`: add the `image-cache` store at v13, existence-gated, with the type in `MyLoveDBSchema`.
- [x] `src/services/imageCache.ts` (new): add `readCachedImage(userId, path)`, which returns `Blob | null`, `writeCachedImage(userId, path, blob)`, which throws on failure, and `deleteAccountImages(userId)`. Document the API in a module header for story 10.
- [x] `src/stores/slices/notesSlice.ts`:
  - add kind `love-notes`, its saved shape and guard, the fresh marker and `saveNotesCopy`;
  - make `fetchNotes` copy-first, on `lookupPartnerId`, and register it as the refresher;
  - rewrite the copy after `addNote`, a confirmed send or resend, a confirmed removal and `fetchOlderNotes`;
  - apply the `notesError` rule.
- [x] `src/components/love-notes/LoveNoteMessage.tsx`: show server images cache-first through `imageCache`, as the Code Map describes.
- [x] `src/stores/slices/authSlice.ts`: call `deleteAccountImages` in `deleteAccountData`.
- [x] Both fake-session stubs: add `love-notes` and `love_notes_visible` as listed in the Code Map.
- [x] Unit tests:
  - cover every matrix row;
  - cover the stale-session paths for the server read, the copy read and the image fetch;
  - cover the v13 upgrade for fresh and existing databases;
  - adjust existing tests only where behaviour legitimately changed.
- [x] `tests/e2e/offline/love-notes-offline-copy.spec.ts`:
  1. Seed a partner text note and an image note, load Notes online, reload offline, and check that both render, including the image.
  2. Offline, seed a note, then go online: it appears without a reload.
  3. Delete the seeded rows and objects at teardown.
- [x] `AGENTS.md`: in the data-model pitfall, love notes now keep a local copy and an image cache. Make this a docs-only commit.

**Acceptance Criteria:**
- Given notes loaded in an earlier online session, when the app is reloaded offline and Notes opened, then the saved notes are listed with no error banner.
- Given the device is offline, when a note is sent, then it is refused as today and the copy is unchanged.
- Given A signed out and B signed in on the same device, then none of A's notes or cached images are readable for B.

## Implementation Notes

- `fetchNotes` keeps notes that still carry a `tempId` (sending or failed) after the server page, because it now also runs on reconnect and signed-in start; before, a refresh would have dropped a failed note and its Retry. Only notes it drops have their preview URLs revoked.
- Sends and resends confirm through `confirmOptimisticNote`: when a refresh already listed the committed row while the insert reply was in flight, the optimistic note is dropped rather than doubled.
- The `notesError` rule is applied on "a failed read while the list is non-empty" in both `fetchNotes` and `fetchOlderNotes` (copy or a server list from earlier in the session), so a failed reconnect refresh raises no banner either. `unlinked` and signed-out calls set the error whatever is shown.
- The sendNote copy write is not awaited, so the partner broadcast does not wait on IndexedDB. The resend and removal writes are awaited.
- `fetchOlderNotes` uses `lookupPartnerId` with the same unlinked/error split and banner rule as `fetchNotes` (review follow-up). A refresh matches a kept optimistic note to its committed row by `idempotency_key === tempId`. Applying the copy sets `notesHasMore` from its length.
- `LoveNoteMessage` reads the identity through store selectors plus `useAppStore.subscribe` (lint forbids `getState()` in components); the subscription catches an account switch before React re-runs the effect.
- The image-cache unit test swaps in Node's `Blob`: happy-dom's `Blob` does not survive Node's structured clone under fake-indexeddb.

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|---|
| 1 | edge | A refresh returning the committed row of a still-sending or failed note keeps both, so the note shows twice | medium | Optimistic `id` is the `tempId` (`notesSlice.ts:671`), the server row's is a uuid, so `row.id === note.id` never matches; a failed note stays doubled until retry | patch |
| 2 | blind, edge, verif-gap | `fetchOlderNotes` still uses `getPartnerId()`, so offline on a copied thread it sets a "Partner not configured" banner | medium | `notesHasMore` stays `true` after a failed read and `MessageList.tsx:236-241` calls `onLoadMore`; breaks the frozen no-banner rule | patch |
| 3 | edge | Applying the copy never sets `notesHasMore` | low | Initial `true` is kept whatever the copy holds; direct correction | patch |
| 4 | blind | Header and catch comments say the banner is suppressed only for a copied thread; code suppresses it for any non-empty thread | low | `keepThreadClear = !conclusiveError && notes.length > 0`; comment fix | patch |
| 5 | verif-gap | `notesSlice.sessionGuard.test.ts` mock lacks `lookupPartnerId`, so its fetchNotes cases pass without reaching the guard | medium | Pre-verified: the reviewer ran it and saw the missing-export error thrown at `notesSlice.ts:361` | patch |
| 6 | verif-gap | No test pins that a refresh keeps a failed note's preview URL un-revoked | low | Pre-verified: changing `:430` to revoke all passes every test | patch |
| 7 | blind, edge | A Realtime note or send landing before the copy read saves `[note]` over the saved thread | low | Same window as story 7 row 1: Realtime mounts with the screen and subscribes slower than an IndexedDB read; fix adds a flag or merge | reject |
| 8 | blind, edge | Overlapping `fetchNotes` calls resolving out of order let the older answer win and drop newer notes | low | Same as story 7 rows 2-3; the drop window pre-exists (`fetchNotes` always replaced state); fix adds a sequence guard | reject |
| 9 | blind, edge | Each reconnect/start refresh trims loaded older pages back to the newest 50 | low | Real, but only while scrolled back at a reconnect; the fix is a merge branch, not a direct correction | reject |
| 10 | edge | An unlinked answer leaves the previous couple's copied thread visible | false | No unlink path exists (SPEC non-goals); an account linked once stays linked | reject |
| 11 | blind, edge | A removed note's image stays in the image cache until sign-out | low | Not visible to users; the fix adds a new cache-delete API | reject |
| 12 | blind, edge | The image cache has no size cap or eviction | low | Quota eviction is story 10 (CAP-5); note images are at most 2048 px and quota is shared GBs | reject |
| 13 | blind, edge | An undecodable cached Blob is never evicted | maybe-false | Needs a corrupt Storage object, which the signed-URL path would also fail on; would only be low | reject |
| 14 | blind | A sign-out between the ownership check and the cache `put` can leave the outgoing account's image | low | Millisecond window between `getDb()` and `put`; the local-copy mechanism has the same accepted window | reject |
| 15 | edge | A download finishing after unmount is still cached | low | The row was mounted, so the image was on screen; caching it matches "filled when shown" | reject |
| 16 | blind | Offline send says "Partner not configured" and a test pins it | low | Pre-existing and "refused as today" per the matrix; the needs-a-connection message is story 11 (CAP-4) | reject |
| 17 | blind | An empty offline thread shows the raw lookup reason in the banner | low | The matrix row only requires an error as today; wording is story 11 | reject |
| 18 | blind | One store subscription per image message | low | The list is virtualized; the callback is a two-field compare | reject |
| 19 | blind | The sender's own image is downloaded again after a confirmed send | low | One extra download on first display; not a defect in the frozen scope | reject |
| 20 | blind | The copy is rewritten whole on every change, with no size cap | low | Bounded by the pages loaded this session | reject |
| 21 | blind | E2E "no banner" check uses `toHaveCount(0)` on Dismiss, which cannot catch a later banner | low | Row 2's patch removes the late-banner source and unit tests pin it | reject |
| 22 | blind | `localCopy.ts` header says no feature keeps its own cache | low | The spec froze `localCopy.ts`; `imageCache.ts`'s header states why it is separate | reject |
| 23 | blind | AGENTS.md says four modules open `my-love-db`; `src` has seven besides `dbSchema.ts` | low | `grep` finds seven (already stale before this change); the fix edits AGENTS.md | defer |

## Design Notes

Images are cached when shown rather than prefetched, which matches CAP-1's "data it last loaded" and keeps prefetching for story 10's gallery. The blob store is separate from `local-copies` because that header requires plain, cloneable values without blob URLs, and a per-account `by-user` index lets sign-out delete in one sweep. `download()` returns an authenticated Blob and needs no signed URL, so the cache key is the storage path alone.

## Verification

**Commands:**
- `npm run typecheck`: exit 0
- `npm run lint`: exit 0
- `npx vitest run tests/unit src`: all pass
- `npx playwright test tests/e2e/offline tests/e2e/notes tests/e2e/auth` (with `supabase start`): all pass

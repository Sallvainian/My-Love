# Brownfield: storage as of 023ea7fd, updated for 72e094d4 (2026-09-24)

Paths cite the code at that commit. Check each one before relying on it.

## Per data kind

| Kind | Read from today | Offline write | Local copy | Realtime | Paging | Visible to |
|---|---|---|---|---|---|---|
| Photos | `photos` table, full keyset-paged read of 500 a page since #350 (`photoService.listAllPhotos`); images downloaded as Blobs, no signed URLs | Upload and delete still need a connection (story 11) | **Local copy since #350**: kind `photos`, shown at once then replaced by the full server read on signed-in start, reconnect and gallery open; every image filled in the background into `image-cache` (Wi-Fi only unless the per-device "Download photos over mobile data" switch is on; a browser that cannot report the connection type fills anywhere), oldest photo image evicted only when storage refuses a write, and since #353 a refused photo is not downloaded again until room may have been freed | None | Gallery reveals 20 tiles a step from the full list | Couple |
| Love notes (+ images) | `love_notes_visible`, 50 then older pages (`notesSlice.ts:191-262`) | **Text queued since #349**: per-account IndexedDB `note-queue` (DB v14), drained in order under `withSyncLock` with the `tempId` as `idempotency_key`; a note with a picture is refused offline; since 65daa75b a queued note carries `written_at` (composition time, shown in the bubble when over 60 s before `created_at`; ordering stays on `created_at`) and a transient send failure online is retried on a 5/10/20/40/60 s backoff | **Local copy since #348**: kind `love-notes`, shown at once then replaced by the server's newest page (a reconnect refresh keeps scrolled-back pages); images cached per account in IndexedDB `image-cache` keyed `[userId, storage path]`, a note's image deleted when the note is removed (#353), otherwise emptied only at sign-out; a failed note can be deleted through the removal confirmation since #353; signed URLs still in a Map capped at 100 (`loveNoteImageService.ts`) | Broadcast `love-notes:<uid>` via direct `supabase.channel` (`useRealtimeMessages.ts:285,591`) | 50 | Sender and recipient |
| Pokes/kisses | `interactions` (`interactionService.ts:374-386`) | Throws (`interactionService.ts:204`) | **Local copy since #347**: kind `interactions`, shown at once then replaced by the server list; refreshed on signed-in start and reconnect; confirmed sends, accepted Realtime rows and confirmed mark-viewed rewrite it | `postgres_changes` via direct `supabase.channel` (`interactionService.ts:323-331`) | 100 loaded, 7 days shown | Sender and recipient |
| Events | `events` (`eventsService.ts`) | Reads show the saved copy; writes still refused (no write queue) | **Local copy since #345**: kind `events` in `local-copies`, shown at once then replaced by the server's first page; confirmed add/edit/delete rewrite it; still stripped from persist | None | 50 upcoming + 50 past | Couple (creator writes) |
| Own mood | IndexedDB `moods` (`moodSlice.ts:138`) | **Queued** with `synced:false` (`moodService.ts:105-135`) | IndexedDB, `[userId,date]`; **since #346** filled from the server on signed-in start and reconnect (refresher kind `mood-history`, whole history 500 rows a page, merge never overwrites queued rows) | Sends `mood-updates:<partner>` | Timeline pages Supabase 50 at a time (`useMoodHistory.ts:14`) | Couple |
| Partner mood | Supabase, 30 rows (`moodSlice.ts` `fetchPartnerMoods`) | n/a | **Local copy since #346**: kind `partner-moods`, written on each successful fetch, shown offline (not a registered refresher) | `moodSyncService.subscribeMoodUpdates` (`:801-819`) | 30 | Couple |
| Anniversaries | Server → mirror in `settings.relationship.anniversaries` | Refused (`requireOnline`, `accountDataError.ts`) | **Local copy since #341**: kind `anniversaries`; persisted blob writes `[]`; `anniversaryVault.ts` removed | None | All | Owner |
| Message favorites | Server → IndexedDB `message-favorites` | Refused | IndexedDB `[messageId,userId]`; refreshed through local-copy kind `message-data` since #341; own store until story 12 | None | All | Owner |
| Custom messages | Server → IndexedDB `messages`, index `by-user` | Refused | IndexedDB; refreshed through kind `message-data` since #341; own store until story 12 | None | All | Owner |
| Bundled messages | IndexedDB, seeded from `src/data/defaultMessages.ts` (`settingsSlice.ts:190-198`) | n/a | Unowned rows; rotation history in the global persist blob | None | All | All |
| Partner profile | `users`, `partner_requests` (`partnerService.ts`) | Fails | **Local copy since #340**: kind `partner` in `local-copies` (`partnerSlice.ts`); `getPartner()` returns `linked`/`unlinked`/`error` | None | n/a | Self and partner |
| Device settings | Zustand persist only (`useAppStore.ts:106,201`) | Local only, never sent | Global key, not per account | None | n/a | No table |

## Infrastructure

- **Service worker.** `src/sw.ts` uses `injectManifest`:
  - navigations are NetworkFirst with a 3 s timeout (`:66-70`);
  - images and fonts are CacheFirst, 100 entries, 30 days (`:73-84`);
  - no route covers Supabase REST, Realtime or Storage;
  - a new version reloads the app automatically (`main.tsx:11-28`).

  There is no service worker in dev or E2E (`main.tsx:29-36`, `playwright.config.ts:178`).
- **IndexedDB.** `my-love-db`, `DB_VERSION = 14` since #349, stores: `messages`, `message-favorites`, `moods`, `sw-auth` (one token slot), `local-copies` (keyed `[userId, kind]`, index `by-user`), `image-cache` (v13, keyed `[userId, path]`, index `by-user`) and `note-queue` (v14, keyed by the note's `tempId`, index `by-user`). The dead `photos` store was dropped in v11. Seven modules open it (`storage`, `moodService`, `customMessageService`, `localCopy`, `imageCache`, `noteQueue`, `sw-db`), and all go through `upgradeDb`.
- **Persist.** `my-love-storage`, `version: 0`. `partialize` saves `settings`, `isOnboarded` and `messageHistory` in one device-global blob (`useAppStore.ts:198-225`).
- **Online signal.** `navigator.onLine` only. `useNetworkStatus` drives `NetworkStatusIndicator`. The App.tsx `online` handler syncs pending moods and, since #340, calls `refreshLocalCopies()`; signed-in start calls it too. Moods also sync at start and every 5 minutes. Only kinds registered with `registerLocalCopy` re-sync on reconnect (today: `partner`, `anniversaries`, `message-data`, `couple-settings`, `profile`, `events`, `mood-history`, `interactions`, `love-notes`, `photos`).
- **Mood queue.**
  - Sync takes `withSyncLock` (Web Locks with `ifAvailable`, `syncLock.ts:48-64`) and makes 4 attempts with 1/2/4 s backoff (`moodSyncService.ts:449-490`).
  - A payload fingerprint turns `markAsSynced` into `cleared`, `deferred` or `missing` (`moodService.ts:340-372`).
  - Service-worker Background Sync uses tag `sync-pending-moods` (`sw.ts:114,183-352`) and is registered from `MoodTracker.tsx:219-224`.
  - Conflicts resolve as last-write-wins.
- **Sign-out.** `discardAccountState()` (`authSlice.ts`) resets in-memory state through `signedOutState()` and calls `deleteAccountData(outgoingUserId)`: since #341 it empties that account's `local-copies`, custom-message rows and favorites. Unsynced moods stay for their owner. The `my-love-account-owner` localStorage marker (an account id only) lets a no-session boot, or a different account's sign-in, delete the previous owner's leftovers. A new account-owned store must be added to `deleteAccountData`.
- **Quota.** `navigator.storage` is never used. `photoService.checkStorageQuota` is a 1 GB server-side check. Images are compressed to 2048 px at JPEG 0.8 (`config/images.ts:16-23`).
- **Tests that pin offline behaviour.**
  - E2E: only `tests/e2e/offline/network-status.spec.ts`, with 2 tests.
  - Unit: `swMoodSync`, `swDbScoping`, `moodStaleSync`, `signOutClearsAccountState`, `accountDataSlices`, `offlineMessageHonesty`.

## Changed since the table was written (#338, #339, #340, #341)

- **Mirror refresh.** `loadAnniversariesFromServer` and `loadMessageDataFromServer` now refresh on every signed-in start, with no upload guard. `localDataUpload.ts`, `migrationService.ts` and the `localOnly` mark are gone.
- **Notes session checks.** Every async action in `notesSlice.ts` captures and re-checks `{ userId, authSessionVersion }`. A stale send stops before the upload and again before the insert.
- **Start date parsing.** `messageRotation.ts` parses the start date with `parseEventDate`.
- **Local-copy foundation (#340, story 1).** `src/services/localCopy.ts` holds the shared mechanism; its module header documents the API and consumer rules. The partner profile is its first consumer. E2E: `tests/e2e/offline/partner-offline-copy.spec.ts`.
- **Account-data mirrors (#341, story 2).** Anniversaries are on the local copy and `anniversaryVault.ts` is gone. Custom messages and favorites refresh through the mechanism but keep their own stores. Rows left by accounts that signed out before #341 are not swept; story 12 drops those stores. E2E: `tests/e2e/offline/account-data-offline-copy.spec.ts`.

## Hard-coded settings (removed by stories 3 and 4)

Story 3 (#342) removed `src/config/constants.ts`, `datingStart`, `PARTNER_NAME` and the `notificationTime`/`notifications`/`startDate`/`partnerName` settings. The start date now lives in `public.couple_settings` (local-copy kind `couple-settings`), and the mood pop-up uses the partner's display name.

Story 4 (#343) removed `src/config/relationshipDates.ts`. Each partner's birthday is `public.users.birthday`, written through a column-level UPDATE grant, and the wedding date is `couple_settings.wedding_date` (migration `20260924000000`). Your own name and birthday are local-copy kind `profile`, the partner's birthday rides on kind `partner`, and the wedding date on `couple-settings`. Home's `BirthdayWeddingCards` label each birthday with the display name, so no source file hard-codes a name.

## Known gaps this spec closes

- Photos have no local copy. (Events closed by #345, partner mood and own-mood history by #346, pokes/kisses by #347, love notes by #348.)
- The persisted blob and the service-worker caches are shared by the whole device, not kept per account.
- Signed image URLs expire and change, so no photo is cached for offline use. (Love-note images are cached by storage path since #348.)

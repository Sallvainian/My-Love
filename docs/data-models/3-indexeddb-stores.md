# 3. IndexedDB Stores

**Source:** `src/services/dbSchema.ts`

## Database Configuration

- **Name:** `my-love-db`
- **Version:** `5`
- **Library:** `idb` v8.0.3 (promise-based IndexedDB wrapper)
- **Schema type:** `MyLoveDBSchema` (TypeScript interface extending `DBSchema`)

## Store Definitions

### `messages` (v1)

Custom love messages for the daily message rotation.

| Property     | Type              | Notes                                                 |
| ------------ | ----------------- | ----------------------------------------------------- |
| key          | `number`          | Auto-increment                                        |
| `id`         | `number`          | Auto-generated key                                    |
| `text`       | `string`          | Message content (1-1000 chars)                        |
| `category`   | `MessageCategory` | `reason`, `memory`, `affirmation`, `future`, `custom` |
| `isCustom`   | `boolean`         | User-created vs. preset                               |
| `active`     | `boolean`         | Participates in rotation                              |
| `createdAt`  | `Date`            | Creation timestamp                                    |
| `isFavorite` | `boolean`         | Favorited by user                                     |
| `updatedAt`  | `Date`            | Last update timestamp                                 |
| `tags`       | `string[]`        | User-defined tags                                     |

**Indexes:** `by-category` (string), `by-date` (Date)

**Data pattern:** Local-only. Not synced to Supabase.

---

### `photos` (v2)

Local photo blobs with compression metadata.

| Property         | Type       | Notes                                   |
| ---------------- | ---------- | --------------------------------------- |
| key              | `number`   | Auto-increment                          |
| `id`             | `number`   | Auto-generated key                      |
| `imageBlob`      | `Blob`     | Compressed image data                   |
| `caption`        | `string`   | Max 500 chars                           |
| `tags`           | `string[]` | User-defined tags                       |
| `uploadDate`     | `Date`     | Upload timestamp                        |
| `originalSize`   | `number`   | Pre-compression size (bytes)            |
| `compressedSize` | `number`   | Post-compression size (bytes)           |
| `width`          | `number`   | Image width (pixels)                    |
| `height`         | `number`   | Image height (pixels)                   |
| `mimeType`       | `string`   | `image/jpeg`, `image/png`, `image/webp` |

**Indexes:** `by-date` (Date, non-unique)

**Migration note:** v1 had `blob` field; v2 renamed to `imageBlob`. `PhotoStorageService._doInit()` handles data migration within the upgrade transaction.

**Data pattern:** Local-only.

---

### `moods` (v3)

Offline-first mood entries synced to Supabase.

| Property     | Type         | Notes                             |
| ------------ | ------------ | --------------------------------- |
| key          | `number`     | Auto-increment                    |
| `id`         | `number`     | Auto-generated key                |
| `userId`     | `string`     | User UUID                         |
| `mood`       | `MoodType`   | Primary mood (12 enum values)     |
| `moods`      | `MoodType[]` | All selected moods                |
| `note`       | `string`     | Max 200 chars                     |
| `date`       | `string`     | ISO date YYYY-MM-DD               |
| `timestamp`  | `Date`       | Full timestamp                    |
| `synced`     | `boolean`    | Uploaded to Supabase              |
| `supabaseId` | `string`     | Supabase record UUID (after sync) |

**Indexes:** `by-date` (string, **unique** -- one mood per day)

**Data pattern:** Offline-first. Written to IndexedDB first, then synced to Supabase. `synced` flag tracks sync status.

---

### `sw-auth` (v4)

Background Sync auth token for service worker access.

| Property       | Type        | Notes                             |
| -------------- | ----------- | --------------------------------- |
| key            | `'current'` | Fixed key (only one token stored) |
| `id`           | `'current'` | Literal string key                |
| `accessToken`  | `string`    | JWT access token                  |
| `refreshToken` | `string`    | JWT refresh token                 |
| `expiresAt`    | `number`    | Unix timestamp (seconds)          |
| `userId`       | `string`    | User UUID                         |

**No indexes.** Single-record store.

**Data pattern:** Updated on sign-in, TOKEN_REFRESHED, cleared on sign-out. Read by service worker for Background Sync API calls.

---

### `scripture-sessions` (v5)

Cache of Supabase `scripture_sessions` rows.

| Property             | Type                      | Notes                          |
| -------------------- | ------------------------- | ------------------------------ |
| key                  | `string`                  | UUID from Supabase             |
| `id`                 | `string`                  | Session UUID                   |
| `mode`               | `ScriptureSessionMode`    | `'solo'` or `'together'`       |
| `userId`             | `string`                  | Current user's UUID            |
| `partnerId`          | `string`                  | Partner UUID (together mode)   |
| `currentPhase`       | `ScriptureSessionPhase`   | 6 phases                       |
| `currentStepIndex`   | `number`                  | 0-16                           |
| `status`             | `ScriptureSessionStatus`  | 4 statuses                     |
| `version`            | `number`                  | Optimistic concurrency version |
| `snapshotJson`       | `Record<string, unknown>` | Server snapshot                |
| `myRole`             | `ScriptureSessionRole`    | `'reader'` or `'responder'`    |
| `partnerRole`        | `ScriptureSessionRole`    | Partner's role                 |
| `user1Ready`         | `boolean`                 | Lobby ready state              |
| `user2Ready`         | `boolean`                 | Lobby ready state              |
| `startedAt`          | `Date`                    | Session creation               |
| `completedAt`        | `Date`                    | Session completion             |
| `countdownStartedAt` | `Date`                    | Lobby countdown start          |

**Indexes:** `by-user` (string)

**Data pattern:** Cache layer. Supabase is source of truth. Cache-first reads with background refresh.

---

### `scripture-reflections` (v5)

Cache of Supabase `scripture_reflections` rows.

| Property    | Type      | Notes               |
| ----------- | --------- | ------------------- |
| key         | `string`  | UUID                |
| `id`        | `string`  | Reflection UUID     |
| `sessionId` | `string`  | Parent session UUID |
| `stepIndex` | `number`  | Step number         |
| `userId`    | `string`  | Author UUID         |
| `rating`    | `number`  | 1-5 scale           |
| `notes`     | `string`  | Reflection text     |
| `isShared`  | `boolean` | Shared with partner |
| `createdAt` | `Date`    | Creation timestamp  |

**Indexes:** `by-session` (string)

---

### `scripture-bookmarks` (v5)

Cache of Supabase `scripture_bookmarks` rows.

| Property           | Type      | Notes               |
| ------------------ | --------- | ------------------- |
| key                | `string`  | UUID                |
| `id`               | `string`  | Bookmark UUID       |
| `sessionId`        | `string`  | Parent session UUID |
| `stepIndex`        | `number`  | Bookmarked step     |
| `userId`           | `string`  | Owner UUID          |
| `shareWithPartner` | `boolean` | Visible to partner  |
| `createdAt`        | `Date`    | Creation timestamp  |

**Indexes:** `by-session` (string)

---

### `scripture-messages` (v5)

Cache of Supabase `scripture_messages` rows.

| Property    | Type     | Notes               |
| ----------- | -------- | ------------------- |
| key         | `string` | UUID                |
| `id`        | `string` | Message UUID        |
| `sessionId` | `string` | Parent session UUID |
| `senderId`  | `string` | Author UUID         |
| `message`   | `string` | Message content     |
| `createdAt` | `Date`   | Creation timestamp  |

**Indexes:** `by-session` (string)

## Version Upgrade History

| Version | Migration         | Stores Added                                                                               |
| ------- | ----------------- | ------------------------------------------------------------------------------------------ |
| v1      | Initial           | `messages`                                                                                 |
| v2      | Photo enhancement | `photos` (recreated with `imageBlob` field)                                                |
| v3      | Mood tracking     | `moods`                                                                                    |
| v4      | Background Sync   | `sw-auth`                                                                                  |
| v5      | Scripture reading | `scripture-sessions`, `scripture-reflections`, `scripture-bookmarks`, `scripture-messages` |

All upgrades are handled by the centralized `upgradeDb()` function in `src/services/dbSchema.ts`.

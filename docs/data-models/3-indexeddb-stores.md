# 3. IndexedDB Stores

**Source:** `src/services/dbSchema.ts`

Database name: `my-love-db` | Current version: **5**

## Store Definitions

### `messages` (v1)

- **Key:** `number` (auto-increment)
- **Value:** `Message` (text, category, isCustom, active, isFavorite, createdAt, updatedAt, tags)
- **Indexes:** `by-category` (string), `by-date` (Date)

### `photos` (v2)

- **Key:** `number` (auto-increment)
- **Value:** `Photo` (imageBlob, caption, tags, uploadDate, originalSize, compressedSize, width, height, mimeType)
- **Indexes:** `by-date` (Date, non-unique)
- Note: v1 had `blob` field, renamed to `imageBlob` in v2 with data migration

### `moods` (v3)

- **Key:** `number` (auto-increment)
- **Value:** `MoodEntry` (userId, mood, moods[], note, date, timestamp, synced, supabaseId)
- **Indexes:** `by-date` (string, **unique**) -- one mood per date

### `sw-auth` (v4)

- **Key:** `'current'` (literal string)
- **Value:** `StoredAuthToken` (id, accessToken, refreshToken, expiresAt, userId)
- **Indexes:** none
- Purpose: Stores auth token for Background Sync service worker access

### `scripture-sessions` (v5)

- **Key:** `string` (UUID from Supabase)
- **Value:** `ScriptureSession` (id, mode, userId, partnerId, currentPhase, currentStepIndex, status, version, snapshotJson, myRole, partnerRole, user1Ready, user2Ready, countdownStartedAt, startedAt, completedAt)
- **Indexes:** `by-user` (string)

### `scripture-reflections` (v5)

- **Key:** `string` (UUID)
- **Value:** `ScriptureReflection` (id, sessionId, stepIndex, userId, rating, notes, isShared, createdAt)
- **Indexes:** `by-session` (string)

### `scripture-bookmarks` (v5)

- **Key:** `string` (UUID)
- **Value:** `ScriptureBookmark` (id, sessionId, stepIndex, userId, shareWithPartner, createdAt)
- **Indexes:** `by-session` (string)

### `scripture-messages` (v5)

- **Key:** `string` (UUID)
- **Value:** `ScriptureMessage` (id, sessionId, senderId, message, createdAt)
- **Indexes:** `by-session` (string)

## Version History

| Version | Changes                                                         |
| ------- | --------------------------------------------------------------- |
| 1       | `messages` store with category/date indexes                     |
| 2       | `photos` store with enhanced schema (blob renamed to imageBlob) |
| 3       | `moods` store with unique by-date index                         |
| 4       | `sw-auth` store for Background Sync auth token                  |
| 5       | 4 scripture stores (sessions, reflections, bookmarks, messages) |

## Upgrade Function

`upgradeDb(db, oldVersion, newVersion)` in `dbSchema.ts` handles all migrations centrally. Each service calls this during `_doInit()`. Exception: `PhotoStorageService` handles v1->v2 photo migration with data preservation (requires transaction access).

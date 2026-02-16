# 3. IndexedDB Stores

**Source:** `src/services/dbSchema.ts`

## Database Configuration

```typescript
const DB_NAME = 'my-love-db';
const DB_VERSION = 5;
```

All services share a single database with centralized upgrade logic via `upgradeDb()`.

## 3.1 `messages`

Custom love messages for the daily message rotation.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `number` | Auto-increment primary key |
| `text` | `string` | Message text (1-500 chars) |
| `category` | `MessageCategory` | `'reason'`, `'memory'`, `'affirmation'`, `'future'`, `'custom'` |
| `isCustom` | `boolean` | `true` for user-created messages |
| `active` | `boolean` | Controls participation in daily rotation |
| `createdAt` | `Date` | |
| `isFavorite` | `boolean?` | |
| `updatedAt` | `Date?` | |
| `tags` | `string[]?` | |

**Indexes:** `by-category` (category), `by-date` (createdAt)

**Service:** `customMessageService` (Story 3.5)

## 3.2 `photos`

Compressed photo blobs stored locally with metadata.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `number` | Auto-increment primary key |
| `imageBlob` | `Blob` | Compressed image data |
| `caption` | `string?` | Photo caption (max 500 chars) |
| `tags` | `string[]` | Tag array (default `[]`) |
| `uploadDate` | `Date` | |
| `originalSize` | `number` | Original file size in bytes |
| `compressedSize` | `number` | Compressed size in bytes |
| `width` | `number` | Image width in pixels |
| `height` | `number` | Image height in pixels |
| `mimeType` | `string` | `'image/jpeg'`, `'image/png'`, or `'image/webp'` |

**Indexes:** `by-date` (uploadDate)

**Service:** `photoStorageService` (Story 4.1)

**Migration note:** v1 used `blob` field name; v2 renamed to `imageBlob`. The `photoStorageService._doInit()` handles data migration for existing v1 records.

## 3.3 `moods`

Mood entries with offline-first sync tracking.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `number` | Auto-increment primary key |
| `userId` | `string` | Authenticated user's UUID |
| `mood` | `MoodType` | Primary mood (backward compatibility) |
| `moods` | `MoodType[]?` | All selected moods (multi-mood support) |
| `note` | `string?` | Optional note (max 200 chars) |
| `date` | `string` | ISO date string (`YYYY-MM-DD`) |
| `timestamp` | `Date` | Full timestamp when logged |
| `synced` | `boolean` | `false` until uploaded to Supabase |
| `supabaseId` | `string?` | Supabase record UUID after sync |

**Indexes:** `by-date` (date, **unique**) -- enforces one mood per day

**Service:** `moodService` (Story 6.2)

## 3.4 `sw-auth`

Auth token storage for Background Sync service worker access.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `'current'` | Fixed key (single record) |
| `accessToken` | `string` | JWT for API authorization |
| `refreshToken` | `string` | For token refresh |
| `expiresAt` | `number` | Unix timestamp of token expiry |
| `userId` | `string` | User UUID for REST API calls |

**No indexes.** Single record keyed by `'current'`.

**Access:** Written by `authService` (sign-in, token refresh), read by `sw-db.ts` (Background Sync).

## 3.5 `scripture-sessions`

Cached scripture reading sessions for offline support.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | UUID from Supabase |
| `mode` | `'solo' \| 'together'` | Session mode |
| `userId` | `string` | Current user's ID |
| `partnerId` | `string?` | Partner's ID (together mode) |
| `currentPhase` | `ScriptureSessionPhase` | `lobby`, `countdown`, `reading`, `reflection`, `report`, `complete` |
| `currentStepIndex` | `number` | |
| `status` | `ScriptureSessionStatus` | `pending`, `in_progress`, `complete`, `abandoned` |
| `version` | `number` | Optimistic concurrency control |
| `snapshotJson` | `Record<string, unknown>?` | |
| `startedAt` | `Date` | |
| `completedAt` | `Date?` | |

**Indexes:** `by-user` (userId)

## 3.6 `scripture-reflections`

Cached per-step reflections.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | UUID |
| `sessionId` | `string` | FK to scripture-sessions |
| `stepIndex` | `number` | |
| `userId` | `string` | |
| `rating` | `number?` | 1-5 |
| `notes` | `string?` | |
| `isShared` | `boolean` | |
| `createdAt` | `Date` | |

**Indexes:** `by-session` (sessionId)

## 3.7 `scripture-bookmarks`

Cached bookmarked reading steps.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | UUID |
| `sessionId` | `string` | FK to scripture-sessions |
| `stepIndex` | `number` | |
| `userId` | `string` | |
| `shareWithPartner` | `boolean` | |
| `createdAt` | `Date` | |

**Indexes:** `by-session` (sessionId)

## 3.8 `scripture-messages`

Cached Daily Prayer Report messages.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | UUID |
| `sessionId` | `string` | FK to scripture-sessions |
| `senderId` | `string` | |
| `message` | `string` | |
| `createdAt` | `Date` | |

**Indexes:** `by-session` (sessionId)

## Version History

| Version | Migration | Stores Added |
|---------|-----------|-------------|
| v1 | Initial | `messages` with by-category and by-date indexes |
| v2 | Photos | `photos` with by-date index (deleted and recreated old v1 photos store) |
| v3 | Moods | `moods` with by-date unique index |
| v4 | Background Sync | `sw-auth` for service worker auth token storage |
| v5 | Scripture | `scripture-sessions`, `scripture-reflections`, `scripture-bookmarks`, `scripture-messages` |

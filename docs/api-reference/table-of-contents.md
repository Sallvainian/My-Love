# API Reference - Table of Contents

## 1. Supabase Client Configuration

- Singleton client instance with typed `Database` generic
- Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- Client options: `persistSession`, `autoRefreshToken`, `detectSessionInUrl`, `eventsPerSecond: 10`
- `getPartnerId()` - query current user's partner_id from users table
- `getPartnerDisplayName()` - fetch partner's display_name
- `isSupabaseConfigured()` - env var presence check

## 2. Authentication Service

- Facade: `authService` object composing `sessionService` + `actionService`
- Types: `AuthCredentials`, `AuthResult`, `AuthStatus`
- Actions: `signIn()`, `signUp()`, `signOut()`, `resetPassword()`, `signInWithGoogle()`
- Sessions: `getSession()`, `getUser()`, `getCurrentUserId()`, `getCurrentUserIdOfflineSafe()`
- `onAuthStateChange()` - listener with IndexedDB token persistence for SW

## 3. Error Handling Utilities

- `SupabaseServiceError` class with `code`, `details`, `hint`, `isNetworkError`
- `handleSupabaseError()` - maps PostgrestError codes (23505, 42501, PGRST116, etc.)
- `handleNetworkError()` - wraps fetch failures
- Type guards: `isPostgrestError()`, `isSupabaseServiceError()`
- `retryWithBackoff<T>()` - generic exponential backoff (default: 3 attempts, 1s/2s/4s)
- `logSupabaseError()`, `createOfflineMessage()`

## 4. Mood API Service

- `MoodApi` class (singleton `moodApi`)
- `create(moodData: MoodInsert): Promise<SupabaseMood>`
- `fetchByUser(userId, limit?): Promise<SupabaseMood[]>`
- `fetchByDateRange(userId, startDate, endDate): Promise<SupabaseMood[]>`
- `fetchById(moodId): Promise<SupabaseMood | null>`
- `update(moodId, updates): Promise<SupabaseMood>`
- `delete(moodId): Promise<void>`
- `getMoodHistory(userId, offset?, limit?): Promise<SupabaseMood[]>`
- `ApiValidationError` class with `validationErrors: ZodError`

## 5. Mood Sync Service

- `MoodSyncService` class (singleton `moodSyncService`)
- `syncMood(mood: MoodEntry): Promise<SupabaseMoodRecord>`
- `syncPendingMoods(): Promise<SyncResult>`
- `subscribeMoodUpdates(callback, onStatusChange?): Promise<() => void>`
- `fetchMoods(userId, limit?): Promise<SupabaseMoodRecord[]>`
- `getLatestPartnerMood(userId): Promise<SupabaseMoodRecord | null>`
- Broadcast to partner after sync via ephemeral channel

## 6. Interaction Service

- `InteractionService` class (singleton `interactionService`)
- `sendPoke(partnerId): Promise<SupabaseInteractionRecord>`
- `sendKiss(partnerId): Promise<SupabaseInteractionRecord>`
- `subscribeInteractions(callback): Promise<() => void>` (postgres_changes INSERT)
- `getInteractionHistory(limit?, offset?): Promise<Interaction[]>`
- `getUnviewedInteractions(): Promise<Interaction[]>`
- `markAsViewed(interactionId): Promise<void>`

## 7. Partner Service

- `PartnerService` class (singleton `partnerService`)
- `getPartner(): Promise<PartnerInfo | null>`
- `searchUsers(query, limit?): Promise<UserSearchResult[]>`
- `sendPartnerRequest(toUserId): Promise<void>`
- `acceptPartnerRequest(requestId): Promise<void>` (calls `accept_partner_request` RPC)
- `declinePartnerRequest(requestId): Promise<void>` (calls `decline_partner_request` RPC)
- `getPendingRequests(): Promise<{ sent, received }>`
- `hasPartner(): Promise<boolean>`

## 8. IndexedDB Services

- `BaseIndexedDBService<T, DBTypes, StoreName>` abstract class
  - `init()`, `add()`, `get()`, `getAll()`, `update()`, `delete()`, `clear()`, `getPage()`
- `MoodService` (store: `moods`, index: `by-date` unique)
  - `create()`, `updateMood()`, `getMoodForDate()`, `getMoodsInRange()`, `getUnsyncedMoods()`, `markAsSynced()`
- `PhotoStorageService` (store: `photos`, index: `by-date`)
  - `create()`, `getAll()`, `getPage()`, `update()`, `getStorageSize()`, `estimateQuotaRemaining()`
- `CustomMessageService` (store: `messages`, indexes: `by-category`, `by-date`)
  - `create()`, `updateMessage()`, `getAll(filter?)`, `getActiveCustomMessages()`, `exportMessages()`, `importMessages()`
- `StorageService` (legacy) - photos and messages CRUD
- `localStorageHelper` - `get<T>()`, `set<T>()`, `remove()`, `clear()`

## 9. Photo Services

- **PhotoService** (Supabase Storage, singleton `photoService`)
  - `getSignedUrl()`, `getSignedUrls()`, `checkStorageQuota()`, `getPhotos()`, `uploadPhoto()`, `deletePhoto()`, `getPhoto()`, `updatePhoto()`
- **LoveNoteImageService** (Edge Function + Storage)
  - `uploadLoveNoteImage()`, `uploadCompressedBlob()`, `getSignedImageUrl()`, `batchGetSignedUrls()`, `deleteLoveNoteImage()`
  - LRU signed URL cache with deduplication
- **ImageCompressionService** (Canvas API)
  - `compressImage()`, `validateImageFile()`, `estimateCompressedSize()`

## 10. Validation Layer

- **Client-side schemas** (`src/validation/schemas.ts`): `MessageSchema`, `PhotoSchema`, `MoodEntrySchema`, `SettingsSchema`, `CustomMessagesExportSchema`, `SupabaseSessionSchema`, `SupabaseReflectionSchema`, `SupabaseBookmarkSchema`, `SupabaseMessageSchema`
- **API response schemas** (`src/api/validation/supabaseSchemas.ts`): `SupabaseMoodSchema`, `SupabaseInteractionSchema`, `SupabaseUserSchema`, `CoupleStatsSchema`
- **Error utilities** (`src/validation/errorMessages.ts`): `ValidationError`, `formatZodError()`, `getFieldErrors()`, `createValidationError()`, `isValidationError()`, `isZodError()`

## 11. Service Worker & Background Sync

- Workbox strategies: `NetworkOnly` (JS/CSS), `NetworkFirst` (navigation), `CacheFirst` (images/fonts/Google Fonts)
- Background Sync: `sync-pending-moods` tag triggers `syncPendingMoods()`
- `sw-db.ts`: `getPendingMoods()`, `markMoodSynced()`, `storeAuthToken()`, `getAuthToken()`, `clearAuthToken()`
- Direct Supabase REST API calls with stored JWT

## 12. Real-Time Subscriptions

- `RealtimeService` class: postgres_changes on `moods` table
- Mood broadcast: `channel('mood-updates:{userId}')` with Broadcast API
- Interaction realtime: `channel('incoming-interactions')` with postgres_changes INSERT filter
- Scripture session: private broadcast channels `scripture-session:{sessionId}`

## 13. Scripture Reading Service

- `ScriptureReadingService` (extends `BaseIndexedDBService`, singleton `scriptureReadingService`)
- Sessions: `createSession()`, `getSession()`, `getUserSessions()`, `updateSession()`
- Reflections: `addReflection()`, `getReflectionsBySession()`
- Bookmarks: `addBookmark()`, `toggleBookmark()`, `getBookmarksBySession()`, `updateSessionBookmarkSharing()`
- Messages: `addMessage()`, `getMessagesBySession()`
- Stats: `getCoupleStats()`
- Cache recovery: `recoverSessionCache()`, `recoverAllCaches()`
- Report: `getSessionReportData()`
- Error codes: `VERSION_MISMATCH`, `SESSION_NOT_FOUND`, `UNAUTHORIZED`, `SYNC_FAILED`, `OFFLINE`, `CACHE_CORRUPTED`, `VALIDATION_FAILED`

## 14. Additional Services

- `SyncService`: `syncPendingMoods()`, `hasPendingSync()`, `getPendingCount()`
- `ImageCompressionService`: Canvas API compression (max 2048px, 80% JPEG quality)
- `MigrationService`: `migrateCustomMessagesFromLocalStorage()`
- `PerformanceMonitor`: `measureAsync()`, `recordMetric()`, `getReport()`

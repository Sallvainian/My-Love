# API Reference -- Table of Contents

## 1. Supabase Client Configuration
- Environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`)
- Singleton client instance with Database typing
- Auth configuration (persist session, auto-refresh, OAuth detection)
- Realtime configuration (10 events/second)
- Helper functions: `getPartnerId()`, `getPartnerDisplayName()`, `isSupabaseConfigured()`

## 2. Authentication API
- Facade pattern: `authService` composes `sessionService` + `actionService`
- Email/password sign-in and sign-up
- Google OAuth with offline access
- Password reset
- Session management and token refresh
- `getCurrentUserId()` and `getCurrentUserIdOfflineSafe()`
- `onAuthStateChange()` listener with IndexedDB token storage for SW
- Auth types: `AuthCredentials`, `AuthResult`, `AuthStatus`

## 3. Mood API
- `MoodApi` class with Zod-validated CRUD operations
- `create(moodData)` -- insert with response validation
- `fetchByUser(userId, limit)` -- query by user
- `fetchByDateRange(userId, startDate, endDate)` -- date range query
- `fetchById(moodId)` -- single mood lookup
- `update(moodId, updates)` -- partial update
- `delete(moodId)` -- remove mood
- `getMoodHistory(userId, offset, limit)` -- paginated history
- `ApiValidationError` class for validation failures

## 4. Mood Sync Service
- `MoodSyncService` class for IndexedDB-to-Supabase synchronization
- `syncMood(mood)` -- upload single mood with Broadcast API notification
- `syncPendingMoods()` -- batch sync with retry (1s, 2s, 4s backoff)
- `subscribeMoodUpdates(callback)` -- Broadcast API subscription
- `fetchMoods(userId, limit)` -- validated fetch
- `getLatestPartnerMood(userId)` -- partner's current mood
- `SyncResult` interface: `{ synced, failed, errors }`

## 5. Interaction API
- `InteractionService` class for poke/kiss interactions
- `sendPoke(partnerId)` / `sendKiss(partnerId)` -- send interactions
- `subscribeInteractions(callback)` -- postgres_changes realtime
- `getInteractionHistory(limit, offset)` -- paginated history
- `getUnviewedInteractions()` -- unread interactions
- `markAsViewed(interactionId)` -- mark as read
- Types: `Interaction`, `InteractionType`, `SupabaseInteractionRecord`

## 6. Partner Service
- `PartnerService` class for partner relationship management
- `getPartner()` -- current partner info
- `searchUsers(query, limit)` -- user search by name/email
- `sendPartnerRequest(toUserId)` -- send connection request
- `getPendingRequests()` -- sent and received requests
- `acceptPartnerRequest(requestId)` -- accept via RPC
- `declinePartnerRequest(requestId)` -- decline via RPC
- `hasPartner()` -- boolean check
- Types: `UserSearchResult`, `PartnerInfo`, `PartnerRequest`

## 7. Error Handling
- `SupabaseServiceError` class (code, details, hint, isNetworkError)
- `handleSupabaseError()` -- PostgrestError to user-friendly message
- `handleNetworkError()` -- network failure with offline message
- Error code mapping: 23505, 23503, 23502, 42501, 42P01, PGRST116, PGRST301
- `retryWithBackoff()` -- generic exponential backoff
- `RetryConfig` and `DEFAULT_RETRY_CONFIG` (3 attempts, 1s/2s/4s)
- Type guards: `isPostgrestError()`, `isSupabaseServiceError()`
- Logging: `logSupabaseError()`
- `isOnline()` -- network status check
- `createOfflineMessage()` -- user-friendly offline text

## 8. Validation Schemas
- API response schemas (`src/api/validation/supabaseSchemas.ts`)
- Local data schemas (`src/validation/schemas.ts`)
- Error message utilities (`src/validation/errorMessages.ts`)
- Schema coverage: Users, Moods, Interactions, Messages, Photos, Scripture entities
- `MoodTypeSchema` enum (12 mood types)
- Insert/Update schemas for all entities
- `ValidationError` class with field-level errors

## 9. Service Layer (IndexedDB)
- `BaseIndexedDBService<T, DBTypes, StoreName>` abstract class
- CRUD operations: `add`, `get`, `getAll`, `update`, `delete`, `clear`, `getPage`
- Cursor-based pagination for efficiency
- Error strategy: reads return null/empty, writes throw
- `MoodService` -- mood entries with sync tracking
- `CustomMessageService` -- love messages with filtering and export/import
- `PhotoStorageService` -- photo blobs with v1-to-v2 migration
- `ScriptureReadingService` -- cache-first pattern with write-through and corruption recovery
- `LoveNoteImageService` -- Supabase Storage signed URL management
- `ImageCompressionService` -- Canvas API compression
- `PhotoService` -- Supabase Storage CRUD with quota management
- Database schema: `MyLoveDBSchema` (8 stores, 5 versions)

## 10. Edge Functions
- `upload-love-note-image` -- server-side image upload validation
  - Magic byte MIME detection (JPEG, PNG, WebP, GIF)
  - Rate limiting (10 uploads/minute per user)
  - File size validation (5MB max)
  - CORS handling
  - Auth verification via Bearer token
  - Storage path: `{user_id}/{timestamp}-{uuid}.jpg`

## 11. Service Worker
- Workbox precaching with `__WB_MANIFEST`
- Caching strategies: NetworkOnly (JS/CSS), NetworkFirst (navigation), CacheFirst (assets/fonts)
- Background Sync API for `sync-pending-moods` tag
- Direct Supabase REST API calls (no JS client in SW context)
- IndexedDB helpers: `getPendingMoods`, `markMoodSynced`, `getAuthToken`, `clearAuthToken`
- Auth token management for SW background operations
- Multi-mood transformation (`transformMoodForSupabase`)

## 12. Real-Time Subscriptions
- `RealtimeService` -- channel management with tracking
- `subscribeMoodChanges()` -- postgres_changes for mood updates
- Broadcast API for partner mood notifications (replacing postgres_changes)
- Interaction realtime via postgres_changes INSERT events
- Channel lifecycle: subscribe, track, unsubscribe, cleanup
- Error handler registration

---

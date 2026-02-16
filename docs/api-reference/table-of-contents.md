# API Reference -- Table of Contents

## 1. Supabase Client Configuration
- Environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`)
- Singleton client instance with `Database` typing
- Auth config: `persistSession`, `autoRefreshToken`, `detectSessionInUrl`
- Realtime config: `eventsPerSecond: 10`
- `getPartnerId()` -- query partner_id from users table
- `getPartnerDisplayName()` -- fetch partner's display_name
- `isSupabaseConfigured()` -- verify env vars present

## 2. Authentication Service
- Facade pattern: `authService` composes `sessionService` + `actionService`
- Types: `AuthCredentials`, `AuthResult`, `AuthStatus`
- `signIn(credentials)` -- email/password with IndexedDB token storage for Background Sync
- `signUp(credentials)` -- email/password registration
- `signOut()` -- logout with IndexedDB token cleanup
- `signInWithGoogle()` -- OAuth with `access_type: 'offline'`, `prompt: 'consent'`
- `resetPassword(email)` -- password reset email
- `getSession()` -- current session from Supabase Auth
- `getUser()` -- server-validated user object
- `getCurrentUserId()` -- server-validated user ID
- `getCurrentUserIdOfflineSafe()` -- cached session user ID (no network call)
- `getAuthStatus()` -- `{ isAuthenticated, user, session }`
- `onAuthStateChange(callback)` -- listener with automatic IndexedDB token sync

## 3. Error Handling Utilities
- `SupabaseServiceError` class: `code`, `details`, `hint`, `isNetworkError`
- `handleSupabaseError(error, context?)` -- PostgrestError to user-friendly message
- Error code mapping: 23505 (duplicate), 23503 (FK violation), 23502 (null violation), 42501 (RLS denied), 42P01 (table not found), PGRST116 (no rows), PGRST301 (bad params)
- `handleNetworkError(error, context?)` -- network failure with offline message
- `isOnline()` -- `navigator.onLine` check
- `isPostgrestError(error)` -- type guard
- `isSupabaseServiceError(error)` -- type guard
- `logSupabaseError(context, error)` -- structured console logging
- `retryWithBackoff<T>(operation, config?)` -- exponential backoff
- `RetryConfig`: `maxAttempts`, `initialDelayMs`, `maxDelayMs`, `backoffMultiplier`
- `DEFAULT_RETRY_CONFIG`: 3 attempts, 1s initial, 30s max, 2x multiplier
- `createOfflineMessage(operation)` -- user-friendly offline text

## 4. Mood API Service
- `MoodApi` class with Zod-validated Supabase CRUD
- `ApiValidationError` class with `validationErrors: ZodError | null`
- `create(moodData: MoodInsert)` -- insert + response validation
- `fetchByUser(userId, limit=50)` -- query by user, descending
- `fetchByDateRange(userId, startDate, endDate)` -- date range query
- `fetchById(moodId)` -- single mood (returns `null` for PGRST116)
- `update(moodId, updates)` -- partial update with `updated_at`
- `delete(moodId)` -- remove mood
- `getMoodHistory(userId, offset=0, limit=50)` -- paginated with `.range()`

## 5. Mood Sync Service
- `MoodSyncService` class for IndexedDB-to-Supabase synchronization
- `SyncResult`: `{ synced: number, failed: number, errors: string[] }`
- `syncMood(mood: MoodEntry)` -- transform + upload + broadcast to partner
- `syncPendingMoods()` -- batch sync with retry (1s/2s/4s backoff, max 3 retries)
- `subscribeMoodUpdates(callback, onStatusChange?)` -- Broadcast API (not postgres_changes)
- `fetchMoods(userId, limit=50)` -- delegates to validated `moodApi.fetchByUser()`
- `getLatestPartnerMood(userId)` -- single most recent mood
- `SyncService` class (services/syncService.ts): parallel `Promise.all` with partial failure

## 6. Interaction Service
- `InteractionService` class for poke/kiss interactions
- Types: `InteractionType = 'poke' | 'kiss'`, `Interaction`, `SupabaseInteractionRecord`
- `sendPoke(partnerId)` -- delegates to `sendInteraction('poke', partnerId)`
- `sendKiss(partnerId)` -- delegates to `sendInteraction('kiss', partnerId)`
- `subscribeInteractions(callback)` -- `postgres_changes` INSERT on interactions table
- `getInteractionHistory(limit=50, offset=0)` -- bidirectional query with transform
- `getUnviewedInteractions()` -- unread interactions for current user
- `markAsViewed(interactionId)` -- update `viewed = true`

## 7. Partner Service
- `PartnerService` class for partner relationship management
- Types: `UserSearchResult`, `PartnerInfo`, `PartnerRequest`
- `getPartner()` -- current partner info from users table
- `searchUsers(query, limit=10)` -- ilike search on email + display_name
- `sendPartnerRequest(toUserId)` -- insert to partner_requests (checks both users have no partner)
- `getPendingRequests()` -- returns `{ sent: PartnerRequest[], received: PartnerRequest[] }`
- `acceptPartnerRequest(requestId)` -- calls `accept_partner_request` RPC
- `declinePartnerRequest(requestId)` -- calls `decline_partner_request` RPC
- `hasPartner()` -- boolean check

## 8. IndexedDB Services
- `BaseIndexedDBService<T, DBTypes, StoreName>` abstract class
- Database schema: `MyLoveDBSchema` (8 stores, v1-v5)
- `upgradeDb()` centralized migration function
- `MoodService` -- mood tracking with sync status
- `CustomMessageService` -- messages with filtering, export/import
- `PhotoStorageService` -- photo blobs with v1-v2 data migration
- Scripture stores: sessions, reflections, bookmarks, messages

## 9. Photo Services
- `PhotoService` (Supabase Storage) -- cloud photo CRUD with signed URLs
- `PhotoStorageService` (IndexedDB) -- local photo storage with cursor pagination
- `ImageCompressionService` -- Canvas API compression (max 2048px, 80% JPEG)
- `LoveNoteImageService` -- Edge Function upload + signed URL cache with LRU eviction
- Edge Function: `upload-love-note-image` -- server-side MIME validation + rate limiting

## 10. Validation Layer
- API schemas (`src/api/validation/supabaseSchemas.ts`): User, Mood, Interaction, Message, Photo
- Local schemas (`src/validation/schemas.ts`): Message, Photo, Mood, Settings, Export, Scripture
- Error utilities (`src/validation/errorMessages.ts`): `ValidationError`, `formatZodError`, `getFieldErrors`
- 12 mood types, 5 message categories, 3 photo MIME types

## 11. Service Worker & Background Sync
- Workbox: `precacheAndRoute`, `NetworkOnly` (JS/CSS), `NetworkFirst` (navigation), `CacheFirst` (assets)
- Background Sync API for `sync-pending-moods` tag
- Direct Supabase REST API calls from SW context (no JS client)
- SW-DB helpers: `getPendingMoods`, `markMoodSynced`, `storeAuthToken`, `getAuthToken`, `clearAuthToken`

## 12. Real-Time Subscriptions
- `RealtimeService` -- channel management with Map tracking
- `subscribeMoodChanges(userId, onMoodChange, onError?)` -- postgres_changes
- Broadcast API for partner mood notifications
- Interaction realtime via postgres_changes INSERT events
- Channel lifecycle: subscribe, track, unsubscribe, cleanup

# API Reference Documentation

## My-Love PWA -- Complete API Layer Reference

This section documents the entire API surface of the My-Love application, covering the Supabase client configuration, authentication flows, data services, validation schemas, service worker background sync, edge functions, and real-time subscription patterns.

### Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React | 19.2.4 |
| Language | TypeScript | 5.9 |
| Build | Vite | 7.3.1 |
| Backend | Supabase (Auth, Postgres, Storage, Realtime, Edge Functions) | supabase-js 2.x |
| Validation | Zod | 4.3.6 (v4) |
| Offline Storage | IndexedDB via `idb` | -- |
| Service Worker | Workbox | -- |

### Architecture Overview

The API layer follows a layered architecture:

```
UI Components (React)
    |
    v
API Services (src/api/)          Service Layer (src/services/)
  - authService                    - moodService (IndexedDB)
  - moodApi                       - customMessageService (IndexedDB)
  - moodSyncService               - photoStorageService (IndexedDB)
  - interactionService             - scriptureReadingService (IndexedDB + Supabase)
  - partnerService                 - BaseIndexedDBService (abstract)
  - errorHandlers                  - realtimeService
    |                                |
    v                                v
Supabase Client (src/api/supabaseClient.ts)
    |
    v
Supabase Backend (Postgres, Auth, Storage, Realtime)
    |
    v
Edge Functions (supabase/functions/)
```

### Singleton Pattern

All services export singleton instances for application-wide use:

| Service | Singleton Export | Module |
|---------|-----------------|--------|
| Supabase Client | `supabase` | `api/supabaseClient` |
| Auth Service | `authService` | `api/authService` |
| Mood API | `moodApi` | `api/moodApi` |
| Mood Sync | `moodSyncService` | `api/moodSyncService` |
| Interaction Service | `interactionService` | `api/interactionService` |
| Partner Service | `partnerService` | `api/partnerService` |
| Mood Service (IndexedDB) | `moodService` | `services/moodService` |
| Custom Message Service | `customMessageService` | `services/customMessageService` |
| Photo Storage Service | `photoStorageService` | `services/photoStorageService` |
| Scripture Reading Service | `scriptureReadingService` | `services/scriptureReadingService` |
| Realtime Service | `realtimeService` | `services/realtimeService` |

### Documents in This Section

- [Table of Contents](./table-of-contents.md) -- Detailed outline of all API reference sections
- [1. Supabase Client Configuration](./1-supabase-client-configuration.md)
  - [Client Initialization](./1-supabase-client-configuration.md#client-initialization)
  - [Exported Functions](./1-supabase-client-configuration.md#exported-functions)
    - [`supabase`](./1-supabase-client-configuration.md#supabase)
    - [`getPartnerId()`](./1-supabase-client-configuration.md#getpartnerid)
    - [`getPartnerDisplayName()`](./1-supabase-client-configuration.md#getpartnerdisplayname)
    - [`isSupabaseConfigured()`](./1-supabase-client-configuration.md#issupbaseconfigured)
- [2. Authentication API](./2-authentication-api.md)
  - [Types](./2-authentication-api.md#types) -- AuthCredentials, AuthResult, AuthStatus
  - [Methods](./2-authentication-api.md#methods)
    - [`signIn(credentials)`](./2-authentication-api.md#signcredentials)
    - [`signUp(credentials)`](./2-authentication-api.md#signupcredentials)
    - [`signOut()`](./2-authentication-api.md#signout)
    - [`getSession()`](./2-authentication-api.md#getsession)
    - [`getUser()`](./2-authentication-api.md#getuser)
    - [`getCurrentUserId()`](./2-authentication-api.md#getcurrentuserid)
    - [`getCurrentUserIdOfflineSafe()`](./2-authentication-api.md#getcurrentuseridofflinesafe)
    - [`getAuthStatus()`](./2-authentication-api.md#getauthstatus)
    - [`onAuthStateChange(callback)`](./2-authentication-api.md#onauthstatechangecallback)
    - [`resetPassword(email)`](./2-authentication-api.md#resetpasswordemail)
    - [`signInWithGoogle()`](./2-authentication-api.md#signinwithgoogle)
- [3. Mood API](./3-mood-api.md)
  - [Custom Error Class](./3-mood-api.md#custom-error-class) -- ApiValidationError
  - [Methods](./3-mood-api.md#methods)
    - [`create(moodData)`](./3-mood-api.md#createmooddata)
    - [`fetchByUser(userId, limit?)`](./3-mood-api.md#fetchbyuseruserid-limit)
    - [`fetchByDateRange(userId, startDate, endDate)`](./3-mood-api.md#fetchbydaterangeuserid-startdate-enddate)
    - [`fetchById(moodId)`](./3-mood-api.md#fetchbyidmoodid)
    - [`update(moodId, updates)`](./3-mood-api.md#updatemoodid-updates)
    - [`delete(moodId)`](./3-mood-api.md#deletemoodid)
    - [`getMoodHistory(userId, offset?, limit?)`](./3-mood-api.md#getmoodhistoryuserid-offset-limit)
- [4. Mood Sync Service](./4-mood-sync-service.md)
  - [Types](./4-mood-sync-service.md#types) -- SyncResult
  - [Methods](./4-mood-sync-service.md#methods)
    - [`syncMood(mood)`](./4-mood-sync-service.md#syncmoodmood)
    - [`syncPendingMoods()`](./4-mood-sync-service.md#syncpendingmoods)
    - [`subscribeMoodUpdates(callback, onStatusChange?)`](./4-mood-sync-service.md#subscribemoodupdatescallback-onstatuschange)
    - [`fetchMoods(userId, limit?)`](./4-mood-sync-service.md#fetchmoodsuserid-limit)
    - [`getLatestPartnerMood(userId)`](./4-mood-sync-service.md#getlatestpartnermooduserid)
- [5. Interaction API](./5-interaction-api.md)
  - [Types](./5-interaction-api.md#types) -- InteractionType, Interaction
  - [Methods](./5-interaction-api.md#methods)
    - [`sendPoke(partnerId)`](./5-interaction-api.md#sendpokepartnerid)
    - [`sendKiss(partnerId)`](./5-interaction-api.md#sendkisspartnerid)
    - [`subscribeInteractions(callback)`](./5-interaction-api.md#subscribeinteractionscallback)
    - [`getInteractionHistory(limit?, offset?)`](./5-interaction-api.md#getinteractionhistorylimit-offset)
    - [`getUnviewedInteractions()`](./5-interaction-api.md#getunviewedinteractions)
    - [`markAsViewed(interactionId)`](./5-interaction-api.md#markasviewedinteractionid)
- [6. Partner Service](./6-partner-service.md)
  - [Types](./6-partner-service.md#types) -- UserSearchResult, PartnerInfo, PartnerRequest
  - [Methods](./6-partner-service.md#methods)
    - [`getPartner()`](./6-partner-service.md#getpartner)
    - [`searchUsers(query, limit?)`](./6-partner-service.md#searchusersquery-limit)
    - [`sendPartnerRequest(toUserId)`](./6-partner-service.md#sendpartnerrequesttouserid)
    - [`getPendingRequests()`](./6-partner-service.md#getpendingrequests)
    - [`acceptPartnerRequest(requestId)`](./6-partner-service.md#acceptpartnerrequestrequestid)
    - [`declinePartnerRequest(requestId)`](./6-partner-service.md#declinepartnerrequestrequestid)
    - [`hasPartner()`](./6-partner-service.md#haspartner)
- [7. Error Handling](./7-error-handling.md)
  - [Error Classes](./7-error-handling.md#error-classes) -- SupabaseServiceError
  - [Utility Functions](./7-error-handling.md#utility-functions)
    - [`isOnline()`](./7-error-handling.md#isonline)
    - [`handleSupabaseError(error, context?)`](./7-error-handling.md#handlesupabaseerrorerror-context)
    - [`handleNetworkError(error, context?)`](./7-error-handling.md#handlenetworkerrorerror-context)
    - [`isPostgrestError(error)`](./7-error-handling.md#ispostgresterrorerror)
    - [`isSupabaseServiceError(error)`](./7-error-handling.md#issupabaseserviceerrorerror)
    - [`logSupabaseError(context, error)`](./7-error-handling.md#logsupabaseerrorcontext-error)
    - [`retryWithBackoff(operation, config?)`](./7-error-handling.md#retrywithbackoffoperation-config)
    - [`createOfflineMessage(operation)`](./7-error-handling.md#createofflinemessageoperation)
- [8. Validation Schemas](./8-validation-schemas.md)
  - [Common Schemas](./8-validation-schemas.md#common-schemas) -- UUIDSchema, TimestampSchema
  - [Entity Schemas](./8-validation-schemas.md#entity-schemas)
    - [User Schemas](./8-validation-schemas.md#user-schemas)
    - [Mood Schemas](./8-validation-schemas.md#mood-schemas)
    - [Interaction Schemas](./8-validation-schemas.md#interaction-schemas)
    - [Message and Photo Schemas (placeholder)](./8-validation-schemas.md#message--photo-schemas-placeholder)
  - [Array Schemas](./8-validation-schemas.md#array-schemas)
  - [Exported Types](./8-validation-schemas.md#exported-types)
- [9. Service Layer](./9-service-layer.md)
  - [9.1 BaseIndexedDBService](./9-service-layer.md#91-baseindexeddbservice)
  - [9.2 Database Schema](./9-service-layer.md#92-database-schema)
  - [9.3 StorageService](./9-service-layer.md#93-storageservice) -- Legacy direct IndexedDB operations
  - [9.4 PhotoService (Supabase Storage)](./9-service-layer.md#94-photoservice-supabase-storage)
  - [9.5 PhotoStorageService (IndexedDB)](./9-service-layer.md#95-photostorageservice-indexeddb)
  - [9.6 CustomMessageService](./9-service-layer.md#96-custommessageservice)
  - [9.7 MoodService (IndexedDB)](./9-service-layer.md#97-moodservice-indexeddb)
  - [9.8 ScriptureReadingService](./9-service-layer.md#98-scripturereadingservice) -- Cache-first read, write-through pattern
  - [9.9 LoveNoteImageService](./9-service-layer.md#99-lovenoteimageservice) -- Signed URL management
  - [9.10 ImageCompressionService](./9-service-layer.md#910-imagecompressionservice)
  - [9.11 SyncService](./9-service-layer.md#911-syncservice) -- IndexedDB-to-Supabase batch sync
  - [9.12 PerformanceMonitor](./9-service-layer.md#912-performancemonitor)
- [10. Edge Functions](./10-edge-functions.md)
  - [`upload-love-note-image`](./10-edge-functions.md#upload-love-note-image) -- Server-side image validation
    - [Request](./10-edge-functions.md#request)
    - [Configuration](./10-edge-functions.md#configuration)
    - [Validation Pipeline](./10-edge-functions.md#validation-pipeline)
    - [Response](./10-edge-functions.md#response)
- [11. Service Worker](./11-service-worker.md)
  - [Main Service Worker](./11-service-worker.md#main-service-worker) (`src/sw.ts`)
    - [Caching Strategy](./11-service-worker.md#caching-strategy)
    - [Background Sync](./11-service-worker.md#background-sync)
    - [Message Handler](./11-service-worker.md#message-handler)
  - [Service Worker Database Helpers](./11-service-worker.md#service-worker-database-helpers) (`src/sw-db.ts`)
- [12. Real-time Subscriptions](./12-real-time-subscriptions.md)
  - [Architecture](./12-real-time-subscriptions.md#architecture) -- Broadcast API vs postgres_changes
  - [RealtimeService Methods](./12-real-time-subscriptions.md#realtimeservice-methods)
    - [`subscribeMoodChanges(userId, onMoodChange, onError?)`](./12-real-time-subscriptions.md#subscribemoodchangesuserid-onmoodchange-onerror)
    - [`unsubscribe(channelId)`](./12-real-time-subscriptions.md#unsubscribechannelid)
    - [`unsubscribeAll()`](./12-real-time-subscriptions.md#unsubscribeall)
    - [`setErrorHandler(callback)`](./12-real-time-subscriptions.md#seterrorhandlercallback)
    - [`getActiveSubscriptions()`](./12-real-time-subscriptions.md#getactivesubscriptions)
  - [Mood Broadcast Flow](./12-real-time-subscriptions.md#mood-broadcast-flow)
  - [Interaction Realtime Flow](./12-real-time-subscriptions.md#interaction-realtime-flow)

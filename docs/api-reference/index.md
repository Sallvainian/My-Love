# API Reference

Complete reference documentation for the My Love application API layer.

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React | 19.2.4 |
| Language | TypeScript | 5.9.3 |
| Build | Vite | 7.3.1 |
| Backend | Supabase (Auth, Postgres, Storage, Realtime, Edge Functions) | supabase-js 2.93.3 |
| Validation | Zod | 4.3.6 (imported as `zod/v4`) |
| Offline Storage | IndexedDB via `idb` | 8.0.3 |
| Service Worker | Workbox (InjectManifest) | -- |

## Architecture Overview

```
UI Components (React 19 + Zustand Sliced Store)
    |
    v
API Services (src/api/)              Service Layer (src/services/)
  - authService (facade)               - BaseIndexedDBService (abstract)
  - moodApi (validated CRUD)            - moodService (IndexedDB)
  - moodSyncService (sync + broadcast)  - customMessageService (IndexedDB)
  - interactionService (poke/kiss)       - photoStorageService (IndexedDB)
  - partnerService (connections)         - scriptureReadingService (cache-first)
  - errorHandlers (retry, mapping)       - realtimeService (channel mgmt)
  - validation/supabaseSchemas           - syncService (batch sync)
    |                                    - imageCompressionService
    v                                    - loveNoteImageService
Supabase Client (singleton, typed)       - photoService (Supabase Storage)
    |
    v
Supabase Backend                     Edge Functions (Deno)
  - Postgres with RLS                  - upload-love-note-image
  - Auth (email, Google OAuth)
  - Storage (photos, love-note-images)
  - Realtime (Broadcast + postgres_changes)
```

## Singleton Exports

All services use the singleton pattern. Import the instance, not the class:

| Singleton | Import Path |
|-----------|-------------|
| `supabase` | `src/api/supabaseClient` |
| `authService` | `src/api/authService` |
| `moodApi` | `src/api/moodApi` |
| `moodSyncService` | `src/api/moodSyncService` |
| `interactionService` | `src/api/interactionService` |
| `partnerService` | `src/api/partnerService` |
| `moodService` | `src/services/moodService` |
| `customMessageService` | `src/services/customMessageService` |
| `photoStorageService` | `src/services/photoStorageService` |
| `imageCompressionService` | `src/services/imageCompressionService` |
| `photoService` | `src/services/photoService` |
| `realtimeService` | `src/services/realtimeService` |
| `syncService` | `src/services/syncService` |

## Documents

| # | Document | Description |
|---|----------|-------------|
| 1 | [Supabase Client Configuration](./1-supabase-client-configuration.md) | Singleton client, env vars, partner helpers |
| 2 | [Authentication Service](./2-authentication-service.md) | Sign-in/up, OAuth, session management, token storage |
| 3 | [Error Handling Utilities](./3-error-handling-utilities.md) | Error classes, retry logic, network detection, error mapping |
| 4 | [Mood API Service](./4-mood-api-service.md) | Validated Supabase CRUD for mood entries |
| 5 | [Mood Sync Service](./5-mood-sync-service.md) | IndexedDB-to-Supabase sync with Broadcast API |
| 6 | [Interaction Service](./6-interaction-service.md) | Poke/kiss interactions with Realtime subscriptions |
| 7 | [Partner Service](./7-partner-service.md) | User search, partner requests, connection management |
| 8 | [IndexedDB Services](./8-indexeddb-services.md) | BaseIndexedDBService, mood, photo, message, scripture CRUD |
| 9 | [Photo Services](./9-photo-services.md) | Cloud storage, local storage, compression, love note images |
| 10 | [Validation Layer](./10-validation-layer.md) | Zod schemas, error formatting, custom error classes |
| 11 | [Service Worker & Background Sync](./11-service-worker-background-sync.md) | Workbox caching, background mood sync, SW-DB helpers |
| 12 | [Real-Time Subscriptions](./12-real-time-subscriptions.md) | Broadcast API, postgres_changes, channel management |

## Source File Map

```
src/api/
  supabaseClient.ts          -> Doc 1
  authService.ts             -> Doc 2
  auth/actionService.ts      -> Doc 2
  auth/sessionService.ts     -> Doc 2
  auth/types.ts              -> Doc 2
  errorHandlers.ts           -> Doc 3
  moodApi.ts                 -> Doc 4
  moodSyncService.ts         -> Doc 5
  interactionService.ts      -> Doc 6
  partnerService.ts          -> Doc 7
  validation/supabaseSchemas.ts -> Doc 10

src/services/
  BaseIndexedDBService.ts    -> Doc 8
  dbSchema.ts                -> Doc 8
  moodService.ts             -> Doc 8
  customMessageService.ts    -> Doc 8
  photoStorageService.ts     -> Doc 9
  photoService.ts            -> Doc 9
  imageCompressionService.ts -> Doc 9
  loveNoteImageService.ts    -> Doc 9
  syncService.ts             -> Doc 5
  realtimeService.ts         -> Doc 12

src/validation/
  schemas.ts                 -> Doc 10
  errorMessages.ts           -> Doc 10

src/sw.ts                    -> Doc 11
src/sw-db.ts                 -> Doc 11

supabase/functions/upload-love-note-image/index.ts -> Doc 9
```

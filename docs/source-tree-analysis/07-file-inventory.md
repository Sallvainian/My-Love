# File Inventory

Complete file counts, line counts, and quick reference for the entire codebase.

## Summary

| Category                                 | Files   | Lines       |
| ---------------------------------------- | ------- | ----------- |
| Source (non-test `.ts`/`.tsx` in `src/`) | 178     | ~35,943     |
| Tests in `src/` (`__tests__/`, `.test.`) | 29      | ~9,159      |
| Unit tests in `tests/unit/`              | 27      | --          |
| E2E tests in `tests/e2e/`                | 28      | --          |
| API tests in `tests/api/`                | 4       | --          |
| SQL migrations                           | 25      | --          |
| pgTAP database tests                     | 14      | --          |
| GitHub Actions workflows                 | 19      | --          |
| **Total TypeScript/TSX in `src/`**       | **197** | **~43,133** |

## Source Files by Directory

Sorted by total lines (excluding test files colocated in `src/`):

| Directory                                      | Files | Lines | Description                                                |
| ---------------------------------------------- | ----- | ----- | ---------------------------------------------------------- |
| `src/services/`                                | 14    | 4,589 | IndexedDB services, sync, image compression, photo storage |
| `src/stores/slices/`                           | 11    | 3,518 | Zustand slice implementations (includes authSlice)         |
| `src/api/`                                     | 8     | 2,131 | Supabase API services (mood, interaction, partner)         |
| `src/components/scripture-reading/containers/` | 6     | 2,016 | Scripture reading main containers                          |
| `src/utils/`                                   | 16    | 1,982 | Utility functions (date, mood, validation, sync)           |
| `src/data/`                                    | 3     | 1,872 | Default messages (1,677 lines), scripture steps            |
| `src/hooks/`                                   | 15    | 1,719 | React hooks (realtime, auth, mood, photos)                 |
| `src/components/love-notes/`                   | 7     | 1,415 | Love notes chat UI                                         |
| `src/` (root)                                  | 6     | 1,414 | App.tsx (610), sw.ts (261), sw-db.ts (173), main.tsx (47)  |
| `src/components/MoodTracker/`                  | 6     | 1,124 | Mood tracking UI                                           |
| `src/components/AdminPanel/`                   | 6     | 1,054 | Admin message management                                   |
| `src/types/`                                   | 3     | 1,020 | Core types, database types (auto-generated), models        |
| `src/components/PhotoGallery/`                 | 4     | 1,007 | Photo gallery and viewer                                   |
| `src/components/scripture-reading/hooks/`      | 5     | 954   | Solo reading flow decomposed hooks (2026-03-13 refactor)   |
| `src/components/scripture-reading/reflection/` | 3     | 678   | Scripture reflection components                            |
| `src/components/MoodHistory/`                  | 4     | 670   | Calendar-based mood history                                |
| `src/components/PartnerMoodView/`              | 2     | 663   | Partner mood display with interactions                     |
| `src/components/PokeKissInterface/`            | 2     | 582   | Poke/kiss/fart interactions                                |
| `src/components/Settings/`                     | 3     | 575   | App settings and anniversary config                        |
| `src/validation/`                              | 3     | 568   | Zod schemas, error messages                                |
| `src/components/RelationshipTimers/`           | 5     | 493   | Time together, birthday, event countdowns                  |
| `src/components/photos/`                       | 1     | 482   | Photo uploader component                                   |
| `src/components/PhotoUpload/`                  | 1     | 456   | Photo upload modal                                         |
| `src/config/`                                  | 5     | 448   | Performance, images, sentry, constants, dates              |
| `src/components/DailyMessage/`                 | 1     | 376   | Daily love message display                                 |
| `src/components/scripture-reading/session/`    | 3     | 373   | Countdown, disconnect overlay, lock-in                     |
| `src/components/shared/`                       | 3     | 366   | Network indicator, sync toast                              |
| `src/stores/` (root)                           | 2     | 357   | useAppStore (290), types (67)                              |
| `src/api/validation/`                          | 1     | 295   | Supabase response schemas                                  |
| `src/api/auth/`                                | 3     | 271   | Auth actions, sessions, types                              |

## Largest Source Files

| File                                                                | Lines | Category               |
| ------------------------------------------------------------------- | ----- | ---------------------- |
| `src/data/defaultMessages.ts`                                       | 1,677 | Data                   |
| `src/stores/slices/scriptureReadingSlice.ts`                        | 1,021 | Store                  |
| `src/services/scriptureReadingService.ts`                           | 958   | Service                |
| `src/types/database.types.ts`                                       | 686   | Types (auto-generated) |
| `src/components/PartnerMoodView/PartnerMoodView.tsx`                | 662   | Component              |
| `src/App.tsx`                                                       | 610   | Entry point            |
| `src/stores/slices/notesSlice.ts`                                   | 608   | Store                  |
| `src/components/PokeKissInterface/PokeKissInterface.tsx`            | 581   | Component              |
| `src/components/MoodTracker/MoodTracker.tsx`                        | 572   | Component              |
| `src/stores/slices/messagesSlice.ts`                                | 527   | Store                  |
| `src/services/photoService.ts`                                      | 527   | Service                |
| `src/components/scripture-reading/containers/ScriptureOverview.tsx` | 521   | Component              |
| `src/components/PhotoGallery/PhotoViewer.tsx`                       | 519   | Component              |
| `src/components/scripture-reading/hooks/useReportPhase.ts`          | 501   | Hook                   |
| `src/components/photos/PhotoUploader.tsx`                           | 482   | Component              |
| `src/api/moodApi.ts`                                                | 480   | API                    |
| `src/api/moodSyncService.ts`                                        | 458   | API                    |
| `src/components/PhotoUpload/PhotoUpload.tsx`                        | 456   | Component              |
| `src/components/scripture-reading/containers/ReadingContainer.tsx`  | 443   | Component              |
| `src/components/scripture-reading/containers/ReadingPhaseView.tsx`  | 411   | Component              |
| `src/components/love-notes/MessageList.tsx`                         | 410   | Component              |

## Largest Test Files

| File                                                                    | Lines | Type |
| ----------------------------------------------------------------------- | ----- | ---- |
| `src/components/scripture-reading/__tests__/SoloReadingFlow.test.tsx`   | 1,714 | Unit |
| `src/components/scripture-reading/__tests__/ScriptureOverview.test.tsx` | 761   | Unit |
| `src/components/love-notes/__tests__/LoveNoteMessage.test.tsx`          | 549   | Unit |
| `src/components/scripture-reading/__tests__/ReflectionSummary.test.tsx` | 496   | Unit |
| `src/components/love-notes/__tests__/MessageInput.test.tsx`             | 454   | Unit |
| `src/services/__tests__/loveNoteImageService.test.ts`                   | 397   | Unit |
| `src/utils/__tests__/backgroundSync.test.ts`                            | 387   | Unit |
| `src/hooks/__tests__/useRealtimeMessages.test.ts`                       | 373   | Unit |
| `src/hooks/__tests__/useNetworkStatus.test.ts`                          | 343   | Unit |

## File Type Distribution

| Extension | Count | Description                                         |
| --------- | ----- | --------------------------------------------------- |
| `.tsx`    | 82    | React components with JSX (66 non-test)             |
| `.ts`     | 115   | TypeScript modules (services, utils, types, config) |
| `.sql`    | 39    | Database migrations (25) + pgTAP tests (14)         |
| `.yml`    | 9     | GitHub Actions workflow definitions                 |
| `.md`     | 100+  | Documentation files                                 |

Totals for `src/`: **197** `.ts`/`.tsx` files (43,133 lines), of which **168 are non-test** (33,974 lines) and 29 are co-located tests. Plus 4 `.css` files.

## Component Count by Feature

| Feature Area        | Components | Containers | Hooks                                                     |
| ------------------- | ---------- | ---------- | --------------------------------------------------------- |
| Scripture Reading   | 10         | 6          | 8 (broadcast, presence, 5 decomposed hooks, motionConfig) |
| Love Notes          | 5          | 0          | 2 (useLoveNotes, useRealtimeMessages)                     |
| Mood Tracking       | 6          | 0          | 3 (useMoodHistory, usePartnerMood, useAuth)               |
| Photos              | 8          | 0          | 1 (usePhotos)                                             |
| Admin Panel         | 5          | 0          | 0                                                         |
| Relationship Timers | 4          | 0          | 0                                                         |
| Settings            | 2          | 0          | 0                                                         |
| Navigation          | 1          | 0          | 1 (useNetworkStatus)                                      |
| Shared              | 3          | 0          | 0                                                         |

## Store Slice Sizes

| Slice                      | Lines | Actions | Key Responsibility                |
| -------------------------- | ----- | ------- | --------------------------------- |
| `scriptureReadingSlice.ts` | 1,013 | 25      | Scripture session state machine   |
| `notesSlice.ts`            | 608   | 11      | Love notes CRUD, rate limiting    |
| `messagesSlice.ts`         | 527   | 15      | Daily messages, favorites, custom |
| `moodSlice.ts`             | 346   | 8       | Mood tracking, partner sync       |
| `settingsSlice.ts`         | 258   | 7       | Init, theme, relationship config  |
| `interactionsSlice.ts`     | 253   | 8       | Poke/kiss interactions            |
| `photosSlice.ts`           | 208   | 8       | Photo gallery state               |
| `partnerSlice.ts`          | 141   | 8       | Partner data, requests, search    |
| `navigationSlice.ts`       | 85    | 7       | View routing                      |
| `authSlice.ts`             | 50    | 2       | User identity, isAuthenticated    |
| `appSlice.ts`              | 28    | 3       | Loading, error, hydration flag    |

## Service Layer Sizes

| Service                      | Lines | Storage          | Key Operations                                 |
| ---------------------------- | ----- | ---------------- | ---------------------------------------------- |
| `scriptureReadingService.ts` | 962   | IDB + Supabase   | Session CRUD, reflections, bookmarks, messages |
| `photoService.ts`            | 524   | Supabase Storage | Upload, fetch, delete, signed URLs             |
| `moodApi.ts` (API)           | 478   | Supabase         | Validated CRUD, pagination, date-range fetch   |
| `moodSyncService.ts` (API)   | 451   | Supabase         | Upward sync with backoff, mood broadcast       |
| `interactionService.ts` (API)| 346   | Supabase         | Poke/kiss send, postgres_changes subscription  |
| `partnerService.ts` (API)    | 340   | Supabase         | Search, requests, accept/decline               |
| `storage.ts`                 | 337   | IDB              | Legacy message + photo storage operations      |
| `loveNoteImageService.ts`    | 309   | Supabase Storage | Edge Function upload, signed URL LRU cache     |
| `BaseIndexedDBService.ts`    | 307   | IDB              | Abstract CRUD base class                       |
| `customMessageService.ts`    | 300   | IDB              | Custom message CRUD, import/export             |
| `supabaseSchemas.ts` (API)   | 295   | --               | Zod schemas for Supabase responses             |
| `dbSchema.ts`                | 272   | IDB              | Schema v5, 8 object stores, `upgradeDb()`      |
| `moodService.ts`             | 256   | IDB              | Local mood CRUD                                |
| `imageCompressionService.ts` | 203   | --               | Canvas-based image resize                      |
| `supabaseClient.ts` (API)    | 158   | --               | Singleton client, partner helpers              |
| `errorHandlers.ts` (API)     | 155   | --               | Postgrest/network error mapping                |
| `migrationService.ts`        | 149   | IDB              | localStorage -> IndexedDB migration            |

**Deleted in the dead-code sweep:** `syncService.ts` (217), `realtimeService.ts` (151), `performanceMonitor.ts` (142), `photoStorageService.ts` (334), `realtimeChannel.ts` (50), `useImageCompression.ts` (87), `validation/index.ts` (37), `RelationshipTimers.tsx`, plus the `CountdownTimer/index.ts` and `Settings/index.ts` barrels.

## Related Documentation

- [Technology Stack Summary](./01-technology-stack-summary.md)
- [Directory Tree](./02-directory-tree.md)
- [Dependency Graph](./06-dependency-graph.md)

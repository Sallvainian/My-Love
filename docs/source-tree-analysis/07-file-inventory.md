# File Inventory

Complete file counts, line counts, and quick reference for the entire codebase.

## Summary

| Category                                 | Files   | Lines       |
| ---------------------------------------- | ------- | ----------- |
| Source (non-test `.ts`/`.tsx` in `src/`) | 168     | ~38,500     |
| Tests in `src/` (`__tests__/`, `.test.`) | 29      | ~6,550      |
| Unit tests in `tests/unit/`              | 27      | --          |
| E2E tests in `tests/e2e/`                | 27      | --          |
| SQL migrations                           | 23      | --          |
| pgTAP database tests                     | 14      | --          |
| GitHub Actions workflows                 | 18      | --          |
| **Total TypeScript/TSX in `src/`**       | **197** | **~45,050** |

## Source Files by Directory

Sorted by total lines (excluding test files colocated in `src/`):

| Directory                                      | Files | Lines | Description                                                |
| ---------------------------------------------- | ----- | ----- | ---------------------------------------------------------- |
| `src/services/`                                | 14    | 4,714 | IndexedDB services, sync, image compression, photo storage |
| `src/stores/slices/`                           | 10    | 3,563 | Zustand slice implementations                              |
| `src/components/scripture-reading/containers/` | 4     | 2,665 | Scripture reading main containers                          |
| `src/api/`                                     | 7     | 2,128 | Supabase API services (mood, interaction, partner)         |
| `src/utils/`                                   | 17    | 2,007 | Utility functions (date, mood, validation, sync)           |
| `src/data/`                                    | 3     | 1,872 | Default messages (1,677 lines), scripture steps            |
| `src/hooks/`                                   | 14    | 1,668 | React hooks (realtime, auth, mood, photos)                 |
| `src/components/love-notes/`                   | 7     | 1,416 | Love notes chat UI                                         |
| `src/` (root)                                  | 6     | 1,253 | App.tsx (624), sw.ts (268), sw-db.ts (173), main.tsx (46)  |
| `src/components/MoodTracker/`                  | 6     | 1,128 | Mood tracking UI                                           |
| `src/components/AdminPanel/`                   | 6     | 1,054 | Admin message management                                   |
| `src/components/PhotoGallery/`                 | 4     | 1,045 | Photo gallery and viewer                                   |
| `src/types/`                                   | 3     | 1,020 | Core types, database types (auto-generated), models        |
| `src/components/MoodHistory/`                  | 4     | 721   | Calendar-based mood history                                |
| `src/components/scripture-reading/reflection/` | 3     | 681   | Scripture reflection components                            |
| `src/components/PartnerMoodView/`              | 2     | 670   | Partner mood display with interactions                     |
| `src/components/PokeKissInterface/`            | 2     | 583   | Poke/kiss/fart interactions                                |
| `src/components/Settings/`                     | 3     | 576   | App settings and anniversary config                        |
| `src/validation/`                              | 3     | 568   | Zod schemas, error messages                                |
| `src/components/RelationshipTimers/`           | 5     | 493   | Time together, birthday, event countdowns                  |
| `src/components/photos/`                       | 1     | 482   | Photo uploader component                                   |
| `src/components/PhotoUpload/`                  | 1     | 456   | Photo upload modal                                         |
| `src/config/`                                  | 5     | 447   | Performance, images, sentry, constants, dates              |
| `src/components/DailyMessage/`                 | 1     | 375   | Daily love message display                                 |
| `src/components/scripture-reading/session/`    | 3     | 371   | Countdown, disconnect overlay, lock-in                     |
| `src/components/shared/`                       | 3     | 366   | Network indicator, sync toast                              |
| `src/stores/` (root)                           | 2     | 351   | useAppStore (286), types (65)                              |
| `src/api/auth/`                                | 3     | 287   | Auth actions, sessions, types                              |
| `src/api/validation/`                          | 1     | 295   | Supabase response schemas                                  |

## Largest Source Files

| File                                                                | Lines | Category               |
| ------------------------------------------------------------------- | ----- | ---------------------- |
| `src/data/defaultMessages.ts`                                       | 1,677 | Data                   |
| `src/components/scripture-reading/containers/SoloReadingFlow.tsx`   | 1,377 | Component              |
| `src/stores/slices/scriptureReadingSlice.ts`                        | 1,035 | Store                  |
| `src/services/scriptureReadingService.ts`                           | 965   | Service                |
| `src/types/database.types.ts`                                       | 686   | Types (auto-generated) |
| `src/components/PartnerMoodView/PartnerMoodView.tsx`                | 669   | Component              |
| `src/stores/slices/notesSlice.ts`                                   | 641   | Store                  |
| `src/App.tsx`                                                       | 624   | Entry point            |
| `src/components/PokeKissInterface/PokeKissInterface.tsx`            | 582   | Component              |
| `src/components/MoodTracker/MoodTracker.tsx`                        | 576   | Component              |
| `src/components/PhotoGallery/PhotoViewer.tsx`                       | 558   | Component              |
| `src/stores/slices/messagesSlice.ts`                                | 547   | Store                  |
| `src/services/photoService.ts`                                      | 540   | Service                |
| `src/components/scripture-reading/containers/ScriptureOverview.tsx` | 529   | Component              |
| `src/api/moodSyncService.ts`                                        | 485   | API                    |
| `src/components/photos/PhotoUploader.tsx`                           | 482   | Component              |
| `src/api/moodApi.ts`                                                | 480   | API                    |
| `src/components/scripture-reading/containers/ReadingContainer.tsx`  | 480   | Component              |
| `src/components/PhotoUpload/PhotoUpload.tsx`                        | 456   | Component              |
| `src/components/love-notes/MessageList.tsx`                         | 404   | Component              |

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
| `.tsx`    | 86    | React components with JSX                           |
| `.ts`     | 111   | TypeScript modules (services, utils, types, config) |
| `.sql`    | 37    | Database migrations (23) + pgTAP tests (14)         |
| `.yml`    | 18    | GitHub Actions workflow definitions                 |
| `.md`     | 30+   | Documentation files                                 |

## Component Count by Feature

| Feature Area        | Components | Containers | Hooks                                       |
| ------------------- | ---------- | ---------- | ------------------------------------------- |
| Scripture Reading   | 10         | 4          | 3 (broadcast, presence, motionConfig)       |
| Love Notes          | 5          | 0          | 2 (useLoveNotes, useRealtimeMessages)       |
| Mood Tracking       | 6          | 0          | 3 (useMoodHistory, usePartnerMood, useAuth) |
| Photos              | 8          | 0          | 2 (usePhotos, useImageCompression)          |
| Admin Panel         | 5          | 0          | 0                                           |
| Relationship Timers | 4          | 0          | 0                                           |
| Settings            | 2          | 0          | 0                                           |
| Navigation          | 1          | 0          | 1 (useNetworkStatus)                        |
| Shared              | 3          | 0          | 0                                           |

## Store Slice Sizes

| Slice                      | Lines | Actions | Key Responsibility                |
| -------------------------- | ----- | ------- | --------------------------------- |
| `scriptureReadingSlice.ts` | 1,035 | 15+     | Scripture session state machine   |
| `notesSlice.ts`            | 641   | 8       | Love notes CRUD, rate limiting    |
| `messagesSlice.ts`         | 547   | 10      | Daily messages, favorites, custom |
| `moodSlice.ts`             | 364   | 6       | Mood tracking, partner sync       |
| `settingsSlice.ts`         | 257   | 3       | Init, theme, relationship config  |
| `interactionsSlice.ts`     | 257   | 4       | Poke/kiss/fart interactions       |
| `photosSlice.ts`           | 209   | 5       | Photo gallery state               |
| `partnerSlice.ts`          | 141   | 3       | Partner data, display name        |
| `navigationSlice.ts`       | 84    | 2       | View routing                      |
| `appSlice.ts`              | 28    | 1       | Loading state                     |

## Service Layer Sizes

| Service                       | Lines | Storage          | Key Operations                                 |
| ----------------------------- | ----- | ---------------- | ---------------------------------------------- |
| `scriptureReadingService.ts`  | 965   | IDB + Supabase   | Session CRUD, reflections, bookmarks, messages |
| `photoService.ts`             | 540   | Supabase Storage | Upload, fetch, delete, signed URLs             |
| `moodSyncService.ts` (API)    | 485   | Supabase         | Bidirectional sync, conflict resolution        |
| `moodApi.ts` (API)            | 480   | Supabase         | CRUD, pagination, partner mood fetch           |
| `loveNoteImageService.ts`     | 402   | Supabase Storage | Image upload/download for notes                |
| `interactionService.ts` (API) | 373   | Supabase         | Send/fetch interactions                        |
| `storage.ts`                  | 373   | IDB              | Message storage operations                     |
| `photoStorageService.ts`      | 355   | IDB              | Local photo blob caching                       |
| `partnerService.ts` (API)     | 345   | Supabase         | Partner lookup, stats                          |
| `BaseIndexedDBService.ts`     | 324   | IDB              | Abstract CRUD base class                       |
| `customMessageService.ts`     | 316   | IDB              | Custom message CRUD                            |
| `dbSchema.ts`                 | 299   | IDB              | Schema v5, 8 object stores, migrations         |
| `moodService.ts`              | 270   | IDB              | Local mood CRUD                                |
| `syncService.ts`              | 222   | IDB + Supabase   | Mood sync coordination                         |
| `imageCompressionService.ts`  | 202   | --               | Canvas-based image resize                      |

## Related Documentation

- [Technology Stack Summary](./01-technology-stack-summary.md)
- [Directory Tree](./02-directory-tree.md)
- [Dependency Graph](./06-dependency-graph.md)

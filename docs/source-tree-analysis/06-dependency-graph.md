# Dependency Graph

Module-level dependency relationships across the codebase. Arrows indicate "imports from" direction.

## Layer Architecture

```
               +------------------+
               |    main.tsx      |
               +--------+---------+
                        |
               +--------v---------+
               |     App.tsx      |
               +--------+---------+
                        |
        +---------------+---------------+
        |               |               |
+-------v------+ +------v------+ +-----v-------+
|  Components  | |    Hooks    | |   Stores    |
+--------------+ +------+------+ +------+------+
        |               |               |
        +-------+-------+-------+-------+
                |               |
         +------v------+ +-----v-------+
         |   Services  | |     API     |
         +------+------+ +------+------+
                |               |
         +------v------+ +-----v-------+
         |  Validation | |    Config   |
         +------+------+ +------+------+
                |               |
                +-------+-------+
                        |
                +-------v-------+
                |     Types     |
                +---------------+
```

## Core Infrastructure Dependencies

### Entry Points

```
main.tsx
  -> config/sentry.ts
  -> App.tsx

App.tsx
  -> stores/useAppStore.ts
  -> api/auth/actionService.ts
  -> api/auth/sessionService.ts
  -> api/supabaseClient.ts
  -> config/sentry.ts
  -> config/relationshipDates.ts
  -> utils/themes.ts
  -> utils/storageMonitor.ts
  -> utils/backgroundSync.ts
  -> services/migrationService.ts
  -> components/shared/ (NetworkStatusIndicator, SyncToast)
  -> components/DailyMessage/
  -> components/ErrorBoundary/
  -> components/ViewErrorBoundary/
  -> components/Navigation/BottomNavigation
  -> components/RelationshipTimers/
  -> components/LoginScreen/
  -> components/DisplayNameSetup/
```

### Zustand Store

```
stores/useAppStore.ts
  -> stores/types.ts
  -> stores/slices/appSlice.ts
  -> stores/slices/messagesSlice.ts
  -> stores/slices/photosSlice.ts
  -> stores/slices/settingsSlice.ts
  -> stores/slices/navigationSlice.ts
  -> stores/slices/moodSlice.ts
  -> stores/slices/interactionsSlice.ts
  -> stores/slices/partnerSlice.ts
  -> stores/slices/notesSlice.ts
  -> stores/slices/scriptureReadingSlice.ts

stores/types.ts
  -> (all 10 slice files for type extraction)
```

### Slice Dependencies

```
settingsSlice.ts
  -> services/storage.ts
  -> data/defaultMessagesLoader.ts
  -> config/constants.ts
  -> validation/schemas.ts
  -> validation/errorMessages.ts

messagesSlice.ts
  -> services/storage.ts
  -> services/customMessageService.ts
  -> utils/messageRotation.ts

moodSlice.ts
  -> services/moodService.ts
  -> api/moodSyncService.ts
  -> api/supabaseClient.ts
  -> api/auth/sessionService.ts

notesSlice.ts
  -> api/supabaseClient.ts
  -> api/auth/sessionService.ts
  -> services/imageCompressionService.ts
  -> services/loveNoteImageService.ts
  -> config/images.ts

scriptureReadingSlice.ts
  -> services/scriptureReadingService.ts
  -> api/supabaseClient.ts
  -> data/scriptureSteps.ts

interactionsSlice.ts
  -> api/interactionService.ts
  -> api/auth/sessionService.ts
  -> utils/interactionValidation.ts

partnerSlice.ts
  -> api/partnerService.ts

photosSlice.ts
  -> services/photoService.ts
  -> api/supabaseClient.ts

navigationSlice.ts
  -> (types only)

appSlice.ts
  -> (types only)
```

## Service Layer Dependencies

### IndexedDB Services

```
BaseIndexedDBService.ts
  -> (no internal imports -- abstract base class)

moodService.ts
  -> BaseIndexedDBService.ts
  -> services/dbSchema.ts
  -> validation/schemas.ts
  -> validation/errorMessages.ts

customMessageService.ts
  -> BaseIndexedDBService.ts
  -> services/dbSchema.ts
  -> config/performance.ts

photoStorageService.ts
  -> BaseIndexedDBService.ts
  -> services/dbSchema.ts
  -> validation/schemas.ts
  -> validation/errorMessages.ts
  -> config/performance.ts
  -> services/performanceMonitor.ts

scriptureReadingService.ts
  -> BaseIndexedDBService.ts
  -> api/supabaseClient.ts
  -> api/validation/supabaseSchemas.ts
  -> stores/types.ts

storage.ts (message storage)
  -> services/dbSchema.ts
```

### API Services

```
supabaseClient.ts
  -> types/database.types.ts

moodApi.ts
  -> supabaseClient.ts

moodSyncService.ts
  -> supabaseClient.ts
  -> moodApi.ts
  -> validation/supabaseSchemas.ts
  -> errorHandlers.ts
  -> services/moodService.ts

interactionService.ts
  -> supabaseClient.ts
  -> auth/sessionService.ts

partnerService.ts
  -> supabaseClient.ts

auth/actionService.ts
  -> supabaseClient.ts
  -> sw-db.ts
  -> auth/types.ts

auth/sessionService.ts
  -> supabaseClient.ts
  -> sw-db.ts
  -> auth/types.ts
```

### Other Services

```
loveNoteImageService.ts
  -> api/supabaseClient.ts
  -> imageCompressionService.ts
  -> config/images.ts

imageCompressionService.ts
  -> config/images.ts

migrationService.ts
  -> customMessageService.ts
  -> validation/schemas.ts
  -> validation/errorMessages.ts
  -> config/performance.ts

realtimeService.ts
  -> api/supabaseClient.ts
  -> api/validation/supabaseSchemas.ts

syncService.ts
  -> moodService.ts
  -> api/moodApi.ts
  -> api/validation/supabaseSchemas.ts
```

## Service Worker Dependencies

```
sw.ts
  -> sw-db.ts

sw-db.ts
  -> services/dbSchema.ts
```

The service worker operates in a separate JS context. It duplicates IndexedDB access logic from `dbSchema.ts` via `sw-db.ts` and uses raw `fetch()` against the Supabase REST API instead of the Supabase client library.

## Hook Dependencies

```
useAuth.ts -> api/supabaseClient.ts
useAutoSave.ts -> services/dbSchema.ts
useImageCompression.ts -> services/imageCompressionService.ts
useLoveNotes.ts -> stores/useAppStore.ts, hooks/useRealtimeMessages.ts
useMoodHistory.ts -> api/moodApi.ts, api/validation/supabaseSchemas.ts
useNetworkStatus.ts -> (browser APIs only)
usePartnerMood.ts -> api/moodSyncService.ts
usePhotos.ts -> stores/useAppStore.ts, services/photoService.ts
useRealtimeMessages.ts -> stores/useAppStore.ts, api/supabaseClient.ts, api/auth/sessionService.ts
useScriptureBroadcast.ts -> api/supabaseClient.ts, stores/useAppStore.ts, services/scriptureReadingService.ts
useScripturePresence.ts -> api/supabaseClient.ts, services/scriptureReadingService.ts
useMotionConfig.ts -> (no internal imports)
useVibration.ts -> (no internal imports)
```

## Most-Imported Modules (Hub Nodes)

Ranked by number of internal importers (excluding test files):

| Module                                | Importers | Role                           |
| ------------------------------------- | --------- | ------------------------------ |
| `stores/useAppStore.ts`               | 25+       | Central state access           |
| `api/supabaseClient.ts`               | 14        | Database/auth client singleton |
| `types/index.ts`                      | 20+       | Core type definitions          |
| `types/models.ts`                     | 5         | Love note model types          |
| `services/dbSchema.ts`                | 5         | IndexedDB schema               |
| `validation/schemas.ts`               | 4         | Zod validation schemas         |
| `validation/errorMessages.ts`         | 6         | Error formatting               |
| `services/BaseIndexedDBService.ts`    | 4         | IndexedDB base class           |
| `config/images.ts`                    | 3         | Image configuration            |
| `config/performance.ts`               | 3         | Performance constants          |
| `api/auth/sessionService.ts`          | 6         | Auth session management        |
| `services/photoService.ts`            | 5         | Photo operations               |
| `services/scriptureReadingService.ts` | 4         | Scripture operations           |
| `api/validation/supabaseSchemas.ts`   | 5         | API response validation        |
| `utils/messageRotation.ts`            | 1         | Message selection              |

## Circular Dependency Analysis

No circular dependencies exist. The architecture enforces a strict unidirectional flow:

```
Components -> Hooks -> Stores -> Services -> API -> Types
                                    |
                                    v
                              Validation/Config
```

The only cross-layer pattern is stores importing from API services (slices call API functions directly in async actions), which is an intentional design choice for the slice pattern.

## External Dependency Map

Key third-party imports by module category:

| Category       | External Dependencies                                                                    |
| -------------- | ---------------------------------------------------------------------------------------- |
| Stores         | `zustand`, `zustand/middleware`                                                          |
| API            | `@supabase/supabase-js`                                                                  |
| Services       | `idb`                                                                                    |
| Validation     | `zod`                                                                                    |
| Components     | `react`, `framer-motion`, `lucide-react`, `react-window`, `react-window-infinite-loader` |
| Sanitization   | `dompurify`                                                                              |
| Monitoring     | `@sentry/react`                                                                          |
| Service Worker | `workbox-precaching`, `workbox-routing`, `workbox-strategies`, `workbox-expiration`      |

## Related Documentation

- [Critical Code Paths](./04-critical-code-paths.md)
- [Shared Modules](./05-shared-modules.md)
- [Architecture - State Management](../architecture/05-state-management-overview.md)

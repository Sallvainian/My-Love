# Architecture Pattern

## Layered Architecture

The application follows a five-layer architecture where data flows downward through well-defined boundaries:

```
UI Components (React)
    |
Custom Hooks (usePhotos, useLoveNotes, useMoodHistory, etc.)
    |
Zustand Store (10 slices composing AppState)
    |
Services (storageService, moodService, photoService, scriptureReadingService, etc.)
    |
API Layer (supabaseClient, moodSyncService, interactionService, partnerService)
    |
Backend (Supabase: PostgreSQL + Auth + Storage + Realtime)
```

## Layer Responsibilities

### 1. UI Components (`src/components/`)

React components responsible for rendering and user interaction. Organized by feature:

- **Feature views**: `MoodTracker/`, `PhotoGallery/`, `PartnerMoodView/`, `love-notes/`, `scripture-reading/`
- **Shared components**: `shared/NetworkStatusIndicator`, `shared/SyncToast`
- **Navigation**: `Navigation/BottomNavigation`
- **Error boundaries**: `ErrorBoundary/`, `ViewErrorBoundary/`

Components do NOT call services or APIs directly. They use hooks or the Zustand store.

### 2. Custom Hooks (`src/hooks/`)

Bridge between components and the store. Hooks handle:

- **Data fetching on mount**: `useLoveNotes` auto-fetches notes, `usePhotos` auto-loads photos
- **Realtime subscriptions**: `useRealtimeMessages` manages Broadcast channel lifecycle
- **Browser API wrappers**: `useNetworkStatus`, `useVibration`, `useMotionConfig`
- **Auto-save**: `useAutoSave` fires on visibility change and before unload

### 3. Zustand Store (`src/stores/`)

Single store composed from 10 slices via spread operator in `useAppStore.ts`:

```typescript
export const useAppStore = create<AppState>()(
  persist(
    (set, get, api) => ({
      ...createAppSlice(set, get, api),
      ...createMessagesSlice(set, get, api),
      ...createPhotosSlice(set, get, api),
      ...createSettingsSlice(set, get, api),
      ...createNavigationSlice(set, get, api),
      ...createMoodSlice(set, get, api),
      ...createInteractionsSlice(set, get, api),
      ...createPartnerSlice(set, get, api),
      ...createNotesSlice(set, get, api),
      ...createScriptureReadingSlice(set, get, api),
    }),
    { /* persist config */ }
  )
);
```

### 4. Services (`src/services/`)

Domain-specific business logic and local persistence:

- `storageService`: IndexedDB CRUD for messages
- `moodService`: IndexedDB mood entries with validation
- `photoService`: Supabase Storage upload with signed URLs
- `imageCompressionService`: Canvas API compression (2048px max, 80% JPEG quality)
- `customMessageService`: IndexedDB custom message management
- `scriptureReadingService`: Supabase RPC calls for scripture sessions

### 5. API Layer (`src/api/`)

Direct Supabase client calls:

- `supabaseClient.ts`: Singleton client initialization
- `moodSyncService.ts`: Mood upload/fetch to Supabase `moods` table
- `interactionService.ts`: Poke/kiss CRUD + realtime subscription
- `partnerService.ts`: Partner search, request, accept/decline
- `auth/sessionService.ts`: Session management, offline-safe user ID
- `auth/actionService.ts`: Sign in, sign out, sign up
- `moodApi.ts`: Paginated mood history queries

## Key Trade-offs

| Decision | Benefit | Cost |
|---|---|---|
| No client-side router | Simpler codebase, no router dependency | Manual URL/history management in `navigationSlice` |
| Zustand over Redux | Less boilerplate, smaller bundle | No middleware ecosystem, no action replay |
| IndexedDB + localStorage | Fast hydration for settings, unlimited storage for data | Two persistence layers to maintain |
| injectManifest SW strategy | Full control over caching behavior | More complex SW code than generateSW |
| Optimistic UI updates | Instant feedback for users | Must handle rollback on server failure |
| Broadcast API over postgres_changes | Reliable cross-user messaging | Manual channel management per user |

## Cross-Slice Dependencies

Most slices are self-contained. Notable exceptions:

- `settingsSlice.initializeApp()` calls `messagesSlice.updateCurrentMessage()` via `get()`
- `moodSlice.syncPendingMoods()` calls `moodSlice.fetchPartnerMoods()` via `get()`
- `notesSlice.sendNote()` creates Supabase Broadcast channels to notify partner

Circular dependencies are avoided by defining `AppSlice` in `types.ts` (not in `appSlice.ts`).

# State Management Overview

## Architecture

My-Love uses **Zustand 5** with a single store composed from 10 slices. The store is wrapped in the `persist` middleware for automatic localStorage hydration.

For detailed slice documentation, see [State Management Section](../state-management/index.md).

## Quick Reference

### Store Composition

```typescript
// src/stores/useAppStore.ts
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
    { name: 'my-love-storage', version: 0, /* ... */ }
  )
);
```

### The 10 Slices

| Slice | State Fields | Key Actions | Persisted |
|---|---|---|---|
| **App** | `isLoading`, `error`, `__isHydrated` | `setLoading`, `setError` | No |
| **Settings** | `settings`, `isOnboarded` | `initializeApp`, `setTheme`, `addAnniversary` | Yes |
| **Navigation** | `currentView` | `setView`, `navigateHome`, etc. | No |
| **Messages** | `messages`, `messageHistory`, `currentMessage`, `customMessages` | `loadMessages`, `updateCurrentMessage`, `createCustomMessage` | Partial |
| **Mood** | `moods`, `partnerMoods`, `syncStatus` | `addMoodEntry`, `syncPendingMoods`, `fetchPartnerMoods` | Yes (moods) |
| **Interactions** | `interactions`, `unviewedCount`, `isSubscribed` | `sendPoke`, `sendKiss`, `subscribeToInteractions` | No |
| **Partner** | `partner`, `sentRequests`, `receivedRequests`, `searchResults` | `loadPartner`, `sendPartnerRequest`, `acceptPartnerRequest` | No |
| **Notes** | `notes`, `notesIsLoading`, `notesHasMore`, `sentMessageTimestamps` | `fetchNotes`, `sendNote`, `retryFailedMessage` | No |
| **Photos** | `photos`, `selectedPhotoId`, `isUploading`, `uploadProgress` | `uploadPhoto`, `loadPhotos`, `deletePhoto` | No |
| **Scripture** | `session`, `scriptureLoading`, `activeSession`, `pendingRetry` | `createSession`, `advanceStep`, `saveAndExit`, `retryFailedWrite` | No |

### Type-Safe Slice Creator Pattern

```typescript
// src/stores/types.ts
export type AppStateCreator<Slice> = StateCreator<AppState, AppMiddleware, [], Slice>;
```

Each slice uses this type to get full access to the composed `AppState` via `get()`.

# Zustand Store - Quick Reference

**Location**: `/src/stores/useAppStore.ts` + `/src/stores/slices/*`  
**Documentation**: `ZUSTAND_STATE_MANAGEMENT_ARCHITECTURE.md`

## Store Composition

```typescript
useAppStore = compose(
  SettingsSlice,
  MessagesSlice,
  PhotosSlice,
  MoodSlice,
  PartnerSlice,
  InteractionsSlice,
  NavigationSlice,
  + core: { isLoading, error, __isHydrated }
)
```

## Slice Directory

| Slice            | File                   | Purpose                     | State                                    | Actions |
| ---------------- | ---------------------- | --------------------------- | ---------------------------------------- | ------- |
| **Settings**     | `settingsSlice.ts`     | App settings, init, theme   | settings, isOnboarded                    | 7       |
| **Messages**     | `messagesSlice.ts`     | Messages, history, rotation | messages, messageHistory, currentMessage | 16      |
| **Photos**       | `photosSlice.ts`       | Photo gallery, compression  | photos, selectedPhotoId                  | 8       |
| **Mood**         | `moodSlice.ts`         | Mood tracking, sync         | moods, partnerMoods, syncStatus          | 7       |
| **Partner**      | `partnerSlice.ts`      | Partner info, requests      | partner, sentRequests, receivedRequests  | 8       |
| **Interactions** | `interactionsSlice.ts` | Poke/kiss, Realtime         | interactions, unviewedCount              | 8       |
| **Navigation**   | `navigationSlice.ts`   | View routing                | currentView                              | 5       |

## Persistence Overview

### LocalStorage (my-love-storage)

```
~5-15 KB total
├─ settings
├─ isOnboarded
├─ messageHistory (serialized Map → Array)
└─ moods
```

### IndexedDB (my-love-db)

```
Unlimited
├─ messages (default + custom)
├─ photos (with image blobs)
└─ moods (full entries)
```

### Supabase (Realtime + Backend)

```
Dynamic
├─ partner info
├─ interactions (Realtime)
├─ mood sync
└─ authentication
```

## Key Actions by Use Case

### On App Startup

1. `initializeApp()` → Settings Slice
   - Hydrates from LocalStorage
   - Initializes IndexedDB
   - Loads default messages

### Daily Message Rotation

1. `updateCurrentMessage()` → Messages Slice
   - Computes today's message
   - Caches in messageHistory Map
   - Returns Message object

### Photo Upload

1. `uploadPhoto(file, caption, tags)` → Photos Slice
   - Validates file
   - Compresses image
   - Checks storage quota
   - Saves to IndexedDB

### Mood Tracking

1. `addMoodEntry(moods[], note?)` → Mood Slice
   - Saves to IndexedDB
   - Queues for sync
   - Updates sync status

2. `syncPendingMoods()` → Mood Slice
   - Sends to Supabase
   - Updates lastSyncAt
   - Tracks pending count

### Partner Connection

1. `loadPartner()` → Partner Slice
2. `sendPartnerRequest(userId)` → Partner Slice
3. `acceptPartnerRequest(requestId)` → Partner Slice

### Real-time Interactions

1. `subscribeToInteractions()` → Interactions Slice
   - Establishes Supabase Realtime subscription
   - Listens for poke/kiss events
   - Updates state automatically

2. `sendPoke(partnerId)` → Interactions Slice
3. `sendKiss(partnerId)` → Interactions Slice

## Type Definitions

```typescript
// Root state type
type AppState = MessagesSlice &
  PhotosSlice &
  SettingsSlice &
  NavigationSlice &
  MoodSlice &
  InteractionsSlice &
  PartnerSlice &
  CoreState;

// Usage in components
const state = useAppStore((state) => state.messages);
const action = useAppStore((state) => state.addMoodEntry);
```

## Custom Hooks Pattern

```typescript
// Selector hooks (to avoid re-renders)
export const useMessages = () => useAppStore((state) => state.messages);
export const useCurrentMessage = () => useAppStore((state) => state.currentMessage);
export const useSettings = () => useAppStore((state) => state.settings);

// Action hooks (to access dispatch functions)
export const useMessageActions = () => ({
  updateCurrentMessage: useAppStore((s) => s.updateCurrentMessage),
  navigateToPreviousMessage: useAppStore((s) => s.navigateToPreviousMessage),
});
```

## Critical Implementation Details

### Story 3.3: Message History Navigation

- `currentIndex`: 0 = today, 1 = yesterday, 30 = max history
- `shownMessages`: Map of date → messageId (cached)
- `canNavigateBack()`: Check if index < availableDays
- `canNavigateForward()`: Check if index > 0

### Story 3.5: Custom Messages

- Moved from LocalStorage to IndexedDB
- `active` flag controls participation in rotation
- Rotation pool filters: `!custom || active !== false`
- Import/export via JSON file

### Story 4: Photo Gallery

- Compression: JPEG, dynamic quality
- Quota: Warn at 80%, block at 95%
- Storage: IndexedDB with Blob objects
- Navigation: Smart carousel logic on delete

### Story 6: Mood Tracking

- Local: IndexedDB with offline support
- Sync: Background sync to Supabase
- Partner moods: Read-only, fetched separately
- Status: Pending count, online flag, lastSyncAt

## Common Patterns

### Async Action with Optimistic Update

```typescript
async action() {
  // 1. Optimistic update
  set((state) => ({ items: [...state.items, newItem] }));

  // 2. Persist to backend
  try {
    await service.save(newItem);
  } catch (error) {
    // 3. Revert on error
    set((state) => ({ items: state.items.filter(i => i !== newItem) }));
    throw error;
  }
}
```

### Cross-Slice Call

```typescript
// In slice A
const state = get(); // Access full AppState
if (state.updateCurrentMessage) {
  state.updateCurrentMessage(); // Call slice B method
}
```

### Validation

```typescript
try {
  const validated = SettingsSchema.parse(settings);
  set({ settings: validated });
} catch (error) {
  if (isZodError(error)) {
    throw createValidationError(error);
  }
}
```

### Loading State

```typescript
async loadData() {
  try {
    set({ isLoading: true, error: null });
    const data = await fetch();
    set({ data, isLoading: false });
  } catch (error) {
    set({ error: error.message, isLoading: false });
  }
}
```

## Error Recovery Strategies

| Scenario               | Recovery                     |
| ---------------------- | ---------------------------- |
| Corrupted localStorage | Clear + use defaults         |
| IndexedDB unavailable  | Log + continue with memory   |
| Validation failure     | Log error + revert state     |
| Network error          | Log + retry with UI feedback |
| Hydration failure      | Use initial state defaults   |

## Performance Considerations

### ✅ Do This

- Use selectors: `useAppStore(s => s.messages)`
- Batch updates: single `set()` call
- Filter before iteration: rotation pool
- Lazy load: `loadPhotos()` on demand
- Map for O(1) lookup: messageHistory

### ❌ Avoid This

- Accessing full state: `const state = useAppStore()`
- Multiple set() calls: causes re-renders
- Expensive computations in selectors
- Loading everything on init
- Array find() in hot loops

## Testing

### Mock Store Setup

```typescript
const mockStore = {
  messages: testMessages,
  settings: testSettings,
  updateCurrentMessage: vi.fn(),
};
```

### Selective Hydration

- Can load individual slices
- Defaults for missing state
- Pre-hydration validation

## Debugging

### Console Logging

All slices use `[SliceName]` prefix:

- `[Settings]`
- `[Messages]`
- `[Photos]`
- `[Mood]`
- `[Partner]`
- `[Interactions]`
- `[Navigation]`

### Store Inspector

```typescript
// In dev console
__APP_STORE__.getState(); // Full state
__APP_STORE__.subscribe(console.log); // Track changes
```

### Hot Module Reload

Persist middleware handles HMR gracefully:

- Preserves hydrated state
- Re-initializes new actions
- No data loss

## Version Management

**Current Version**: 0  
**Schema Changes**: Handled in `validateHydratedState()`  
**Migration Path**: None yet (greenfield project)

If needed, increment `version` in persist config and add migration logic in `onRehydrateStorage`.

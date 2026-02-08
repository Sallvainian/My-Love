# Store Configuration

The store is defined in `src/stores/useAppStore.ts`. It composes all slices inside a single `create<AppState>()(persist(...))` call.

## Composition Order

```typescript
export const useAppStore = create<AppState>()(
  persist(
    (set, get, api) => ({
      ...createAppSlice(set, get, api),            // Core runtime state
      ...createMessagesSlice(set, get, api),        // Daily messages + custom messages
      ...createPhotosSlice(set, get, api),          // Photo gallery + uploads
      ...createSettingsSlice(set, get, api),        // User preferences + app init
      ...createNavigationSlice(set, get, api),      // View routing
      ...createMoodSlice(set, get, api),            // Mood tracking + sync
      ...createInteractionsSlice(set, get, api),    // Poke/kiss interactions
      ...createPartnerSlice(set, get, api),         // Partner connection
      ...createNotesSlice(set, get, api),           // Love notes chat
      ...createScriptureReadingSlice(set, get, api),// Scripture reading sessions
    }),
    { name: 'my-love-storage', version: 0, ... }
  )
);
```

**AppSlice is listed first** because it owns the core hydration and loading flags that other slices depend on.

## AppState Type

The composite state type is an intersection of all slice interfaces, defined in `src/stores/types.ts`:

```typescript
export interface AppState
  extends AppSlice,
    MessagesSlice,
    PhotosSlice,
    SettingsSlice,
    NavigationSlice,
    MoodSlice,
    InteractionsSlice,
    PartnerSlice,
    NotesSlice,
    ScriptureSlice {}
```

## AppStateCreator Generic

All slice creators use a shared type alias that encodes the persist middleware tuple:

```typescript
export type AppMiddleware = [['zustand/persist', unknown]];
export type AppStateCreator<Slice> = StateCreator<AppState, AppMiddleware, [], Slice>;
```

This ensures every slice can call `get()` to access the full `AppState` for cross-slice reads while maintaining type safety.

## E2E Testing

The store is exposed on `window.__APP_STORE__` in all environments for end-to-end test access.

---

# Zustand Store Configuration

## Store Creation

The store is created in `src/stores/useAppStore.ts` using Zustand's `create` function with the `persist` middleware:

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const useAppStore = create<AppState>()(
  persist(
    (...args) => ({
      ...createAppSlice(...args),
      ...createSettingsSlice(...args),
      ...createNavigationSlice(...args),
      ...createMessagesSlice(...args),
      ...createMoodSlice(...args),
      ...createInteractionsSlice(...args),
      ...createPartnerSlice(...args),
      ...createNotesSlice(...args),
      ...createPhotosSlice(...args),
      ...createScriptureReadingSlice(...args),
    }),
    persistConfig
  )
);
```

The spread pattern composes all 10 slices into a single flat state object. Each slice's properties and actions are merged at the top level of `AppState`.

## AppState Type

Defined in `src/stores/types.ts` as an intersection type:

```typescript
export type AppState = AppSlice &
  SettingsSlice &
  NavigationSlice &
  MessagesSlice &
  MoodSlice &
  InteractionsSlice &
  PartnerSlice &
  NotesSlice &
  PhotosSlice &
  ScriptureReadingSlice;
```

## Slice Creator Type

Each slice uses the `AppStateCreator<T>` type which includes the persist middleware signature:

```typescript
export type AppStateCreator<T> = StateCreator<
  AppState,
  [['zustand/persist', Partial<AppState>]],
  [],
  T
>;
```

This type gives each slice creator three arguments:
- `set` -- Update function (supports partial state or updater function)
- `get` -- Returns full `AppState` (cross-slice reads)
- `_api` -- Store API (rarely used)

## Persist Configuration

```typescript
const persistConfig = {
  name: 'my-love-storage',

  storage: createJSONStorage(() => ({
    getItem: (name: string) => {
      const item = localStorage.getItem(name);
      if (!item) return null;
      try {
        const parsed = JSON.parse(item);
        // Pre-hydration validation
        if (parsed?.state) {
          // Deserialize Map from array entries
          if (Array.isArray(parsed.state.messageHistory?.shownMessages)) {
            parsed.state.messageHistory.shownMessages = new Map(
              parsed.state.messageHistory.shownMessages
            );
          }
        }
        return JSON.stringify(parsed);
      } catch {
        console.error('[Store] Failed to parse persisted state');
        localStorage.removeItem(name);
        return null;
      }
    },
    setItem: (name: string, value: string) => {
      try {
        const parsed = JSON.parse(value);
        // Serialize Map to array entries
        if (parsed?.state?.messageHistory?.shownMessages instanceof Map) {
          parsed.state.messageHistory.shownMessages = Array.from(
            parsed.state.messageHistory.shownMessages.entries()
          );
        }
        localStorage.setItem(name, JSON.stringify(parsed));
      } catch {
        console.error('[Store] Failed to serialize state');
      }
    },
    removeItem: (name: string) => localStorage.removeItem(name),
  })),

  partialize: (state: AppState) => ({
    settings: state.settings,
    isOnboarded: state.isOnboarded,
    messageHistory: state.messageHistory,
    moods: state.moods,
  }),

  onRehydrateStorage: () => {
    return (_state: AppState | undefined, error: Error | undefined) => {
      if (error) {
        console.error('[Store] Hydration error:', error);
      }
      useAppStore.setState({ __isHydrated: !error });
    };
  },
};
```

### Custom Storage Adapter

The custom `createJSONStorage` adapter handles:

1. **Map serialization**: `messageHistory.shownMessages` is a `Map<string, number>` which JSON cannot serialize natively. The adapter converts it to/from an array of `[key, value]` entries.
2. **Corruption recovery**: If parsing fails, the corrupted entry is removed from localStorage and `null` is returned, triggering default state.
3. **Pre-hydration validation**: Validates structure before hydration to catch corruption early.

### Partialize Function

Only 4 state keys are persisted to localStorage:

| Key | Type | Size Impact |
|-----|------|-------------|
| `settings` | `Settings` | ~500 bytes |
| `isOnboarded` | `boolean` | ~10 bytes |
| `messageHistory` | `MessageHistory` | ~2-5 KB (depends on history size) |
| `moods` | `MoodEntry[]` | ~10-50 KB (depends on entries) |

This keeps localStorage under 100KB typically, well within the 5MB browser limit.

### Hydration Callback

`onRehydrateStorage` sets the `__isHydrated` flag on `AppSlice` after hydration completes. The `initializeApp()` function in `SettingsSlice` checks this flag before proceeding:

```typescript
const isHydrated = get().__isHydrated;
if (!isHydrated) {
  // Critical: clear corrupted localStorage
  localStorage.removeItem('my-love-storage');
  return;
}
```

## E2E Testing Support

The store is exposed to `window.__STORE__` in development and test environments:

```typescript
if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
  (window as Record<string, unknown>).__STORE__ = useAppStore;
}
```

This enables E2E tests to directly inspect and manipulate store state.

## Related Documentation

- [Slice Details](./02-slice-details.md)
- [Persistence Strategy](./05-persistence-strategy.md)
- [Data Flow](./04-data-flow.md)

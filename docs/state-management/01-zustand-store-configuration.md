# Zustand Store Configuration

## Store Creation

The store is created in `src/stores/useAppStore.ts` using Zustand's `create` function with the `persist` middleware:

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const useAppStore = create<AppState>()(
  persist(
    (set, get, api) => ({
      // AppSlice FIRST - owns core state (isLoading, error, __isHydrated)
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
    persistConfig
  )
);
```

The spread pattern composes all 10 slices into a single flat state object. Each slice's properties and actions are merged at the top level of `AppState`. AppSlice is spread first because it owns core state that other slices depend on.

## AppState Type

Defined in `src/stores/types.ts` as an intersection of interfaces:

```typescript
export interface AppState
  extends
    AppSlice,
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

Note: `AppSlice` interface is defined in `src/stores/types.ts` (not in `appSlice.ts`) to avoid circular imports.

## Middleware Type

```typescript
export type AppMiddleware = [['zustand/persist', unknown]];
```

This single-source-of-truth type ensures the middleware signature matches between types.ts and useAppStore.ts.

## Slice Creator Type

Each slice uses the `AppStateCreator<T>` type which includes the persist middleware signature:

```typescript
export type AppStateCreator<Slice> = StateCreator<AppState, AppMiddleware, [], Slice>;
```

This type gives each slice creator three arguments:

- `set` -- Update function (supports partial state or updater function)
- `get` -- Returns full `AppState` (cross-slice reads)
- `api` -- Store API (rarely used)

## Persist Configuration

### Storage Key and Version

```typescript
{
  name: 'my-love-storage',
  version: 0,  // State schema version (matches test fixtures)
}
```

### Custom Storage Adapter

The store uses `createJSONStorage` with a custom localStorage adapter that performs pre-hydration validation:

```typescript
storage: createJSONStorage(() => ({
  getItem: (name) => {
    const str = localStorage.getItem(name);
    if (!str) return null;
    try {
      const data = JSON.parse(str);
      const validation = validateHydratedState(data.state);
      if (!validation.isValid) {
        localStorage.removeItem(name);
        return null;  // Zustand uses initial state defaults
      }
      return str;
    } catch {
      localStorage.removeItem(name);
      return null;
    }
  },
  setItem: (name, value) => localStorage.setItem(name, value),
  removeItem: (name) => localStorage.removeItem(name),
})),
```

The adapter handles:

1. **Pre-hydration validation**: Validates state structure before Zustand deserializes it
2. **Corruption recovery**: If parsing or validation fails, the corrupted entry is removed and `null` is returned, triggering default state
3. **Critical vs non-critical errors**: Only `shownMessages` type mismatch and `currentIndex` type mismatch are critical -- missing fields are OK

### Partialize Function

```typescript
partialize: (state) => ({
  settings: state.settings,
  isOnboarded: state.isOnboarded,
  messageHistory: {
    ...state.messageHistory,
    shownMessages:
      state.messageHistory?.shownMessages instanceof Map
        ? Array.from(state.messageHistory.shownMessages.entries())
        : [],
  },
  moods: state.moods,
}),
```

Only 4 state keys are persisted to localStorage:

| Key              | Type             | Size Impact                       | Notes                           |
| ---------------- | ---------------- | --------------------------------- | ------------------------------- |
| `settings`       | `Settings`       | ~500 bytes                        |                                 |
| `isOnboarded`    | `boolean`        | ~10 bytes                         |                                 |
| `messageHistory` | `MessageHistory` | ~2-5 KB (depends on history size) | Map serialized to array entries |
| `moods`          | `MoodEntry[]`    | ~10-50 KB (depends on entries)    |                                 |

This keeps localStorage under 100KB typically, well within the 5MB browser limit.

**Not persisted to localStorage:**

- `messages` -- Loaded from IndexedDB on init
- `customMessages` -- Loaded from IndexedDB via `customMessageService`
- `currentMessage` -- Computed from messages + messageHistory
- `isLoading`, `error` -- Runtime UI state
- All photos, notes, interactions, partner, scripture state

### Map Serialization (Story 3.3)

`messageHistory.shownMessages` is a `Map<string, number>` (date string -> message ID). Since JSON cannot serialize Map, the `partialize` function converts it to `Array<[string, number]>` for storage, and `onRehydrateStorage` converts it back to a Map on load.

### Hydration Callback

`onRehydrateStorage` runs after hydration completes and handles:

1. **Error recovery**: Clears corrupted localStorage if hydration fails
2. **Map deserialization**: Converts `shownMessages` array back to Map with validation
3. **Null messageHistory recovery**: Creates default structure if missing
4. **State integrity validation**: Re-validates with `validateHydratedState`
5. **Hydration flag**: Sets `state.__isHydrated = true` via direct property assignment (actions not available in this callback)

## State Validation

The `validateHydratedState` function performs structural validation:

- Checks if state exists
- Validates `settings.themeName` and `settings.relationship` if settings present
- Validates `messageHistory.shownMessages` is Array or Map (not other types)
- Validates `messageHistory.currentIndex` is a number
- Only critical errors (type mismatches) cause validation failure; missing fields are OK

## E2E Testing Support

The store is exposed to `window.__APP_STORE__` unconditionally:

```typescript
declare global {
  interface Window {
    __APP_STORE__?: typeof useAppStore;
  }
}

if (typeof window !== 'undefined') {
  window.__APP_STORE__ = useAppStore;
}
```

This enables E2E tests to directly inspect and manipulate store state via `window.__APP_STORE__`.

## Related Documentation

- [Slice Details](./02-slice-details.md)
- [Persistence Strategy](./05-persistence-strategy.md)
- [Data Flow](./04-data-flow.md)

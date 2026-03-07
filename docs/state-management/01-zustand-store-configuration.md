# Zustand Store Configuration

## Store Creation

**File**: `src/stores/useAppStore.ts` (287 lines)
**Zustand Version**: 5.0.11

The store is created using Zustand's `create` function with the `persist` middleware:

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AppState } from './types';

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
    persistConfig
  )
);
```

The spread pattern composes all 10 slices into a single flat state object. Each slice's properties and actions are merged at the top level of `AppState`. `createAppSlice` is spread first because it owns core state (`isLoading`, `error`, `__isHydrated`).

## AppState Type

**File**: `src/stores/types.ts` (66 lines)

Defined as an interface extending all slice interfaces:

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

`AppSlice` is defined in `types.ts` (not `appSlice.ts`) to avoid circular imports. See [Cross-Slice Dependencies](./03-cross-slice-dependencies.md) for details.

## Middleware Type

```typescript
export type AppMiddleware = [['zustand/persist', unknown]];
```

Single middleware: `persist` only. No devtools or immer. If middleware is added later, update this tuple in one place.

## Slice Creator Type

```typescript
export type AppStateCreator<Slice> = StateCreator<AppState, AppMiddleware, [], Slice>;
```

Each slice creator receives three arguments from this type:

- `set` -- Partial state updater (`(partial: Partial<AppState>) => void` or `(updater: (state: AppState) => Partial<AppState>) => void`)
- `get` -- Returns full `AppState` snapshot (enables cross-slice reads)
- `api` -- Store API object (rarely used directly)

## Persist Configuration

### Storage Key

```typescript
name: 'my-love-storage'
```

### Schema Version

```typescript
version: 0
```

Matches test fixtures. Increment when making breaking schema changes to trigger migration.

### Custom Storage Adapter

```typescript
storage: createJSONStorage(() => ({
  getItem: (name) => {
    const str = localStorage.getItem(name);
    if (!str) return null;
    try {
      const data = JSON.parse(str);
      const validation = validateHydratedState(data.state);
      if (!validation.isValid) {
        console.error('[Storage] Pre-hydration validation failed:', validation.errors);
        localStorage.removeItem(name);
        return null;
      }
      return str;
    } catch (parseError) {
      console.error('[Storage] Failed to parse localStorage data:', parseError);
      localStorage.removeItem(name);
      return null;
    }
  },
  setItem: (name, value) => localStorage.setItem(name, value),
  removeItem: (name) => localStorage.removeItem(name),
})),
```

The custom adapter handles:

1. **Pre-hydration validation**: Runs `validateHydratedState()` before returning data to Zustand. Checks `shownMessages` is an array or Map, `currentIndex` is a number.
2. **Corruption recovery**: If parsing or validation fails, removes the corrupted entry and returns `null`, triggering default state.
3. **Critical vs non-critical errors**: Only fails on critical errors (`shownMessages` wrong type, `currentIndex` wrong type). Missing fields are acceptable -- defaults will be used.

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

| Key              | Type                | Serialization                     | Size Impact                       |
| ---------------- | ------------------- | --------------------------------- | --------------------------------- |
| `settings`       | `Settings \| null`  | Direct JSON                       | ~500 bytes                        |
| `isOnboarded`    | `boolean`           | Direct JSON                       | ~10 bytes                         |
| `messageHistory` | `MessageHistory`    | Map -> Array for `shownMessages`  | ~2-5 KB (depends on history size) |
| `moods`          | `MoodEntry[]`       | Direct JSON                       | ~10-50 KB (depends on entries)    |

**Map serialization**: `messageHistory.shownMessages` is a `Map<string, number>` (date string -> message ID). The `partialize` function converts it to an array of `[key, value]` tuples for JSON storage. The `onRehydrateStorage` callback converts it back.

### Hydration Callback

```typescript
onRehydrateStorage: () => (state, error) => {
  if (error) {
    // Clear corrupted state, app will use defaults
    localStorage.removeItem('my-love-storage');
    return;
  }

  // Deserialize shownMessages: Array -> Map
  if (state?.messageHistory) {
    const raw = state.messageHistory.shownMessages as unknown;
    if (!raw) {
      state.messageHistory.shownMessages = new Map();
    } else if (raw instanceof Map) {
      // Already a Map, OK
    } else if (Array.isArray(raw)) {
      // Validate array structure, then convert
      const isValidArray = raw.every(
        (item): item is [string, unknown] =>
          Array.isArray(item) && item.length === 2 && typeof item[0] === 'string'
      );
      state.messageHistory.shownMessages = isValidArray ? new Map(raw) : new Map();
    } else {
      state.messageHistory.shownMessages = new Map();
    }
  } else if (state) {
    // Create default messageHistory structure
    state.messageHistory = {
      currentIndex: 0, shownMessages: new Map(), maxHistoryDays: 30,
      favoriteIds: [], lastShownDate: '', lastMessageId: 0, viewedIds: [],
    };
  }

  // Handle null settings gracefully (let initial state defaults apply)

  // Run post-hydration validation
  const validation = validateHydratedState(state);
  if (!validation.isValid) {
    localStorage.removeItem('my-love-storage');
  }

  // Set hydration flag
  if (state) state.__isHydrated = true;
}
```

The callback performs four tasks:

1. **Error recovery**: Clears corrupted state on hydration error
2. **Map deserialization**: Converts `shownMessages` from serialized array back to `Map<string, number>`
3. **Structural validation**: Re-validates after deserialization, clears on failure
4. **Hydration flag**: Sets `__isHydrated = true` directly on the state object (actions not yet available during hydration)

### Pre-Hydration Validation (`validateHydratedState`)

```typescript
function validateHydratedState(state: Partial<AppState> | undefined): {
  isValid: boolean;
  errors: string[];
}
```

Validates:
- `state` is not undefined
- `settings.themeName` exists (if settings present)
- `settings.relationship` exists (if settings present)
- `messageHistory.shownMessages` is Array or Map (if present)
- `messageHistory.currentIndex` is a number (if present)

Only critical errors (`shownMessages` wrong type, `currentIndex` wrong type) cause validation failure. Missing fields are OK -- they use defaults.

## E2E Testing Support

```typescript
declare global {
  interface Window {
    __APP_STORE__?: typeof useAppStore;
  }
}

if (typeof window !== 'undefined' && import.meta.env.MODE !== 'production') {
  window.__APP_STORE__ = useAppStore;
}
```

In non-production environments, the store is exposed on `window.__APP_STORE__`. E2E tests can inspect and manipulate state via `page.evaluate()`.

## Related Documentation

- [Slice Details](./02-slice-details.md)
- [Persistence Strategy](./05-persistence-strategy.md)
- [Data Flow](./04-data-flow.md)

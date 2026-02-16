# Store Configuration

The store is defined in `src/stores/useAppStore.ts`. It composes all slices inside a single `create<AppState>()(persist(...))` call.

## Store Creation

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

`createAppSlice` is listed first because it owns the core state (`isLoading`, `error`, `__isHydrated`) that other slices depend on.

## Persist Configuration

### Storage Key and Version

```typescript
{
  name: 'my-love-storage',
  version: 0,
}
```

### Custom Storage with Pre-Hydration Validation

The store wraps `localStorage` with `createJSONStorage` to validate state before Zustand hydrates it:

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
        return null; // Zustand uses initial state defaults
      }
      return str;
    } catch (parseError) {
      localStorage.removeItem(name);
      return null;
    }
  },
  setItem: (name, value) => localStorage.setItem(name, value),
  removeItem: (name) => localStorage.removeItem(name),
})),
```

### State Validation

The `validateHydratedState` function checks structural integrity:

```typescript
function validateHydratedState(state: Partial<AppState> | undefined): {
  isValid: boolean;
  errors: string[];
} {
  // Checks:
  // - state is not undefined
  // - settings.themeName exists (if settings present)
  // - settings.relationship exists (if settings present)
  // - messageHistory.shownMessages is Array or Map
  // - messageHistory.currentIndex is a number
  //
  // Only CRITICAL type errors (wrong data types) trigger reset.
  // Missing fields are OK -- they use defaults.
}
```

### Partialize (Selective Persistence)

Only small, critical state is persisted to localStorage:

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

**NOT persisted** (loaded from IndexedDB or Supabase):
- `messages` -- loaded from IndexedDB on init
- `currentMessage` -- computed from messages + history
- `customMessages` -- loaded from IndexedDB via `customMessageService`
- `photos` -- loaded from Supabase on demand
- `notes` -- loaded from Supabase on demand
- `interactions` -- loaded from Supabase on demand
- `isLoading`, `error` -- transient UI state

### Map Serialization

The `messageHistory.shownMessages` field is a `Map<string, number>` (date string to message ID). Since JSON cannot serialize Maps, it is:

1. **Serialized** in `partialize`: `Map` -> `Array` via `Array.from(map.entries())`
2. **Deserialized** in `onRehydrateStorage`: `Array` -> `Map` via `new Map(array)`

### onRehydrateStorage

Runs after Zustand loads persisted state:

```typescript
onRehydrateStorage: () => (state, error) => {
  if (error) {
    localStorage.removeItem('my-love-storage');
    return;
  }

  // Deserialize shownMessages: Array -> Map
  if (state?.messageHistory) {
    const raw = state.messageHistory.shownMessages as unknown;
    if (!raw) {
      state.messageHistory.shownMessages = new Map();
    } else if (raw instanceof Map) {
      // Already a Map (shouldn't happen but handled)
    } else if (Array.isArray(raw)) {
      const isValidArray = raw.every(
        (item): item is [string, unknown] =>
          Array.isArray(item) && item.length === 2 && typeof item[0] === 'string'
      );
      if (isValidArray) {
        state.messageHistory.shownMessages = new Map(raw);
      } else {
        state.messageHistory.shownMessages = new Map();
      }
    } else {
      state.messageHistory.shownMessages = new Map();
    }
  } else if (state) {
    // Create default messageHistory structure
    state.messageHistory = {
      currentIndex: 0,
      shownMessages: new Map(),
      maxHistoryDays: 30,
      favoriteIds: [],
      lastShownDate: '',
      lastMessageId: 0,
      viewedIds: [],
    };
  }

  // Set hydration flag
  if (state) {
    state.__isHydrated = true;
  }
};
```

### Corruption Recovery

Multiple levels of corruption detection and recovery:

1. **Pre-hydration** (custom storage `getItem`): Validates JSON structure before Zustand touches it
2. **During hydration** (`onRehydrateStorage`): Validates and deserializes Maps with fallbacks
3. **Post-hydration** (`initializeApp`): Checks `__isHydrated` flag and clears corrupted state

All three levels fall back to clearing localStorage and using initial state defaults.

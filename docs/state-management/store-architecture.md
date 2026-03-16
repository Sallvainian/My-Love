# Store Architecture

## Store Creation

The Zustand store is created in `src/stores/useAppStore.ts` using `create<AppState>()` with the `persist` middleware. All 11 slices are composed by spreading their creators:

```typescript
export const useAppStore = create<AppState>()(
  persist(
    (set, get, api) => ({
      // AppSlice FIRST - owns core state (isLoading, error, __isHydrated)
      ...createAppSlice(set, get, api),
      // AuthSlice - single source of truth for user identity
      ...createAuthSlice(set, get, api),
      // Compose all other slices
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
    {
      /* persist config */
    }
  )
);
```

AppSlice is spread first because it owns core state fields (`isLoading`, `error`, `__isHydrated`). AuthSlice is spread second as all other slices read `userId` from it synchronously.

## Type System

All types are centralized in `src/stores/types.ts`:

- **`AppSlice`** -- Interface for core app state. Defined in `types.ts` (not `appSlice.ts`) to avoid circular imports.
- **`AppState`** -- Intersection of all 11 slice interfaces: `AppSlice & AuthSlice & MessagesSlice & PhotosSlice & SettingsSlice & NavigationSlice & MoodSlice & InteractionsSlice & PartnerSlice & NotesSlice & ScriptureSlice`.
- **`AppMiddleware`** -- Tuple type `[['zustand/persist', unknown]]` for persist middleware.
- **`AppStateCreator<Slice>`** -- Generic helper: `StateCreator<AppState, AppMiddleware, [], Slice>`. All slices use this for type-safe creation.

## Persistence Configuration

### Storage Key

`'my-love-storage'` in localStorage.

### Version

`version: 0` (matches test fixtures).

### What Gets Persisted (partialize)

Only small, critical state goes to localStorage:

- `settings` -- Theme, relationship config
- `isOnboarded` -- Onboarding status
- `messageHistory` -- Message tracking with Map-to-Array serialization
- `moods` -- Mood entries array

Large data (messages, photos, custom messages) is stored in IndexedDB and loaded on init.

### Map Serialization

`messageHistory.shownMessages` is a `Map<string, number>` at runtime. During persistence:

**Serialize (partialize):** `Map` to `Array` via `Array.from(map.entries())`
**Deserialize (onRehydrateStorage):** `Array` back to `Map` via `new Map(array)` with validation:

- Checks array structure: each entry must be `[string, unknown]` tuple
- Falls back to empty `Map()` on any validation failure
- Handles null, undefined, already-Map, and non-array cases

### Pre-Hydration Validation

Custom `createJSONStorage` wrapper intercepts `getItem`:

1. Parses JSON from localStorage
2. Validates state structure via `validateHydratedState()`
3. Clears corrupted state and returns `null` on critical errors
4. Only considers structural issues critical (e.g., `shownMessages` not array/Map, `currentIndex` not number)
5. Missing fields are allowed -- they use defaults

### Post-Hydration Recovery (onRehydrateStorage)

After Zustand deserializes:

1. Deserializes `shownMessages` array back to `Map` with validation
2. Creates default `messageHistory` if missing
3. Logs warnings for missing `settings` (lets initial state handle defaults)
4. Re-validates full state integrity
5. Clears localStorage on critical validation failure
6. Sets `__isHydrated = true` via direct property assignment (actions not available in callback)

## E2E Testing Support

The store is exposed to `window.__APP_STORE__` in non-production mode for E2E test access:

```typescript
if (typeof window !== 'undefined' && import.meta.env.MODE !== 'production') {
  window.__APP_STORE__ = useAppStore;
}
```

## Custom Storage Wrapper

Uses `createJSONStorage(() => customStorage)` where the custom storage:

- `getItem`: Reads from localStorage, parses JSON, validates structure, returns raw string or null
- `setItem`: Direct `localStorage.setItem`
- `removeItem`: Direct `localStorage.removeItem`

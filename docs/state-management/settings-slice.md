# Settings Slice

**File:** `src/stores/slices/settingsSlice.ts`
**Interface:** `SettingsSlice`

## Purpose

Manages application settings, onboarding state, theme configuration, relationship dates, and app initialization. The `initializeApp()` action is the main entry point that coordinates IndexedDB initialization and message loading on startup.

## State

| Field         | Type       | Default                 | Persisted          | Description                                                    |
| ------------- | ---------- | ----------------------- | ------------------ | -------------------------------------------------------------- |
| `settings`    | `Settings` | Default settings object | Yes (localStorage) | Theme name, relationship config (partner names, anniversaries) |
| `isOnboarded` | `boolean`  | `false`                 | Yes (localStorage) | Whether user has completed onboarding                          |

## Settings Shape

The `Settings` type includes:

- `themeName` -- Current theme (e.g., `'default'`)
- `relationship` -- Partner names, dating start date
- `anniversaries` -- Array of anniversary objects with label and date

## Actions

| Action              | Signature                                        | Description                                                               |
| ------------------- | ------------------------------------------------ | ------------------------------------------------------------------------- |
| `initializeApp`     | `() => Promise<void>`                            | Coordinates app startup: hydration check, IndexedDB init, message loading |
| `setSettings`       | `(settings: Settings) => void`                   | Validates and sets full settings object (Zod validation)                  |
| `updateSettings`    | `(updates: Partial<Settings>) => void`           | Merges partial settings update (validates merged result)                  |
| `setOnboarded`      | `(onboarded: boolean) => void`                   | Sets onboarding completion flag                                           |
| `addAnniversary`    | `(anniversary: Omit<Anniversary, 'id'>) => void` | Adds anniversary with auto-generated ID                                   |
| `removeAnniversary` | `(id: number) => void`                           | Removes anniversary by ID                                                 |
| `setTheme`          | `(theme: ThemeName) => void`                     | Updates theme name in settings                                            |

## Cross-Slice Dependencies

- **Reads:** `AppSlice` (via `get()` to access `setLoading`, `setError`)
- **Writes:** `MessagesSlice` (loads messages from IndexedDB into messages state during `initializeApp`)

## Initialization Flow (`initializeApp`)

1. Guard: Prevents concurrent/duplicate initialization (StrictMode protection via module-level flags)
2. Sets `isLoading = true` via AppSlice
3. Checks `__isHydrated` flag -- aborts with error if hydration failed
4. Initializes IndexedDB via `storageService.init()`
5. Loads messages from IndexedDB; if empty, populates with default messages
6. Calls `updateCurrentMessage()` on MessagesSlice
7. Sets `isLoading = false`
8. On error: sets `error` message, sets `isLoading = false`

## Validation

Settings are validated using Zod schemas. The `themeName` field is required for state validation (missing `themeName` triggers a validation warning but not a critical failure).

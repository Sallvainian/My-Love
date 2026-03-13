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

| Action              | Signature                              | Description                                              |
| ------------------- | -------------------------------------- | -------------------------------------------------------- |
| `updateSettings`    | `(partial: Partial<Settings>) => void` | Merges partial settings update                           |
| `addAnniversary`    | `(anniversary: Anniversary) => void`   | Adds anniversary to settings                             |
| `removeAnniversary` | `(id: string) => void`                 | Removes anniversary by ID                                |
| `initializeApp`     | `() => Promise<void>`                  | Coordinates app startup: IndexedDB init, message loading |
| `setOnboarded`      | `(value: boolean) => void`             | Sets onboarding completion flag                          |

## Cross-Slice Dependencies

- **Reads:** `AppSlice` (via `get()` to access `setLoading`, `setError`)
- **Writes:** `MessagesSlice` (loads messages from IndexedDB into messages state during `initializeApp`)

## Initialization Flow (`initializeApp`)

1. Sets `isLoading = true`
2. Initializes IndexedDB database
3. Loads messages from IndexedDB
4. Loads custom messages from IndexedDB via `customMessageService`
5. Sets `isLoading = false`
6. On error: sets `error` message, sets `isLoading = false`

## Validation

Settings are validated using Zod schemas. The `themeName` field is required for state validation (missing `themeName` triggers a validation warning but not a critical failure).

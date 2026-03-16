# App Slice

**File:** `src/stores/slices/appSlice.ts`
**Interface:** `AppSlice` (defined in `src/stores/types.ts` to avoid circular imports)

## Purpose

Owns core application state that was previously "root" fields. Manages loading indicators, error messages, and hydration tracking.

## State

| Field          | Type             | Default | Persisted | Description                                                   |
| -------------- | ---------------- | ------- | --------- | ------------------------------------------------------------- |
| `isLoading`    | `boolean`        | `false` | No        | Global loading indicator                                      |
| `error`        | `string \| null` | `null`  | No        | Global error message                                          |
| `__isHydrated` | `boolean`        | `false` | No        | Internal flag set after Zustand persist rehydration completes |

## Actions

| Action        | Signature                         | Description         |
| ------------- | --------------------------------- | ------------------- |
| `setLoading`  | `(loading: boolean) => void`      | Sets `isLoading`    |
| `setError`    | `(error: string \| null) => void` | Sets `error`        |
| `setHydrated` | `(hydrated: boolean) => void`     | Sets `__isHydrated` |

## Notes

- `__isHydrated` is set to `true` directly in `onRehydrateStorage` callback (not via the `setHydrated` action) because actions are not available during rehydration.
- This slice is spread first in `useAppStore.ts` to ensure its fields are the base.
- No cross-slice dependencies.
- No persistence -- all fields are transient runtime state.

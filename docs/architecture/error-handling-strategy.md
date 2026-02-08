# Error Handling Strategy

## View-Level Error Boundaries

Two-tier error boundary architecture:
1. **`ErrorBoundary`** (top-level) - Catches catastrophic errors, shows full-page fallback
2. **`ViewErrorBoundary`** (per-view) - Catches view-specific errors while keeping `BottomNavigation` visible, allowing users to navigate away from broken views

## Service Layer Error Handling

`BaseIndexedDBService` implements a split error strategy:
- **Read operations** (`get`, `getAll`, `getPage`): Return `null` or `[]` on failure. Rationale: graceful degradation, app continues with empty state.
- **Write operations** (`add`, `update`, `delete`, `clear`): Throw on failure. Rationale: data integrity, callers must handle failures explicitly.

## Network Error Handling

- `NetworkStatusIndicator` shows a banner when offline
- `SyncToast` shows sync completion feedback after Background Sync
- `offlineErrorHandler.ts` provides offline-specific error messages
- API errors are caught in `api/errorHandlers.ts` with user-friendly messages

## State Corruption Recovery

Zustand's `onRehydrateStorage` callback validates state on load:
1. Validates JSON parse success
2. Validates critical fields (`themeName`, `shownMessages` type)
3. On corruption: clears localStorage, logs error, falls back to defaults
4. Map deserialization (Array -> Map) with structure validation

---

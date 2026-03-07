# Cross-Slice Dependencies

## Dependency Map

All slices share access to full `AppState` via `get()`. Below is the complete dependency graph.

```
AppSlice (defined in types.ts)
  ^
  |-- SettingsSlice reads: setLoading, setError, __isHydrated
  |-- All slices may read: isLoading, error

SettingsSlice
  |-- Writes: messages (MessagesSlice state) via set({ messages })
  |-- Calls: updateCurrentMessage() (MessagesSlice action)

MessagesSlice
  |-- Reads: settings (SettingsSlice state) for getAvailableHistoryDays()

MoodSlice         -- No cross-slice dependencies
NavigationSlice   -- No cross-slice dependencies
InteractionsSlice -- No cross-slice dependencies
PartnerSlice      -- No cross-slice dependencies
NotesSlice        -- No cross-slice dependencies
PhotosSlice       -- No cross-slice dependencies
ScriptureSlice    -- No cross-slice dependencies
```

## Initialization Coordination

The most significant cross-slice interaction occurs during app startup in `settingsSlice.initializeApp()`:

```
initializeApp()
  1. get().setLoading(true)           // AppSlice action
  2. get().setError(null)             // AppSlice action
  3. get().__isHydrated               // AppSlice state read
  4. storageService.init()            // IndexedDB open
  5. storageService.getAllMessages()   // IndexedDB read
  6. set({ messages })                // MessagesSlice state WRITE
  7. get().updateCurrentMessage()     // MessagesSlice action CALL
  8. get().setLoading(false)          // AppSlice action
```

This is the only place where one slice directly writes another slice's state field. All other cross-slice communication is through action calls via `get()`.

## Why AppSlice Lives in types.ts

The `AppSlice` interface is defined in `src/stores/types.ts` rather than `src/stores/slices/appSlice.ts` to prevent circular imports:

1. `appSlice.ts` uses `AppStateCreator<AppSlice>` which references `AppState`
2. `AppState` extends `AppSlice`
3. If `AppSlice` were in `appSlice.ts`, `types.ts` would import from `appSlice.ts`, which imports from `types.ts` -- circular

By co-locating `AppSlice` with `AppState` in `types.ts`, the cycle is broken.

## Slice Independence

8 of 10 slices are fully self-contained. Only SettingsSlice and MessagesSlice have cross-slice dependencies, and the dependency graph has max depth 2. This design:

- Makes slices independently testable
- Prevents cascading state updates
- Enables potential future slice extraction

## Related Documentation

- [Slice Details](./02-slice-details.md)
- [Store Configuration](./01-zustand-store-configuration.md)
- [Data Flow](./04-data-flow.md)

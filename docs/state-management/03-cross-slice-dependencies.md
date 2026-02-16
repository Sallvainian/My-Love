# Cross-Slice Dependencies

## Dependency Map

Since all slices share access to the full `AppState` via `get()`, cross-slice reads and writes are possible. Below is the complete dependency graph.

```
AppSlice (types.ts)
  ^
  |-- SettingsSlice reads: setLoading, setError, __isHydrated
  |-- All slices may read: isLoading, error

SettingsSlice
  |-- Writes: messages (MessagesSlice state)
  |-- Calls: updateCurrentMessage() (MessagesSlice action)

MessagesSlice
  |-- Reads: settings (SettingsSlice state) for relationship start date

MoodSlice
  |-- No cross-slice dependencies (self-contained)

NavigationSlice
  |-- No cross-slice dependencies

InteractionsSlice
  |-- No cross-slice dependencies

PartnerSlice
  |-- No cross-slice dependencies

NotesSlice
  |-- No cross-slice dependencies

PhotosSlice
  |-- No cross-slice dependencies

ScriptureReadingSlice
  |-- No cross-slice dependencies
```

## Initialization Coordination

The most significant cross-slice interaction occurs during app initialization in `settingsSlice.initializeApp()`:

```typescript
initializeApp: async () => {
  // 1. Read AppSlice state
  get().setLoading(true);
  get().setError(null);

  // 2. Check AppSlice hydration flag
  const isHydrated = get().__isHydrated;

  // 3. Load messages and write to MessagesSlice state
  set({ messages: messagesWithIds });

  // 4. Call MessagesSlice action
  get().updateCurrentMessage();

  // 5. Update AppSlice state
  get().setLoading(false);
};
```

This is the only place where one slice directly writes another slice's state. All other cross-slice communication is through action calls.

## Why AppSlice Lives in types.ts

The `AppSlice` interface is defined in `src/stores/types.ts` rather than `src/stores/slices/appSlice.ts` to prevent circular imports:

1. `appSlice.ts` creates the slice using `AppStateCreator<AppSlice>`
2. `AppStateCreator` references `AppState`
3. `AppState` includes `AppSlice`
4. If `AppSlice` were in `appSlice.ts`, `types.ts` would import from `appSlice.ts`, which imports from `types.ts` -- circular

By keeping `AppSlice` in `types.ts` alongside `AppState`, the circular dependency is avoided.

## Slice Independence

Most slices are self-contained, communicating with external services (IndexedDB, Supabase) rather than other slices. This design:

- Makes slices independently testable
- Prevents cascading state updates
- Keeps the dependency graph shallow (max depth: 2)
- Enables potential future slice extraction

## Related Documentation

- [Slice Details](./02-slice-details.md)
- [Zustand Store Configuration](./01-zustand-store-configuration.md)
- [Data Flow](./04-data-flow.md)

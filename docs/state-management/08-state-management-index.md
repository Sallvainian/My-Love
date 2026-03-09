# State Management Quick Reference

## Documents

| #   | Document                                                           | Description                                                                          |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| 01  | [Zustand Store Configuration](./01-zustand-store-configuration.md) | Store creation, persist middleware, custom Map serialization, hydration, E2E support |
| 02  | [Slice Details](./02-slice-details.md)                             | All 10 slices: exact TypeScript interfaces, state fields, actions, defaults          |
| 03  | [Cross-Slice Dependencies](./03-cross-slice-dependencies.md)       | Dependency graph, initialization coordination, circular import prevention            |
| 04  | [Data Flow Patterns](./04-data-flow.md)                            | 6 patterns: offline-first, online-first, realtime, cache, background sync, hydration |
| 05  | [Persistence Strategy](./05-persistence-strategy.md)               | localStorage vs IndexedDB, what is persisted, Map serialization, corruption recovery |
| 06  | [React Hooks](./06-react-hooks.md)                                 | All 14 custom hooks with signatures, behavior, and component usage                   |
| 07  | [Direct Store Access](./07-direct-store-access.md)                 | getState(), setState(), subscribe(), E2E testing, cross-slice access                 |

## File Locations

### Store

```
src/stores/
  useAppStore.ts                    # Main store (create + persist), 287 lines
  types.ts                          # AppState, AppSlice, AppMiddleware, AppStateCreator, 66 lines
  slices/
    appSlice.ts                     # Loading, error, hydration — 28 lines
    settingsSlice.ts                # Settings, onboarding, theme, init — 258 lines
    navigationSlice.ts              # View routing — 84 lines
    messagesSlice.ts                # Daily messages, history, favorites, custom CRUD — 547 lines
    moodSlice.ts                    # Mood tracking, sync, partner moods — 364 lines
    interactionsSlice.ts            # Poke/kiss — 257 lines
    partnerSlice.ts                 # Partner data, requests — 141 lines
    notesSlice.ts                   # Love notes chat — 641 lines
    photosSlice.ts                  # Photo gallery — 209 lines
    scriptureReadingSlice.ts        # Scripture sessions (largest) — 1053 lines
```

### Hooks

```
src/hooks/
  index.ts                          # Barrel exports (5 hooks)
  useAuth.ts                        # Supabase auth state
  useLoveNotes.ts                   # Love notes + realtime
  useRealtimeMessages.ts            # Broadcast channel management
  useAutoSave.ts                    # Scripture auto-save
  useMoodHistory.ts                 # Paginated mood history
  usePartnerMood.ts                 # Partner mood + realtime
  useNetworkStatus.ts               # Online/offline detection
  useVibration.ts                   # Vibration API wrapper
  useMotionConfig.ts                # Reduced motion support
  useImageCompression.ts            # Image compression state
  usePhotos.ts                      # Photo store consumer
  useScriptureBroadcast.ts          # Together-mode broadcast channel
  useScripturePresence.ts           # Partner position tracking
```

### Persistence

| Layer           | Storage      | Keys                                                 |
| --------------- | ------------ | ---------------------------------------------------- |
| Zustand persist | localStorage | `settings`, `isOnboarded`, `messageHistory`, `moods` |
| Services        | IndexedDB    | messages, photos, moods, sw-auth, scripture-\*       |
| API             | Supabase     | All cloud-synced data                                |

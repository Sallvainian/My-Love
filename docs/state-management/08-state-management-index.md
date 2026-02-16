# State Management Documentation Index

## Documents

| # | Document | Description |
|---|----------|-------------|
| 01 | [Zustand Store Configuration](./01-zustand-store-configuration.md) | Store creation, persist middleware setup, custom serialization, hydration |
| 02 | [Slice Details](./02-slice-details.md) | All 10 slices: state fields, actions, validation, cross-slice deps |
| 03 | [Cross-Slice Dependencies](./03-cross-slice-dependencies.md) | Dependency graph, initialization coordination, circular import prevention |
| 04 | [Data Flow Patterns](./04-data-flow.md) | 6 data flow patterns: offline-first, online-first, realtime, cache, sync, hydration |
| 05 | [Persistence Strategy](./05-persistence-strategy.md) | localStorage vs IndexedDB, what is persisted, Map serialization, corruption recovery |
| 06 | [React Hooks](./06-react-hooks.md) | All 12 custom hooks: auth, realtime, network, vibration, photos, moods |
| 07 | [Direct Store Access](./07-direct-store-access.md) | getState(), setState(), subscribe(), E2E testing, cross-slice access |

## Quick Reference

### Store Location

```
src/stores/
  useAppStore.ts         # Main store (create + persist)
  types.ts               # AppState, AppSlice, AppStateCreator
  slices/
    appSlice.ts          # Loading, error, hydration
    settingsSlice.ts     # Settings, onboarding, theme, init
    navigationSlice.ts   # View routing
    messagesSlice.ts     # Daily messages, history, favorites
    moodSlice.ts         # Mood tracking, sync, partner moods
    interactionsSlice.ts # Poke/kiss
    partnerSlice.ts      # Partner data, requests
    notesSlice.ts        # Love notes chat
    photosSlice.ts       # Photo gallery
    scriptureReadingSlice.ts  # Scripture sessions
```

### Hook Location

```
src/hooks/
  index.ts               # Barrel exports
  useAuth.ts             # Supabase auth state
  useLoveNotes.ts        # Love notes + realtime
  useRealtimeMessages.ts # Broadcast channel management
  useAutoSave.ts         # Scripture auto-save
  useMoodHistory.ts      # Paginated mood history
  usePartnerMood.ts      # Partner mood + realtime
  useNetworkStatus.ts    # Online/offline detection
  useVibration.ts        # Vibration API wrapper
  useMotionConfig.ts     # Reduced motion support
  useImageCompression.ts # Image compression state
  usePhotos.ts           # Photo store consumer
```

### Persistence Summary

| Layer | Storage | Keys |
|-------|---------|------|
| Zustand persist | localStorage | `settings`, `isOnboarded`, `messageHistory`, `moods` |
| Services | IndexedDB | messages, photos, moods, sw-auth, scripture-* |
| API | Supabase | All cloud-synced data |

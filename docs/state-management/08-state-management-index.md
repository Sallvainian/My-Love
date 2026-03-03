# State Management Documentation Index

## Documents

| #   | Document                                                           | Description                                                                          |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| 01  | [Zustand Store Configuration](./01-zustand-store-configuration.md) | Store creation, persist middleware setup, custom serialization, hydration            |
| 02  | [Slice Details](./02-slice-details.md)                             | All 10 slices: state fields, actions, validation, auth guards, cross-slice deps      |
| 03  | [Cross-Slice Dependencies](./03-cross-slice-dependencies.md)       | Dependency graph, initialization coordination, circular import prevention            |
| 04  | [Data Flow Patterns](./04-data-flow.md)                            | 7 data flow patterns: offline-first, online-first, realtime, cache, sync, hydration, broadcast reconnect |
| 05  | [Persistence Strategy](./05-persistence-strategy.md)               | localStorage vs IndexedDB, what is persisted, Map serialization, corruption recovery |
| 06  | [React Hooks](./06-react-hooks.md)                                 | All 14 custom hooks: auth, realtime, network, vibration, photos, moods, scripture broadcast/presence |
| 07  | [Direct Store Access](./07-direct-store-access.md)                 | getState(), setState(), subscribe(), E2E testing via `window.__APP_STORE__`, cross-slice access |

## Quick Reference

### Store Location

```
src/stores/
  useAppStore.ts         # Main store (create + persist)
  types.ts               # AppState, AppSlice, AppStateCreator, AppMiddleware
  slices/
    appSlice.ts          # Loading, error, hydration
    settingsSlice.ts     # Settings, onboarding, theme, init
    navigationSlice.ts   # View routing (6 views)
    messagesSlice.ts     # Daily messages, history, favorites, custom messages
    moodSlice.ts         # Mood tracking, sync, partner moods
    interactionsSlice.ts # Poke/kiss with realtime subscription
    partnerSlice.ts      # Partner data, requests, search
    notesSlice.ts        # Love notes chat with optimistic updates
    photosSlice.ts       # Photo gallery with upload progress
    scriptureReadingSlice.ts  # Scripture sessions: solo + together modes, lobby, lock-in, disconnection
```

### Hook Location

```
src/hooks/
  index.ts                 # Barrel exports (7 hooks)
  useAuth.ts               # Supabase auth state
  useLoveNotes.ts          # Love notes + realtime integration
  useRealtimeMessages.ts   # Broadcast channel for love notes with exponential backoff retry
  useAutoSave.ts           # Scripture auto-save on visibility change / beforeunload
  useMoodHistory.ts        # Paginated mood history (50/page)
  usePartnerMood.ts        # Partner mood + realtime broadcast updates
  useNetworkStatus.ts      # Online/offline detection with 1.5s reconnect debounce
  useVibration.ts          # Vibration API wrapper with feature detection
  useMotionConfig.ts       # Framer Motion reduced motion presets
  useImageCompression.ts   # Image compression state machine (idle/compressing/complete/error)
  usePhotos.ts             # Photo store consumer with auto-load
  useScriptureBroadcast.ts # Together-mode broadcast channel lifecycle + reconnect (Epic 4)
  useScripturePresence.ts  # Ephemeral partner position tracking + heartbeat (Epic 4)
```

### Persistence Summary

| Layer           | Storage      | Keys                                                 |
| --------------- | ------------ | ---------------------------------------------------- |
| Zustand persist | localStorage | `settings`, `isOnboarded`, `messageHistory`, `moods` |
| Services        | IndexedDB    | messages, photos, moods, sw-auth, scripture-\*       |
| API             | Supabase     | All cloud-synced data                                |

### Auth Guard Summary (Epic 4 Hardening)

| Location                          | Action                    | Auth Method                         |
| --------------------------------- | ------------------------- | ----------------------------------- |
| `scriptureReadingSlice.ts`        | `loadSession`             | `supabase.auth.getUser()`           |
| `scriptureReadingSlice.ts`        | `selectRole`              | `supabase.auth.getUser()`           |
| `scriptureReadingSlice.ts`        | `checkForActiveSession`   | `supabase.auth.getUser()`           |
| `moodSlice.ts`                    | `addMoodEntry`            | `getCurrentUserIdOfflineSafe()`     |
| `useScriptureBroadcast.ts`        | channel subscribe         | `supabase.realtime.setAuth()` + `supabase.auth.getUser()` |
| `useScripturePresence.ts`         | channel subscribe         | `supabase.realtime.setAuth()` + `supabase.auth.getUser()` |

### Reconnect Logic Summary (Epic 4 Hardening)

| Hook                       | Channel Pattern                     | Retry Mechanism                  |
| -------------------------- | ----------------------------------- | -------------------------------- |
| `useScriptureBroadcast`    | `scripture-session:{sessionId}`     | `retryCount` state + useEffect re-run, `isRetryingRef` storm guard |
| `useScripturePresence`     | `scripture-presence:{sessionId}`    | `retryCount` state + useEffect re-run                               |
| `useRealtimeMessages`      | `love-notes:{userId}`              | Exponential backoff (1-30s), max 5 retries via `retryCountRef`      |

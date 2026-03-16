# State Management Documentation

Zustand 5.0.11-based state management architecture for the **My-Love** PWA with 11 slices (including AuthSlice), localStorage persistence, custom Map serialization, and IndexedDB for large data.

> Last updated: 2026-03-15

## Documentation Files

| File                                                    | Description                                                                 |
| ------------------------------------------------------- | --------------------------------------------------------------------------- |
| [Store Architecture](./store-architecture.md)           | Store creation, middleware, persistence, serialization, corruption recovery |
| [App Slice](./app-slice.md)                             | Core app state: loading, error, hydration                                   |
| [Auth Slice](./auth-slice.md)                           | User identity: userId, email, isAuthenticated                               |
| [Settings Slice](./settings-slice.md)                   | Theme, relationship config, anniversaries, app initialization               |
| [Navigation Slice](./navigation-slice.md)               | View routing with browser history integration                               |
| [Messages Slice](./messages-slice.md)                   | Daily love messages, favorites, history tracking, custom messages           |
| [Mood Slice](./mood-slice.md)                           | Mood tracking, partner moods, offline sync                                  |
| [Interactions Slice](./interactions-slice.md)           | Poke/kiss/fart interactions, realtime subscriptions                         |
| [Partner Slice](./partner-slice.md)                     | Partner connection, requests, user search                                   |
| [Notes Slice](./notes-slice.md)                         | Love notes chat, rate limiting, optimistic updates                          |
| [Photos Slice](./photos-slice.md)                       | Photo gallery, upload, storage quota management                             |
| [Scripture Reading Slice](./scripture-reading-slice.md) | Scripture sessions, lobby, lock-in, broadcast, couple stats                 |

## Quick Reference

| Slice        | Key State                                                          | Persisted                     | Cross-Slice Deps                        |
| ------------ | ------------------------------------------------------------------ | ----------------------------- | --------------------------------------- |
| App          | `isLoading`, `error`, `__isHydrated`                               | No                            | None                                    |
| Auth         | `userId`, `userEmail`, `isAuthenticated`                           | No                            | None (set by App.tsx onAuthStateChange) |
| Settings     | `settings`, `isOnboarded`                                          | Yes (localStorage)            | Reads AppSlice, writes MessagesSlice    |
| Navigation   | `currentView`                                                      | No                            | None                                    |
| Messages     | `messages`, `messageHistory`, `currentMessage`, `customMessages`   | Partial (messageHistory only) | Reads Settings (via `get()`)            |
| Mood         | `moods`, `partnerMoods`, `syncStatus`                              | Yes (moods in localStorage)   | Reads AuthSlice (`userId`)              |
| Interactions | `interactions`, `unviewedCount`, `isSubscribed`                    | No                            | Reads AuthSlice (`userId`)              |
| Partner      | `partner`, `isLoadingPartner`, `sentRequests`, `receivedRequests`  | No                            | None                                    |
| Notes        | `notes`, `notesIsLoading`, `notesError`, `notesHasMore`            | No                            | Reads AuthSlice (`userId`)              |
| Photos       | `photos`, `selectedPhotoId`, `isUploading`, `storageWarning`       | No                            | Reads AuthSlice (`userId`)              |
| Scripture    | `session`, `scriptureLoading`, `myRole`, `partnerLocked`, +20 more | No                            | Reads AuthSlice (`userId`)              |

## Architecture Overview

The store is composed in `/src/stores/useAppStore.ts` using Zustand's slice pattern. All 11 slices (including the AuthSlice added for auth centralization) are merged into a single `AppState` intersection type defined in `/src/stores/types.ts`. The store uses the `persist` middleware with localStorage via `createJSONStorage`, with custom pre-hydration validation and corruption recovery.

### Key Files

| File                                         | Purpose                                                                      |
| -------------------------------------------- | ---------------------------------------------------------------------------- |
| `src/stores/useAppStore.ts`                  | Store creation, persist config, Map serialization, validation                |
| `src/stores/types.ts`                        | `AppState` intersection type, `AppSlice` interface, `AppStateCreator` helper |
| `src/stores/slices/appSlice.ts`              | Core loading/error/hydration state                                           |
| `src/stores/slices/authSlice.ts`             | User identity (userId, email, isAuthenticated)                               |
| `src/stores/slices/settingsSlice.ts`         | Settings, onboarding, theme, app initialization                              |
| `src/stores/slices/navigationSlice.ts`       | View routing                                                                 |
| `src/stores/slices/messagesSlice.ts`         | Messages, favorites, history                                                 |
| `src/stores/slices/moodSlice.ts`             | Mood tracking and sync                                                       |
| `src/stores/slices/interactionsSlice.ts`     | Poke/kiss interactions                                                       |
| `src/stores/slices/partnerSlice.ts`          | Partner connections                                                          |
| `src/stores/slices/notesSlice.ts`            | Love notes chat                                                              |
| `src/stores/slices/photosSlice.ts`           | Photo gallery                                                                |
| `src/stores/slices/scriptureReadingSlice.ts` | Scripture reading sessions                                                   |

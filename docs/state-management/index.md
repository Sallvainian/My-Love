# State Management Documentation

Zustand-based state management architecture for the **My-Love** PWA with 10 slices, localStorage persistence, and custom serialization.

## Table of Contents

1. [Store Configuration](./01-zustand-store-configuration.md) — Store creation, persist config, Map serialization, corruption recovery
2. [Slice Details](./02-slice-details.md) — All 10 slices: state shapes, actions, validation, persistence
3. [Cross-Slice Dependencies](./03-cross-slice-dependencies.md) — Dependency graph, initialization coordination
4. [Data Flow Patterns](./04-data-flow.md) — 6 patterns: offline-first, online-first, realtime, cache, sync, hydration
5. [Persistence Strategy](./05-persistence-strategy.md) — localStorage vs IndexedDB, quota monitoring
6. [React Hooks](./06-react-hooks.md) — All 12 custom hooks with signatures and behavior
7. [Direct Store Access](./07-direct-store-access.md) — getState(), setState(), subscribe(), E2E support
8. [Index](./08-state-management-index.md) — Quick reference with file locations

## Quick Reference

| Slice | Key State | Persisted | Cross-Slice Deps |
|---|---|---|---|
| App | `isLoading`, `error`, `__isHydrated` | No | None |
| Settings | `settings`, `isOnboarded` | Yes (localStorage) | None |
| Navigation | `currentView` | No | None |
| Messages | `messages`, `messageHistory`, `currentMessage`, `customMessages` | Partial (messageHistory) | Settings (via `get()`) |
| Mood | `moods`, `partnerMoods`, `syncStatus` | Yes (moods in localStorage + IndexedDB) | None |
| Interactions | `interactions`, `unviewedCount`, `isSubscribed` | No | None |
| Partner | `partner`, `sentRequests`, `receivedRequests`, `searchResults` | No | None |
| Notes | `notes`, `notesIsLoading`, `notesHasMore`, `sentMessageTimestamps` | No | None |
| Photos | `photos`, `selectedPhotoId`, `isUploading`, `uploadProgress` | No | None |
| Scripture | `session`, `scriptureLoading`, `activeSession`, `pendingRetry` | No | None |

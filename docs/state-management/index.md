# State Management

## Table of Contents

1. [Overview](overview.md) -- Architecture philosophy and slice composition pattern
2. [Store Configuration](store-configuration.md) -- `useAppStore.ts` setup, persist middleware, custom storage
3. [Slice Details](slice-details.md) -- All 10 slices: state fields, actions, cross-slice dependencies
4. [Data Flow](data-flow.md) -- Component -> Hook -> Store -> Service -> API flow
5. [Persistence Strategy](persistence-strategy.md) -- localStorage vs IndexedDB, what gets persisted where
6. [React Hooks](react-hooks.md) -- Custom hooks that wrap store access
7. [Direct Store Access Pattern](direct-store-access-pattern.md) -- Selector patterns for optimal re-renders

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

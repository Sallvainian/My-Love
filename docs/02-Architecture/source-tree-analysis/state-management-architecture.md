# State Management Architecture

## Zustand Store Composition

```typescript
// src/stores/useAppStore.ts
const useAppStore = create<AppState>()(
  persist(
    (...args) => ({
      ...createSettingsSlice(...args), // User preferences
      ...createMessagesSlice(...args), // Message state
      ...createPhotosSlice(...args), // Photo gallery
      ...createMoodSlice(...args), // Mood tracking
      ...createPartnerSlice(...args), // Partner connection
      ...createInteractionsSlice(...args), // Poke/Kiss
      ...createNavigationSlice(...args), // App navigation
    }),
    { name: 'my-love-storage' }
  )
);
```

## Slice Action Count

| Slice               | Actions | Key Responsibilities                     |
| ------------------- | ------- | ---------------------------------------- |
| `settingsSlice`     | 12      | Theme, display name, anniversaries, auth |
| `messagesSlice`     | 11      | Favorites, history, custom messages      |
| `photosSlice`       | 9       | CRUD, pagination, selection              |
| `moodSlice`         | 10      | Mood entry, history, multi-select        |
| `partnerSlice`      | 8       | Pairing, sync status                     |
| `interactionsSlice` | 5       | Poke/Kiss sending, receiving             |
| `navigationSlice`   | 4       | Active view, back navigation             |
| **Total**           | **59**  | Full feature coverage                    |

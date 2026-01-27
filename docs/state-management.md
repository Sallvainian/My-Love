# State Management

> Zustand store architecture for My-Love project.

## Overview

State management uses Zustand 5.0 with:
- **Slice composition pattern** - 8 feature slices combined into one store
- **Persist middleware** - LocalStorage for critical state
- **IndexedDB integration** - Large data stored separately

## Store Architecture

### Main Store (`src/stores/useAppStore.ts`)

```typescript
export interface AppState
  extends MessagesSlice,
    PhotosSlice,
    SettingsSlice,
    NavigationSlice,
    MoodSlice,
    InteractionsSlice,
    PartnerSlice,
    NotesSlice {
  isLoading: boolean;
  error: string | null;
  __isHydrated?: boolean;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get, api) => ({
      ...createMessagesSlice(set, get, api),
      ...createPhotosSlice(set, get, api),
      ...createSettingsSlice(set, get, api),
      ...createNavigationSlice(set, get, api),
      ...createMoodSlice(set, get, api),
      ...createInteractionsSlice(set, get, api),
      ...createPartnerSlice(set, get, api),
      ...createNotesSlice(set, get, api),
      isLoading: false,
      error: null,
    }),
    { /* persist config */ }
  )
);
```

## Slices

### messagesSlice

Daily message rotation and favorites.

| State | Type | Description |
|-------|------|-------------|
| `messages` | `Message[]` | All available messages |
| `currentMessage` | `Message | null` | Today's message |
| `messageHistory` | `MessageHistory` | Rotation tracking |
| `customMessages` | `Message[]` | User-added messages |

| Action | Description |
|--------|-------------|
| `initializeMessages()` | Load messages on startup |
| `getNextMessage()` | Rotate to next message |
| `toggleFavorite(id)` | Mark/unmark favorite |
| `addCustomMessage(text)` | Add user message |

### photosSlice

Photo gallery and upload management.

| State | Type | Description |
|-------|------|-------------|
| `photos` | `PhotoWithUrls[]` | Photo list with URLs |
| `uploadProgress` | `number` | Upload percentage |
| `storageQuota` | `StorageQuota` | Usage stats |

| Action | Description |
|--------|-------------|
| `loadPhotos()` | Fetch photos from Supabase |
| `uploadPhoto(file)` | Upload new photo |
| `deletePhoto(id)` | Delete photo |
| `updateCaption(id, caption)` | Edit caption |

### settingsSlice

User preferences and relationship data.

| State | Type | Description |
|-------|------|-------------|
| `settings` | `Settings` | User preferences |
| `isOnboarded` | `boolean` | Onboarding complete |

| Action | Description |
|--------|-------------|
| `updateSettings(partial)` | Update settings |
| `completeOnboarding()` | Mark onboarded |
| `setTheme(theme)` | Change theme |

### navigationSlice

View routing (no React Router).

| State | Type | Description |
|-------|------|-------------|
| `currentView` | `ViewType` | Active view |
| `previousView` | `ViewType | null` | For back navigation |

| Action | Description |
|--------|-------------|
| `navigateTo(view)` | Change view |
| `goBack()` | Return to previous |

### moodSlice

Mood tracking and partner mood.

| State | Type | Description |
|-------|------|-------------|
| `moods` | `Mood[]` | User's mood entries |
| `partnerMood` | `Mood | null` | Partner's latest |
| `isSaving` | `boolean` | Save in progress |

| Action | Description |
|--------|-------------|
| `saveMoodEntry(entry)` | Save new mood |
| `loadMoodHistory()` | Fetch history |
| `fetchPartnerMood()` | Get partner's mood |

### interactionsSlice

Poke/kiss/fart interactions.

| State | Type | Description |
|-------|------|-------------|
| `interactions` | `Interaction[]` | Received interactions |
| `unreadCount` | `number` | Unread count |

| Action | Description |
|--------|-------------|
| `sendInteraction(type)` | Send poke/kiss |
| `markAsRead(id)` | Mark viewed |
| `loadInteractions()` | Fetch history |

### partnerSlice

Partner information.

| State | Type | Description |
|-------|------|-------------|
| `partner` | `Partner | null` | Partner info |
| `isConnected` | `boolean` | Partner linked |

| Action | Description |
|--------|-------------|
| `fetchPartner()` | Load partner data |
| `sendPartnerRequest(email)` | Request link |

### notesSlice

Love notes real-time chat.

| State | Type | Description |
|-------|------|-------------|
| `notes` | `LoveNote[]` | Chat messages |
| `isLoading` | `boolean` | Loading state |
| `hasMore` | `boolean` | More to load |

| Action | Description |
|--------|-------------|
| `loadNotes(offset)` | Load messages |
| `sendNote(content, image?)` | Send message |
| `subscribeToNotes()` | Real-time updates |

## Persistence Strategy

### LocalStorage (via Zustand persist)

Small, critical data:
- `settings` - User preferences
- `isOnboarded` - Onboarding flag
- `messageHistory` - Message rotation state

### IndexedDB (via services)

Large datasets:
- `messages` - Full message library
- `photos` - Photo metadata
- `customMessages` - User messages

### Supabase (source of truth)

Server-synced data:
- `moods` - Mood entries
- `notes` - Love notes
- `interactions` - Poke/kiss records
- `photos` - Photo files

## Usage Patterns

### Selector Pattern (Required)

```typescript
// DO: Use selectors for performance
const moods = useAppStore(state => state.moods);

// DO: Combine related state
const { notes, sendNote } = useAppStore(state => ({
  notes: state.notes,
  sendNote: state.sendNote,
}));

// DON'T: Select entire store
const store = useAppStore(); // Causes re-renders
```

### Cross-Slice Access

```typescript
// Inside a slice, use get() for other slices
const createMoodSlice = (set, get, api) => ({
  syncMoodToPartner: async () => {
    const { partner } = get(); // Access partnerSlice
    // ...
  },
});
```

### Hydration Guard

```typescript
// Check hydration before initialization
const isHydrated = useAppStore(state => state.__isHydrated);

useEffect(() => {
  if (isHydrated) {
    initializeApp();
  }
}, [isHydrated]);
```

## Map Serialization

`messageHistory.shownMessages` is a `Map<string, number>`:

```typescript
// Serialize to Array for JSON storage
partialize: (state) => ({
  messageHistory: {
    ...state.messageHistory,
    shownMessages: Array.from(
      state.messageHistory.shownMessages.entries()
    ),
  },
}),

// Deserialize back to Map
onRehydrateStorage: () => (state) => {
  if (state?.messageHistory) {
    state.messageHistory.shownMessages = new Map(
      state.messageHistory.shownMessages
    );
  }
},
```

## Testing

Store is exposed for E2E tests:

```typescript
if (typeof window !== 'undefined') {
  window.__APP_STORE__ = useAppStore;
}
```

Access in Playwright:

```typescript
const store = await page.evaluate(() => window.__APP_STORE__.getState());
```

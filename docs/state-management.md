# State Management Documentation

## Overview

**My Love** uses [Zustand](https://zustand.docs.pmnd.rs/) for state management with the persist middleware for LocalStorage integration. The application has a single, centralized store that manages all global state.

**Key Features**:
- Single source of truth (`useAppStore`)
- Automatic LocalStorage persistence
- Simple, non-boilerplate API
- React hooks-based
- TypeScript-first with full type safety

## Store Architecture

### File Location

`/src/stores/useAppStore.ts`

### Store Creation Pattern

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // State
      // Actions
    }),
    {
      name: 'my-love-storage',
      partialize: (state) => ({
        // Only persist critical state
      })
    }
  )
);
```

**Middleware Stack**:
1. `persist` - Syncs state with LocalStorage
2. Type inference via `create<AppState>()`

## State Structure

### Complete State Interface

```typescript
interface AppState {
  // Settings & Configuration
  settings: Settings | null;
  isOnboarded: boolean;

  // Message Management
  messages: Message[];
  messageHistory: MessageHistory;
  currentMessage: Message | null;

  // Mood Tracking
  moods: MoodEntry[];

  // UI State
  isLoading: boolean;
  error: string | null;

  // Actions (15 total)
  initializeApp: () => Promise<void>;
  setSettings: (settings: Settings) => void;
  updateSettings: (updates: Partial<Settings>) => void;
  setOnboarded: (onboarded: boolean) => void;
  loadMessages: () => Promise<void>;
  addMessage: (text: string, category: MessageCategory) => Promise<void>;
  toggleFavorite: (messageId: number) => Promise<void>;
  updateCurrentMessage: () => void;
  addMoodEntry: (mood: MoodType, note?: string) => void;
  getMoodForDate: (date: string) => MoodEntry | undefined;
  addAnniversary: (anniversary: Omit<Anniversary, 'id'>) => void;
  removeAnniversary: (id: number) => void;
  setTheme: (theme: ThemeName) => void;
}
```

## State Slices

### 1. Settings Slice

**Purpose**: User preferences and relationship configuration

**State**:
```typescript
settings: Settings | null;
```

**Initial Value**: `null` (set after onboarding)

**Actions**:

#### setSettings
```typescript
setSettings: (settings: Settings) => void
```
**Purpose**: Set complete settings object (used during onboarding)

**Example**:
```typescript
const { setSettings } = useAppStore();

setSettings({
  themeName: 'sunset',
  notificationTime: '09:00',
  relationship: {
    startDate: '2023-01-15',
    partnerName: 'My Love',
    anniversaries: [...]
  },
  customization: { ... },
  notifications: { ... }
});
```

#### updateSettings
```typescript
updateSettings: (updates: Partial<Settings>) => void
```
**Purpose**: Partial update of settings (merge with existing)

**Example**:
```typescript
const { updateSettings } = useAppStore();

// Update just the theme
updateSettings({ themeName: 'ocean' });
```

**Implementation**:
```typescript
updateSettings: (updates) => {
  const { settings } = get();
  if (settings) {
    set({ settings: { ...settings, ...updates } });
  }
}
```

---

### 2. Onboarding Slice

**Purpose**: Track onboarding completion status

**State**:
```typescript
isOnboarded: boolean;
```

**Initial Value**: `false`

**Actions**:

#### setOnboarded
```typescript
setOnboarded: (onboarded: boolean) => void
```
**Purpose**: Mark onboarding as complete

**Example**:
```typescript
const { setOnboarded } = useAppStore();

// Complete onboarding
setOnboarded(true);
```

**Effect**: Changes app view from Onboarding → DailyMessage

---

### 3. Messages Slice

**Purpose**: Manage love messages and daily rotation

**State**:
```typescript
messages: Message[];
messageHistory: MessageHistory;
currentMessage: Message | null;
```

**Initial Values**:
- `messages`: `[]` (loaded from IndexedDB)
- `messageHistory`: `{ lastShownDate: '', lastMessageId: 0, favoriteIds: [], viewedIds: [] }`
- `currentMessage`: `null` (computed on init)

**Actions**:

#### loadMessages
```typescript
loadMessages: () => Promise<void>
```
**Purpose**: Load all messages from IndexedDB

**Example**:
```typescript
const { loadMessages } = useAppStore();

await loadMessages();
```

**Implementation**:
```typescript
loadMessages: async () => {
  try {
    const messages = await storageService.getAllMessages();
    set({ messages });
  } catch (error) {
    console.error('Error loading messages:', error);
  }
}
```

#### addMessage
```typescript
addMessage: (text: string, category: MessageCategory) => Promise<void>
```
**Purpose**: Add a new custom message

**Example**:
```typescript
const { addMessage } = useAppStore();

await addMessage(
  "You make every day brighter just by being you.",
  'affirmation'
);
```

**Implementation**:
```typescript
addMessage: async (text, category) => {
  try {
    const newMessage: Omit<Message, 'id'> = {
      text,
      category,
      isCustom: true,
      createdAt: new Date(),
      isFavorite: false,
    };

    const id = await storageService.addMessage(newMessage);
    const messageWithId = { ...newMessage, id };

    set((state) => ({
      messages: [...state.messages, messageWithId],
    }));
  } catch (error) {
    console.error('Error adding message:', error);
  }
}
```

#### toggleFavorite
```typescript
toggleFavorite: (messageId: number) => Promise<void>
```
**Purpose**: Toggle favorite status of a message

**Example**:
```typescript
const { toggleFavorite } = useAppStore();

// Favorite message with ID 42
await toggleFavorite(42);
```

**Implementation**:
```typescript
toggleFavorite: async (messageId) => {
  try {
    await storageService.toggleFavorite(messageId);

    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId ? { ...msg, isFavorite: !msg.isFavorite } : msg
      ),
      messageHistory: {
        ...state.messageHistory,
        favoriteIds: state.messages.find((m) => m.id === messageId)?.isFavorite
          ? state.messageHistory.favoriteIds.filter((id) => id !== messageId)
          : [...state.messageHistory.favoriteIds, messageId],
      },
    }));

    get().updateCurrentMessage();
  } catch (error) {
    console.error('Error toggling favorite:', error);
  }
}
```

**Side Effects**:
1. Updates IndexedDB
2. Updates in-memory messages array
3. Updates favoriteIds in messageHistory
4. Refreshes currentMessage if it's the favorited one

#### updateCurrentMessage
```typescript
updateCurrentMessage: () => void
```
**Purpose**: Determine and set the current daily message

**Algorithm**:
1. Check if it's a new day (compare `lastShownDate` with today)
2. If new day:
   - Use `getTodayMessage()` algorithm (see `/src/utils/messageRotation.ts`)
   - Prioritizes favorites (2x weight)
   - Uses deterministic daily seed
   - Updates `lastShownDate`, `lastMessageId`, and `viewedIds`
3. If same day:
   - Show the same message as `lastMessageId`

**Example**:
```typescript
const { updateCurrentMessage } = useAppStore();

// Call on app init or when favoriting a message
updateCurrentMessage();
```

**Implementation**:
```typescript
updateCurrentMessage: () => {
  const { messages, messageHistory, settings } = get();

  if (!settings || messages.length === 0) return;

  if (isNewDay(messageHistory.lastShownDate)) {
    const startDate = new Date(settings.relationship.startDate);
    const todayMessage = getTodayMessage(
      messages,
      startDate,
      messageHistory.favoriteIds
    );

    if (todayMessage) {
      set({
        currentMessage: todayMessage,
        messageHistory: {
          ...messageHistory,
          lastShownDate: new Date().toISOString(),
          lastMessageId: todayMessage.id,
          viewedIds: [...messageHistory.viewedIds, todayMessage.id],
        },
      });
    }
  } else {
    const lastMessage = messages.find((m) => m.id === messageHistory.lastMessageId);
    if (lastMessage) {
      set({ currentMessage: lastMessage });
    }
  }
}
```

---

### 4. Moods Slice

**Purpose**: Daily mood tracking

**State**:
```typescript
moods: MoodEntry[];
```

**Initial Value**: `[]`

**Actions**:

#### addMoodEntry
```typescript
addMoodEntry: (mood: MoodType, note?: string) => void
```
**Purpose**: Add or update today's mood entry

**Example**:
```typescript
const { addMoodEntry } = useAppStore();

addMoodEntry('grateful', 'Had an amazing day together!');
```

**Implementation**:
```typescript
addMoodEntry: (mood, note) => {
  const today = new Date().toISOString().split('T')[0];
  const newMood: MoodEntry = {
    date: today,
    mood,
    note,
  };

  set((state) => ({
    moods: [...state.moods.filter((m) => m.date !== today), newMood],
  }));
}
```

**Behavior**: Replaces existing mood for today (only one mood per day)

#### getMoodForDate
```typescript
getMoodForDate: (date: string) => MoodEntry | undefined
```
**Purpose**: Retrieve mood entry for a specific date

**Example**:
```typescript
const { getMoodForDate } = useAppStore();

const todayMood = getMoodForDate('2024-10-30');
if (todayMood) {
  console.log(`Feeling ${todayMood.mood}`);
}
```

**Implementation**:
```typescript
getMoodForDate: (date) => {
  return get().moods.find((m) => m.date === date);
}
```

---

### 5. Anniversary Slice

**Purpose**: Manage special dates

**State**: Stored within `settings.relationship.anniversaries`

**Actions**:

#### addAnniversary
```typescript
addAnniversary: (anniversary: Omit<Anniversary, 'id'>) => void
```
**Purpose**: Add a new anniversary to the list

**Example**:
```typescript
const { addAnniversary } = useAppStore();

addAnniversary({
  date: '2023-06-20',
  label: 'First "I Love You"',
  description: 'Under the stars at the beach'
});
```

**Implementation**:
```typescript
addAnniversary: (anniversary) => {
  const { settings } = get();
  if (settings) {
    const newId =
      Math.max(0, ...settings.relationship.anniversaries.map((a) => a.id)) + 1;
    const newAnniversary: Anniversary = { ...anniversary, id: newId };

    set({
      settings: {
        ...settings,
        relationship: {
          ...settings.relationship,
          anniversaries: [...settings.relationship.anniversaries, newAnniversary],
        },
      },
    });
  }
}
```

**ID Generation**: Max existing ID + 1

#### removeAnniversary
```typescript
removeAnniversary: (id: number) => void
```
**Purpose**: Delete an anniversary by ID

**Example**:
```typescript
const { removeAnniversary } = useAppStore();

removeAnniversary(3);
```

**Implementation**:
```typescript
removeAnniversary: (id) => {
  const { settings } = get();
  if (settings) {
    set({
      settings: {
        ...settings,
        relationship: {
          ...settings.relationship,
          anniversaries: settings.relationship.anniversaries.filter(
            (a) => a.id !== id
          ),
        },
      },
    });
  }
}
```

---

### 6. Theme Slice

**Purpose**: Manage active theme

**State**: Stored within `settings.themeName`

**Actions**:

#### setTheme
```typescript
setTheme: (theme: ThemeName) => void
```
**Purpose**: Change the active theme

**Example**:
```typescript
const { setTheme } = useAppStore();

setTheme('ocean');
```

**Implementation**:
```typescript
setTheme: (theme) => {
  const { settings } = get();
  if (settings) {
    set({
      settings: {
        ...settings,
        themeName: theme,
      },
    });
  }
}
```

**Side Effects**: Theme change is detected in `App.tsx` and applies CSS variables

---

### 7. UI State Slice

**Purpose**: Loading and error states

**State**:
```typescript
isLoading: boolean;
error: string | null;
```

**Initial Values**:
- `isLoading`: `false`
- `error`: `null`

**Usage**: Set during async operations (primarily in `initializeApp`)

---

### 8. Initialization Slice

**Purpose**: App startup logic

**Actions**:

#### initializeApp
```typescript
initializeApp: () => Promise<void>
```
**Purpose**: Initialize IndexedDB and load initial data

**Called**: Once on app mount in `App.tsx` useEffect

**Example**:
```typescript
const { initializeApp } = useAppStore();

useEffect(() => {
  initializeApp();
}, [initializeApp]);
```

**Implementation**:
```typescript
initializeApp: async () => {
  set({ isLoading: true, error: null });

  try {
    // 1. Initialize IndexedDB
    await storageService.init();

    // 2. Load messages from IndexedDB
    const storedMessages = await storageService.getAllMessages();

    // 3. If no messages exist, populate with defaults
    if (storedMessages.length === 0) {
      const messagesToAdd = defaultMessages.map((msg, index) => ({
        ...msg,
        id: index + 1,
        createdAt: new Date(),
        isCustom: false,
      }));

      await storageService.addMessages(messagesToAdd);
      set({ messages: messagesToAdd });
    } else {
      set({ messages: storedMessages });
    }

    // 4. Update current message for today
    get().updateCurrentMessage();

    set({ isLoading: false });
  } catch (error) {
    console.error('Error initializing app:', error);
    set({ error: 'Failed to initialize app', isLoading: false });
  }
}
```

**Steps**:
1. Set loading state
2. Initialize IndexedDB connection
3. Load messages (or populate defaults)
4. Compute current daily message
5. Clear loading state

---

## Persistence Configuration

### Persist Middleware

**Configuration**:
```typescript
persist(
  (set, get) => ({ /* store */ }),
  {
    name: 'my-love-storage',
    version: 1, // State schema version for future migrations
    partialize: (state) => ({
      settings: state.settings,
      isOnboarded: state.isOnboarded,
      messageHistory: state.messageHistory,
      moods: state.moods,
    }),
    onRehydrateStorage: () => (state, error) => {
      if (error) {
        console.error('[Zustand Persist] Failed to rehydrate state:', error);
        localStorage.removeItem('my-love-storage');
        console.warn('[Zustand Persist] Corrupted state cleared.');
        return;
      }
      if (state) {
        console.log('[Zustand Persist] State successfully rehydrated');
      }
    },
  }
)
```

**Options**:

| Option | Value | Purpose |
|--------|-------|---------|
| `name` | `'my-love-storage'` | LocalStorage key |
| `version` | `1` | State schema version for migrations |
| `partialize` | Function | Select which state to persist |
| `onRehydrateStorage` | Callback | Error handling and recovery |

### Persisted vs. Non-Persisted State

**Persisted to LocalStorage**:
- `settings` - User preferences
- `isOnboarded` - Onboarding status
- `messageHistory` - Message rotation tracking
- `moods` - Daily mood entries

**Not Persisted** (loaded on init):
- `messages` - Stored in IndexedDB
- `photos` - Stored in IndexedDB
- `currentMessage` - Computed from messages
- `isLoading` - Runtime UI state
- `error` - Runtime UI state

**Rationale**:
- Large data (messages, photos) → IndexedDB
- Small config data → LocalStorage
- Computed state → Re-calculated on load
- Transient state → Not persisted

---

## Usage Patterns

### 1. Component Usage

**Basic Hook**:
```typescript
import { useAppStore } from '../stores/useAppStore';

function MyComponent() {
  const { currentMessage, toggleFavorite } = useAppStore();

  return (
    <div>
      <p>{currentMessage?.text}</p>
      <button onClick={() => toggleFavorite(currentMessage.id)}>
        Favorite
      </button>
    </div>
  );
}
```

### 2. Selective Subscriptions

**Problem**: Re-renders on any state change

**Solution**: Use selectors

```typescript
// ❌ Bad: Re-renders on any store change
const store = useAppStore();

// ✅ Good: Only re-renders when currentMessage changes
const currentMessage = useAppStore((state) => state.currentMessage);
const toggleFavorite = useAppStore((state) => state.toggleFavorite);
```

### 3. Accessing Store Outside Components

**Method 1**: Direct store access
```typescript
import { useAppStore } from '../stores/useAppStore';

// Outside component
const messages = useAppStore.getState().messages;
```

**Method 2**: Subscribe to changes
```typescript
import { useAppStore } from '../stores/useAppStore';

useAppStore.subscribe((state) => {
  console.log('Settings changed:', state.settings);
});
```

### 4. Conditional Actions

**Pattern**: Check state before executing

```typescript
const { settings, updateSettings } = useAppStore();

function updateTheme(newTheme: ThemeName) {
  if (settings) {
    updateSettings({ themeName: newTheme });
  } else {
    console.warn('Cannot update theme: settings not initialized');
  }
}
```

### 5. Optimistic Updates

**Pattern**: Update UI before async operation completes

```typescript
toggleFavorite: async (messageId) => {
  // 1. Optimistically update UI
  set((state) => ({
    messages: state.messages.map((msg) =>
      msg.id === messageId ? { ...msg, isFavorite: !msg.isFavorite } : msg
    ),
  }));

  try {
    // 2. Persist to IndexedDB
    await storageService.toggleFavorite(messageId);
  } catch (error) {
    // 3. Rollback on error
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId ? { ...msg, isFavorite: !msg.isFavorite } : msg
      ),
    }));
    console.error('Failed to toggle favorite:', error);
  }
}
```

---

## State Update Patterns

### 1. Simple State Update

```typescript
set({ isLoading: true });
```

### 2. Computed State Update

```typescript
set((state) => ({
  messages: [...state.messages, newMessage]
}));
```

### 3. Nested State Update

```typescript
set((state) => ({
  settings: {
    ...state.settings,
    relationship: {
      ...state.settings.relationship,
      partnerName: 'New Name'
    }
  }
}));
```

### 4. Multiple State Updates

```typescript
set({
  isLoading: false,
  error: null,
  messages: loadedMessages
});
```

### 5. Conditional Update

```typescript
const { settings } = get();
if (settings) {
  set({ settings: { ...settings, themeName: 'ocean' } });
}
```

---

## State Access Methods

### get()
**Purpose**: Access current state within actions

```typescript
const currentState = get();
console.log(currentState.messages.length);
```

### set()
**Purpose**: Update state

```typescript
set({ isLoading: true });
set((state) => ({ count: state.count + 1 }));
```

### useAppStore.getState()
**Purpose**: Access state outside React components

```typescript
const currentMessages = useAppStore.getState().messages;
```

### useAppStore.subscribe()
**Purpose**: Subscribe to state changes outside React

```typescript
const unsubscribe = useAppStore.subscribe((state, prevState) => {
  if (state.settings !== prevState.settings) {
    console.log('Settings changed!');
  }
});

// Later: unsubscribe()
```

---

## Performance Optimization

### 1. Use Selectors

```typescript
// ✅ Good: Only subscribes to currentMessage
const currentMessage = useAppStore((state) => state.currentMessage);

// ❌ Bad: Subscribes to entire store
const { currentMessage } = useAppStore();
```

### 2. Memoize Derived State

```typescript
import { useMemo } from 'react';

const messages = useAppStore((state) => state.messages);
const favoriteMessages = useMemo(
  () => messages.filter(m => m.isFavorite),
  [messages]
);
```

### 3. Batch Updates

```typescript
// ❌ Bad: Two separate renders
set({ isLoading: true });
set({ error: null });

// ✅ Good: Single render
set({ isLoading: true, error: null });
```

### 4. Shallow Equality for Objects

```typescript
import shallow from 'zustand/shallow';

const { settings, isOnboarded } = useAppStore(
  (state) => ({ settings: state.settings, isOnboarded: state.isOnboarded }),
  shallow
);
```

---

## Debugging

### Zustand DevTools

**Installation** (optional):
```bash
npm install --save-dev @redux-devtools/extension
```

**Integration**:
```typescript
import { devtools } from 'zustand/middleware';

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set, get) => ({ /* store */ }),
      { name: 'my-love-storage' }
    ),
    { name: 'MyLoveStore' }
  )
);
```

### Console Logging

**Log all state changes**:
```typescript
useAppStore.subscribe((state) => {
  console.log('State updated:', state);
});
```

**Log specific slice changes**:
```typescript
useAppStore.subscribe((state, prevState) => {
  if (state.currentMessage !== prevState.currentMessage) {
    console.log('Current message changed:', state.currentMessage);
  }
});
```

---

## Testing

### Unit Testing Actions

```typescript
import { renderHook, act } from '@testing-library/react';
import { useAppStore } from './useAppStore';

test('toggleFavorite updates message', async () => {
  const { result } = renderHook(() => useAppStore());

  await act(async () => {
    await result.current.toggleFavorite(42);
  });

  const message = result.current.messages.find(m => m.id === 42);
  expect(message?.isFavorite).toBe(true);
});
```

### Resetting State (for tests)

```typescript
beforeEach(() => {
  useAppStore.setState({
    settings: null,
    isOnboarded: false,
    messages: [],
    // ... reset all state
  });
});
```

---

## Migration Guide

### Adding New State

1. **Update interface**:
   ```typescript
   interface AppState {
     // ... existing
     newFeature: NewFeatureData[];
   }
   ```

2. **Add initial value**:
   ```typescript
   persist(
     (set, get) => ({
       // ... existing
       newFeature: [],
     }),
     // ...
   )
   ```

3. **Add to partialize** (if should persist):
   ```typescript
   partialize: (state) => ({
     // ... existing
     newFeature: state.newFeature,
   })
   ```

4. **Add actions**:
   ```typescript
   addNewFeature: (data: NewFeatureData) => {
     set((state) => ({
       newFeature: [...state.newFeature, data]
     }));
   }
   ```

---

## Troubleshooting Persistence Issues

### Problem: State Not Persisting Across Sessions

**Symptoms:**
- Settings, favorites, or mood entries disappear after browser refresh
- App behaves as if it's the first time opening

**Diagnosis:**
1. Open Chrome DevTools → Application tab → Local Storage
2. Look for `my-love-storage` key
3. Check if value is a valid JSON object

**Common Causes & Solutions:**

**1. LocalStorage Disabled (Private Browsing)**
- Private browsing mode blocks LocalStorage writes
- **Solution**: Use app in normal browser mode, or expect state to reset each session

**2. LocalStorage Quota Exceeded**
- Browser storage limit reached (typically 5-10MB)
- **Symptoms**: Console shows `[Zustand Persist] Failed to rehydrate state`
- **Solution**:
  - Open DevTools → Application → Local Storage
  - Clear other sites' data or the `my-love-storage` key
  - Reload app (will reinitialize with defaults)

**3. Corrupted State Data**
- Invalid JSON in LocalStorage causes rehydration failure
- **Symptoms**: Console shows rehydration error, then "Corrupted state cleared"
- **Solution**: Automatic - corrupted state is cleared and app reinitializes
- **Manual Fix**: Delete `my-love-storage` key in DevTools and reload

**4. Browser Extensions Blocking Storage**
- Some privacy extensions block LocalStorage
- **Solution**: Whitelist the app domain or disable extension temporarily

### Problem: Specific State Not Persisting

**Check Partialize Configuration:**

Only these fields are persisted:
- ✅ `settings` - User preferences, theme, relationship data
- ✅ `isOnboarded` - Onboarding completion status
- ✅ `messageHistory` - Message rotation tracking
- ✅ `moods` - Daily mood entries

These are **NOT** persisted (by design):
- ❌ `messages` - Stored in IndexedDB (separate storage layer)
- ❌ `photos` - Stored in IndexedDB
- ❌ `currentMessage` - Computed on app init from messages + messageHistory
- ❌ `isLoading`, `error` - Transient UI state

If a field you expect to persist is in the "NOT persisted" list, that's intentional architecture (large data → IndexedDB, computed state → recalculated).

### Problem: Data Loss After Update

**Migration Strategy:**

The persist middleware uses `version: 1` to track state schema changes.

**If you see this error after an update:**
```
[Zustand Persist] Failed to rehydrate state: <error>
[Zustand Persist] Corrupted state cleared.
```

**What happened:**
- State schema changed in a new version
- Old persisted data is incompatible
- Middleware automatically cleared incompatible state

**Recovery:**
- App will reinitialize with defaults
- You'll need to re-enter settings (partner name, relationship start date)
- Message history and moods will reset

**Future-Proofing:**
- Future updates may include migration logic to preserve data across schema changes
- Currently, schema changes require manual re-entry of settings

### Debugging Tools

**Check Persisted State:**
```javascript
// In browser console
JSON.parse(localStorage.getItem('my-love-storage'))
```

**Manually Clear State:**
```javascript
// In browser console
localStorage.removeItem('my-love-storage');
location.reload();
```

**Check Rehydration Status:**
- Look for console logs:
  - ✅ `[Zustand Persist] State successfully rehydrated`
  - ❌ `[Zustand Persist] Failed to rehydrate state`

**Inspect State in DevTools:**
- Install React DevTools extension
- Select Components tab → useAppStore hook
- View current state values

### Error Recovery Flow

```
1. App loads → Persist middleware attempts rehydration
2. If error occurs:
   a. Console error logged with details
   b. Corrupted state automatically cleared
   c. App continues with default initial state
3. User sees fresh app (like first visit)
4. No crash or infinite loops - graceful fallback
```

---

## Related Documentation

- **Data Models**: See `/docs/data-models.md`
- **Architecture**: See `/docs/architecture.md`
- **Store Implementation**: See `/src/stores/useAppStore.ts`
- **Zustand Docs**: https://zustand.docs.pmnd.rs/

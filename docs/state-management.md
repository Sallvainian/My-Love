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

## IndexedDB and Service Worker Configuration

### Overview

**My Love** uses IndexedDB for large data storage (messages, photos) and a service worker (via vite-plugin-pwa with Workbox) for offline-first PWA capabilities. This section documents how these systems interact and the error handling patterns applied.

**Key Insight**: IndexedDB operations are **browser API calls** (not HTTP requests), so service workers do **NOT** intercept them. This means:
- No special service worker configuration is needed to "exclude" IndexedDB
- IndexedDB transactions complete independently of service worker cache state
- The service worker only intercepts `fetch` events (network requests for HTML, JS, CSS, images, etc.)

### Service Worker Configuration

**File**: `/vite.config.ts`

**Workbox Configuration**:
```typescript
workbox: {
  // IndexedDB operations are browser API calls (not HTTP requests),
  // so service worker caching strategies do NOT intercept them.
  // No navigateFallbackDenylist or exclusions needed for IndexedDB.
  globPatterns: ['**/*.{js,css,html,png,jpg,jpeg,svg,woff2}'],
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts-cache',
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
        },
        cacheableResponse: {
          statuses: [0, 200]
        }
      }
    }
  ]
}
```

**What gets cached:**
- Static app shell assets (JS, CSS, HTML, images) via `globPatterns`
- Google Fonts (external API) via `runtimeCaching`

**What does NOT get cached:**
- IndexedDB operations (not HTTP requests)
- `storageService` method calls (pure JavaScript API calls)

**Conclusion**: No service worker configuration changes are needed for IndexedDB compatibility.

### StorageService Error Handling

**File**: `/src/services/storage.ts`

All IndexedDB operations now include comprehensive error handling following the Story 1.2 pattern:

**Pattern**:
1. **Try-catch blocks** wrap all async IndexedDB operations
2. **Comprehensive console logging** for debugging (all logs prefixed with `[StorageService]`)
3. **Fallback behavior**:
   - Read operations (get, getAll): Return `undefined` or `[]` on failure (graceful degradation)
   - Write operations (add, update, delete): Re-throw errors for caller to handle (preserve data integrity)
4. **Edge cases handled**: Permission denied, quota exceeded, corrupted database, blocked transactions

**Example - Read Operation (Graceful Fallback)**:
```typescript
async getAllMessages(): Promise<Message[]> {
  try {
    await this.init();
    const messages = await this.db!.getAll('messages');
    console.log('[StorageService] Retrieved all messages, count:', messages.length);
    return messages;
  } catch (error) {
    console.error('[StorageService] Failed to get all messages:', error);
    return []; // Graceful fallback: return empty array
  }
}
```

**Example - Write Operation (Throw for Integrity)**:
```typescript
async addMessage(message: Omit<Message, 'id'>): Promise<number> {
  try {
    await this.init();
    console.log('[StorageService] Adding message to IndexedDB');
    const id = await this.db!.add('messages', message as Message);
    console.log('[StorageService] Message added successfully, id:', id);
    return id;
  } catch (error) {
    console.error('[StorageService] Failed to add message:', error);
    console.error('[StorageService] Message data:', message);
    throw error; // Re-throw to allow caller to handle
  }
}
```

**Store Integration**:

The `useAppStore.initializeApp()` method already has try-catch error handling that works with the enhanced StorageService:

```typescript
initializeApp: async () => {
  set({ isLoading: true, error: null });

  try {
    await storageService.init(); // May throw if IndexedDB fails
    const storedMessages = await storageService.getAllMessages(); // Returns [] on failure

    if (storedMessages.length === 0) {
      await storageService.addMessages(messagesToAdd); // May throw if write fails
      set({ messages: messagesToAdd });
    } else {
      set({ messages: storedMessages });
    }

    get().updateCurrentMessage();
    set({ isLoading: false });
  } catch (error) {
    console.error('Error initializing app:', error);
    set({ error: 'Failed to initialize app', isLoading: false });
    // App continues with default state - graceful degradation
  }
}
```

**Error Recovery Strategy**:
1. If IndexedDB initialization fails → App shows error state but doesn't crash
2. If message loading fails → Returns empty array, app populates defaults
3. If write operations fail → Error logged, user sees failure (data integrity preserved)

### Offline Testing Procedures

Since no automated test infrastructure exists yet (per Story 1.1 audit), manual browser-based testing is required.

**Prerequisites**:
- Chrome or Edge browser (DevTools has best IndexedDB inspection tools)
- Built and running app (`npm run dev` or `npm run build && npm run preview`)

---

#### Test 1: Offline Message Favorite Persistence (AC: 5)

**Goal**: Verify favorites persist when offline and survive app restart

**Steps**:
1. Open app in browser
2. Open DevTools (F12) → **Network** tab
3. Enable **Offline** mode (checkbox or dropdown)
4. Click favorite/heart icon on a message
5. **Verify**: Console shows `[StorageService] Favorite toggled successfully`
6. Open DevTools → **Application** tab → **IndexedDB** → `my-love-db` → `messages`
7. **Verify**: Message has `isFavorite: true` in IndexedDB
8. Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)
9. **Verify**: Favorite persists after restart
10. Toggle favorite multiple times offline
11. **Verify**: All changes persist in IndexedDB

**Expected Console Logs**:
```
[StorageService] Favorite toggled successfully, id: 42, new value: true
[StorageService] Message updated successfully, id: 42
```

**Expected Behavior**:
- ✅ Favorite toggles work offline
- ✅ Changes visible in IndexedDB immediately
- ✅ Favorites persist after hard refresh
- ✅ No network errors in console

---

#### Test 2: Offline Photo Persistence (AC: 4)

**Goal**: Verify photos persist offline and remain accessible

**Steps**:
1. Enable **Offline** mode in DevTools
2. Navigate to Photos tab (if implemented) or use photo upload feature
3. Add a photo
4. **Verify**: Console shows `[StorageService] Photo added successfully`
5. Open DevTools → **Application** → **IndexedDB** → `my-love-db` → `photos`
6. **Verify**: Photo entry exists with correct data
7. Disable offline mode (go online)
8. **Verify**: Photo displays correctly
9. Close app offline → Reopen offline
10. **Verify**: Photo still accessible

**Expected Console Logs**:
```
[StorageService] Adding photo to IndexedDB
[StorageService] Photo added successfully, id: 1
```

**Expected Behavior**:
- ✅ Photo upload works offline
- ✅ Photo stored in IndexedDB
- ✅ Photo persists after network changes
- ✅ Photo accessible after app restart offline

---

#### Test 3: Service Worker Non-Interference (AC: 2)

**Goal**: Verify service worker doesn't block IndexedDB operations

**Steps**:
1. Ensure service worker is active: DevTools → **Application** → **Service Workers**
2. **Verify**: Service worker status shows "activated and running"
3. Perform IndexedDB operations (favorite message, add message)
4. Check **Console** for errors
5. Check **Network** tab
6. **Verify**: IndexedDB operations do NOT appear in Network tab (they're not HTTP requests)
7. Disable service worker temporarily (click "Unregister")
8. Repeat IndexedDB operations
9. **Compare behavior**: Should be identical with or without service worker

**Expected Console Logs**:
```
[StorageService] Favorite toggled successfully, id: 5, new value: true
```

**Expected Behavior**:
- ✅ No "failed to execute transaction" errors
- ✅ IndexedDB operations NOT in Network tab
- ✅ Same behavior with SW enabled/disabled
- ✅ No blocking or delays

---

#### Test 4: Fresh Install Offline (AC: 1, 3)

**Goal**: Verify app initializes with default messages when offline

**Steps**:
1. Clear all site data: DevTools → **Application** → **Clear storage** → "Clear site data"
2. Enable **Offline** mode
3. Hard refresh (Cmd+Shift+R)
4. **Verify**: App loads successfully
5. Check **Console** for initialization logs
6. Open IndexedDB → `my-love-db` → `messages`
7. **Verify**: Default messages populated (e.g., 100 messages)
8. Check message display on screen
9. **Verify**: Daily message appears

**Expected Console Logs**:
```
[StorageService] Initializing IndexedDB...
[StorageService] Created messages object store
[StorageService] IndexedDB initialized successfully
[StorageService] Adding bulk messages to IndexedDB, count: 100
[StorageService] Bulk messages added successfully
```

**Expected Behavior**:
- ✅ App initializes offline successfully
- ✅ Default messages populate IndexedDB
- ✅ No network errors prevent initialization
- ✅ Daily message displays correctly

---

#### Test 5: Service Worker Update Scenario (AC: 3)

**Goal**: Verify IndexedDB data intact after service worker updates

**Steps**:
1. With app loaded, favorite some messages
2. Make a code change (e.g., add comment to `vite.config.ts`)
3. Rebuild app (`npm run build`)
4. Reload page → Service worker will update
5. DevTools → **Application** → **Service Workers**
6. **Verify**: New service worker activated
7. Check IndexedDB → `messages`
8. **Verify**: Favorites still present
9. Check all persisted data (moods, settings)
10. **Verify**: No data loss

**Expected Behavior**:
- ✅ Service worker updates successfully
- ✅ IndexedDB data intact
- ✅ Favorites preserved
- ✅ No data corruption

---

#### Test 6: Network Toggle Stress Test (AC: 1, 3)

**Goal**: Verify no data loss during rapid online/offline changes

**Steps**:
1. Start online, perform operations (favorite, add message)
2. Toggle to **Offline** in DevTools
3. Perform more operations
4. Toggle back to **Online**
5. Perform more operations
6. Repeat cycle 3-5 times rapidly
7. Check IndexedDB data integrity
8. Check console for errors
9. Verify all changes persisted

**Expected Behavior**:
- ✅ No data loss during network changes
- ✅ All operations complete successfully
- ✅ No race conditions or transaction failures
- ✅ Console shows successful operations

---

#### Test 7: Regression Test - All Features (AC: 1, 2, 3)

**Goal**: Verify existing features still work correctly

**Test Matrix**:
| Feature | Offline? | Expected Result |
|---------|----------|----------------|
| Display daily message | ✅ | Works |
| Toggle favorite | ✅ | Persists |
| Add custom message | ✅ | Stored |
| Navigate between categories | ✅ | Works |
| Theme switching | ✅ | Persists |
| Mood entry | ✅ | Saved |
| Settings changes | ✅ | Persisted |

**Steps**:
1. Enable **Offline** mode
2. Test each feature in the matrix
3. Verify console logs show successful operations
4. Check IndexedDB for persisted data
5. Verify no errors or warnings

**Expected Behavior**:
- ✅ All features functional offline
- ✅ Data persists correctly
- ✅ No feature regressions

---

### Debugging IndexedDB Issues

**Common Problems**:

**1. "Failed to execute 'transaction' on 'IDBDatabase'"**
- **Cause**: Attempting transaction on closed or version-changing database
- **Check Console**: Look for `[StorageService]` error logs
- **Solution**: Automatic retry via `this.init()` in each method

**2. "QuotaExceededError"**
- **Cause**: Browser storage quota exceeded (typically 10-50% of available disk space)
- **Check**: DevTools → Application → Storage → Check quota usage
- **Solution**: Delete large photos, clear unused messages, or increase browser quota

**3. "UnknownError" or "AbortError"**
- **Cause**: Database corruption, permission issues, or browser bug
- **Check Console**: Detailed error logs from StorageService
- **Solution**: Clear site data and reinitialize

**4. Operations Silently Failing**
- **Symptom**: No errors, but changes don't persist
- **Check**: DevTools → Application → IndexedDB → Verify data written
- **Possible Cause**: Private browsing mode (IndexedDB may be disabled)
- **Solution**: Use normal browsing mode

**Debugging Tools**:

**Inspect IndexedDB**:
```javascript
// In browser console
indexedDB.databases().then(dbs => console.log(dbs));
```

**Check StorageService Logs**:
- All operations log to console with `[StorageService]` prefix
- Look for error logs with operation context
- Example: `[StorageService] Failed to add message:` followed by error details

**Manual Database Reset**:
```javascript
// In browser console
indexedDB.deleteDatabase('my-love-db');
location.reload(); // Will reinitialize with defaults
```

**Verify Service Worker Not Caching**:
- Open DevTools → Network tab
- Perform IndexedDB operations
- Verify NO network requests appear (IndexedDB is local API calls)

---

### Technical Details

**IndexedDB Schema**:
- Database: `my-love-db` (version 1)
- Object Stores:
  - `photos`: Auto-increment key, index on `uploadDate`
  - `messages`: Auto-increment key, indexes on `category` and `createdAt`

**Service Worker Lifecycle**:
1. App loads → Service worker registers
2. Service worker installs → Precaches static assets
3. Service worker activates → Intercepts fetch events
4. IndexedDB operations happen independently (not intercepted)

**Data Flow**:
```
User Action → Component → Store Action → storageService → IndexedDB
                                      ↓
                              Console Logging (debugging)
```

**Error Handling Flow**:
```
IndexedDB Operation Attempt
  ├─ Success → Log success → Return data
  └─ Failure → Log error with context
       ├─ Read operation → Return fallback (undefined/[])
       └─ Write operation → Throw error → Caller handles
```

---

## Related Documentation

- **Data Models**: See `/docs/data-models.md`
- **Architecture**: See `/docs/architecture.md`
- **Store Implementation**: See `/src/stores/useAppStore.ts`
- **Zustand Docs**: https://zustand.docs.pmnd.rs/

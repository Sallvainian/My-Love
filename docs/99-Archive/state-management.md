# State Management Architecture

> **Last Updated**: 2025-11-16
> **State Library**: Zustand 5.0.8
> **Total Slices**: 7
> **Total Actions**: 59

## Overview

My Love PWA uses **Zustand** for state management with a slice-based architecture. The store is composed of feature-specific slices that are merged into a single store with automatic LocalStorage persistence.

### Key Features

- **Slice-Based Architecture**: Each feature has its own isolated slice
- **Automatic Persistence**: LocalStorage middleware saves state automatically
- **Type Safety**: Full TypeScript support with inferred types
- **React 19 Compatible**: Works with React's latest features
- **Minimal Boilerplate**: Simple API without Redux complexity

## Store Architecture

### Main Store Composition

```typescript
// src/stores/useAppStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createSettingsSlice } from './slices/settingsSlice';
import { createMessagesSlice } from './slices/messagesSlice';
import { createPhotosSlice } from './slices/photosSlice';
import { createMoodSlice } from './slices/moodSlice';
import { createPartnerSlice } from './slices/partnerSlice';
import { createInteractionsSlice } from './slices/interactionsSlice';
import { createNavigationSlice } from './slices/navigationSlice';

export const useAppStore = create<AppState>()(
  persist(
    (...args) => ({
      ...createSettingsSlice(...args),
      ...createMessagesSlice(...args),
      ...createPhotosSlice(...args),
      ...createMoodSlice(...args),
      ...createPartnerSlice(...args),
      ...createInteractionsSlice(...args),
      ...createNavigationSlice(...args),
    }),
    {
      name: 'my-love-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist essential data, not UI state
        settings: {
          displayName: state.displayName,
          theme: state.theme,
          partnerName: state.partnerName,
          relationshipStartDate: state.relationshipStartDate,
          anniversaries: state.anniversaries,
          hasCompletedOnboarding: state.hasCompletedOnboarding,
        },
        messages: {
          currentDayNumber: state.currentDayNumber,
          favorites: state.favorites,
          customMessages: state.customMessages,
          shownMessageIds: Array.from(state.shownMessageIds),
        },
        photos: {
          // Photos stored in IndexedDB, not LocalStorage
        },
        mood: {
          // Mood history synced to Supabase
          moodHistory: state.moodHistory,
        },
      }),
    }
  )
);
```

## Feature Slices Deep Dive

### Settings Slice (12 Actions)

**Purpose**: User preferences, authentication, and relationship configuration

```typescript
// src/stores/slices/settingsSlice.ts

interface SettingsSlice {
  // State
  displayName: string;
  userId: string | null;
  email: string | null;
  isAuthenticated: boolean;
  authToken: string | null;
  sessionExpiry: string | null;
  theme: ThemeName;
  partnerName: string;
  relationshipStartDate: string;
  anniversaries: Anniversary[];
  hasCompletedOnboarding: boolean;
  isFirstVisit: boolean;
  lastOpenedDate: string;

  // Actions
  setDisplayName: (name: string) => void;
  setTheme: (theme: ThemeName) => void;
  setPartnerName: (name: string) => void;
  setRelationshipStartDate: (date: string) => void;
  addAnniversary: (anniversary: Anniversary) => void;
  removeAnniversary: (id: string) => void;
  updateAnniversary: (id: string, updates: Partial<Anniversary>) => void;
  setAuthenticated: (status: boolean, token?: string) => void;
  setUserId: (id: string) => void;
  setEmail: (email: string) => void;
  completeOnboarding: () => void;
  resetSettings: () => void;
}

export const createSettingsSlice: StateCreator<AppState, [], [], SettingsSlice> = (set) => ({
  // Initial state
  displayName: '',
  userId: null,
  email: null,
  isAuthenticated: false,
  authToken: null,
  sessionExpiry: null,
  theme: 'sunset',
  partnerName: '',
  relationshipStartDate: new Date().toISOString(),
  anniversaries: [],
  hasCompletedOnboarding: false,
  isFirstVisit: true,
  lastOpenedDate: new Date().toISOString(),

  // Actions
  setDisplayName: (name) => set({ displayName: name }),
  setTheme: (theme) => set({ theme }),
  setPartnerName: (name) => set({ partnerName: name }),
  setRelationshipStartDate: (date) => set({ relationshipStartDate: date }),

  addAnniversary: (anniversary) =>
    set((state) => ({
      anniversaries: [...state.anniversaries, anniversary],
    })),

  removeAnniversary: (id) =>
    set((state) => ({
      anniversaries: state.anniversaries.filter((a) => a.id !== id),
    })),

  updateAnniversary: (id, updates) =>
    set((state) => ({
      anniversaries: state.anniversaries.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    })),

  setAuthenticated: (status, token) =>
    set({
      isAuthenticated: status,
      authToken: token || null,
      sessionExpiry: token ? new Date(Date.now() + 3600000).toISOString() : null,
    }),

  setUserId: (id) => set({ userId: id }),
  setEmail: (email) => set({ email }),
  completeOnboarding: () => set({ hasCompletedOnboarding: true, isFirstVisit: false }),
  resetSettings: () =>
    set({
      displayName: '',
      userId: null,
      email: null,
      isAuthenticated: false,
      authToken: null,
      theme: 'sunset',
      hasCompletedOnboarding: false,
    }),
});
```

### Messages Slice (11 Actions)

**Purpose**: Daily message rotation, favorites, history navigation, custom messages

```typescript
// src/stores/slices/messagesSlice.ts

interface MessagesSlice {
  // State
  currentDayNumber: number;
  currentMessage: Message | null;
  messageHistory: Message[];
  shownMessageIds: Set<string>;
  favorites: FavoriteMessage[];
  customMessages: Message[];
  historyIndex: number;
  canGoBack: boolean;
  canGoForward: boolean;

  // Actions
  setCurrentMessage: (message: Message) => void;
  incrementDayNumber: () => void;
  addToHistory: (message: Message) => void;
  toggleFavorite: (message: Message) => void;
  isFavorite: (messageId: string) => boolean;
  goBackInHistory: () => void;
  goForwardInHistory: () => void;
  addCustomMessage: (message: Omit<Message, 'id' | 'isCustom'>) => void;
  removeCustomMessage: (id: string) => void;
  updateCustomMessage: (id: string, updates: Partial<Message>) => void;
  resetMessages: () => void;
}

export const createMessagesSlice: StateCreator<AppState, [], [], MessagesSlice> = (set, get) => ({
  currentDayNumber: 1,
  currentMessage: null,
  messageHistory: [],
  shownMessageIds: new Set(),
  favorites: [],
  customMessages: [],
  historyIndex: -1,
  canGoBack: false,
  canGoForward: false,

  setCurrentMessage: (message) =>
    set({
      currentMessage: message,
      shownMessageIds: new Set([...get().shownMessageIds, message.id]),
    }),

  incrementDayNumber: () =>
    set((state) => ({
      currentDayNumber: state.currentDayNumber + 1,
    })),

  addToHistory: (message) =>
    set((state) => ({
      messageHistory: [...state.messageHistory, message],
      historyIndex: state.messageHistory.length,
      canGoBack: true,
      canGoForward: false,
    })),

  toggleFavorite: (message) =>
    set((state) => {
      const isFav = state.favorites.some((f) => f.id === message.id);
      if (isFav) {
        return { favorites: state.favorites.filter((f) => f.id !== message.id) };
      }
      return {
        favorites: [...state.favorites, { ...message, favoritedAt: new Date().toISOString() }],
      };
    }),

  isFavorite: (messageId) => get().favorites.some((f) => f.id === messageId),

  goBackInHistory: () =>
    set((state) => {
      const newIndex = Math.max(0, state.historyIndex - 1);
      return {
        historyIndex: newIndex,
        currentMessage: state.messageHistory[newIndex] || null,
        canGoBack: newIndex > 0,
        canGoForward: true,
      };
    }),

  goForwardInHistory: () =>
    set((state) => {
      const newIndex = Math.min(state.messageHistory.length - 1, state.historyIndex + 1);
      return {
        historyIndex: newIndex,
        currentMessage: state.messageHistory[newIndex] || null,
        canGoBack: true,
        canGoForward: newIndex < state.messageHistory.length - 1,
      };
    }),

  addCustomMessage: (messageData) => {
    const newMessage: Message = {
      ...messageData,
      id: crypto.randomUUID(),
      isCustom: true,
    };
    set((state) => ({
      customMessages: [...state.customMessages, newMessage],
    }));
  },

  removeCustomMessage: (id) =>
    set((state) => ({
      customMessages: state.customMessages.filter((m) => m.id !== id),
    })),

  updateCustomMessage: (id, updates) =>
    set((state) => ({
      customMessages: state.customMessages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    })),

  resetMessages: () =>
    set({
      currentDayNumber: 1,
      currentMessage: null,
      messageHistory: [],
      shownMessageIds: new Set(),
      favorites: [],
      historyIndex: -1,
      canGoBack: false,
      canGoForward: false,
    }),
});
```

### Photos Slice (9 Actions)

**Purpose**: Photo gallery management, carousel navigation, upload progress

```typescript
// src/stores/slices/photosSlice.ts

interface PhotosSlice {
  photos: Photo[];
  selectedPhotoId: string | null;
  isCarouselOpen: boolean;
  isLoading: boolean;
  uploadProgress: number;
  currentPage: number;
  pageSize: number;
  hasMorePhotos: boolean;
  totalPhotoCount: number;

  addPhoto: (photo: Photo) => void;
  removePhoto: (id: string) => void;
  updatePhoto: (id: string, updates: Partial<Photo>) => void;
  selectPhoto: (id: string) => void;
  clearSelection: () => void;
  openCarousel: (photoId: string) => void;
  closeCarousel: () => void;
  loadNextPage: () => Promise<void>;
  setUploadProgress: (progress: number) => void;
}

export const createPhotosSlice: StateCreator<AppState, [], [], PhotosSlice> = (set, get) => ({
  photos: [],
  selectedPhotoId: null,
  isCarouselOpen: false,
  isLoading: false,
  uploadProgress: 0,
  currentPage: 0,
  pageSize: 20,
  hasMorePhotos: true,
  totalPhotoCount: 0,

  addPhoto: (photo) =>
    set((state) => ({
      photos: [photo, ...state.photos],
      totalPhotoCount: state.totalPhotoCount + 1,
    })),

  removePhoto: (id) =>
    set((state) => ({
      photos: state.photos.filter((p) => p.id !== id),
      totalPhotoCount: Math.max(0, state.totalPhotoCount - 1),
      selectedPhotoId: state.selectedPhotoId === id ? null : state.selectedPhotoId,
    })),

  updatePhoto: (id, updates) =>
    set((state) => ({
      photos: state.photos.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),

  selectPhoto: (id) => set({ selectedPhotoId: id }),
  clearSelection: () => set({ selectedPhotoId: null }),

  openCarousel: (photoId) =>
    set({
      isCarouselOpen: true,
      selectedPhotoId: photoId,
    }),

  closeCarousel: () =>
    set({
      isCarouselOpen: false,
      selectedPhotoId: null,
    }),

  loadNextPage: async () => {
    const { currentPage, pageSize, hasMorePhotos } = get();
    if (!hasMorePhotos || get().isLoading) return;

    set({ isLoading: true });
    try {
      // Load from IndexedDB service
      const page = await photoStorageService.getPage(currentPage, pageSize);
      set((state) => ({
        photos: [...state.photos, ...page.photos],
        currentPage: currentPage + 1,
        hasMorePhotos: page.hasMore,
        isLoading: false,
      }));
    } catch (error) {
      set({ isLoading: false });
    }
  },

  setUploadProgress: (progress) => set({ uploadProgress: progress }),
});
```

### Mood Slice (10 Actions)

**Purpose**: Mood tracking, multi-emotion selection, calendar navigation, partner sync

```typescript
// src/stores/slices/moodSlice.ts

interface MoodSlice {
  currentMood: MoodEntry | null;
  moodHistory: MoodEntry[];
  selectedMoods: MoodType[];
  currentIntensity: number;
  currentNote: string;
  partnerCurrentMood: MoodEntry | null;
  calendarMonth: number;
  calendarYear: number;

  setSelectedMoods: (moods: MoodType[]) => void;
  toggleMoodSelection: (mood: MoodType) => void;
  setIntensity: (level: number) => void;
  setNote: (text: string) => void;
  saveMoodEntry: () => Promise<void>;
  loadMoodHistory: (userId: string) => Promise<void>;
  setPartnerMood: (entry: MoodEntry) => void;
  navigateCalendar: (month: number, year: number) => void;
  deleteMoodEntry: (id: string) => Promise<void>;
  resetMoodState: () => void;
}

export const createMoodSlice: StateCreator<AppState, [], [], MoodSlice> = (set, get) => ({
  currentMood: null,
  moodHistory: [],
  selectedMoods: [],
  currentIntensity: 3,
  currentNote: '',
  partnerCurrentMood: null,
  calendarMonth: new Date().getMonth(),
  calendarYear: new Date().getFullYear(),

  setSelectedMoods: (moods) => set({ selectedMoods: moods }),

  toggleMoodSelection: (mood) =>
    set((state) => {
      const isSelected = state.selectedMoods.includes(mood);
      return {
        selectedMoods: isSelected
          ? state.selectedMoods.filter((m) => m !== mood)
          : [...state.selectedMoods, mood],
      };
    }),

  setIntensity: (level) => set({ currentIntensity: level }),
  setNote: (text) => set({ currentNote: text }),

  saveMoodEntry: async () => {
    const { selectedMoods, currentIntensity, currentNote, userId } = get();
    if (selectedMoods.length === 0) return;

    const entry: MoodEntry = {
      id: crypto.randomUUID(),
      userId: userId || '',
      moods: selectedMoods,
      intensity: currentIntensity,
      note: currentNote || undefined,
      timestamp: new Date().toISOString(),
      syncedToCloud: false,
    };

    // Save locally first
    set((state) => ({
      currentMood: entry,
      moodHistory: [entry, ...state.moodHistory],
      selectedMoods: [],
      currentNote: '',
      currentIntensity: 3,
    }));

    // Sync to cloud
    try {
      await moodApi.saveMoodEntry(entry);
      set((state) => ({
        moodHistory: state.moodHistory.map((e) =>
          e.id === entry.id ? { ...e, syncedToCloud: true } : e
        ),
      }));
    } catch (error) {
      console.error('Failed to sync mood entry:', error);
    }
  },

  loadMoodHistory: async (userId) => {
    try {
      const history = await moodApi.getMoodHistory(userId);
      set({ moodHistory: history });
    } catch (error) {
      console.error('Failed to load mood history:', error);
    }
  },

  setPartnerMood: (entry) => set({ partnerCurrentMood: entry }),

  navigateCalendar: (month, year) =>
    set({
      calendarMonth: month,
      calendarYear: year,
    }),

  deleteMoodEntry: async (id) => {
    set((state) => ({
      moodHistory: state.moodHistory.filter((e) => e.id !== id),
    }));
    try {
      await moodApi.deleteMoodEntry(id);
    } catch (error) {
      console.error('Failed to delete mood entry:', error);
    }
  },

  resetMoodState: () =>
    set({
      currentMood: null,
      selectedMoods: [],
      currentIntensity: 3,
      currentNote: '',
      partnerCurrentMood: null,
    }),
});
```

### Partner Slice (8 Actions)

**Purpose**: Partner pairing, sync status, connection management

```typescript
// src/stores/slices/partnerSlice.ts

export const createPartnerSlice: StateCreator<AppState, [], [], PartnerSlice> = (set) => ({
  partnerId: null,
  partnerName: '',
  partnerDisplayName: '',
  isPaired: false,
  pairingCode: null,
  lastSyncTime: null,
  isSyncing: false,
  syncError: null,

  setPartner: (id, name) =>
    set({
      partnerId: id,
      partnerDisplayName: name,
      isPaired: true,
    }),

  generatePairingCode: async () => {
    const code = await partnerService.createPairingCode();
    set({ pairingCode: code });
    return code;
  },

  joinWithCode: async (code) => {
    try {
      const partner = await partnerService.joinPartner(code);
      set({
        partnerId: partner.id,
        partnerDisplayName: partner.displayName,
        isPaired: true,
        pairingCode: null,
      });
      return true;
    } catch {
      return false;
    }
  },

  clearPartner: () =>
    set({
      partnerId: null,
      partnerDisplayName: '',
      isPaired: false,
      pairingCode: null,
    }),

  setSyncStatus: (syncing) => set({ isSyncing: syncing }),
  setSyncError: (error) => set({ syncError: error }),
  updateLastSync: () => set({ lastSyncTime: new Date().toISOString() }),
  resetPartnerState: () =>
    set({
      partnerId: null,
      partnerName: '',
      isPaired: false,
      isSyncing: false,
      syncError: null,
    }),
});
```

### Interactions Slice (5 Actions)

**Purpose**: Poke/Kiss interactions with rate limiting

```typescript
// src/stores/slices/interactionsSlice.ts

export const createInteractionsSlice: StateCreator<AppState, [], [], InteractionsSlice> = (
  set,
  get
) => ({
  interactions: [],
  unreadCount: 0,
  lastPokeTime: null,
  lastKissTime: null,
  canPoke: true,
  canKiss: true,

  sendPoke: async (receiverId) => {
    const { canPoke } = get();
    if (!canPoke) return;

    set({ canPoke: false, lastPokeTime: new Date().toISOString() });

    try {
      await interactionService.sendInteraction('poke', receiverId);
      // Re-enable after cooldown (30 seconds)
      setTimeout(() => set({ canPoke: true }), 30000);
    } catch (error) {
      set({ canPoke: true });
    }
  },

  sendKiss: async (receiverId) => {
    const { canKiss } = get();
    if (!canKiss) return;

    set({ canKiss: false, lastKissTime: new Date().toISOString() });

    try {
      await interactionService.sendInteraction('kiss', receiverId);
      setTimeout(() => set({ canKiss: true }), 30000);
    } catch (error) {
      set({ canKiss: true });
    }
  },

  markAsRead: (id) =>
    set((state) => ({
      interactions: state.interactions.map((i) => (i.id === id ? { ...i, isRead: true } : i)),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),

  loadInteractions: async () => {
    const interactions = await interactionService.getInteractionHistory();
    set({
      interactions,
      unreadCount: interactions.filter((i) => !i.isRead).length,
    });
  },

  checkRateLimits: () => {
    const { lastPokeTime, lastKissTime } = get();
    const now = Date.now();
    const cooldown = 30000; // 30 seconds

    set({
      canPoke: !lastPokeTime || now - new Date(lastPokeTime).getTime() > cooldown,
      canKiss: !lastKissTime || now - new Date(lastKissTime).getTime() > cooldown,
    });
  },
});
```

### Navigation Slice (4 Actions)

**Purpose**: App view management and navigation history

```typescript
// src/stores/slices/navigationSlice.ts

type AppView = 'home' | 'photos' | 'mood' | 'settings' | 'admin';

export const createNavigationSlice: StateCreator<AppState, [], [], NavigationSlice> = (
  set,
  get
) => ({
  currentView: 'home',
  previousView: null,
  navigationHistory: ['home'],

  navigateTo: (view) =>
    set((state) => ({
      currentView: view,
      previousView: state.currentView,
      navigationHistory: [...state.navigationHistory, view],
    })),

  goBack: () => {
    const { navigationHistory } = get();
    if (navigationHistory.length <= 1) return;

    const newHistory = navigationHistory.slice(0, -1);
    set({
      currentView: newHistory[newHistory.length - 1],
      navigationHistory: newHistory,
      previousView: newHistory.length > 1 ? newHistory[newHistory.length - 2] : null,
    });
  },

  clearHistory: () =>
    set({
      navigationHistory: ['home'],
      previousView: null,
    }),

  resetNavigation: () =>
    set({
      currentView: 'home',
      previousView: null,
      navigationHistory: ['home'],
    }),
});
```

## Persistence Strategy

### What Gets Persisted

| Category          | Persisted | Storage                 | Reason             |
| ----------------- | --------- | ----------------------- | ------------------ |
| User Settings     | ✅ Yes    | LocalStorage            | User preferences   |
| Authentication    | ✅ Yes    | LocalStorage            | Session continuity |
| Theme             | ✅ Yes    | LocalStorage            | Visual preference  |
| Anniversaries     | ✅ Yes    | LocalStorage            | User data          |
| Message Favorites | ✅ Yes    | LocalStorage            | User selection     |
| Message History   | ✅ Yes    | LocalStorage            | Navigation state   |
| Custom Messages   | ✅ Yes    | IndexedDB               | Large data         |
| Photos            | ✅ Yes    | IndexedDB               | Blob storage       |
| Mood History      | ✅ Yes    | Supabase + LocalStorage | Sync + offline     |
| UI State          | ❌ No     | Memory only             | Transient state    |
| Loading States    | ❌ No     | Memory only             | Temporary          |
| Upload Progress   | ❌ No     | Memory only             | Temporary          |

### Hydration Pattern

```typescript
// Rehydration happens automatically on app load
// State is merged with initial values

const useAppStore = create<AppState>()(
  persist(
    // ... slices
    {
      name: 'my-love-storage',
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('Failed to rehydrate storage:', error);
        } else {
          // State has been loaded from LocalStorage
          console.log('State rehydrated successfully');
        }
      },
    }
  )
);
```

## Usage Patterns

### Basic Component Usage

```typescript
// Reading state
const DisplayNameComponent = () => {
  const displayName = useAppStore((state) => state.displayName);
  const theme = useAppStore((state) => state.theme);

  return <div className={themes[theme].textPrimary}>{displayName}</div>;
};
```

### Optimized Selectors

```typescript
// Memoized selector to prevent unnecessary re-renders
const selectMoodStats = (state: AppState) => ({
  totalMoods: state.moodHistory.length,
  averageIntensity: state.moodHistory.reduce((a, m) => a + m.intensity, 0) / state.moodHistory.length
});

const MoodStats = () => {
  const stats = useAppStore(selectMoodStats);
  // Only re-renders when moodHistory changes
  return <div>Total: {stats.totalMoods}, Avg: {stats.averageIntensity}</div>;
};
```

### Action Dispatching

```typescript
// Component with actions
const MoodTracker = () => {
  const selectedMoods = useAppStore((state) => state.selectedMoods);
  const toggleMoodSelection = useAppStore((state) => state.toggleMoodSelection);
  const saveMoodEntry = useAppStore((state) => state.saveMoodEntry);

  const handleSave = async () => {
    await saveMoodEntry();
    toast.success('Mood saved!');
  };

  return (
    <div>
      {MOOD_TYPES.map(mood => (
        <button
          key={mood}
          onClick={() => toggleMoodSelection(mood)}
          className={selectedMoods.includes(mood) ? 'selected' : ''}
        >
          {mood}
        </button>
      ))}
      <button onClick={handleSave}>Save</button>
    </div>
  );
};
```

### Multiple Store Values

```typescript
// Using shallow equality check for better performance
import { shallow } from 'zustand/shallow';

const PhotoGallery = () => {
  const { photos, isLoading, hasMorePhotos, loadNextPage } = useAppStore(
    (state) => ({
      photos: state.photos,
      isLoading: state.isLoading,
      hasMorePhotos: state.hasMorePhotos,
      loadNextPage: state.loadNextPage
    }),
    shallow // Prevents re-render if object reference changes but values don't
  );

  return (
    <InfiniteScroll
      items={photos}
      loading={isLoading}
      hasMore={hasMorePhotos}
      onLoadMore={loadNextPage}
    />
  );
};
```

## Performance Optimizations

### Selector Memoization

```typescript
// Derive computed values efficiently
const selectFavoriteCount = (state: AppState) => state.favorites.length;
const selectUnreadInteractions = (state: AppState) => state.unreadCount;

// Composed selector
const selectNotificationData = (state: AppState) => ({
  favoriteCount: state.favorites.length,
  unreadCount: state.unreadCount,
  hasNotifications: state.favorites.length > 0 || state.unreadCount > 0,
});
```

### Avoiding Unnecessary Renders

```typescript
// ❌ Bad: Creates new array on every render
const Component = () => {
  const messages = useAppStore((state) => [...state.messageHistory].reverse());
  // ...
};

// ✅ Good: Selector returns stable reference
const selectReversedHistory = (state: AppState) => {
  // Only recalculated when messageHistory changes
  return state.messageHistory.slice().reverse();
};

const Component = () => {
  const messages = useAppStore(selectReversedHistory);
  // ...
};
```

### Subscription Splitting

```typescript
// Split subscriptions for independent updates
const Header = () => {
  // Only re-renders when displayName changes
  const displayName = useAppStore((state) => state.displayName);
  return <h1>Welcome, {displayName}</h1>;
};

const ThemeToggle = () => {
  // Only re-renders when theme changes
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  return <button onClick={() => setTheme(nextTheme(theme))}>{theme}</button>;
};
```

## Best Practices

### 1. Keep Slices Focused

Each slice handles one domain (messages, photos, mood, etc.)

### 2. Use Immutable Updates

All state updates create new object references

### 3. Persist Essential Data Only

Don't persist loading states, UI state, or derived data

### 4. Optimize Selectors

Use shallow comparison and memoization where appropriate

### 5. Handle Async Actions Properly

Track loading/error states, handle failures gracefully

### 6. Type Everything

Full TypeScript coverage prevents runtime errors

---

**Generated by BMAD document-project workflow**
**Scan Level**: Exhaustive (all store slices analyzed)

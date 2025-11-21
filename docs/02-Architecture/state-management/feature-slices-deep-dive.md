# Feature Slices Deep Dive

## Settings Slice (12 Actions)

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

## Messages Slice (11 Actions)

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

## Photos Slice (9 Actions)

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

## Mood Slice (10 Actions)

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

## Partner Slice (8 Actions)

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

## Interactions Slice (5 Actions)

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

## Navigation Slice (4 Actions)

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

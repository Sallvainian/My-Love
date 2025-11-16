# State Slice Interfaces

## Settings Slice

```typescript
interface SettingsState {
  // User identity
  displayName: string;
  userId: string | null;
  email: string | null;

  // Authentication
  isAuthenticated: boolean;
  authToken: string | null;
  sessionExpiry: string | null;

  // Visual preferences
  theme: ThemeName;

  // Relationship data
  partnerName: string;
  relationshipStartDate: string; // ISO date
  anniversaries: Anniversary[];

  // App state
  hasCompletedOnboarding: boolean;
  isFirstVisit: boolean;
  lastOpenedDate: string;

  // Actions (12 total)
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
```

## Messages Slice

```typescript
interface MessagesState {
  // Current state
  currentDayNumber: number;
  currentMessage: Message | null;

  // History tracking
  messageHistory: Message[];
  shownMessageIds: Set<string>;

  // Favorites
  favorites: FavoriteMessage[];

  // Custom messages
  customMessages: Message[];

  // Navigation
  historyIndex: number;
  canGoBack: boolean;
  canGoForward: boolean;

  // Actions (11 total)
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
```

## Photos Slice

```typescript
interface PhotosState {
  photos: Photo[];
  selectedPhotoId: string | null;
  isCarouselOpen: boolean;
  isLoading: boolean;
  uploadProgress: number;

  // Pagination
  currentPage: number;
  pageSize: number;
  hasMorePhotos: boolean;
  totalPhotoCount: number;

  // Actions (9 total)
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
```

## Mood Slice

```typescript
interface MoodState {
  currentMood: MoodEntry | null;
  moodHistory: MoodEntry[];
  selectedMoods: MoodType[]; // Multi-select support
  currentIntensity: number;
  currentNote: string;

  // Partner mood
  partnerCurrentMood: MoodEntry | null;

  // Calendar view
  calendarMonth: number;
  calendarYear: number;

  // Actions (10 total)
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
```

## Partner Slice

```typescript
interface PartnerState {
  partnerId: string | null;
  partnerName: string;
  partnerDisplayName: string;
  isPaired: boolean;
  pairingCode: string | null;

  // Sync status
  lastSyncTime: string | null;
  isSyncing: boolean;
  syncError: string | null;

  // Actions (8 total)
  setPartner: (id: string, name: string) => void;
  generatePairingCode: () => Promise<string>;
  joinWithCode: (code: string) => Promise<boolean>;
  clearPartner: () => void;
  setSyncStatus: (syncing: boolean) => void;
  setSyncError: (error: string | null) => void;
  updateLastSync: () => void;
  resetPartnerState: () => void;
}
```

## Interactions Slice

```typescript
interface InteractionsState {
  interactions: Interaction[];
  unreadCount: number;
  lastPokeTime: string | null;
  lastKissTime: string | null;
  canPoke: boolean;
  canKiss: boolean;

  // Actions (5 total)
  sendPoke: (receiverId: string) => Promise<void>;
  sendKiss: (receiverId: string) => Promise<void>;
  markAsRead: (id: string) => void;
  loadInteractions: () => Promise<void>;
  checkRateLimits: () => void;
}
```

## Navigation Slice

```typescript
type AppView = 'home' | 'photos' | 'mood' | 'settings' | 'admin';

interface NavigationState {
  currentView: AppView;
  previousView: AppView | null;
  navigationHistory: AppView[];

  // Actions (4 total)
  navigateTo: (view: AppView) => void;
  goBack: () => void;
  clearHistory: () => void;
  resetNavigation: () => void;
}
```

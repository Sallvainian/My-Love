# Slice Details

All 10 slices with exact TypeScript interfaces from source. Each slice creator uses `AppStateCreator<Slice>` from `src/stores/types.ts`.

---

## 1. AppSlice

**File**: `src/stores/types.ts` (interface) + `src/stores/slices/appSlice.ts` (28 lines, creator)

Interface defined in `types.ts` to avoid circular imports (see [Cross-Slice Dependencies](./03-cross-slice-dependencies.md)).

```typescript
export interface AppSlice {
  isLoading: boolean;
  error: string | null;
  __isHydrated: boolean;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setHydrated: (hydrated: boolean) => void;
}
```

| Field          | Type             | Default | Persisted |
| -------------- | ---------------- | ------- | --------- |
| `isLoading`    | `boolean`        | `false` | No        |
| `error`        | `string \| null` | `null`  | No        |
| `__isHydrated` | `boolean`        | `false` | No        |

**Cross-Slice**: None inbound. Other slices call `get().setLoading()` and `get().setError()`.

---

## 2. SettingsSlice

**File**: `src/stores/slices/settingsSlice.ts` (258 lines)

```typescript
export interface SettingsSlice {
  settings: Settings | null;
  isOnboarded: boolean;
  initializeApp: () => Promise<void>;
  setSettings: (settings: Settings) => void;
  updateSettings: (updates: Partial<Settings>) => void;
  setOnboarded: (onboarded: boolean) => void;
  addAnniversary: (anniversary: Omit<Anniversary, 'id'>) => void;
  removeAnniversary: (id: number) => void;
  setTheme: (theme: ThemeName) => void;
}
```

| Field         | Type               | Default                    | Persisted |
| ------------- | ------------------ | -------------------------- | --------- |
| `settings`    | `Settings \| null` | Pre-configured (see below) | Yes       |
| `isOnboarded` | `boolean`          | `true`                     | Yes       |

**Default settings**:
```typescript
{
  themeName: 'sunset',
  notificationTime: '09:00',
  relationship: {
    startDate: APP_CONFIG.defaultStartDate,   // '2025-10-18'
    partnerName: APP_CONFIG.defaultPartnerName, // 'Gracie'
    anniversaries: [],
  },
  customization: { accentColor: '#ff6b9d', fontFamily: 'system-ui' },
  notifications: { enabled: true, time: '09:00' },
}
```

**Actions**:

| Action              | Validation                         | Side Effects                                                          |
| ------------------- | ---------------------------------- | --------------------------------------------------------------------- |
| `initializeApp`     | Checks `__isHydrated`              | Opens IndexedDB, loads/seeds messages, calls `updateCurrentMessage()` |
| `setSettings`       | `SettingsSchema.parse()` (Zod)     | Throws `ValidationError` on failure                                   |
| `updateSettings`    | Merges then `SettingsSchema.parse()` | Throws `ValidationError` on failure                                   |
| `addAnniversary`    | Auto-generates ID from max+1       | Nested spread update on `settings.relationship.anniversaries`         |
| `removeAnniversary` | None                               | Filters by ID                                                         |
| `setTheme`          | None                               | Updates `settings.themeName`                                          |

**StrictMode Protection**: Module-level `isInitializing` and `isInitialized` flags prevent duplicate `initializeApp()` calls.

**Cross-Slice**: Reads `AppSlice` (`setLoading`, `setError`, `__isHydrated`). Writes `MessagesSlice` state (`messages` via `set()`), calls `updateCurrentMessage()`.

---

## 3. NavigationSlice

**File**: `src/stores/slices/navigationSlice.ts` (84 lines)

```typescript
export type ViewType = 'home' | 'photos' | 'mood' | 'partner' | 'notes' | 'scripture';

export interface NavigationSlice {
  currentView: ViewType;
  setView: (view: ViewType, skipHistory?: boolean) => void;
  navigateHome: () => void;
  navigatePhotos: () => void;
  navigateMood: () => void;
  navigatePartner: () => void;
  navigateNotes: () => void;
  navigateScripture: () => void;
}
```

| Field         | Type       | Default  | Persisted |
| ------------- | ---------- | -------- | --------- |
| `currentView` | `ViewType` | `'home'` | No        |

`setView` updates `window.history.pushState` with `BASE_URL`-aware path mapping. `skipHistory` parameter prevents loops during `popstate` event handling. Six convenience navigators each call `setView`.

---

## 4. MessagesSlice

**File**: `src/stores/slices/messagesSlice.ts` (547 lines)

```typescript
export interface MessagesSlice {
  messages: Message[];
  messageHistory: MessageHistory;
  currentMessage: Message | null;
  currentDayOffset: number; // @deprecated - use messageHistory.currentIndex
  customMessages: CustomMessage[];
  customMessagesLoaded: boolean;
  loadMessages: () => Promise<void>;
  addMessage: (text: string, category: Message['category']) => Promise<void>;
  toggleFavorite: (messageId: number) => Promise<void>;
  updateCurrentMessage: () => void;
  navigateToPreviousMessage: () => void;
  navigateToNextMessage: () => void;
  canNavigateBack: () => boolean;
  canNavigateForward: () => boolean;
  loadCustomMessages: () => Promise<void>;
  createCustomMessage: (input: CreateMessageInput) => Promise<void>;
  updateCustomMessage: (input: UpdateMessageInput) => Promise<void>;
  deleteCustomMessage: (id: number) => Promise<void>;
  getCustomMessages: (filter?: MessageFilter) => CustomMessage[];
  exportCustomMessages: () => Promise<void>;
  importCustomMessages: (file: File) => Promise<{ imported: number; skipped: number }>;
}
```

| Field                 | Type              | Default           | Persisted        |
| --------------------- | ----------------- | ----------------- | ---------------- |
| `messages`            | `Message[]`       | `[]`              | No (IndexedDB)   |
| `messageHistory`      | `MessageHistory`  | See below         | Yes (localStorage) |
| `currentMessage`      | `Message \| null` | `null`            | No               |
| `currentDayOffset`    | `number`          | `0`               | No (deprecated)  |
| `customMessages`      | `CustomMessage[]` | `[]`              | No (IndexedDB)   |
| `customMessagesLoaded`| `boolean`         | `false`           | No               |

**MessageHistory default**: `{ currentIndex: 0, shownMessages: new Map(), maxHistoryDays: 30, favoriteIds: [], lastShownDate: '', lastMessageId: 0, viewedIds: [] }`

**Message Rotation**: `getDailyMessage()` uses a deterministic date-hash. `shownMessages` Map caches date->messageID. Inactive custom messages (`active === false`) are excluded from the rotation pool.

**Cross-Slice**: `canNavigateBack()` reads `settings` from SettingsSlice via `get()`.

---

## 5. MoodSlice

**File**: `src/stores/slices/moodSlice.ts` (364 lines)

```typescript
export interface MoodSlice {
  moods: MoodEntry[];
  partnerMoods: MoodEntry[];
  syncStatus: {
    pendingMoods: number;
    isOnline: boolean;
    lastSyncAt?: Date;
    isSyncing: boolean;
  };
  addMoodEntry: (moods: MoodEntry['mood'][], note?: string) => Promise<void>;
  getMoodForDate: (date: string) => MoodEntry | undefined;
  updateMoodEntry: (date: string, moods: MoodEntry['mood'][], note?: string) => Promise<void>;
  loadMoods: () => Promise<void>;
  updateSyncStatus: () => Promise<void>;
  syncPendingMoods: () => Promise<{ synced: number; failed: number }>;
  fetchPartnerMoods: (limit?: number) => Promise<void>;
  getPartnerMoodForDate: (date: string) => MoodEntry | undefined;
}
```

| Field          | Type          | Default                                          | Persisted |
| -------------- | ------------- | ------------------------------------------------ | --------- |
| `moods`        | `MoodEntry[]` | `[]`                                             | Yes       |
| `partnerMoods` | `MoodEntry[]` | `[]`                                             | No        |
| `syncStatus`   | object        | `{ pendingMoods: 0, isOnline: navigator.onLine, isSyncing: false }` | No |

**Offline-first flow**: `addMoodEntry` -> `getCurrentUserIdOfflineSafe()` -> `moodService.create()` (IndexedDB with `synced: false`) -> optimistic state update -> `syncPendingMoods()` if online.

**Partner moods**: `fetchPartnerMoods` calls `moodSyncService.fetchMoods(partnerId, limit)`, transforms Supabase records to `MoodEntry[]`, sets `partnerMoods`.

---

## 6. InteractionsSlice

**File**: `src/stores/slices/interactionsSlice.ts` (257 lines)

```typescript
export interface InteractionsSlice {
  interactions: Interaction[];
  unviewedCount: number;
  isSubscribed: boolean;
  sendPoke: (partnerId: string) => Promise<SupabaseInteractionRecord>;
  sendKiss: (partnerId: string) => Promise<SupabaseInteractionRecord>;
  markInteractionViewed: (id: string) => Promise<void>;
  getUnviewedInteractions: () => Interaction[];
  getInteractionHistory: (days?: number) => Interaction[];
  loadInteractionHistory: (limit?: number) => Promise<void>;
  subscribeToInteractions: () => Promise<() => void>;
  addIncomingInteraction: (interaction: SupabaseInteractionRecord) => void;
}
```

| Field           | Type            | Default | Persisted |
| --------------- | --------------- | ------- | --------- |
| `interactions`  | `Interaction[]` | `[]`    | No        |
| `unviewedCount` | `number`        | `0`     | No        |
| `isSubscribed`  | `boolean`       | `false` | No        |

Uses `InteractionService` singleton. `sendPoke`/`sendKiss` validate via `validateInteraction()` before calling service. `addIncomingInteraction` deduplicates by ID. `subscribeToInteractions` returns an unsubscribe function that also sets `isSubscribed: false`.

---

## 7. PartnerSlice

**File**: `src/stores/slices/partnerSlice.ts` (141 lines)

```typescript
export interface PartnerSlice {
  partner: PartnerInfo | null;
  isLoadingPartner: boolean;
  sentRequests: PartnerRequest[];
  receivedRequests: PartnerRequest[];
  isLoadingRequests: boolean;
  searchResults: UserSearchResult[];
  isSearching: boolean;
  loadPartner: () => Promise<void>;
  loadPendingRequests: () => Promise<void>;
  searchUsers: (query: string) => Promise<void>;
  clearSearch: () => void;
  sendPartnerRequest: (toUserId: string) => Promise<void>;
  acceptPartnerRequest: (requestId: string) => Promise<void>;
  declinePartnerRequest: (requestId: string) => Promise<void>;
  hasPartner: () => boolean;
}
```

| Field              | Type                   | Default | Persisted |
| ------------------ | ---------------------- | ------- | --------- |
| `partner`          | `PartnerInfo \| null`  | `null`  | No        |
| `isLoadingPartner` | `boolean`              | `false` | No        |
| `sentRequests`     | `PartnerRequest[]`     | `[]`    | No        |
| `receivedRequests` | `PartnerRequest[]`     | `[]`    | No        |
| `isLoadingRequests`| `boolean`              | `false` | No        |
| `searchResults`    | `UserSearchResult[]`   | `[]`    | No        |
| `isSearching`      | `boolean`              | `false` | No        |

All actions use `partnerService`. `searchUsers` requires `query.trim().length >= 2`. `sendPartnerRequest` reloads pending requests and clears search. `acceptPartnerRequest` reloads both partner and requests via `Promise.all`.

---

## 8. NotesSlice

**File**: `src/stores/slices/notesSlice.ts` (641 lines)

```typescript
export interface NotesSlice {
  notes: LoveNote[];
  notesIsLoading: boolean;
  notesError: string | null;
  notesHasMore: boolean;
  sentMessageTimestamps: number[];
  fetchNotes: (limit?: number) => Promise<void>;
  fetchOlderNotes: (limit?: number) => Promise<void>;
  addNote: (note: LoveNote) => void;
  setNotes: (notes: LoveNote[]) => void;
  setNotesError: (error: string | null) => void;
  clearNotesError: () => void;
  checkRateLimit: () => { recentTimestamps: number[]; now: number };
  sendNote: (content: string, imageFile?: File) => Promise<void>;
  retryFailedMessage: (tempId: string) => Promise<void>;
  cleanupPreviewUrls: () => void;
  removeFailedMessage: (tempId: string) => void;
}
```

| Field                   | Type             | Default | Persisted |
| ----------------------- | ---------------- | ------- | --------- |
| `notes`                 | `LoveNote[]`     | `[]`    | No        |
| `notesIsLoading`        | `boolean`        | `false` | No        |
| `notesError`            | `string \| null` | `null`  | No        |
| `notesHasMore`          | `boolean`        | `true`  | No        |
| `sentMessageTimestamps` | `number[]`       | `[]`    | No        |

**Rate limiting**: `checkRateLimit()` filters `sentMessageTimestamps` to last 60s window, throws if >= 10 messages. Constants from `NOTES_CONFIG`.

**Optimistic send**: `sendNote` creates temp note with `tempId`, adds to state immediately, compresses/uploads image if present, inserts to Supabase, replaces temp with server response. On failure, marks `error: true` on the note. `retryFailedMessage` reuses cached `imageBlob` to avoid re-compression.

**Broadcast**: After successful insert, subscribes to partner channel and sends `new_message` broadcast event, then unsubscribes.

**Memory cleanup**: `revokePreviewUrlsFromNotes()` helper revokes all `blob:` URLs. Called by `fetchNotes`, `setNotes`, `cleanupPreviewUrls`.

---

## 9. PhotosSlice

**File**: `src/stores/slices/photosSlice.ts` (209 lines)

```typescript
export interface PhotosSlice {
  photos: PhotoWithUrls[];
  selectedPhotoId: string | null;
  isUploading: boolean;
  uploadProgress: number;
  error: string | null;
  storageWarning: string | null;
  uploadPhoto: (input: PhotoUploadInput) => Promise<void>;
  loadPhotos: () => Promise<void>;
  deletePhoto: (photoId: string) => Promise<void>;
  updatePhoto: (photoId: string, updates: Partial<SupabasePhoto>) => Promise<void>;
  selectPhoto: (photoId: string | null) => void;
  clearPhotoSelection: () => void;
  clearError: () => void;
  clearStorageWarning: () => void;
}
```

| Field            | Type               | Default | Persisted |
| ---------------- | ------------------ | ------- | --------- |
| `photos`         | `PhotoWithUrls[]`  | `[]`    | No        |
| `selectedPhotoId`| `string \| null`   | `null`  | No        |
| `isUploading`    | `boolean`          | `false` | No        |
| `uploadProgress` | `number`           | `0`     | No        |
| `error`          | `string \| null`   | `null`  | No        |
| `storageWarning` | `string \| null`   | `null`  | No        |

**Quota checks**: `uploadPhoto` checks quota before upload -- rejects at >=95%, warns at >=80%. Re-checks after upload. Progress callback updates `uploadProgress` 0-100.

---

## 10. ScriptureSlice (ScriptureReadingSlice)

**File**: `src/stores/slices/scriptureReadingSlice.ts` (1053 lines) -- largest slice

```typescript
export interface ScriptureReadingState {
  session: ScriptureSession | null;
  scriptureLoading: boolean;
  isInitialized: boolean;
  isPendingLockIn: boolean;
  isPendingReflection: boolean;
  isSyncing: boolean;
  scriptureError: ScriptureError | null;
  activeSession: ScriptureSession | null;
  isCheckingSession: boolean;
  pendingRetry: PendingRetry | null;
  coupleStats: CoupleStats | null;
  isStatsLoading: boolean;
  myRole: SessionRole | null;          // 'reader' | 'responder'
  partnerJoined: boolean;
  myReady: boolean;
  partnerReady: boolean;
  countdownStartedAt: number | null;   // Server UTC ms
  currentUserId: string | null;
  partnerLocked: boolean;
  partnerDisconnected: boolean;
  partnerDisconnectedAt: number | null;
  _broadcastFn: ((event: string, payload: unknown) => void) | null;
}

export interface ScriptureSlice extends ScriptureReadingState {
  // Session lifecycle
  createSession: (mode: SessionMode, partnerId?: string) => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  exitSession: () => void;
  updatePhase: (phase: SessionPhase) => void;
  clearScriptureError: () => void;
  checkForActiveSession: () => Promise<void>;
  clearActiveSession: () => void;
  // Solo reading
  advanceStep: () => Promise<void>;
  saveAndExit: () => Promise<void>;
  saveSession: () => Promise<void>;
  abandonSession: (sessionId: string) => Promise<void>;
  retryFailedWrite: () => Promise<void>;
  // Stats
  loadCoupleStats: () => Promise<void>;
  // Lobby (Story 4.1)
  selectRole: (role: SessionRole) => Promise<void>;
  toggleReady: (isReady: boolean) => Promise<void>;
  convertToSolo: () => Promise<void>;
  applySessionConverted: () => void;
  onPartnerJoined: () => void;
  onPartnerReady: (isReady: boolean) => void;
  onCountdownStarted: (startTs: number) => void;
  onBroadcastReceived: (payload: StateUpdatePayload) => void;
  // Lock-in (Story 4.2)
  lockIn: () => Promise<void>;
  undoLockIn: () => Promise<void>;
  onPartnerLockInChanged: (locked: boolean) => void;
  // Disconnection (Story 4.3)
  setPartnerDisconnected: (disconnected: boolean) => void;
  endSession: () => Promise<void>;
  // Internal
  setBroadcastFn: (fn: ((event: string, payload: unknown) => void) | null) => void;
}
```

**Key types**:
- `SessionRole`: `'reader' | 'responder'`
- `PendingRetry`: `{ type: 'advanceStep' | 'saveSession'; attempts: number; maxAttempts: number; sessionData?: {...} }`
- `StateUpdatePayload`: Broadcast payload shape from server RPCs

**Session reset**: `resetSessionState(get)` preserves `coupleStats`, `isStatsLoading`, `isInitialized` across session transitions.

**Lobby RPCs**: `selectRole`, `toggleReady`, `convertToSolo`, `lockIn`, `undoLockIn`, `endSession` all use `callLobbyRpc()` wrapper for untyped RPCs not yet in `database.types.ts`.

**Retry**: `retryFailedWrite` retries from `pendingRetry.sessionData` up to `maxAttempts` (3). Clears retry state on success or max attempts.

**Broadcast integration**: `_broadcastFn` is set by `useScriptureBroadcast` hook. Lobby/lock-in actions call it after successful RPCs to notify partner.

---

## Related Documentation

- [Store Configuration](./01-zustand-store-configuration.md)
- [Cross-Slice Dependencies](./03-cross-slice-dependencies.md)
- [React Hooks](./06-react-hooks.md)

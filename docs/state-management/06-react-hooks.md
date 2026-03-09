# React Hooks

All custom hooks in `src/hooks/`. Barrel export (`src/hooks/index.ts`) exports: `useNetworkStatus`, `useAutoSave`, `useLoveNotes`, `useVibration`, `useMotionConfig`.

---

## useAuth (`src/hooks/useAuth.ts`)

```typescript
function useAuth(): { user: User | null; loading: boolean };
```

- Calls `supabase.auth.getUser()` on mount
- Subscribes to `supabase.auth.onAuthStateChange()` for session changes
- Cleanup: unsubscribes on unmount
- **Used by**: `App.tsx`

## useLoveNotes (`src/hooks/useLoveNotes.ts`)

```typescript
function useLoveNotes(): {
  notes: LoveNote[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  fetchNotes: () => Promise<void>;
  fetchOlderNotes: () => Promise<void>;
  sendNote: (content: string, imageFile?: File) => Promise<void>;
  clearError: () => void;
  retryFailedMessage: (tempId: string) => Promise<void>;
  removeFailedMessage: (tempId: string) => void;
  cleanupPreviewUrls: () => void;
  partnerId: string | null;
};
```

- Wraps NotesSlice selectors with memoized callbacks
- Integrates `useRealtimeMessages(partnerId)` for live broadcast delivery
- Auto-fetches notes on mount
- Cleans up preview URLs on unmount
- **Used by**: `LoveNotes`, `MessageInput`

## useRealtimeMessages (`src/hooks/useRealtimeMessages.ts`)

```typescript
function useRealtimeMessages(partnerId: string | null): void;
```

- Manages Supabase Broadcast channel `love-notes:{userId}`
- Exponential backoff retry: 1s, 2s, 4s, 8s, 16s (max 30s), up to 5 retries
- Vibration feedback on incoming message
- Connection state tracking: connected/disconnected/connecting
- Cleanup: unsubscribes and removes channel on unmount
- **Used by**: `useLoveNotes` (internal)

## useAutoSave (`src/hooks/useAutoSave.ts`)

```typescript
function useAutoSave(session: ScriptureSession | null): void;
```

- Listens to `visibilitychange` -- saves when tab becomes hidden
- Listens to `beforeunload` -- saves on page close
- Fire-and-forget: does not block visibility/unload events
- **Used by**: `SoloReadingFlow`

## useMoodHistory (`src/hooks/useMoodHistory.ts`)

```typescript
function useMoodHistory(userId: string): {
  moods: SupabaseMood[];
  loading: boolean;
  hasMore: boolean;
  loadMore: () => void;
};
```

- Page size: 50 entries, cursor-based pagination via `moodApi.fetchByUser()`
- **Used by**: `MoodHistoryTimeline`

## usePartnerMood (`src/hooks/usePartnerMood.ts`)

```typescript
function usePartnerMood(partnerId: string | null): {
  partnerMood: MoodEntry | null;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
};
```

- Supabase Broadcast subscription for live partner mood updates
- Falls back to last known mood when disconnected
- **Used by**: `PartnerMoodDisplay`

## useNetworkStatus (`src/hooks/useNetworkStatus.ts`)

```typescript
function useNetworkStatus(): 'online' | 'offline' | 'connecting';
```

- Listens to `window.addEventListener('online')` and `offline`
- 1.5s debounce on reconnection to prevent UI flicker
- **Used by**: `NetworkStatusIndicator`, `NetworkStatusDot`, `SoloReadingFlow`, `ScriptureOverview`

## useVibration (`src/hooks/useVibration.ts`)

```typescript
function useVibration(): {
  vibrate: (pattern: number | number[]) => void;
  isSupported: boolean;
};
```

- Feature detection for Vibration API
- No-op on unsupported devices
- **Used by**: `MessageInput`

## useMotionConfig (`src/hooks/useMotionConfig.ts`)

```typescript
function useMotionConfig(): {
  shouldAnimate: boolean;
  motionPresets: object;
};
```

- Reads `window.matchMedia('(prefers-reduced-motion: reduce)')` on mount
- Listens for preference changes
- **Used by**: `SoloReadingFlow`, `ScriptureOverview`, `ReadingContainer`, `Countdown`

## useImageCompression (`src/hooks/useImageCompression.ts`)

```typescript
function useImageCompression(): {
  compress: (file: File) => Promise<CompressedImage>;
  isCompressing: boolean;
  error: string | null;
};
```

- React state wrapper for `imageCompressionService`
- **Used by**: `PhotoUploader`

## usePhotos (`src/hooks/usePhotos.ts`)

```typescript
function usePhotos(): {
  photos: PhotoWithUrls[];
  loading: boolean;
  error: string | null;
  storageWarning: string | null;
  isUploading: boolean;
  uploadProgress: number;
  uploadPhoto: (input: PhotoUploadInput) => Promise<void>;
  loadPhotos: () => Promise<void>;
  deletePhoto: (photoId: string) => Promise<void>;
  clearError: () => void;
  clearStorageWarning: () => void;
};
```

- Wraps PhotosSlice selectors with memoized callbacks
- Auto-loads photos on mount
- **Used by**: `PhotoGallery`, `PhotoUploader`

## useScriptureBroadcast (`src/hooks/useScriptureBroadcast.ts`)

```typescript
function useScriptureBroadcast(sessionId: string | null, mode: SessionMode | null): void;
```

- Manages Supabase Realtime channel for together-mode scripture sessions
- Dispatches to store actions: `onPartnerJoined`, `onPartnerReady`, `onCountdownStarted`, `onBroadcastReceived`, `onPartnerLockInChanged`, `setPartnerDisconnected`
- Wires `setBroadcastFn` so store actions can send broadcasts
- Mounted in `ScriptureOverview` to persist across lobby/reading transitions
- **Used by**: `ScriptureOverview`

## useScripturePresence (`src/hooks/useScripturePresence.ts`)

```typescript
function useScripturePresence(
  sessionId: string | null,
  myView: string
): {
  partnerPresence: PartnerPresenceInfo | null;
};
```

- Tracks partner's current view (verse or response) via Supabase Presence
- Sends own view state on change
- Returns null when partner not present
- **Used by**: `ReadingContainer`

## Store Access Patterns

**Single selector** (minimal re-renders):

```typescript
const currentView = useAppStore((state) => state.currentView);
```

**Multiple selectors with useShallow** (scripture containers):

```typescript
const { session, scriptureLoading } = useAppStore(
  useShallow((state) => ({ session: state.session, scriptureLoading: state.scriptureLoading }))
);
```

**Action extraction** (stable reference, no re-render):

```typescript
const setView = useAppStore((state) => state.setView);
```

## Related Documentation

- [Slice Details](./02-slice-details.md)
- [Direct Store Access](./07-direct-store-access.md)

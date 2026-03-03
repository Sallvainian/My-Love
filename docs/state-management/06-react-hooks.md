# React Hooks

## Custom Hooks Inventory

All custom hooks are in `src/hooks/`. The barrel export (`src/hooks/index.ts`) exports: `useNetworkStatus`, `useAutoSave`, `useLoveNotes`, `useVibration`, `useMotionConfig`, `useScriptureBroadcast`, `useScripturePresence`.

14 hooks total. 7 barrel-exported, 7 imported directly by consumers.

---

### useAuth (`src/hooks/useAuth.ts`)

Provides authentication state to the application shell.

```typescript
function useAuth(): UseAuthReturn;

interface UseAuthReturn {
  user: User | null;
  isLoading: boolean;
  error: string | null;
}
```

| Return      | Type             | Description                         |
| ----------- | ---------------- | ----------------------------------- |
| `user`      | `User \| null`   | Authenticated Supabase user or null |
| `isLoading` | `boolean`        | True during initial auth check      |
| `error`     | `string \| null` | Error message if auth fails         |

**Implementation:**

- Calls `supabase.auth.getUser()` on mount
- Subscribes to `supabase.auth.onAuthStateChange()` for real-time session changes
- Cleanup: unsubscribes on unmount

---

### useLoveNotes (`src/hooks/useLoveNotes.ts`)

Composes store access with realtime messaging for the Love Notes feature.

```typescript
function useLoveNotes(autoFetch?: boolean): UseLoveNotesResult;

interface UseLoveNotesResult {
  notes: LoveNote[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  fetchNotes: () => Promise<void>;
  fetchOlderNotes: () => Promise<void>;
  clearError: () => void;
  sendNote: (content: string, imageFile?: File) => Promise<void>;
  retryFailedMessage: (tempId: string) => Promise<void>;
  removeFailedMessage: (tempId: string) => void;
}
```

| Parameter   | Type      | Default | Description                        |
| ----------- | --------- | ------- | ---------------------------------- |
| `autoFetch` | `boolean` | `true`  | Auto-fetch notes on mount          |

**Behavior:**

- Auto-fetches notes on mount via `fetchNotes()`
- Integrates `useRealtimeMessages({ enabled: autoFetch })` for live message delivery
- Cleans up preview object URLs on unmount via `cleanupPreviewUrls()`
- Exposes `sendNote` with optional `imageFile` parameter for image attachments
- Exposes `retryFailedMessage` for retrying failed sends (uses cached `imageBlob`)
- Exposes `removeFailedMessage` to discard a failed message from the UI

---

### useRealtimeMessages (`src/hooks/useRealtimeMessages.ts`)

Manages a Supabase Broadcast channel for live love note delivery.

```typescript
function useRealtimeMessages(options?: UseRealtimeMessagesOptions): {};

interface UseRealtimeMessagesOptions {
  onNewMessage?: (message: LoveNote) => void;
  enabled?: boolean;
}
```

| Option         | Type                          | Default | Description                        |
| -------------- | ----------------------------- | ------- | ---------------------------------- |
| `onNewMessage` | `(message: LoveNote) => void` | --      | Optional callback for new messages |
| `enabled`      | `boolean`                     | `true`  | Enable/disable subscription        |

**Features:**

- Creates user-specific channel `love-notes:{userId}` for receiving messages
- Exponential backoff retry: 1s, 2s, 4s, 8s, 16s (max 30s), up to 5 retries
- Vibration feedback on incoming message (`navigator.vibrate([30])`)
- Adds incoming messages to store via `addNote()` with built-in deduplication
- Cleanup: clears retry timeout, removes channel on unmount, resets retry count

---

### useAutoSave (`src/hooks/useAutoSave.ts`)

Auto-saves scripture reading session progress on visibility change and page unload.

```typescript
function useAutoSave(options: UseAutoSaveOptions): void;

interface UseAutoSaveOptions {
  session: ScriptureSession | null;
  saveSession: () => Promise<void>;
}
```

| Parameter     | Type                          | Description                      |
| ------------- | ----------------------------- | -------------------------------- |
| `session`     | `ScriptureSession \| null`    | Active session to monitor        |
| `saveSession` | `() => Promise<void>`         | Save function from store         |

**Behavior:**

- Listens to `document.addEventListener('visibilitychange')` -- saves when tab becomes hidden
- Listens to `window.addEventListener('beforeunload')` -- saves on page close
- Only saves when `session?.status === 'in_progress'`
- Fire-and-forget: does not block the visibility/unload event

---

### useMoodHistory (`src/hooks/useMoodHistory.ts`)

Provides paginated mood history from the Supabase API.

```typescript
function useMoodHistory(userId: string): UseMoodHistoryReturn;

interface UseMoodHistoryReturn {
  moods: SupabaseMood[];
  isLoading: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  error: string | null;
}
```

| Return      | Type             | Description                  |
| ----------- | ---------------- | ---------------------------- |
| `moods`     | `SupabaseMood[]` | Loaded mood entries          |
| `isLoading` | `boolean`        | True during fetch            |
| `hasMore`   | `boolean`        | True if more pages available |
| `loadMore`  | `() => Promise<void>` | Load next page          |
| `error`     | `string \| null` | Error message if fetch fails |

Page size: 50 entries. Uses offset-based pagination via `moodApi.getMoodHistory()`.

---

### usePartnerMood (`src/hooks/usePartnerMood.ts`)

Provides partner's mood data with Broadcast API realtime updates.

```typescript
function usePartnerMood(partnerId: string): UsePartnerMoodResult;

interface UsePartnerMoodResult {
  partnerMood: SupabaseMoodRecord | null;
  isLoading: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  error: string | null;
}
```

| Return             | Type                                            | Description                  |
| ------------------ | ----------------------------------------------- | ---------------------------- |
| `partnerMood`      | `SupabaseMoodRecord \| null`                    | Partner's latest mood        |
| `isLoading`        | `boolean`                                       | True during initial load     |
| `connectionStatus` | `'connecting' \| 'connected' \| 'disconnected'` | Realtime channel state       |
| `error`            | `string \| null`                                | Error message                |

**Behavior:**

- Fetches latest partner mood on mount via `moodSyncService.getLatestPartnerMood()`
- Subscribes to real-time mood updates via `moodSyncService.subscribeMoodUpdates()`
- Filters incoming moods to only accept those from the specified `partnerId`
- Cleanup: unsubscribes on unmount with `isMounted` guard

---

### useNetworkStatus (`src/hooks/useNetworkStatus.ts`)

Tracks device online/offline status with debounced reconnection.

```typescript
function useNetworkStatus(): NetworkStatus;

interface NetworkStatus {
  isOnline: boolean;
  isConnecting: boolean;
}
```

| Return          | Type      | Description                                          |
| --------------- | --------- | ---------------------------------------------------- |
| `isOnline`      | `boolean` | True when browser reports network available           |
| `isConnecting`  | `boolean` | True during brief transition from offline to online   |

**Debounce:** 1.5 second delay on reconnection to prevent UI flicker during brief connectivity interruptions. Listens to `window.addEventListener('online')` and `window.addEventListener('offline')`.

---

### useVibration (`src/hooks/useVibration.ts`)

Wrapper for the Vibration API with feature detection.

```typescript
function useVibration(): UseVibrationReturn;

interface UseVibrationReturn {
  vibrate: (pattern: number | number[]) => void;
  isSupported: boolean;
}
```

| Return        | Type                                    | Description                     |
| ------------- | --------------------------------------- | ------------------------------- |
| `vibrate`     | `(pattern: number \| number[]) => void` | Trigger vibration               |
| `isSupported` | `boolean`                               | True if Vibration API available |

Standard patterns: success = `vibrate(50)`, error = `vibrate([100, 50, 100])`. Gracefully degrades on unsupported devices (no-op).

---

### useMotionConfig (`src/hooks/useMotionConfig.ts`)

Provides Framer Motion animation presets respecting user's reduced motion preferences.

```typescript
function useMotionConfig(): {
  shouldReduceMotion: boolean;
  crossfade: { duration: number };
  slide: { duration: number; ease?: string };
  spring: { duration: number } | { type: 'spring'; stiffness: number; damping: number };
  fadeIn: { duration: number };
  modeReveal: { duration: number };
};
```

| Return               | Type      | Description                                                   |
| -------------------- | --------- | ------------------------------------------------------------- |
| `shouldReduceMotion` | `boolean` | True if `prefers-reduced-motion: reduce` is active            |
| `crossfade`          | `object`  | `{ duration: 0.2 }` or `{ duration: 0 }` if reduced motion  |
| `slide`              | `object`  | `{ duration: 0.3, ease: 'easeInOut' }` or `{ duration: 0 }` |
| `spring`             | `object`  | `{ type: 'spring', stiffness: 100, damping: 15 }` or `{ duration: 0 }` |
| `fadeIn`             | `object`  | `{ duration: 0.2 }` or `{ duration: 0 }`                    |
| `modeReveal`         | `object`  | `{ duration: 0.2 }` or `{ duration: 0 }`                    |

Uses Framer Motion's `useReducedMotion()` hook internally. All Scripture Reading components use this hook instead of raw `useReducedMotion`.

---

### useImageCompression (`src/hooks/useImageCompression.ts`)

React state wrapper for the image compression service.

```typescript
function useImageCompression(): UseImageCompressionReturn;

interface UseImageCompressionReturn {
  compress: (file: File) => Promise<CompressionResult | null>;
  result: CompressionResult | null;
  isCompressing: boolean;
  error: string | null;
  status: 'idle' | 'compressing' | 'complete' | 'error';
  reset: () => void;
}
```

| Return          | Type                                             | Description                 |
| --------------- | ------------------------------------------------ | --------------------------- |
| `compress`      | `(file: File) => Promise<CompressionResult \| null>` | Compress image         |
| `result`        | `CompressionResult \| null`                      | Last compression result     |
| `isCompressing` | `boolean`                                        | True during compression     |
| `error`         | `string \| null`                                 | Error message if failed     |
| `status`        | `CompressionStatus`                              | State machine status        |
| `reset`         | `() => void`                                     | Reset state for next use    |

Status flow: `idle` -> `compressing` -> `complete` | `error`. Validates file before compression.

---

### usePhotos (`src/hooks/usePhotos.ts`)

Store consumer for photos with auto-load on mount.

```typescript
function usePhotos(autoLoad?: boolean): UsePhotosResult;

interface UsePhotosResult {
  photos: SupabasePhoto[];
  isUploading: boolean;
  uploadProgress: number;
  error: string | null;
  storageWarning: string | null;
  uploadPhoto: (input: PhotoUploadInput) => Promise<void>;
  loadPhotos: () => Promise<void>;
  deletePhoto: (photoId: string) => Promise<void>;
  clearError: () => void;
  clearStorageWarning: () => void;
}
```

| Parameter  | Type      | Default | Description                        |
| ---------- | --------- | ------- | ---------------------------------- |
| `autoLoad` | `boolean` | `true`  | Auto-load photos on mount          |

**Behavior:**

- Calls `loadPhotos()` on mount when `autoLoad` is true
- All functions are memoized with `useCallback`
- Upload progress tracked from 0-100% via `uploadProgress`
- Storage quota warnings exposed via `storageWarning`

---

### useScriptureBroadcast (`src/hooks/useScriptureBroadcast.ts`)

Supabase Realtime broadcast channel lifecycle hook for scripture together-mode sessions. This is the ONLY place in the codebase that manages the `scripture-session:{sessionId}` broadcast channel.

```typescript
function useScriptureBroadcast(sessionId: string | null): void;
```

| Parameter   | Type              | Description                             |
| ----------- | ----------------- | --------------------------------------- |
| `sessionId` | `string \| null`  | Active session ID, or null to disconnect|

**Side-effect hook** -- returns nothing. All state changes go through Zustand store actions.

**Event Handlers:**

| Broadcast Event            | Store Action Called            | Description                              |
| -------------------------- | ----------------------------- | ---------------------------------------- |
| `partner_joined`           | `onPartnerJoined()`           | Partner joined the channel               |
| `state_updated`            | `onBroadcastReceived(payload)`| Version-checked session state snapshot   |
| `session_converted`        | `applySessionConverted()`     | Session converted to solo (user2 ejected)|
| `lock_in_status_changed`   | `onPartnerLockInChanged(locked)` | Partner lock-in status changed (Story 4.2) |

**Reconnect Logic (Epic 4 Hardening -- Story 4.3):**

- On `CHANNEL_ERROR` or `CLOSED` status: marks `hasErroredRef = true`, removes stale channel, increments `retryCount` to trigger useEffect re-run
- `isRetryingRef` guard prevents retry storms when error fires before `removeChannel` resolves
- On successful re-subscribe: detects reconnect via `hasErroredRef`, calls `loadSession(sessionId)` to resync state from DB, re-broadcasts `partner_joined` to clear partner's disconnected UI
- Wires `setBroadcastFn` on subscribe so store actions (selectRole, toggleReady, lockIn, etc.) can broadcast via `channel.send()`
- Cleanup on unmount: calls `setBroadcastFn(null)`, removes channel

**Auth:** Calls `supabase.realtime.setAuth()` then `supabase.auth.getUser()` before subscribing. Broadcasts own `partner_joined` with `user_id` payload.

**StrictMode Protection:** Guards against duplicate subscription by checking `channelRef.current !== null`.

**Store Selectors:** Uses `useShallow` from `zustand/react/shallow` for multi-field selection to avoid unnecessary re-renders.

---

### useScripturePresence (`src/hooks/useScripturePresence.ts`)

Ephemeral presence channel for partner position tracking in together-mode scripture reading.

```typescript
function useScripturePresence(
  sessionId: string | null,
  stepIndex: number,
  view: 'verse' | 'response'
): PartnerPresenceInfo;

interface PartnerPresenceInfo {
  view: 'verse' | 'response' | null;
  stepIndex: number | null;
  ts: number | null;
  isPartnerConnected: boolean;
}
```

| Parameter   | Type                       | Description                         |
| ----------- | -------------------------- | ----------------------------------- |
| `sessionId` | `string \| null`           | Session ID for channel name         |
| `stepIndex` | `number`                   | Current reading step (0-based)      |
| `view`      | `'verse' \| 'response'`   | Current view within the step        |

| Return                | Type                              | Description                          |
| --------------------- | --------------------------------- | ------------------------------------ |
| `view`                | `'verse' \| 'response' \| null`  | Partner's current view               |
| `stepIndex`           | `number \| null`                  | Partner's current step               |
| `ts`                  | `number \| null`                  | Timestamp of last presence update    |
| `isPartnerConnected`  | `boolean`                         | False if partner presence is stale   |

**Channel:** `scripture-presence:{sessionId}` with `{ broadcast: { self: false }, private: true }`.

**Presence Broadcast Triggers:**
- Immediately on channel `SUBSCRIBED`
- On `view` prop change (verse / response)
- On `stepIndex` change (resets partner presence state)
- Every 10 seconds via heartbeat interval

**Stale Detection:** Presence updates older than 20 seconds (`STALE_TTL_MS`) are silently dropped. A stale timer fires if no `presence_update` is received within 20s, setting `isPartnerConnected: false`.

**Reconnect Logic (Epic 4 Hardening):** On `CHANNEL_ERROR`, clears interval, sets partner disconnected, removes channel, increments `retryCount` to trigger re-subscribe via useEffect re-run. Same pattern as `useScriptureBroadcast`.

**Auth:** Uses `supabase.realtime.setAuth()` then `supabase.auth.getUser()` to get the current user ID for presence payloads.

---

## Store Access Patterns

### Direct Selector

```typescript
const currentView = useAppStore((state) => state.currentView);
```

### Action Extraction

```typescript
const setView = useAppStore((state) => state.setView);
```

### Multiple Selectors

```typescript
const { moods, addMoodEntry, syncStatus } = useAppStore((state) => ({
  moods: state.moods,
  addMoodEntry: state.addMoodEntry,
  syncStatus: state.syncStatus,
}));
```

**Performance note:** When selecting multiple fields, use `useShallow` from `zustand/react/shallow` to avoid re-renders on every state change:

```typescript
import { useShallow } from 'zustand/react/shallow';

const { notes, isLoading } = useAppStore(
  useShallow((state) => ({
    notes: state.notes,
    isLoading: state.notesIsLoading,
  }))
);
```

## Related Documentation

- [Slice Details](./02-slice-details.md)
- [Direct Store Access](./07-direct-store-access.md)
- [Component Hierarchy](../architecture/06-component-hierarchy.md)

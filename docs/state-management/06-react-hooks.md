# React Hooks

## Custom Hooks Inventory

All custom hooks are in `src/hooks/`. The barrel export (`src/hooks/index.ts`) exports: `useNetworkStatus`, `useAutoSave`, `useLoveNotes`, `useVibration`, `useMotionConfig`.

### useAuth (`src/hooks/useAuth.ts`)

Provides authentication state to the application shell.

```typescript
const { user, loading } = useAuth();
```

| Return | Type | Description |
|--------|------|-------------|
| `user` | `User \| null` | Authenticated Supabase user or null |
| `loading` | `boolean` | True during initial auth check |

**Implementation:**
- Calls `supabase.auth.getUser()` on mount
- Subscribes to `supabase.auth.onAuthStateChange()` for real-time session changes
- Cleanup: unsubscribes on unmount

### useLoveNotes (`src/hooks/useLoveNotes.ts`)

Composes store access with realtime messaging for the Love Notes feature.

```typescript
const { notes, loading, error, sendNote, partnerId } = useLoveNotes();
```

**Behavior:**
- Auto-fetches notes on mount via `loadNotes()`
- Integrates `useRealtimeMessages(partnerId)` for live message delivery
- Cleans up preview object URLs on unmount via `clearPreviewUrls()`

### useRealtimeMessages (`src/hooks/useRealtimeMessages.ts`)

Manages a Supabase Broadcast channel for live love note delivery.

```typescript
useRealtimeMessages(partnerId);
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `partnerId` | `string` | Partner's user ID for channel scoping |

**Features:**
- Exponential backoff retry: 1s, 2s, 4s, 8s, 16s (max 30s), up to 5 retries
- Vibration feedback on incoming message (`navigator.vibrate`)
- Connection state tracking: `connected`, `disconnected`, `connecting`
- Cleanup: unsubscribes and removes channel on unmount

### useAutoSave (`src/hooks/useAutoSave.ts`)

Auto-saves scripture session progress on visibility change and page unload.

```typescript
useAutoSave(session);
```

**Behavior:**
- Listens to `document.addEventListener('visibilitychange')` -- saves when tab becomes hidden
- Listens to `window.addEventListener('beforeunload')` -- saves on page close
- Fire-and-forget: does not block the visibility/unload event

### useMoodHistory (`src/hooks/useMoodHistory.ts`)

Provides paginated mood history from the Supabase API.

```typescript
const { moods, loading, hasMore, loadMore } = useMoodHistory(userId);
```

| Return | Type | Description |
|--------|------|-------------|
| `moods` | `SupabaseMood[]` | Loaded mood entries |
| `loading` | `boolean` | True during fetch |
| `hasMore` | `boolean` | True if more pages available |
| `loadMore` | `() => void` | Load next page |

Page size: 50 entries. Uses cursor-based pagination via `moodApi.fetchByUser()`.

### usePartnerMood (`src/hooks/usePartnerMood.ts`)

Provides partner's mood data with Broadcast API realtime updates.

```typescript
const { partnerMood, connectionStatus } = usePartnerMood(partnerId);
```

| Return | Type | Description |
|--------|------|-------------|
| `partnerMood` | `MoodEntry \| null` | Partner's latest mood |
| `connectionStatus` | `'connected' \| 'disconnected' \| 'connecting'` | Realtime channel state |

### useNetworkStatus (`src/hooks/useNetworkStatus.ts`)

Tracks device online/offline status with debounced reconnection.

```typescript
const status = useNetworkStatus();
// status: 'online' | 'offline' | 'connecting'
```

**Debounce:** 1.5 second delay on reconnection to prevent UI flicker during brief connectivity interruptions. Listens to `window.addEventListener('online')` and `window.addEventListener('offline')`.

### useVibration (`src/hooks/useVibration.ts`)

Wrapper for the Vibration API with feature detection.

```typescript
const { vibrate, isSupported } = useVibration();
```

| Return | Type | Description |
|--------|------|-------------|
| `vibrate` | `(pattern: number \| number[]) => void` | Trigger vibration |
| `isSupported` | `boolean` | True if Vibration API available |

Gracefully degrades on unsupported devices (no-op).

### useMotionConfig (`src/hooks/useMotionConfig.ts`)

Provides Framer Motion configuration respecting user's reduced motion preferences.

```typescript
const { shouldAnimate, motionPresets } = useMotionConfig();
```

| Return | Type | Description |
|--------|------|-------------|
| `shouldAnimate` | `boolean` | False if `prefers-reduced-motion: reduce` |
| `motionPresets` | `object` | Named animation presets (fadeIn, slideUp, etc.) |

Reads `window.matchMedia('(prefers-reduced-motion: reduce)')` on mount and listens for changes.

### useImageCompression (`src/hooks/useImageCompression.ts`)

React state wrapper for the image compression service.

```typescript
const { compress, isCompressing, error } = useImageCompression();
```

| Return | Type | Description |
|--------|------|-------------|
| `compress` | `(file: File) => Promise<CompressedImage>` | Compress image |
| `isCompressing` | `boolean` | True during compression |
| `error` | `string \| null` | Error message if failed |

### usePhotos (`src/hooks/usePhotos.ts`)

Store consumer for photos with auto-load on mount.

```typescript
const { photos, loading, uploadPhoto } = usePhotos();
```

Calls `loadPhotos()` on mount to fetch photos from Supabase.

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

## Related Documentation

- [Slice Details](./02-slice-details.md)
- [Direct Store Access](./07-direct-store-access.md)
- [Component Hierarchy](../architecture/06-component-hierarchy.md)

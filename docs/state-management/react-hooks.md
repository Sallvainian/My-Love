# React Hooks

Custom hooks wrap store access and provide domain-specific APIs to components. They handle data fetching on mount, realtime subscriptions, browser API wrappers, and auto-save logic.

## Hook Inventory

| Hook | File | Purpose | Uses Store |
|---|---|---|---|
| `useAuth` | `src/hooks/useAuth.ts` | Auth state + user object | No (direct Supabase) |
| `useAutoSave` | `src/hooks/useAutoSave.ts` | Save on visibility change / before unload | Yes |
| `useImageCompression` | `src/hooks/useImageCompression.ts` | Image compression with status tracking | No |
| `useLoveNotes` | `src/hooks/useLoveNotes.ts` | Love notes facade: fetch, send, retry, realtime | Yes |
| `useMoodHistory` | `src/hooks/useMoodHistory.ts` | Paginated mood history from Supabase | No (direct API) |
| `useMotionConfig` | `src/hooks/useMotionConfig.ts` | Framer Motion presets with reduced-motion | No |
| `useNetworkStatus` | `src/hooks/useNetworkStatus.ts` | Online/offline/connecting detection | No |
| `usePartnerMood` | `src/hooks/usePartnerMood.ts` | Partner mood + Broadcast subscription | Yes |
| `usePhotos` | `src/hooks/usePhotos.ts` | Photo CRUD with upload progress | Yes |
| `useRealtimeMessages` | `src/hooks/useRealtimeMessages.ts` | Broadcast subscription for love notes | Yes |
| `useVibration` | `src/hooks/useVibration.ts` | Vibration API wrapper | No |

## Barrel Export (`src/hooks/index.ts`)

```typescript
export { useNetworkStatus } from './useNetworkStatus';
export { useAutoSave } from './useAutoSave';
export { useLoveNotes } from './useLoveNotes';
export { useVibration } from './useVibration';
export { useMotionConfig } from './useMotionConfig';
```

## Detailed Hook Documentation

### `useAuth`

Provides authentication state by subscribing to Supabase auth changes:

```typescript
interface UseAuthReturn {
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

export function useAuth(): UseAuthReturn {
  useEffect(() => {
    supabase.auth.getUser();           // Initial check
    supabase.auth.onAuthStateChange(); // Subscribe to changes
    return () => subscription.unsubscribe();
  }, []);
}
```

### `useAutoSave`

Fires save callback on visibility change and before page unload:

```typescript
export function useAutoSave(saveFn: () => Promise<void>) {
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') saveFn();
    };
    const handleBeforeUnload = () => saveFn();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => { /* cleanup */ };
  }, [saveFn]);
}
```

Used by scripture reading to save session progress when the user switches tabs or closes the app.

### `useImageCompression`

Wraps `imageCompressionService` with status tracking:

```typescript
type CompressionStatus = 'idle' | 'compressing' | 'complete' | 'error';

export function useImageCompression() {
  const [status, setStatus] = useState<CompressionStatus>('idle');
  const compress = async (file: File) => {
    setStatus('compressing');
    const result = await imageCompressionService.compressImage(file);
    setStatus('complete');
    return result;
  };
  return { compress, status };
}
```

### `useLoveNotes`

High-level facade that composes store actions + realtime subscription:

```typescript
export function useLoveNotes() {
  const fetchNotes = useAppStore((s) => s.fetchNotes);
  const sendNote = useAppStore((s) => s.sendNote);
  const retryFailedMessage = useAppStore((s) => s.retryFailedMessage);
  const cleanupPreviewUrls = useAppStore((s) => s.cleanupPreviewUrls);

  // Auto-fetch on mount
  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  // Realtime subscription
  useRealtimeMessages({ enabled: true });

  // Cleanup preview URLs on unmount
  useEffect(() => () => cleanupPreviewUrls(), [cleanupPreviewUrls]);

  return { sendNote, retryFailedMessage, /* ... */ };
}
```

### `useMoodHistory`

Paginated mood history with offset-based pagination:

```typescript
const PAGE_SIZE = 50;

export function useMoodHistory(userId: string) {
  const [moods, setMoods] = useState([]);
  const [hasMore, setHasMore] = useState(true);

  const fetchPage = async (offset: number) => {
    const data = await moodApi.fetchMoodHistory(userId, PAGE_SIZE, offset);
    setHasMore(data.length === PAGE_SIZE);
    setMoods((prev) => [...prev, ...data]);
  };
}
```

### `useMotionConfig`

Provides animation presets that respect `prefers-reduced-motion`:

```typescript
export function useMotionConfig() {
  const prefersReducedMotion = useReducedMotion();

  return {
    crossfade: prefersReducedMotion ? noMotion : fadeMotion,
    slide: prefersReducedMotion ? noMotion : slideMotion,
    spring: prefersReducedMotion ? noMotion : springMotion,
    fadeIn: prefersReducedMotion ? noMotion : fadeInMotion,
  };
}
```

### `useNetworkStatus`

Three-state network detection with debounce:

```typescript
type NetworkState = 'online' | 'offline' | 'connecting';

export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkState>(navigator.onLine ? 'online' : 'offline');

  useEffect(() => {
    const handleOnline = () => {
      setStatus('connecting');
      setTimeout(() => setStatus('online'), 1500); // 1.5s debounce
    };
    const handleOffline = () => setStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { /* cleanup */ };
  }, []);
}
```

### `usePartnerMood`

Initial fetch + Broadcast subscription for real-time partner mood updates:

```typescript
export function usePartnerMood() {
  const fetchPartnerMoods = useAppStore((s) => s.fetchPartnerMoods);

  // Initial fetch
  useEffect(() => { fetchPartnerMoods(); }, [fetchPartnerMoods]);

  // Subscribe to partner's mood-updates Broadcast channel
  useEffect(() => {
    const channel = supabase
      .channel(`mood-updates:${userId}`)
      .on('broadcast', { event: 'mood_updated' }, () => fetchPartnerMoods())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);
}
```

### `usePhotos`

Photo lifecycle management:

```typescript
export function usePhotos() {
  const loadPhotos = useAppStore((s) => s.loadPhotos);
  const uploadPhoto = useAppStore((s) => s.uploadPhoto);
  const deletePhoto = useAppStore((s) => s.deletePhoto);

  // Auto-load on mount
  useEffect(() => { loadPhotos(); }, [loadPhotos]);

  return { uploadPhoto, deletePhoto, /* state selectors */ };
}
```

### `useRealtimeMessages`

Broadcast subscription with exponential backoff retry:

```typescript
const RETRY_CONFIG = { maxRetries: 5, baseDelay: 1000, maxDelay: 30000 };

export function useRealtimeMessages(options = {}) {
  const addNote = useAppStore((s) => s.addNote);

  useEffect(() => {
    const channel = supabase
      .channel(`love-notes:${userId}`)
      .on('broadcast', { event: 'new_message' }, handleNewMessage)
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') retryCount = 0;
        if (status === 'CHANNEL_ERROR') {
          const delay = Math.min(baseDelay * 2 ** retryCount, maxDelay);
          setTimeout(() => channel.subscribe(), delay);
        }
      });

    return () => supabase.removeChannel(channel);
  }, []);
}
```

### `useVibration`

Vibration API with feature detection:

```typescript
export function useVibration() {
  const isSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator;

  const vibrate = (pattern: number | number[]) => {
    if (isSupported) navigator.vibrate(pattern);
  };

  return { vibrate, isSupported };
}
```

## Hook Design Patterns

| Pattern | Hooks | Purpose |
|---|---|---|
| Auto-fetch on mount | `useLoveNotes`, `usePhotos`, `usePartnerMood` | Load data when view mounts |
| Realtime subscription | `useRealtimeMessages`, `usePartnerMood` | Live updates via Broadcast |
| Browser API wrapper | `useNetworkStatus`, `useVibration`, `useMotionConfig` | Feature detection + graceful degradation |
| Lifecycle management | `useAutoSave`, `useLoveNotes` (cleanup) | Save/cleanup on unmount |
| Status tracking | `useImageCompression`, `useNetworkStatus` | Track async operation state |

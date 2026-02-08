# React Hooks

Custom hooks wrap store access and provide domain-specific APIs to components.

## useLoveNotes

**File:** `src/hooks/useLoveNotes.ts`

Primary hook for Love Notes chat functionality. Auto-fetches on mount, handles pagination, integrates Realtime subscription, and manages blob URL cleanup.

```typescript
function useLoveNotes(autoFetch?: boolean): UseLoveNotesResult;
```

**Returns:**

| Property | Type | Description |
|----------|------|-------------|
| `notes` | `LoveNote[]` | Notes in chat order |
| `isLoading` | `boolean` | Fetching state |
| `error` | `string \| null` | Error message |
| `hasMore` | `boolean` | More notes available for pagination |
| `fetchNotes` | `() => Promise<void>` | Refresh notes list |
| `fetchOlderNotes` | `() => Promise<void>` | Load older notes |
| `clearError` | `() => void` | Clear error |
| `sendNote` | `(content, imageFile?) => Promise<void>` | Send note with optional image |
| `retryFailedMessage` | `(tempId) => Promise<void>` | Retry failed send |
| `removeFailedMessage` | `(tempId) => void` | Remove failed message |

**Integrations:**
- Subscribes to `useRealtimeMessages` for instant message reception (Supabase Broadcast)
- Cleans up blob preview URLs on unmount

## useAutoSave

**File:** `src/hooks/useAutoSave.ts`

Auto-saves scripture reading session progress when the user switches tabs or closes the browser.

```typescript
function useAutoSave(options: UseAutoSaveOptions): void;
```

**Triggers:**
- `visibilitychange` event (tab switch, home button, lock screen)
- `beforeunload` event (tab close, refresh -- best-effort)

**Conditions:** Only saves when `session.status === 'in_progress'`

## useNetworkStatus

**File:** `src/hooks/useNetworkStatus.ts`

Reactive network connectivity detection with transitional "connecting" state.

```typescript
function useNetworkStatus(): NetworkStatus;
```

**Returns:**

| Property | Type | Description |
|----------|------|-------------|
| `isOnline` | `boolean` | Whether browser has network connection |
| `isConnecting` | `boolean` | Brief transition state (1.5s debounce) |

## useVibration

**File:** `src/hooks/useVibration.ts`

Haptic feedback via the Vibration API with feature detection and graceful degradation.

```typescript
function useVibration(): UseVibrationReturn;
```

**Returns:**

| Property | Type | Description |
|----------|------|-------------|
| `vibrate` | `(pattern: number \| number[]) => void` | Trigger vibration |
| `isSupported` | `boolean` | Whether Vibration API is available |

**Standard patterns:**
- Success: `vibrate(50)` -- single short pulse
- Error: `vibrate([100, 50, 100])` -- double pulse

## useMotionConfig

**File:** `src/hooks/useMotionConfig.ts`

Centralized animation configuration that respects `prefers-reduced-motion`. Wraps Framer Motion's `useReducedMotion`.

```typescript
function useMotionConfig(): MotionConfig;
```

**Returns named animation presets:**

| Preset | Normal | Reduced Motion |
|--------|--------|----------------|
| `crossfade` | `{ duration: 0.2 }` | `{ duration: 0 }` |
| `slide` | `{ duration: 0.3, ease: 'easeInOut' }` | `{ duration: 0 }` |
| `spring` | `{ type: 'spring', stiffness: 100, damping: 15 }` | `{ duration: 0 }` |
| `fadeIn` | `{ duration: 0.2 }` | `{ duration: 0 }` |
| `modeReveal` | `{ duration: 0.2 }` | `{ duration: 0 }` |

---

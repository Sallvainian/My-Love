# Shared and Utility Components

## NetworkStatusIndicator

**File**: `src/components/shared/NetworkStatusIndicator.tsx` (224 lines)

Two variants exported from the same file:

### Banner Variant (`NetworkStatusIndicator`)

```typescript
interface NetworkStatusIndicatorProps {
  className?: string;
  showOnlyWhenOffline?: boolean;
}
```

Full-width bar with icon, colored dot, label text, and description. Three states:

| State | Dot Color | Icon | Label | Description |
|-------|-----------|------|-------|-------------|
| Online | `#51CF66` (green) | `Wifi` | "Online" | (hidden unless `showOnlyWhenOffline=false`) |
| Connecting | `#FCC419` (yellow, pulsing) | `Loader2` (spinning) | "Connecting..." | "Reconnecting to the network..." |
| Offline | `#FF6B6B` (red) | `WifiOff` | "Offline" | "You're offline. Changes will sync when reconnected." |

Uses `useNetworkStatus()` hook. ARIA: `role="status"`, `aria-live="polite"`, descriptive `aria-label`. `data-testid="network-status-indicator"` with `data-status` attribute.

### Dot Variant (`NetworkStatusDot`)

```typescript
function NetworkStatusDot({ className = '' }: { className?: string })
```

Compact 10px (`w-2.5 h-2.5`) circle for inline/header integration. Same three-state color coding. Pulse animation when connecting. `role="status"`, `aria-label` with status text.

## SyncToast

**File**: `src/components/shared/SyncToast.tsx` (163 lines)

```typescript
interface SyncResult {
  successCount: number;
  failCount: number;
}

interface SyncToastProps {
  syncResult: SyncResult | null;
  onDismiss: () => void;
  autoDismissMs?: number; // Default: 5000
}
```

Fixed-position toast notification (top-center, `z-[100]`, min-width 280px). Spring animation entrance (`stiffness: 500`, `damping: 30`). Four display variants:

| Condition | Background | Icon | Message Pattern |
|-----------|------------|------|-----------------|
| All success | `bg-green-50` | `CheckCircle` (green) | "Synced N pending item(s)" |
| Partial success | `bg-yellow-50` | `AlertCircle` (yellow) | "Synced X of Y items (Z failed)" |
| All failed | `bg-red-50` | `AlertCircle` (red) | "Failed to sync N item(s)" |
| No items | `bg-gray-50` | `Cloud` (gray) | "No pending items to sync" |

Auto-dismisses after `autoDismissMs` (default 5000ms). Manual dismiss via X button. Uses `AnimatePresence` for exit animation with 300ms delay before `onDismiss` callback.

## charCounter

**File**: `src/components/scripture-reading/reflection/charCounter.ts` (6 lines)

```typescript
export const CHAR_COUNTER_RATIO = 0.75;

export function getCharCounterThreshold(maxLength: number): number {
  return Math.floor(maxLength * CHAR_COUNTER_RATIO);
}
```

Utility function used by `PerStepReflection` to determine when to show character counters. For a 200-char max, the counter appears at 150 characters.

## motionFeatures

**File**: `src/components/scripture-reading/motionFeatures.ts` (4 lines)

```typescript
import { domAnimation } from 'framer-motion';
export default domAnimation;
```

Re-export for dynamic import by `SoloReadingFlow`'s `LazyMotion` component. Enables tree-shaking of Framer Motion animation features.

## LoadingSpinner

**File**: `src/App.tsx` (inline, not exported)

Inline component defined within `App.tsx` used as the `<Suspense fallback>` for all lazy-loaded routes:

```tsx
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
```

Centered full-screen pink spinning border circle. Not exported -- used only as Suspense fallback within App.

---

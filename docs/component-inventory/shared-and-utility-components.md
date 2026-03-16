# Shared and Utility Components

## NetworkStatusIndicator

**File:** `src/components/shared/NetworkStatusIndicator.tsx`
**Exports:** `NetworkStatusIndicator` (default + named), `NetworkStatusDot` (named)

### NetworkStatusIndicator

Full-featured network status indicator with banner and dot modes. Uses `useNetworkStatus` hook.

**Props:**

- `className?: string` -- Additional CSS classes
- `showOnlyWhenOffline?: boolean` -- Hide when online (default: false)

**States:**
| State | Dot Color | Icon | Label | Banner |
|-------|-----------|------|-------|--------|
| Online | `#51CF66` (green) | Wifi | "Online" | No (compact dot only) |
| Connecting | `#FCC419` (yellow) | Loader2 (spinning) | "Connecting..." | Yes, with "Reconnecting..." |
| Offline | `#FF6B6B` (coral red) | WifiOff | "Offline" | Yes, with "Changes will sync when reconnected" |

The banner includes a colored dot, icon, label text, and description text. Uses `aria-live="polite"` for screen reader announcements.

### NetworkStatusDot

Compact inline dot indicator for header/status bar integration. Same three-state color scheme. Uses `aria-label` for accessibility. Pulse animation on connecting state.

---

## SyncToast

**File:** `src/components/shared/SyncToast.tsx`
**Export:** `SyncToast` (default + named)

Toast notification for sync completion feedback. Uses Framer Motion for spring-based entrance/exit animation.

**Props:**

- `syncResult: SyncResult | null` -- `{ successCount: number, failCount: number }`
- `onDismiss: () => void` -- Called when toast is dismissed
- `autoDismissMs?: number` -- Auto-dismiss duration (default: 5000ms, 0 = no auto-dismiss)

**Variants:**
| Condition | Icon | Colors | Message Example |
|-----------|------|--------|-----------------|
| Full success | CheckCircle | Green | "Synced 3 pending items" |
| Partial success | AlertCircle | Yellow | "Synced 2 of 3 items (1 failed)" |
| All failed | AlertCircle | Red | "Failed to sync 2 items" |
| No items | Cloud | Gray | "No pending items to sync" |

Fixed positioned at top center (`z-[100]`), min width 280px. Dismiss button (X icon) in top-right corner.

---

## ErrorBoundary

**File:** `src/components/ErrorBoundary/ErrorBoundary.tsx`
**Type:** Class component (React error boundary)

Global error boundary wrapping the entire application. Features:

- Catches all React rendering errors
- Reports errors to Sentry (`@sentry/react`)
- Displays fallback UI with error message
- "Try Again" button to reset error state

---

## ViewErrorBoundary

**File:** `src/components/ViewErrorBoundary/ViewErrorBoundary.tsx`
**Type:** Class component (React error boundary)

Per-view error boundary that keeps the bottom navigation visible when a view crashes. Features:

- Wraps each view section independently
- Detects offline errors (network-related exceptions)
- Detects chunk load errors (lazy loading failures, e.g., stale service worker)
- Shows appropriate messaging based on error type:
  - Offline: "You appear to be offline. Please check your connection."
  - Chunk error: "A new version is available. Please refresh."
  - Other: Generic error message with retry button
- Navigation (`BottomNavigation`) remains functional during error state

# Shared and Utility Components

## NetworkStatusIndicator

Two variants for different contexts:

- **Banner variant** (`NetworkStatusIndicator`): Full-width bar with icon, label, and description. Used at the top of the app with `showOnlyWhenOffline` to hide when online.
- **Dot variant** (`NetworkStatusDot`): Compact 10px circle for inline/header usage. Color-coded: green (#51CF66), yellow (#FCC419), red (#FF6B6B).

Both use the `useNetworkStatus` hook and provide ARIA live regions for screen reader announcements.

## SyncToast

Fixed-position toast (top-center, z-index: 100) for sync completion feedback. Three color variants based on result:
- **Full success**: Green with CheckCircle icon
- **Partial success**: Yellow with AlertCircle icon
- **All failed**: Red with AlertCircle icon

Auto-dismisses after 5 seconds with a manual dismiss button. Spring animation (stiffness: 500, damping: 30).

## LoadingSpinner

Inline component defined in `App.tsx` used as the Suspense fallback for all lazy-loaded routes. Centered full-screen pink spinning border circle.

---

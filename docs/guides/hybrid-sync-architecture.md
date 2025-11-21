# Hybrid Sync Architecture

## Overview

The Hybrid Sync solution ensures that mood entries synchronize reliably between IndexedDB (local storage) and Supabase (cloud database) across various network conditions and app states.

## Problem Statement

**Original Issue**: Partner moods that were saved locally (in IndexedDB) were not appearing for the other user, even after 10+ minutes. The realtime subscription was active and working, but moods were stuck in local storage and never synced to Supabase.

**Root Cause**: The offline-first PWA architecture saves moods to IndexedDB first, then syncs to Supabase. While this provides excellent offline support, it created a gap where moods could remain unsynced if:
1. The sync failed silently
2. The app was closed before sync completed
3. Network issues prevented sync
4. User navigated away during sync

## Architecture Design

The Hybrid Sync solution consists of **three complementary sync mechanisms** that work together to ensure reliable synchronization:

### 1. Periodic Sync (While App is Open)
**Location**: [src/App.tsx:278-310](../src/App.tsx#L278-L310)

**Purpose**: Continuously monitor for pending moods while the app is running

**Implementation**:
```typescript
// Runs every 5 minutes while app is open
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

setInterval(() => {
  if (syncStatus.isOnline && session) {
    syncPendingMoods();
  }
}, SYNC_INTERVAL_MS);
```

**Triggers**:
- Every 5 minutes automatically
- Only when online and authenticated
- Runs in background (doesn't block UI)

**Use Case**: Catches moods that failed to sync initially, provides continuous monitoring

---

### 2. Immediate Sync (On App Mount)
**Location**: [src/App.tsx:278-289](../src/App.tsx#L278-L289)

**Purpose**: Check for pending moods as soon as the app opens

**Implementation**:
```typescript
useEffect(() => {
  // Sync immediately on app mount
  if (syncStatus.isOnline && session) {
    syncPendingMoods();
  }
}, [syncPendingMoods, syncStatus.isOnline, session]);
```

**Triggers**:
- App startup/page load
- User navigates back to app
- Only when online and authenticated

**Use Case**: Handles moods that were saved when offline and app was later reopened online

---

### 3. Background Sync (When App is Closed)
**Location**: [src/sw-custom.ts:42-51](../src/sw-custom.ts#L42-L51), [src/utils/backgroundSync.ts](../src/utils/backgroundSync.ts)

**Purpose**: Sync pending moods when app is closed but network is restored

**Implementation**:
```typescript
// Service Worker listens for 'sync' event
self.addEventListener('sync', ((event: SyncEvent) => {
  if (event.tag === 'sync-pending-moods') {
    event.waitUntil(syncPendingMoods());
  }
}) as EventListener);
```

**Triggers**:
- Network connectivity restored (after being offline)
- Browser determines optimal time to sync
- Registered when mood is saved while offline

**Use Case**: Handles moods saved offline when app is closed or in background

---

## Data Flow

### Happy Path (Online)
```
User logs mood
    ↓
Save to IndexedDB (local) ✓
    ↓
Immediate sync to Supabase ✓
    ↓
Realtime notification to partner ✓
    ↓
Partner sees mood immediately ✓
```

### Offline Path (Network Failure)
```
User logs mood
    ↓
Save to IndexedDB (local) ✓
    ↓
Sync fails (offline) ✗
    ↓
Register background sync tag ✓
    ↓
--- User closes app ---
    ↓
Network restored
    ↓
Service Worker triggers sync ✓
    ↓
Sync to Supabase ✓
    ↓
Partner sees mood when they open app ✓
```

### Periodic Sync Path (Missed Sync)
```
User logs mood
    ↓
Save to IndexedDB (local) ✓
    ↓
Initial sync fails silently ✗
    ↓
Mood remains in IndexedDB (pending)
    ↓
5 minutes pass...
    ↓
Periodic sync triggers ✓
    ↓
Detects pending mood ✓
    ↓
Sync to Supabase ✓
    ↓
Partner sees mood ✓
```

---

## Technical Implementation

### Files Modified

#### 1. App.tsx
**Changes**:
- Added `syncStatus` to useAppStore destructuring
- Implemented periodic sync (5-minute interval)
- Implemented immediate sync on mount
- Setup Service Worker message listener

**Code Locations**:
- Line 53: Added `syncStatus` to destructuring
- Lines 278-310: Periodic + immediate sync useEffect
- Lines 313-325: Service Worker listener setup

#### 2. MoodTracker.tsx
**Changes**:
- Register background sync when mood is saved offline

**Code Locations**:
- Line 24: Import `registerBackgroundSync`
- Lines 159-163: Register sync tag when offline

#### 3. vite.config.ts
**Changes**:
- Enabled custom service worker instead of default Workbox

**Code Locations**:
- Lines 32-34: Added `srcDir`, `filename`, `strategies` configuration

### Files Created

#### 1. src/sw-custom.ts
**Purpose**: Custom Service Worker with Background Sync API support

**Key Features**:
- Listens for 'sync' events from Background Sync API
- Sends message to app clients to trigger sync
- Handles activate event for service worker lifecycle
- Handles message events for app communication

**Type Safety**:
- Uses `/// <reference lib="webworker" />` for WebWorker types
- Defines SyncEvent interface with tag and lastChance properties
- Type assertions for event listeners to satisfy TypeScript

#### 2. src/utils/backgroundSync.ts
**Purpose**: Utility functions for Background Sync API

**Exports**:
- `registerBackgroundSync(tag)`: Register a sync tag with service worker
- `setupServiceWorkerListener(callback)`: Setup message listener for service worker
- `isBackgroundSyncSupported()`: Check if Background Sync API is available

**Browser Support**:
- Gracefully degrades if Background Sync API not supported
- Checks for `serviceWorker` in navigator and `SyncManager` in window

#### 3. src/sw-types.d.ts
**Purpose**: TypeScript type definitions for Service Worker APIs

**Note**: Created but not used in final implementation. Types are inlined in sw-custom.ts instead for better compatibility with Vite's service worker compilation.

---

## Browser Support

### Background Sync API
- ✅ Chrome/Edge (79+)
- ✅ Opera (66+)
- ✅ Samsung Internet (12.0+)
- ⚠️ Firefox (Not supported - falls back to periodic sync)
- ⚠️ Safari (Not supported - falls back to periodic sync)

### Graceful Degradation
When Background Sync API is not supported:
1. Periodic sync (5 minutes) still runs ✓
2. Immediate sync on app mount still runs ✓
3. Manual sync still available ✓

**Result**: All browsers get reliable sync, even without Background Sync API support.

---

## Testing Guide

### Test Scenario 1: Offline Mood Entry
1. Turn off network (Airplane mode or DevTools offline)
2. Log a mood entry
3. Verify mood appears locally
4. Close the app
5. Restore network
6. Open app on partner's device
7. **Expected**: Mood appears on partner's device

### Test Scenario 2: Periodic Sync
1. Log a mood entry while online
2. Manually disable sync (temporarily break Supabase connection in code)
3. Verify mood stuck in IndexedDB (check syncStatus.pendingMoods)
4. Wait 5 minutes
5. **Expected**: Periodic sync detects and syncs the pending mood

### Test Scenario 3: Immediate Sync on Mount
1. Log a mood entry while offline
2. Close the app
3. Restore network
4. Open the app
5. **Expected**: Mood syncs immediately on app mount

### Test Scenario 4: Realtime Updates
1. User A logs a mood while online
2. User B has app open
3. **Expected**: User B sees the mood appear immediately via realtime subscription

---

## Configuration

### Sync Interval
**Current**: 5 minutes (300,000 ms)
**Location**: [src/App.tsx:293](../src/App.tsx#L293)

To adjust:
```typescript
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // Change this value
```

**Recommendations**:
- **5 minutes**: Good balance of battery life and sync frequency (current)
- **1 minute**: More aggressive, drains battery faster
- **10 minutes**: Conserves battery, slower sync detection

### Background Sync Tag
**Current**: `'sync-pending-moods'`
**Location**: Multiple files

To change the tag name:
1. [src/sw-custom.ts:43](../src/sw-custom.ts#L43) - Service Worker listener
2. [src/components/MoodTracker/MoodTracker.tsx:160](../src/components/MoodTracker/MoodTracker.tsx#L160) - Registration

---

## Performance Considerations

### Battery Impact
- **Periodic sync**: Minimal impact (runs every 5 minutes, only when app is open)
- **Background sync**: Minimal impact (browser-controlled, optimized timing)
- **Immediate sync**: No impact (runs once on app mount)

### Network Usage
- **Periodic sync**: Only syncs if pending moods exist (checks IndexedDB first)
- **Background sync**: Only syncs when network is restored (not on every interval)
- **Immediate sync**: Single request on app mount

### Resource Optimization
- All sync operations check `syncStatus.isOnline` before executing
- All sync operations check `session` (authenticated) before executing
- Sync operations are non-blocking (don't block UI interactions)
- Failed syncs are logged but don't show errors to user (graceful degradation)

---

## Debugging

### Check Sync Status
```javascript
// In browser console
const store = useAppStore.getState();
console.log('Pending moods:', store.syncStatus.pendingMoods);
console.log('Is online:', store.syncStatus.isOnline);
console.log('Last sync:', store.syncStatus.lastSync);
```

### Check Service Worker Status
```javascript
// In browser console
navigator.serviceWorker.ready.then(reg => {
  reg.sync.getTags().then(tags => {
    console.log('Registered sync tags:', tags);
  });
});
```

### Enable Debug Logging
All sync operations log to console in development mode:
- `[App] Initial sync on mount`
- `[App] Periodic sync triggered`
- `[ServiceWorker] Background Sync triggered`
- `[BackgroundSync] Registered sync tag`

**To enable in production**: Remove `if (import.meta.env.DEV)` checks

---

## Future Enhancements

### Potential Improvements
1. **Exponential backoff**: Retry failed syncs with increasing delays
2. **Sync queue priority**: Sync moods in chronological order
3. **Partial sync**: Sync only new/modified moods (not full re-sync)
4. **Conflict resolution**: Handle moods edited on multiple devices
5. **Network quality detection**: Adjust sync frequency based on connection quality
6. **User-configurable sync interval**: Let users choose sync frequency
7. **Manual sync button**: Allow users to trigger sync on demand

### Monitoring Recommendations
1. Track sync success/failure rates
2. Monitor average time-to-sync for offline moods
3. Measure battery impact of periodic sync
4. Track Background Sync API adoption rate (browser support)

---

## Related Documentation

- **Architecture Overview**: [docs/architecture.md](../architecture.md)
- **State Management**: [docs/ZUSTAND_STATE_MANAGEMENT_ARCHITECTURE/](../ZUSTAND_STATE_MANAGEMENT_ARCHITECTURE/)
- **API Services**: [docs/api-services-architecture/](../api-services-architecture/)
- **Development Guide**: [docs/development-guide.md](../development-guide.md)

---

## Changelog

### 2025-11-18 - Initial Implementation
- Implemented periodic sync (5-minute interval)
- Implemented immediate sync on app mount
- Implemented Service Worker Background Sync API
- Created comprehensive documentation
- Fixed TypeScript compilation errors for Service Worker types
- Verified build succeeds with all three sync mechanisms

### Problem Solved
**Before**: Partner moods stuck in IndexedDB, not syncing to Supabase
**After**: Three-layer sync system ensures moods sync reliably across all network conditions and app states

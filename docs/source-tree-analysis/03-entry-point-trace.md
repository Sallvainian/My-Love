# Entry Point Trace

## Primary Entry Point: `src/main.tsx`

The application boots from `src/main.tsx`, which is referenced by `index.html`.

### Boot Sequence

```typescript
// 1. Initialize Sentry error tracking (no-ops if VITE_SENTRY_DSN is absent)
// 2. React StrictMode (double-mounts in development)
// 3. LazyMotion with domAnimation features (Framer Motion tree-shaking)
// 4. Render <App /> into DOM root

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LazyMotion, domAnimation } from 'framer-motion';
import { initSentry } from './config/sentry';
import App from './App.tsx';
import './index.css';

initSentry();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LazyMotion features={domAnimation}>
      <App />
    </LazyMotion>
  </StrictMode>
);
```

### Service Worker Registration (Production Only)

```typescript
// In production: register SW with auto-reload on update
if (import.meta.env.PROD) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        console.log('[SW] New version available, reloading...');
        updateSW(true); // true = reload after update
      },
      onOfflineReady() {
        console.log('[SW] App ready to work offline');
      },
      onRegisterError(error) {
        console.error('[SW] Registration error:', error);
      },
    });
  });
}

// In development: unregister stale SWs
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => regs.forEach((reg) => reg.unregister()));
}
```

## Application Entry Point: `src/App.tsx`

### Component Lifecycle

```
<App />
  |
  |-- useState: session, authLoading, needsDisplayName, showSplash, showAdmin
  |-- useAppStore(): settings, initializeApp, isLoading, currentView, setView, syncPendingMoods
  |
  |-- useEffect: detectViewFromURL()     // Parse URL to set initial view + popstate listener
  |-- useEffect: checkAuth()             // getSession + onAuthStateChange + Sentry user context
  |-- useEffect: initializeApp()         // Initialize when session established
  |-- useEffect: applyTheme()            // Apply CSS variables for current theme
  |-- useEffect: online/offline listeners // Auto-sync on reconnect
  |-- useEffect: periodic sync           // 5-minute mood sync interval
  |-- useEffect: SW message listener     // Listen for BACKGROUND_SYNC_COMPLETED
  |
  |-- Render Decision:
  |   |-- if authLoading: <LoadingSpinner />
  |   |-- if (!session): <LoginScreen />
  |   |-- if (needsDisplayName): <DisplayNameSetup />
  |   |-- if (isLoading): <LoadingSpinner />
  |   |-- if (showSplash): <WelcomeSplash />
  |   |-- if (showAdmin): <AdminPanel />
  |   |-- else: <Main App Shell>
  |
  |-- Main App Shell:
  |   |-- <NetworkStatusIndicator showOnlyWhenOffline />
  |   |-- <SyncToast />
  |   |-- <main>
  |   |   |-- 'home': <TimeTogether />, <BirthdayCountdown />, <EventCountdown />, <DailyMessage />
  |   |   |-- 'photos': <Suspense><PhotoGallery /></Suspense>
  |   |   |-- 'mood': <Suspense><MoodTracker /></Suspense>
  |   |   |-- 'partner': <Suspense><PartnerMoodView /></Suspense>
  |   |   |-- 'notes': <Suspense><LoveNotes /></Suspense>
  |   |   |-- 'scripture': <Suspense><ScriptureOverview /></Suspense>
  |   |-- <BottomNavigation />
  |   |-- <PhotoUpload /> (modal, lazy)
  |   |-- <PhotoCarousel /> (modal, lazy)
```

### Initialization Effects (in order)

1. **Route detection**: Reads `window.location.pathname` to determine initial view, sets up `popstate` listener
2. **Auth check**: Calls `getSession()`, subscribes to `onAuthStateChange`, sets Sentry user context
3. **App init** (`initializeApp`): Opens IndexedDB, loads/seeds messages, sets `isLoading = false`. Migration from localStorage to IndexedDB runs in background via `requestIdleCallback`.
4. **Theme application**: Applies CSS variables via `applyTheme(settings.themeName)`
5. **Network listeners**: Sets up online/offline event listeners, triggers sync on reconnect
6. **Periodic sync**: Sets up 5-minute `setInterval` for `syncPendingMoods()`
7. **SW listener**: Registers handler for `BACKGROUND_SYNC_COMPLETED` messages, shows `SyncToast`

## Service Worker Entry Point: `src/sw.ts`

The service worker has its own entry point, compiled separately from the main app:

```
src/sw.ts
  |
  |-- skipWaiting() + clientsClaim()     // Auto-activate new SW
  |-- precacheAndRoute(__WB_MANIFEST)    // Precache static assets (images, fonts only)
  |-- cleanupOutdatedCaches()            // Remove old caches
  |
  |-- Cache Strategies:
  |   |-- NetworkOnly: JS/CSS bundles (always fresh code)
  |   |-- NetworkFirst: Navigation (3s timeout, falls back to precache)
  |   |-- CacheFirst: Images, fonts (30-day expiry, 100 max entries)
  |   |-- CacheFirst: Google Fonts (1-year expiry, 30 max entries)
  |
  |-- Event Listeners:
  |   |-- 'sync': syncPendingMoods()     // Background Sync: read IDB, call Supabase REST
  |   |-- 'activate': log ready          // Activation logging
  |
  |-- syncPendingMoods():
  |   |-- getPendingMoods() from IndexedDB
  |   |-- getAuthToken() from IndexedDB (sw-auth store)
  |   |-- Check token expiry (5 min buffer)
  |   |-- POST to Supabase REST API via fetch (per mood)
  |   |-- markMoodSynced() in IndexedDB
  |   |-- postMessage(BACKGROUND_SYNC_COMPLETED) to clients
```

## Store Initialization: `src/stores/useAppStore.ts`

The Zustand store is created at module load time (before any component renders):

```
Module loaded
  |
  |-- create<AppState>()(persist(...))  // Store created with all 10 slices
  |-- persist middleware reads localStorage('my-love-storage')
  |-- Custom storage with pre-hydration validation
  |-- Custom deserialization (Map from array entries for shownMessages)
  |-- onRehydrateStorage callback validates state and sets __isHydrated
  |-- Store is ready for component consumption
  |-- In non-production: window.__APP_STORE__ = useAppStore (for E2E testing)
```

## Related Documentation

- [Directory Tree](./02-directory-tree.md)
- [Critical Code Paths](./04-critical-code-paths.md)
- [Architecture - Navigation](../architecture/09-navigation.md)

# Entry Point Trace

## Primary Entry Point: `src/main.tsx`

The application boots from `src/main.tsx`, which is referenced by `index.html`.

### Boot Sequence

```typescript
// 1. React StrictMode (double-mounts in development)
// 2. LazyMotion with domAnimation features (Framer Motion tree-shaking)
// 3. Render <App /> into DOM root

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LazyMotion, domAnimation } from 'framer-motion';
import App from './App.tsx';
import './index.css';

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
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  const { Workbox } = await import('workbox-window');
  const wb = new Workbox('/My-Love/sw.js');
  wb.addEventListener('waiting', () => {
    wb.messageSkipWaiting();
    window.location.reload();
  });
  wb.register();
}

// In development: unregister stale SWs
if (import.meta.env.DEV) {
  navigator.serviceWorker?.getRegistrations().then(regs =>
    regs.forEach(reg => reg.unregister())
  );
}
```

## Application Entry Point: `src/App.tsx`

### Component Lifecycle

```
<App />
  |
  |-- useAuth()                       // Check Supabase auth session
  |-- useAppStore()                   // Access Zustand store
  |
  |-- useEffect: detectViewFromURL()  // Parse URL to set initial view
  |-- useEffect: popstate listener    // Handle browser back/forward
  |-- useEffect: initializeApp()      // Initialize IndexedDB, load messages
  |-- useEffect: loadMoods()          // Load mood data from IndexedDB
  |-- useEffect: periodic sync        // 5-minute mood sync interval
  |-- useEffect: SW message listener  // Listen for background sync completion
  |-- useEffect: applyTheme()         // Apply CSS variables for current theme
  |
  |-- Render Decision:
  |   |-- if (!user): <LoginScreen />
  |   |-- if (!displayName): <DisplayNameSetup />
  |   |-- else: <Main App Shell>
  |
  |-- Main App Shell:
  |   |-- <ErrorBoundary>
  |   |-- <WelcomeSplash />           // 60-min interval animated splash
  |   |-- <main>
  |   |   |-- renderCurrentView()     // Switch on currentView
  |   |   |   |-- 'home': <DailyMessage />, <RelationshipTimers />, <CountdownTimer />
  |   |   |   |-- 'photos': <Suspense><PhotoGallery /></Suspense>
  |   |   |   |-- 'mood': <Suspense><MoodTracker /></Suspense>
  |   |   |   |-- 'partner': <Suspense><PartnerView /></Suspense>
  |   |   |   |-- 'notes': <Suspense><LoveNotes /></Suspense>
  |   |   |   |-- 'scripture': <Suspense><ScriptureOverview /></Suspense>
  |   |-- <BottomNavigation />
  |   |-- <NetworkStatusIndicator />
  |   |-- <SyncToast />
```

### Initialization Effects (in order)

1. **Auth check** (`useAuth`): Calls `supabase.auth.getUser()`, subscribes to `onAuthStateChange`
2. **URL detection**: Reads `window.location.pathname` to determine initial view
3. **App init** (`initializeApp`): Opens IndexedDB, loads/seeds messages, sets `isLoading = false`
4. **Mood load** (`loadMoods`): Reads all moods from IndexedDB into Zustand state
5. **Periodic sync**: Sets up 5-minute `setInterval` for `syncPendingMoods()`
6. **SW listener**: Registers handler for `BACKGROUND_SYNC_COMPLETED` messages
7. **Theme**: Applies CSS variables via `applyTheme(settings.themeName)`

## Service Worker Entry Point: `src/sw.ts`

The service worker has its own entry point, compiled separately from the main app:

```
src/sw.ts
  |
  |-- precacheAndRoute(__WB_MANIFEST)  // Precache static assets
  |-- cleanupOutdatedCaches()          // Remove old caches
  |
  |-- Cache Strategies:
  |   |-- NetworkOnly: JS/CSS bundles
  |   |-- NetworkFirst: Navigation, API
  |   |-- CacheFirst: Images, fonts
  |
  |-- Event Listeners:
  |   |-- 'sync': syncPendingMoods()   // Background Sync handler
  |   |-- 'message': handleMessage()    // Client communication
  |   |-- 'activate': skipWaiting()     // Auto-activate new SW
```

## Store Initialization: `src/stores/useAppStore.ts`

The Zustand store is created at module load time (before any component renders):

```
Module loaded
  |
  |-- create<AppState>()(persist(...))  // Store created with all 10 slices
  |-- persist middleware reads localStorage('my-love-storage')
  |-- Custom deserialization (Map from array entries)
  |-- onRehydrateStorage callback sets __isHydrated
  |-- Store is ready for component consumption
```

## Related Documentation

- [Directory Tree](./02-directory-tree.md)
- [Critical Folders](./04-critical-folders.md)
- [Architecture - Navigation](../architecture/09-navigation.md)

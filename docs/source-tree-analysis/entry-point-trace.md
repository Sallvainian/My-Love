# Entry Point Trace

The application boots through this sequence:

## 1. `index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  </head>
  <body>
    <!-- SPA redirect handler for GitHub Pages 404.html -->
    <script>
      (function() {
        var redirect = sessionStorage.redirect;
        delete sessionStorage.redirect;
        if (redirect && redirect !== location.href) {
          history.replaceState(null, '', redirect);
        }
      })();
    </script>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

The SPA redirect script handles GitHub Pages deep-link support. The `#root` div is the React mount point.

## 2. `src/main.tsx`

```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LazyMotion, domAnimation } from 'framer-motion';
import './index.css';
import App from './App.tsx';

// PWA registration (production only)
if (import.meta.env.PROD) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() { updateSW(true); },  // Auto-reload on new SW
      onOfflineReady() { console.log('[SW] App ready to work offline'); },
    });
  });
} else if ('serviceWorker' in navigator) {
  // Dev: Unregister all SWs to prevent stale code
  navigator.serviceWorker.getRegistrations().then((regs) =>
    regs.forEach((reg) => reg.unregister())
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LazyMotion features={domAnimation}>
      <App />
    </LazyMotion>
  </StrictMode>
);
```

**What happens:**
1. `index.css` is loaded (Tailwind + custom styles)
2. PWA Service Worker registered in production, unregistered in dev
3. React root created on `#root` element
4. `StrictMode` enables development warnings
5. `LazyMotion` wraps app for tree-shaken Framer Motion
6. `App` component renders

## 3. `src/App.tsx` -- Initialization Sequence

### Phase A: Zustand Store Hydration (synchronous)

Before `App` renders, the Zustand store is created:

```
1. create<AppState>()(persist(...)) executes
2. persist middleware reads 'my-love-storage' from localStorage
3. Custom storage.getItem validates JSON structure
4. onRehydrateStorage deserializes Map<string, number> from Array
5. __isHydrated = true
```

### Phase B: Auth Check

```typescript
useEffect(() => {
  const checkAuth = async () => {
    const currentSession = await getSession();
    setSession(currentSession);
    setAuthLoading(false);
  };
  checkAuth();

  const unsubscribe = onAuthStateChange((newSession) => {
    setSession(newSession);
    // Check display name for OAuth users
  });

  return () => unsubscribe();
}, []);
```

**Render gates (in order):**
1. `authLoading === true` -- Loading spinner
2. `session === null` -- `LoginScreen`
3. `needsDisplayName === true` -- `DisplayNameSetup`

### Phase C: App Initialization

```typescript
useEffect(() => {
  if (!hasInitialized.current && session) {
    hasInitialized.current = true;
    initializeApp();    // settingsSlice
    // Deferred migration (requestIdleCallback)
  }
}, [session]);
```

**`initializeApp()` sequence:**
1. Check `__isHydrated` flag
2. `storageService.init()` -- Open IndexedDB
3. `storageService.getAllMessages()` -- Load messages
4. If no messages: load defaults, write to IndexedDB, read back with IDs
5. `set({ messages })` -- Update messagesSlice
6. `get().updateCurrentMessage()` -- Compute today's daily message
7. `get().setLoading(false)` -- Release loading gate

### Phase D: Route Detection

```typescript
useEffect(() => {
  const routePath = getRoutePath(window.location.pathname);
  const initialView = /* map path to ViewType */;
  setView(initialView, true);  // skipHistory = true

  window.addEventListener('popstate', handlePopState);
  return () => window.removeEventListener('popstate', handlePopState);
}, [setView]);
```

### Phase E: Network & Sync Setup

```typescript
// Online/offline event listeners
window.addEventListener('online', handleOnline);
window.addEventListener('offline', handleOffline);

// Periodic sync (5-minute interval)
setInterval(() => syncPendingMoods(), 5 * 60 * 1000);

// Service Worker message listener (Background Sync completion)
navigator.serviceWorker.addEventListener('message', handleMessage);
```

### Phase F: Rendering

**Render gates (continued):**
4. `isLoading === true` -- Data loading spinner
5. `showSplash === true` -- `WelcomeSplash`
6. `showAdmin === true` -- `AdminPanel`
7. Default -- Main app with views + navigation

### Phase G: Main App Layout

```
<div>
  <NetworkStatusIndicator showOnlyWhenOffline />
  <SyncToast syncResult={syncResult} />
  <main id="main-content">
    {home view -- inline}
    {non-home views -- lazy + ViewErrorBoundary + Suspense}
  </main>
  <BottomNavigation />
  <Suspense><PhotoUpload /></Suspense>
  <Suspense><PhotoCarousel /></Suspense>
</div>
```

## Theme Application

```typescript
useEffect(() => {
  if (settings) applyTheme(settings.themeName);
}, [settings]);
```

`applyTheme` sets CSS custom properties on `document.documentElement` from the theme definition.

## Complete Boot Timeline

```
1. Browser loads index.html
2. SPA redirect script runs (if applicable)
3. Vite loads main.tsx as ES module
4. index.css parsed (Tailwind base/components/utilities)
5. SW registration started (production) or unregistered (dev)
6. React root created, StrictMode + LazyMotion wrapping
7. Zustand store created (synchronous)
8. localStorage read + pre-hydration validation
9. Map deserialization + __isHydrated = true
10. App component first render (authLoading = true, shows spinner)
11. getSession() async call to Supabase
12. Auth state resolved -> session set -> LoginScreen or continue
13. initializeApp() triggered (if session exists)
14. IndexedDB opened, messages loaded
15. updateCurrentMessage() computes today's message
16. isLoading = false -> main UI renders
17. Route detected from URL, view set
18. Network listeners + periodic sync started
19. Theme applied from settings
20. User sees home view (or deep-linked view)
```

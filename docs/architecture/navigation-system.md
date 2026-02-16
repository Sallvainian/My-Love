# Navigation System

## Overview

The app uses a **custom navigation system** without a client-side router library. View state is managed in the Zustand `navigationSlice`, and the browser URL is updated via `history.pushState()` for back/forward button support. The home view renders inline (not lazy-loaded) to guarantee offline availability.

## View Types

```typescript
export type ViewType = 'home' | 'photos' | 'mood' | 'partner' | 'notes' | 'scripture';
```

## Navigation Slice (`src/stores/slices/navigationSlice.ts`)

### State

| Field | Type | Default | Persisted |
|---|---|---|---|
| `currentView` | `ViewType` | `'home'` | No |

### Actions

| Action | Signature | Purpose |
|---|---|---|
| `setView` | `(view: ViewType, skipHistory?: boolean) => void` | Set current view, optionally skip history push |
| `navigateHome` | `() => void` | Convenience shortcut to home |
| `navigatePhotos` | `() => void` | Convenience shortcut to photos |
| `navigateMood` | `() => void` | Convenience shortcut to mood |
| `navigatePartner` | `() => void` | Convenience shortcut to partner |
| `navigateNotes` | `() => void` | Convenience shortcut to notes |
| `navigateScripture` | `() => void` | Convenience shortcut to scripture |

### URL Mapping

```typescript
setView: (view: ViewType, skipHistory = false) => {
  set({ currentView: view });

  if (!skipHistory) {
    const pathMap: Record<ViewType, string> = {
      home: '/',
      photos: '/photos',
      mood: '/mood',
      partner: '/partner',
      notes: '/notes',
      scripture: '/scripture',
    };
    const basePath = pathMap[view];
    const base = import.meta.env.BASE_URL || '/';
    const fullPath = base === '/' ? basePath : base.slice(0, -1) + basePath;
    window.history.pushState({ view }, '', fullPath);
  }
};
```

The `skipHistory` parameter prevents infinite loops during `popstate` handling and initial route detection.

## GitHub Pages Base Path Handling

In production, the app is deployed at `/My-Love/` (configured in `vite.config.ts`):

```typescript
base: mode === 'production' ? '/My-Love/' : '/',
```

The navigation slice respects this by prepending the base path to all URLs:

- Development: `/photos`, `/mood`, `/notes`
- Production: `/My-Love/photos`, `/My-Love/mood`, `/My-Love/notes`

The `App.tsx` helper strips the base path when reading the URL:

```typescript
const getRoutePath = (pathname: string): string => {
  const base = import.meta.env.BASE_URL || '/';
  if (base !== '/' && pathname.startsWith(base)) {
    return pathname.slice(base.length - 1);
  }
  return pathname;
};
```

## Initial Route Detection (`App.tsx`)

On mount, the app reads the current URL and sets the view accordingly:

```typescript
useEffect(() => {
  if (window.location.pathname.includes('/admin')) {
    setShowAdmin(true);
    return;
  }

  const routePath = getRoutePath(window.location.pathname);
  const initialView =
    routePath === '/photos' ? 'photos'
    : routePath === '/mood' ? 'mood'
    : routePath === '/partner' ? 'partner'
    : routePath === '/notes' ? 'notes'
    : routePath === '/scripture' ? 'scripture'
    : 'home';
  setView(initialView, true); // skipHistory = true
}, [setView]);
```

## Browser Back/Forward Support

A `popstate` event listener synchronizes browser navigation with view state:

```typescript
const handlePopState = () => {
  const routePath = getRoutePath(window.location.pathname);
  const view = /* same mapping as above */;
  setView(view, true); // skipHistory = true to prevent loop
};

window.addEventListener('popstate', handlePopState);
```

The `skipHistory = true` parameter is critical -- without it, `setView` would push a new history entry, causing the popstate handler to fire again in an infinite loop.

## SPA Redirect (GitHub Pages 404 Handling)

GitHub Pages does not support SPA routing natively. A `404.html` redirect script handles deep links:

```html
<!-- index.html -->
<script>
  (function() {
    var redirect = sessionStorage.redirect;
    delete sessionStorage.redirect;
    if (redirect && redirect !== location.href) {
      history.replaceState(null, '', redirect);
    }
  })();
</script>
```

The `404.html` file (not in `src/`) stores the attempted URL in `sessionStorage` and redirects to `index.html`, which then restores the URL and lets the app handle routing.

## View Rendering in App.tsx

### Home View (Inline, Not Lazy)

The home view renders directly without `React.lazy` to guarantee it works offline:

```typescript
{currentView === 'home' && (
  <div className="mx-auto max-w-4xl space-y-6 px-4 py-4">
    <TimeTogether />
    <BirthdayCountdown ... />
    <EventCountdown ... />
    <DailyMessage onShowWelcome={showWelcomeManually} />
  </div>
)}
```

### Non-Home Views (Lazy + Error Boundary)

All other views are lazy-loaded and wrapped in `ViewErrorBoundary`:

```typescript
{currentView !== 'home' && (
  <ViewErrorBoundary viewName={currentView} onNavigateHome={() => setView('home')}>
    <Suspense fallback={<LoadingSpinner />}>
      {currentView === 'photos' && <PhotoGallery />}
      {currentView === 'mood' && <MoodTracker />}
      {currentView === 'partner' && <PartnerMoodView />}
      {currentView === 'notes' && <LoveNotes />}
      {currentView === 'scripture' && <ScriptureOverview />}
    </Suspense>
  </ViewErrorBoundary>
)}
```

## Bottom Navigation

The `BottomNavigation` component renders outside any error boundary so it remains visible even when a view crashes:

```typescript
<BottomNavigation
  currentView={currentView}
  onViewChange={setView}
  onSignOut={() => void handleSignOut()}
  signOutDisabled={isSigningOut}
/>
```

## Admin Route

The admin panel is a special route (`/admin`) detected by URL substring matching, not by the navigation slice:

```typescript
if (window.location.pathname.includes('/admin')) {
  setShowAdmin(true);
  return;
}
```

Exiting admin uses `history.pushState` to remove `/admin` from the URL without a page reload.

## Trade-offs

| Decision | Benefit | Cost |
|---|---|---|
| No router library | Zero dependency, smaller bundle | Manual URL/history management |
| Home view inline | Always works offline, no chunk loading | Larger initial bundle |
| Conditional rendering | Simple mental model | No route-level code splitting for home view |
| `skipHistory` parameter | Prevents popstate infinite loops | Extra parameter on every `setView` call |

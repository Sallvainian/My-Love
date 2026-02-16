# Navigation Architecture

## Overview

The app uses **no router library**. Navigation is managed entirely through Zustand state via the `NavigationSlice`. The `App.tsx` component conditionally renders views based on `currentView` state.

## NavigationSlice

Defined in `src/stores/slices/navigationSlice.ts`:

```typescript
type ViewType = 'home' | 'photos' | 'mood' | 'partner' | 'notes' | 'scripture';

export interface NavigationSlice {
  currentView: ViewType;
  setView: (view: ViewType) => void;
}
```

### URL Integration

The `setView` action updates the browser URL to support direct navigation and bookmarking:

```typescript
setView: (view) => {
  set({ currentView: view });
  const base = import.meta.env.MODE === 'production' ? '/My-Love/' : '/';
  const url = view === 'home' ? base : `${base}${view}`;
  window.history.pushState({ view }, '', url);
}
```

Production builds use `/My-Love/` as the base path for GitHub Pages compatibility. Development uses `/`.

### Browser History

`App.tsx` sets up a `popstate` event listener to handle browser back/forward navigation:

```typescript
useEffect(() => {
  const handlePopState = (event: PopStateEvent) => {
    const view = event.state?.view || detectViewFromURL();
    setView(view);
  };
  window.addEventListener('popstate', handlePopState);
  return () => window.removeEventListener('popstate', handlePopState);
}, []);
```

On initial load, `detectViewFromURL()` parses `window.location.pathname` to determine which view to render, handling the base path prefix.

### Navigation State

The `currentView` state is **not persisted** to localStorage. On page refresh, the view is determined from the URL path. This means:
- Bookmarking works (URL reflects current view)
- Refresh works (URL is parsed on load)
- But there is no "last visited view" memory beyond the URL

## Bottom Navigation

The `BottomNavigation` component (`src/components/Navigation/BottomNavigation.tsx`) renders a tab bar with 6 tabs:

| Tab | View | Icon |
|-----|------|------|
| Home | `home` | Heart |
| Photos | `photos` | Camera |
| Mood | `mood` | Smile |
| Partner | `partner` | Users |
| Notes | `notes` | MessageSquare |
| Scripture | `scripture` | Book |

Each tab calls `setView(viewType)` on tap, which updates both the Zustand state and the browser URL.

## Lazy Loading

Non-home views are lazy-loaded using `React.lazy()` in `App.tsx`:

```typescript
const PhotoGallery = lazy(() => import('./components/PhotoGallery/PhotoGallery'));
const MoodTracker = lazy(() => import('./components/MoodTracker/MoodTracker'));
const LoveNotes = lazy(() => import('./components/love-notes/LoveNotes'));
// ... etc.
```

Each lazy component is wrapped in `<Suspense fallback={<LoadingSpinner />}>` for loading states. The home view is not lazy-loaded since it is the default landing page and should render immediately.

## View Error Boundaries

Each view is wrapped in a `ViewErrorBoundary` component (`src/components/ViewErrorBoundary/ViewErrorBoundary.tsx`) that catches rendering errors within individual views without crashing the entire application. If a view crashes, the error boundary displays an error message with a retry option.

## Related Documentation

- [Component Hierarchy](./06-component-hierarchy.md)
- [State Management - Slice Details](../state-management/02-slice-details.md)

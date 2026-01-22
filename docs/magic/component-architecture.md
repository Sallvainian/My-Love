# MAGIC DOC: Component Architecture
*Architecture reference - not a code walkthrough*

## Purpose
Client-side React SPA (Vite) with lazy-loaded feature modules, Zustand integration, and offline-first PWA support.

## Entry Points
- `src/main.tsx` - React root, service worker registration
- `src/App.tsx` - Main orchestrator, auth flow, view routing
- `src/components/Navigation/BottomNavigation.tsx` - 5-tab navigation

## Architecture Patterns

### No Server Components
Pure client-side SPA - no `"use client"` or `"use server"` directives. All components run in browser.

### View Routing
Manual URL-based routing (no React Router library):
- `currentView` state in Zustand `navigationSlice`
- `popstate` listener for browser back/forward
- `window.history.pushState` for programmatic navigation

### Lazy Loading Strategy
```typescript
const PhotoGallery = lazy(() => import('./components/PhotoGallery/PhotoGallery'))
const MoodTracker = lazy(() => import('./components/MoodTracker/MoodTracker'))
// Route-level splitting reduces initial bundle
```

### Component Organization
```
src/components/
├── Navigation/          # Fixed bottom nav
├── [FeatureName]/       # Feature modules
│   ├── FeatureName.tsx  # Main component
│   ├── SubComponent.tsx
│   └── __tests__/       # Colocated tests
└── shared/              # Reusable utilities
```

### State Access Pattern
```typescript
// Selector pattern - only re-renders on selected state change
const currentMessage = useAppStore(state => state.currentMessage);

// Multiple values
const { moods, saveMoodEntry } = useAppStore(state => ({
  moods: state.moods,
  saveMoodEntry: state.saveMoodEntry,
}));
```

### Custom Hooks (src/hooks/)
- `useLoveNotes` - Message state management
- `usePartnerMood` - Partner mood fetching
- `useMoodHistory` - Historical mood data
- `useNetworkStatus` - Online/offline detection
- `useVibration` - Haptic feedback

## Key Connections
- **Zustand store**: `useAppStore` for all global state
- **Services**: Called from store actions, not directly from components
- **Real-time**: Supabase subscriptions setup in `App.tsx` useEffect

## Gotchas
- ErrorBoundary is a class component (only exception to functional pattern)
- E2E testing: Store exposed as `window.__APP_STORE__` in non-prod
- Intersection Observer used for infinite scroll (photos)
- PWA: Service worker handles background sync, not component logic
- Mobile-first: Tailwind responsive classes (`w-full md:w-1/2`)

## See Also
- [State Management](./state-management.md) - Zustand store architecture
- [API & Services](./api-services.md) - Data layer patterns

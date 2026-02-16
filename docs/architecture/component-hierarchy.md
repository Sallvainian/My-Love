# Component Hierarchy

## Root Tree

```
index.html
  |-- main.tsx
        |-- StrictMode
              |-- LazyMotion (features={domAnimation})
                    |-- App
```

## App.tsx Component Tree

```
App
  |-- [Auth Loading] Loading spinner (inline)
  |-- [Not Authenticated] ErrorBoundary > LoginScreen
  |-- [Needs Display Name] ErrorBoundary > DisplayNameSetup
  |-- [Data Loading] Loading spinner (inline)
  |-- [Welcome Splash] ErrorBoundary > Suspense > WelcomeSplash (lazy)
  |-- [Admin Route] ErrorBoundary > Suspense > AdminPanel (lazy)
  |-- [Main App]
        |-- NetworkStatusIndicator (showOnlyWhenOffline)
        |-- SyncToast
        |-- main#main-content
        |   |-- [home view - inline, not lazy]
        |   |     |-- TimeTogether
        |   |     |-- BirthdayCountdown (frank)
        |   |     |-- BirthdayCountdown (gracie)
        |   |     |-- EventCountdown (wedding)
        |   |     |-- EventCountdown (visits[])
        |   |     |-- DailyMessage
        |   |
        |   |-- [non-home views - wrapped in ViewErrorBoundary > Suspense]
        |         |-- PhotoGallery (lazy)
        |         |-- MoodTracker (lazy)
        |         |-- PartnerMoodView (lazy)
        |         |-- LoveNotes (lazy)
        |         |-- ScriptureOverview (lazy)
        |
        |-- BottomNavigation
        |-- Suspense > PhotoUpload (lazy, modal)
        |-- Suspense > PhotoCarousel (lazy, modal)
```

## Lazy-Loaded Components

All secondary views are code-split using `React.lazy` with named exports:

```typescript
const PhotoGallery = lazy(() =>
  import('./components/PhotoGallery/PhotoGallery').then(m => ({ default: m.PhotoGallery }))
);
const MoodTracker = lazy(() =>
  import('./components/MoodTracker/MoodTracker').then(m => ({ default: m.MoodTracker }))
);
const PartnerMoodView = lazy(() =>
  import('./components/PartnerMoodView/PartnerMoodView').then(m => ({ default: m.PartnerMoodView }))
);
const LoveNotes = lazy(() =>
  import('./components/love-notes').then(m => ({ default: m.LoveNotes }))
);
const ScriptureOverview = lazy(() =>
  import('./components/scripture-reading').then(m => ({ default: m.ScriptureOverview }))
);
```

Modal components (`WelcomeSplash`, `PhotoUpload`, `PhotoCarousel`) are also lazy-loaded but with `Suspense fallback={null}` to avoid visible loading spinners.

## Error Boundary Strategy

Two levels of error boundaries:

1. **`ErrorBoundary`**: Top-level, wraps entire app phases (login, display name setup, welcome splash, admin). Shows full-page error with recovery.
2. **`ViewErrorBoundary`**: Per-view boundary wrapping only the content area inside `<main>`. Keeps `BottomNavigation` visible so users can navigate away from a crashed view.

```typescript
<ViewErrorBoundary viewName={currentView} onNavigateHome={() => setView('home')}>
  <Suspense fallback={<LoadingSpinner />}>
    {currentView === 'photos' && <PhotoGallery />}
    {currentView === 'mood' && <MoodTracker />}
    {/* ... */}
  </Suspense>
</ViewErrorBoundary>
```

## View Routing

Views are selected by `currentView` state from `navigationSlice`:

```typescript
type ViewType = 'home' | 'photos' | 'mood' | 'partner' | 'notes' | 'scripture';
```

The home view is rendered inline (not lazy-loaded) to ensure it always works offline. Non-home views are wrapped in `Suspense` with a shared loading spinner.

# Component Hierarchy

```
App (root: auth gate + view router)
  |
  +-- [Auth Loading] -> heart pulse + "Loading..."
  |
  +-- [No Session] -> ErrorBoundary > LoginScreen
  |
  +-- [Needs Display Name] -> ErrorBoundary > DisplayNameSetup
  |
  +-- [App Loading] -> heart pulse + "Loading your data..."
  |
  +-- [Welcome Splash] -> ErrorBoundary > Suspense > WelcomeSplash
  |
  +-- [Admin Route] -> ErrorBoundary > Suspense > AdminPanel
  |
  +-- [Main App]
        |
        +-- NetworkStatusIndicator (offline/connecting banner)
        +-- SyncToast (background sync completion feedback)
        |
        +-- <main>
        |     |
        |     +-- [home] TimeTogether, BirthdayCountdown(s),
        |     |          EventCountdown(s), DailyMessage
        |     |
        |     +-- [non-home] ViewErrorBoundary > Suspense
        |           +-- [photos]    PhotoGallery (lazy)
        |           +-- [mood]      MoodTracker (lazy)
        |           +-- [partner]   PartnerMoodView (lazy)
        |           +-- [notes]     LoveNotes (lazy)
        |           +-- [scripture] ScriptureOverview (lazy)
        |                             +-> SoloReadingFlow
        |                                   +-> BookmarkFlag
        |                                   +-> PerStepReflection
        |                                   +-> ReflectionSummary
        |
        +-- BottomNavigation (tab bar, always visible)
        +-- PhotoUpload (modal, lazy)
        +-- PhotoCarousel (modal, lazy)
```

**Code Splitting Strategy:**

All non-home views and modal components are lazy-loaded via `React.lazy()` with `Suspense` fallback. The home view (`DailyMessage`, `RelationshipTimers`) is bundled in the main chunk for instant first paint.

Manual chunks in `vite.config.ts`:
- `vendor-react`: react, react-dom
- `vendor-supabase`: @supabase/supabase-js
- `vendor-state`: zustand, idb, zod
- `vendor-animation`: framer-motion
- `vendor-icons`: lucide-react

---

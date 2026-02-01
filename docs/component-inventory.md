# Component Inventory

> UI component catalog for My-Love project.
> Last updated: 2026-02-01 | Scan level: Deep (Rescan)

## Overview

30+ React components organized by feature domain. Uses Framer Motion for animations, Lucide React for icons, Tailwind CSS for styling. Accessibility follows WCAG AA with focus-visible, aria attributes, and prefers-reduced-motion support. Code-split views via `React.lazy()` + `Suspense`.

## Routing & Layout

**File**: `src/App.tsx`

```
App (root)
├── ErrorBoundary (global)
├── LoginScreen (unauthenticated)
├── DisplayNameSetup (new user modal)
└── Authenticated Layout
    ├── ViewErrorBoundary (per-view)
    │   └── Current View (lazy-loaded)
    ├── BottomNavigation
    └── PhotoCarousel (global modal)
```

**Views** (ViewType): home, mood, notes, partner, photos, scripture
**Navigation**: URL-based via `window.history.pushState` with BASE_URL for GitHub Pages

## Global Components

### BottomNavigation
**File**: `src/components/Navigation/BottomNavigation.tsx`
7 tabs (Home, Mood, Notes, Partner, Photos, Scripture, Logout). Fixed bottom with safe-area padding. 64px height. Active: pink filled icons.

### ErrorBoundary
**File**: `src/components/ErrorBoundary/ErrorBoundary.tsx`
Class component. Full-screen fallback. Validation error detection. Storage clear & reload option.

### ViewErrorBoundary
**File**: `src/components/ViewErrorBoundary/ViewErrorBoundary.tsx`
Class component. Inline error UI (keeps nav visible). Detects offline/chunk errors. Resets on view change.

### NetworkStatusIndicator
**File**: `src/components/shared/NetworkStatusIndicator.tsx`
Online (green) / Connecting (yellow, spinning) / Offline (red). `aria-live`, `role="status"`. Optional `showOnlyWhenOffline` prop.

### SyncToast
**File**: `src/components/shared/SyncToast.tsx`
Toast notification after sync. Auto-dismiss 5s. Shows success/failure counts.

## Home View

### DailyMessage
**File**: `src/components/DailyMessage/DailyMessage.tsx`
- Swipe navigation (drag with 50px threshold) + keyboard arrows
- Favorite toggle with floating hearts animation
- Share button (native + clipboard fallback)
- Category badge (reason/memory/affirmation/future/custom)
- Framer Motion card transitions, decorative floating emojis

### WelcomeSplash (Lazy)
**File**: `src/components/WelcomeSplash/WelcomeSplash.tsx`
First-visit / 60-minute timer welcome message.

### RelationshipTimers
**File**: `src/components/RelationshipTimers/RelationshipTimers.tsx`
Container: TimeTogether (count-up), BirthdayCountdown, EventCountdown.

### CountdownTimer
**File**: `src/components/CountdownTimer/CountdownTimer.tsx`
Anniversary countdowns with configurable max display.

## Mood Tracking

### MoodTracker (Main Page)
**File**: `src/components/MoodTracker/MoodTracker.tsx`
- Multiple mood selection (6 positive + 6 challenging)
- Optional note (200 chars) with counter
- Tab navigation: Log Mood / Timeline / Calendar
- One mood per day (pre-populates if exists)
- Sync status indicator + offline error with retry

### MoodButton
**File**: `src/components/MoodTracker/MoodButton.tsx`
Spring animation on tap. 48x48px min touch target. `aria-pressed`.

### MoodHistoryCalendar
**File**: `src/components/MoodHistory/MoodHistoryCalendar.tsx`
Month grid with color-coded indicators. Click for detail modal.

### MoodHistoryTimeline
**File**: `src/components/MoodTracker/MoodHistoryTimeline.tsx`
Vertical timeline, newest first. Animated entrance.

### PartnerMoodDisplay
**File**: `src/components/MoodTracker/PartnerMoodDisplay.tsx`
Partner's recent mood with real-time subscription.

## Partner View

### PartnerMoodView (Main Page)
**File**: `src/components/PartnerMoodView/PartnerMoodView.tsx`
- User search (debounced 300ms), send/accept/decline requests
- Partner's 30 most recent moods
- Realtime subscription with connection status indicator
- Mood notification toast (5s auto-hide)
- Poke/Kiss FAB

### PokeKissInterface
**File**: `src/components/PokeKissInterface/PokeKissInterface.tsx`
FAB with Poke/Kiss buttons. Haptic feedback. Expandable direction.

## Love Notes

### LoveNotes (Main Page)
**File**: `src/components/love-notes/LoveNotes.tsx`
Full-screen chat layout. Header + error banner + MessageList + MessageInput.

### MessageList
**File**: `src/components/love-notes/MessageList.tsx`
- Current user right-aligned (blue), partner left-aligned (pink)
- Timestamp + sender name
- Load more button, failed message retry
- Image preview inline, loading skeleton

### MessageInput
**File**: `src/components/love-notes/MessageInput.tsx`
Text input + image attachment + character counter. Submit on Enter (Cmd+Enter mobile). Auto-expand textarea.

### LoveNoteMessage
**File**: `src/components/love-notes/LoveNoteMessage.tsx`
Message bubble with sender info, timestamp, image gallery, delete/edit/retry buttons.

### FullScreenImageViewer
**File**: `src/components/love-notes/FullScreenImageViewer.tsx`
Modal with full image. Close, download buttons.

## Photo Gallery

### PhotoGallery (Main Page)
**File**: `src/components/PhotoGallery/PhotoGallery.tsx`
- Responsive grid (3 cols mobile, 4 desktop)
- Infinite scroll (Intersection Observer, 20/page, 200px threshold)
- Skeleton loader, empty state with upload CTA
- FAB upload button

### PhotoGridItem
**File**: `src/components/PhotoGallery/PhotoGridItem.tsx`
Thumbnail with hover zoom. Aspect ratio container.

### PhotoViewer
**File**: `src/components/PhotoGallery/PhotoViewer.tsx`
Full-screen carousel. Prev/next, photo details, edit/delete/download. Swipe + keyboard nav.

### PhotoUpload (Lazy)
**File**: `src/components/PhotoUpload/PhotoUpload.tsx`
File input + preview, compression, progress, caption input.

### PhotoCarousel (Lazy, Global)
**File**: `src/components/PhotoCarousel/PhotoCarousel.tsx`
Pinch-to-zoom, double-tap zoom, share. Auto-hide controls (3s).

## Scripture Reading

### ScriptureOverview (Lazy, Entry Point)
**File**: `src/components/scripture-reading/containers/ScriptureOverview.tsx`
- Partner status (skeleton loading)
- Start button (offline blocking)
- Mode selection (solo/together) with reveal animation
- Resume prompt for incomplete sessions
- Screen reader announcements (`aria-live`)
- Focus-visible, 48px+ touch targets
- Routes to SoloReadingFlow when session active

### ModeCard (Inline)
Two variants (primary purple, secondary white). Disabled state. Icon + title + description.

### SoloReadingFlow
**File**: `src/components/scripture-reading/containers/SoloReadingFlow.tsx`
- Verse display → response reflection → completion screens
- Progress indicator (step X of 17)
- Save on exit, offline warning, error recovery
- Semantic headings, `aria-current` step tracking

## Authentication

### LoginScreen
**File**: `src/components/LoginScreen/LoginScreen.tsx`
Email/password form + Google OAuth. Validation (email regex, password min 6). `aria-required`, `aria-invalid`, `role="alert"`.

### DisplayNameSetup
**File**: `src/components/DisplayNameSetup/DisplayNameSetup.tsx`
Modal for new users. Name input → submit to user_metadata.

## Custom Hooks

| Hook | Returns | Side Effects |
|------|---------|-------------|
| `useAuth()` | user, isLoading, error | Auth state listener |
| `useNetworkStatus()` | isOnline, isConnecting | online/offline events |
| `useAutoSave()` | isDirty, save | Debounced auto-save |
| `useLoveNotes(autoFetch?)` | notes, send, retry, cleanup | Fetch, realtime, blob cleanup |
| `useMoodHistory()` | Mood data + filtering | — |
| `usePartnerMood()` | Partner mood display | Fetch, realtime |
| `usePhotos(autoLoad?)` | photos, upload, progress | Auto-load |
| `useImageCompression()` | compress(file) | — |
| `useVibration()` | trigger(pattern) | Haptic feedback |
| `useMotionConfig()` | shouldReduceMotion, presets | prefers-reduced-motion |

## Animation Patterns

1. **Tab Transitions**: `AnimatePresence` + `motion.div` opacity/x slide
2. **Card Swipe**: `drag="x"` + `dragElastic` + `onDragEnd`
3. **Floating Elements**: `motion.div` animate loop (hearts, emojis)
4. **Modal Reveal**: `AnimatePresence` initial/animate/exit
5. **List Items**: Stagger via `.map()` + `delay` per index
6. **Scale on Tap**: `whileTap={{ scale: 0.95 }}`
7. **Motion Config**: `useMotionConfig()` respects `prefers-reduced-motion` (duration 0)

## Design System

### Colors
- **Primary**: Pink (#EC4899) / Rose (#F43F5E)
- **Accent**: Purple (#A855F7) — scripture reading
- **Success/Warning/Error**: Green/Yellow/Red
- **5 Themes**: sunset, coral, ocean, lavender, rose

### Typography
- Body: System font (Tailwind default)
- Serif: Playfair Display (scripture)
- Cursive: Dancing Script

### Touch Targets
- Minimum 44-48px (WCAG)
- Bottom nav: 64px height

## Accessibility

### Semantic HTML
`<header>`, `<main>`, `<nav>`, `<section>` landmarks. Proper heading hierarchy. Form labels linked via `htmlFor`.

### ARIA
- `aria-label` on icon buttons
- `aria-live="polite"` for notifications
- `aria-pressed` for toggles
- `aria-current` for active navigation
- `role="alert"` for errors, `role="status"` for indicators

### Keyboard
Tab through all interactive elements. Enter/Space activate. Arrow keys for carousel. Esc closes modals.

### Motion & Vision
`prefers-reduced-motion` respected. Focus rings (focus-visible). Color + icons (not color alone). WCAG AA contrast.

## Performance

- **Code Splitting**: Views, modals, admin panel lazy-loaded
- **Memoization**: MoodCard memo, useCallback, useMemo for positions
- **Image Optimization**: 80% JPEG compression on upload
- **State**: Zustand (minimal re-renders), useShallow for selectors

## Testing

- `data-testid` attributes: `{feature}-{element}` pattern
- E2E store access: `window.__APP_STORE__`

## File Organization

```
src/components/
├── AdminPanel/          # Message management (lazy)
├── CountdownTimer/      # Anniversary countdowns
├── DailyMessage/        # Message of the day
├── DisplayNameSetup/    # OAuth new user
├── ErrorBoundary/       # Global error handling
├── LoginScreen/         # Auth page
├── MoodHistory/         # Calendar view
├── MoodTracker/         # Mood logging + timeline
├── Navigation/          # Bottom nav
├── PartnerMoodView/     # Partner connection + moods
├── PhotoCarousel/       # Image carousel (lazy)
├── PhotoGallery/        # Photo grid
├── PhotoUpload/         # Upload modal (lazy)
├── PokeKissInterface/   # Interaction FAB
├── RelationshipTimers/  # Countdown timers
├── Settings/            # User settings
├── ViewErrorBoundary/   # View-level errors
├── WelcomeSplash/       # Onboarding (lazy)
├── love-notes/          # Chat feature
├── scripture-reading/   # Bible reading
│   └── containers/      # ScriptureOverview, SoloReadingFlow
└── shared/              # NetworkStatusIndicator, SyncToast
```

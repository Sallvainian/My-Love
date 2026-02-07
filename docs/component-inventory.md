# Component Inventory
> UI component catalog for My-Love project.
> Last updated: 2026-02-01 | Scan level: Deep (Rescan v2)

## 1. Overview

- 30+ UI components across 6 feature domains
- React 19.2.3 with Framer Motion 12 animations
- Component-based architecture with lazy loading via `React.lazy()` + `Suspense`
- Tailwind CSS 4 styling with custom themes (5 palettes)
- Zustand 5 for state management with `useShallow` selectors
- Lucide React icons throughout

## 2. Components by Domain

### Navigation

| Component | Props | Store / Hooks | Key Features |
|-----------|-------|---------------|--------------|
| **BottomNavigation** | `currentView: ViewType`, `onViewChange: (view) => void` | -- | 7 tabs (Home, Mood, Notes, Partner, Photos, Scripture, Logout). Fixed bottom bar, 64px height, safe-area padding. Active tab: pink filled icons. `aria-label` on each button. |

### Authentication

| Component | Props | Store / Hooks | Key Features |
|-----------|-------|---------------|--------------|
| **LoginScreen** | `onLoginSuccess?: () => void` | `authService` | Email/password form + Google OAuth. Client-side validation (email regex, password min 6 chars). Error mapping. `aria-required`, `aria-invalid`, `role="alert"`. |
| **DisplayNameSetup** | `isOpen: boolean`, `onComplete: () => void` | `authService`, `supabase` | Modal form for post-OAuth display name entry. Validates 3-30 characters. Upserts Supabase `user_metadata` and `users` table row. |

### Home & Messages

| Component | Props | Store / Hooks | Key Features |
|-----------|-------|---------------|--------------|
| **DailyMessage** | `onShowWelcome?: () => void` | `useAppStore` (currentMessage, messageHistory, toggleFavorite, navigate*) | Card swipe gesture (50px drag threshold), keyboard nav (arrow keys). Floating hearts animation (configurable count). Favorites toggle. Category emoji badges (reason/memory/affirmation/future/custom). Share button (native + clipboard fallback). |
| **WelcomeSplash** | `onContinue: () => void` | -- | Raining hearts animation (15 hearts, 5 emoji variants). Gradient background (pink/rose/purple). Spring entrance animation. First-visit / 60-minute timer trigger. |
| **CountdownTimer** | -- | `useAppStore` | Anniversary countdowns with configurable max display. |
| **RelationshipTimers** | -- | -- | Container for TimeTogether, BirthdayCountdown, EventCountdown sub-components. |
| **TimeTogether** | -- | `useAppStore` | Count-up timer from relationship start date. |
| **BirthdayCountdown** | -- | `useAppStore` | Days until next birthday display. |
| **EventCountdown** | -- | `useAppStore` | Custom event countdown display. |
| **WelcomeButton** | -- | -- | Welcome splash trigger button. |

### Mood Tracking

| Component | Props | Store / Hooks | Key Features |
|-----------|-------|---------------|--------------|
| **MoodTracker** | -- | `useAppStore`, `useAuth`, `getPartnerId` | 3 tabs (tracker / timeline / calendar). 12 moods in 2 categories (6 positive: loved, happy, content, excited, thoughtful, grateful; 6 challenging: sad, anxious, frustrated, angry, lonely, tired). Note field (200 chars). One mood per day (pre-populates if exists). Offline handling with background sync retry. Haptic feedback on save/error. |
| **MoodButton** | `mood: string`, `icon: LucideIcon`, `label: string`, `isSelected: boolean`, `onClick: () => void` | -- | Spring animation on tap (`whileTap scale 0.95`). Scale 1.1x when selected. Pink highlight for selected, gray for unselected. 48x48px min touch target. `aria-pressed`. |
| **PartnerMoodDisplay** | `partnerId: string` | `usePartnerMood` | Partner's recent mood with realtime subscription. Emoji, label, relative timestamp, optional note. "Just now" badge for entries under 5 minutes old. Loading skeleton state. |
| **MoodHistoryTimeline** | `userId: string`, `isPartnerView?: boolean` | `useMoodHistory`, `react-window` | Virtualized vertical timeline with infinite scroll. Date-grouped headers. Newest first ordering. Performance monitoring. |
| **MoodHistoryCalendar** | -- | `moodService` | Month grid view with color-coded mood indicators. Month navigation with 300ms debounce. Click day for detail modal. Current date highlighting. |
| **MoodDetailModal** | -- | -- | Modal overlay showing full mood details for a selected calendar day. |
| **CalendarDay** | -- | -- | Individual day cell in the calendar grid with mood color indicator. |
| **MoodHistoryItem** | -- | -- | Single timeline entry row with mood emoji, label, and timestamp. |
| **NoMoodLoggedState** | -- | -- | Empty state display when partner has no moods logged. |

### Photos

| Component | Props | Store / Hooks | Key Features |
|-----------|-------|---------------|--------------|
| **PhotoGallery** | `onUploadClick?: () => void` | `useAppStore`, `photoService` | Infinite scroll (20/page, IntersectionObserver, 200px threshold). Responsive grid (2 cols mobile, 3 cols tablet, 4 cols desktop). Skeleton loaders during initial load. FAB upload button. Error state with retry. |
| **PhotoUpload** | `isOpen: boolean`, `onClose: () => void` | `useAppStore` (uploadPhoto) | Multi-step flow (select -> preview -> uploading -> success -> error). Caption input (500 chars). File validation: JPEG/PNG/WebP only, max 50MB. Tags input. Storage warning display. |
| **PhotoGridItem** | `photo: PhotoWithUrls`, `onPhotoClick: (photoId) => void` | -- | Square aspect-ratio thumbnail. Lazy loading via IntersectionObserver. Caption overlay on hover/tap with gradient backdrop. Owner badge display. Supabase signed URLs. |
| **PhotoViewer** | `photos: PhotoWithUrls[]`, `selectedPhotoId: string`, `onClose: () => void` | `useAppStore` | Full-screen modal. Prev/next navigation. Swipe + keyboard nav (arrows, Escape). Photo details display. Delete action. Focus trap for accessibility. |
| **PhotoGridSkeleton** | -- | -- | CSS shimmer animation skeleton matching grid item dimensions. `aria-label="Loading photo"`. |
| **PhotoGridSkeletonGrid** | -- | -- | 3x3 grid of PhotoGridSkeleton items for initial load state. |
| **PhotoCarousel** (lazy) | -- | `useAppStore` (photos, selectedPhotoId, selectPhoto, updatePhoto, deletePhoto) | Full-screen lightbox. Swipe left/right with spring transitions (stiffness 300, damping 30). Keyboard nav (ArrowLeft, ArrowRight, Escape). Swipe-down to close. Drag constraints at boundaries. Edit/delete modals. Caption and tags display. |
| **PhotoCarouselControls** | -- | -- | Control overlay for carousel (close, edit, delete buttons). |
| **PhotoEditModal** | -- | -- | Modal form for editing photo caption and tags. |
| **PhotoDeleteConfirmation** | -- | -- | Confirmation dialog for photo deletion. |
| **PhotoUploader** | -- | -- | Alternative upload component in `photos/` directory. |

### Love Notes

| Component | Props | Store / Hooks | Key Features |
|-----------|-------|---------------|--------------|
| **LoveNotes** | -- | `useLoveNotes`, `useAppStore`, `authService` | Full-screen chat layout. Header with partner name. Error banner with retry. Composes MessageList + MessageInput. Safe area handling. |
| **MessageInput** | -- | `useLoveNotes`, `useVibration` | Text input + image attachment (JPEG/PNG/WebP). Enter to send, Shift+Enter for newline, Escape to clear. Character counter visible at 900+ chars (max 1000). Auto-resize textarea. Haptic feedback on send. Image preview with compression. |
| **MessageList** | -- | `react-window`, `react-window-infinite-loader` | Virtualized rendering (60fps with 1000+ messages). Infinite scroll pagination for older messages. Auto-scroll to bottom on new messages. Scroll position preservation during pagination. "New message" indicator when scrolled up. "Beginning of conversation" marker. Date grouping. |
| **LoveNoteMessage** | `message: LoveNote`, `isOwnMessage: boolean`, `senderName: string`, `onRetry?: (tempId) => void` | -- | Chat bubble with sent/received styling. Own messages: coral (#FF6B6B) right-aligned. Partner messages: light gray (#E9ECEF) left-aligned. 16px border radius. Image attachments with signed URL refresh (max 2 retries). Timestamp display. Retry button for failed messages. DOMPurify sanitization. |
| **FullScreenImageViewer** | `imageUrl: string | null`, `isOpen: boolean`, `onClose: () => void`, `alt?: string` | -- | Modal overlay with centered image. Escape key to close. Focus trap (saves/restores previous focus). Close button. Dark background overlay. |
| **ImagePreview** | -- | -- | Inline image preview for attachment before sending. |

### Interactions

| Component | Props | Store / Hooks | Key Features |
|-----------|-------|---------------|--------------|
| **PokeKissInterface** | `expandDirection?: 'up' \| 'down'` | `useAppStore`, `getPartnerId` | Expandable FAB with staggered animation. 4 actions: history, poke, kiss, fart. 30-minute cooldown per type (localStorage). Countdown timer display during cooldown. Notification badge with unviewed count. Custom animations per interaction type. Realtime subscription for received interactions. |
| **InteractionHistory** | `isOpen: boolean`, `onClose: () => void` | `useAppStore` (getInteractionHistory, loadInteractionHistory), `authService` | Modal list view of last 7 days. Sent/received indication with directional arrows. Interaction type icons. Timestamp display. Empty state. |

### Scripture Reading

| Component | Props | Store / Hooks | Key Features |
|-----------|-------|---------------|--------------|
| **ScriptureOverview** (lazy) | -- | `useAppStore` (via `useShallow`), `useNetworkStatus`, `useMotionConfig` | Entry point for scripture feature. Partner status detection (loading/linked/unlinked). Start button with offline blocking. Mode selection reveal animation (solo always available, together conditional on partner). Session resume prompt for incomplete sessions. "Start fresh" calls `abandonSession`. Screen reader announcements (`aria-live`). Focus-visible styles. 48px+ touch targets. Lavender Dreams theme (#A855F7 primary). |
| **ModeCard** (inline) | `title`, `description`, `icon`, `variant: 'primary' \| 'secondary'`, `disabled`, `onClick` | -- | Two variants: primary (purple) and secondary (white). Disabled state. Icon + title + description layout. Focus ring styling. |
| **SoloReadingFlow** | -- | `useAppStore` (via `useShallow`), `useAutoSave`, `useNetworkStatus`, `useMotionConfig` | Step navigation (verse display -> response reflection -> completion). Progress indicator (step X of 17, `MAX_STEPS`). Sub-views per step (verse/response). Save on exit via `useAutoSave` (visibility change, beforeunload). Offline indicator with blocked advancement. Retry UI for failed server writes. Auto-retry on reconnect. `aria-current` step tracking. Focus management. Dialog focus trap for exit confirmation. Slide animation with direction tracking. |

### Shared

| Component | Props | Store / Hooks | Key Features |
|-----------|-------|---------------|--------------|
| **NetworkStatusIndicator** | `className?: string`, `showOnlyWhenOffline?: boolean` | `useNetworkStatus` | 3 states: offline (red #FF6B6B), connecting (yellow #FCC419, spinning icon), online (green #51CF66). Banner display for offline/connecting. `role="status"`, `aria-live="polite"`, descriptive `aria-label` per state. `data-testid` and `data-status` attributes. |
| **NetworkStatusDot** | `className?: string` | `useNetworkStatus` | Compact inline dot indicator. Same 3-state color coding as NetworkStatusIndicator. Minimal footprint for inline use. |
| **SyncToast** | `syncResult: SyncResult \| null`, `onDismiss: () => void`, `autoDismissMs?: number` | -- | Toast notification after sync. Shows success/failure counts with icons (CheckCircle/AlertCircle). Auto-dismisses (default timing, configurable via `autoDismissMs`). Manual dismiss via X button. Slide-in animation. |

### Error Handling

| Component | Props | Store / Hooks | Key Features |
|-----------|-------|---------------|--------------|
| **ErrorBoundary** | `children: ReactNode` | -- | Class component (`getDerivedStateFromError`). Full-screen fallback UI. Console error logging via `componentDidCatch`. Retry button resets error state. Global wrapper for entire app. |
| **ViewErrorBoundary** | `children`, `viewName`, `onNavigateHome` | -- | Class component. Inline error UI (keeps bottom nav visible). Detects offline/chunk-load errors with specific messaging. Retry + "Go Home" navigation buttons. Resets on view change. |

### Settings

| Component | Props | Store / Hooks | Key Features |
|-----------|-------|---------------|--------------|
| **Settings** | -- | `authService` | User account info display. Logout functionality. Settings sections container. |
| **AnniversarySettings** | -- | -- | Anniversary date configuration sub-section. |

### Admin

| Component | Props | Store / Hooks | Key Features |
|-----------|-------|---------------|--------------|
| **AdminPanel** (lazy) | `onExit?: () => void` | `useAppStore` (loadCustomMessages, exportCustomMessages, importCustomMessages) | Message management CRUD. Create/Edit/Delete modals. Import/Export functionality. |
| **CreateMessageForm** | -- | -- | Form for creating new custom messages. |
| **EditMessageForm** | -- | -- | Form for editing existing custom messages. |
| **DeleteConfirmDialog** | -- | -- | Confirmation dialog for message deletion. |
| **MessageList** (Admin) | -- | -- | List display of custom messages with edit/delete actions. |
| **MessageRow** | -- | -- | Single row in admin message list. |

## 3. Accessibility Features Summary

- `aria-label` on all interactive elements (buttons, icon-only controls)
- `aria-required`, `aria-invalid` on form inputs (LoginScreen, DisplayNameSetup)
- `aria-pressed` on toggle buttons (MoodButton, favorites)
- `aria-current` for active navigation and step tracking
- `role="status"`, `aria-live="polite"` for dynamic content (NetworkStatusIndicator, screen reader announcements)
- `role="alert"` for error messages
- `focus-visible:ring-*` for keyboard navigation (purple ring in scripture, pink elsewhere)
- Semantic HTML (`<header>`, `<main>`, `<nav>`, `<section>`) with proper heading hierarchy
- Form labels linked via `htmlFor`
- Keyboard support: Tab through interactive elements, Enter/Space activate, arrow keys for carousels/messages, Escape closes modals
- Touch targets 48px minimum (WCAG AA)
- `prefers-reduced-motion` support via `useMotionConfig` hook (sets all animation durations to 0)
- Focus trap in modal dialogs (PhotoViewer, SoloReadingFlow exit dialog, FullScreenImageViewer)
- Color independence: icons paired with text, not color alone

## 4. Animation Patterns

- **Library**: Framer Motion 12 with `LazyMotion` and `domAnimation` feature bundle
- **Tab Transitions**: `AnimatePresence` + `motion.div` with opacity/x slide. `layoutId` for tab underline animation.
- **Card Swipe**: `drag="x"` + `dragElastic` + `onDragEnd` with 50px threshold (DailyMessage)
- **Floating Elements**: `motion.div` with animate loop for hearts and emojis (memoized positions)
- **Modal Reveal**: `AnimatePresence` with initial/animate/exit variants
- **List Items**: Stagger via `.map()` + `delay` per index (PokeKissInterface action buttons)
- **Scale on Tap**: `whileTap={{ scale: 0.95 }}` (MoodButton, various buttons)
- **Spring Transitions**: Configurable stiffness/damping (PhotoCarousel: 300/30)
- **Reduced Motion**: `useMotionConfig()` wraps `useReducedMotion()`, provides named presets (`crossfade`, `slide`, `spring`, `fadeIn`, `modeReveal`) that return `duration: 0` when reduced motion is preferred

## 5. Theme System

### Color Palettes (5 themes in Tailwind config)

| Theme | CSS Class | Gradient |
|-------|-----------|----------|
| Sunset | `bg-sunset` | #ffe5ec -> #fff4e6 -> #ffd5c8 |
| Coral | (via Tailwind `coral-*`) | Custom coral scale (50-900) |
| Ocean | `bg-ocean` | #e0f7fa -> #b2ebf2 -> #80deea |
| Lavender | `bg-lavender` | #f3e5f5 -> #e1bee7 -> #ce93d8 |
| Rose | `bg-rose` | #fce4ec -> #f8bbd0 -> #f48fb1 |

### Primary Colors

- **Pink** (#EC4899) / **Rose** (#F43F5E): App-wide primary
- **Purple** (#A855F7): Scripture reading ("Lavender Dreams" theme)
- **Success Green** (#51CF66), **Warning Yellow** (#FCC419), **Error Coral Red** (#FF6B6B): Status indicators

### Typography

| Family | CSS Class | Usage |
|--------|-----------|-------|
| Inter | `font-sans` | Body text, UI elements (weights 300-700) |
| Playfair Display | `font-serif` | Scripture reading, decorative headings (weights 400-700) |
| Dancing Script | `font-cursive` | Romantic/cursive accents (weights 400-700) |

### Custom CSS Classes

| Class | Definition |
|-------|------------|
| `.card` | `bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl p-6` |
| `.btn-primary` | Pink-to-rose gradient, white text, rounded-full, shadow, scale hover/active |
| `.btn-secondary` | White/80, pink text, rounded-full, shadow |
| `.btn-icon` | 48x48 rounded-full, white/80 backdrop-blur, shadow |
| `.input` | Rounded-2xl, white/80, pink border, focus ring |
| `.text-gradient` | Pink-to-rose gradient text via `bg-clip-text text-transparent` |
| `.glass` | `bg-white/70 backdrop-blur-lg backdrop-saturate-150` (with webkit fallback) |
| `.safe-top` / `.safe-bottom` | `padding-*: env(safe-area-inset-*)` for mobile notch/home indicator |

### Dark Mode

Not implemented. Some components include `dark:` utility classes (ViewErrorBoundary, MoodHistoryTimeline) but no global dark mode toggle exists.

## 6. Custom Hooks

| Hook | Returns | Side Effects |
|------|---------|-------------|
| `useAuth()` | `user`, `isLoading`, `error` | Auth state listener subscription |
| `useNetworkStatus()` | `isOnline`, `isConnecting` | `online`/`offline` event listeners |
| `useAutoSave()` | `isDirty`, `save` | Debounced auto-save on visibility change / beforeunload |
| `useLoveNotes(autoFetch?)` | `notes`, `send`, `retry`, `cleanup`, `isLoading`, `error`, `hasMore`, `fetchOlderNotes`, `clearError`, `retryFailedMessage` | Fetch, realtime subscription, blob cleanup |
| `useMoodHistory()` | Mood data + filtering | -- |
| `usePartnerMood()` | Partner mood display data | Fetch, realtime subscription |
| `usePhotos(autoLoad?)` | `photos`, `upload`, `progress` | Auto-load on mount |
| `useImageCompression()` | `compress(file)` | -- |
| `useVibration()` | `trigger(pattern)` | Haptic feedback via Vibration API |
| `useMotionConfig()` | `shouldReduceMotion`, `crossfade`, `slide`, `spring`, `fadeIn`, `modeReveal` | Wraps Framer Motion `useReducedMotion` |

## 7. Performance

- **Code Splitting**: Views, modals (PhotoUpload, PhotoCarousel, WelcomeSplash), and AdminPanel are lazy-loaded
- **Virtualized Lists**: `react-window` + `react-window-infinite-loader` for MessageList and MoodHistoryTimeline
- **Memoization**: `memo()` on LoveNoteMessage, `useCallback` for handlers, `useMemo` for heart positions and computed data
- **Image Optimization**: Client-side compression before upload (via `imageCompressionService`)
- **State**: Zustand with `useShallow` for minimal re-renders
- **Intersection Observer**: Lazy image loading in PhotoGridItem, infinite scroll triggers in PhotoGallery

## 8. Testing

- `data-testid` attributes follow `{feature}-{element}` pattern
- E2E store access via `window.__APP_STORE__`
- Unit tests with Vitest + Testing Library
- E2E tests with Playwright

## 9. File Organization

```
src/components/
  AdminPanel/           # Message management (lazy) - 6 sub-components
  CountdownTimer/       # Anniversary countdowns
  DailyMessage/         # Message of the day with swipe
  DisplayNameSetup/     # OAuth new user modal
  ErrorBoundary/        # Global error handling
  InteractionHistory/   # Poke/kiss history modal
  LoginScreen/          # Auth page
  MoodHistory/          # Calendar view + detail modal + day cell
  MoodTracker/          # Mood logging + timeline + buttons + partner display
  Navigation/           # Bottom nav bar
  PartnerMoodView/      # Partner connection + mood display
  PhotoCarousel/        # Image carousel lightbox (lazy)
  PhotoDeleteConfirmation/  # Delete confirmation dialog
  PhotoEditModal/       # Edit caption/tags modal
  PhotoGallery/         # Photo grid + viewer + skeleton
  PhotoUpload/          # Upload modal (lazy)
  PokeKissInterface/    # Interaction FAB
  RelationshipTimers/   # Countdown timer container + sub-components
  Settings/             # User settings + anniversary config
  ViewErrorBoundary/    # View-level error handling
  WelcomeButton/        # Welcome splash trigger
  WelcomeSplash/        # Onboarding animation (lazy)
  love-notes/           # Chat feature - 5 components + tests
  photos/               # PhotoUploader utility component
  scripture-reading/    # Bible reading feature
    containers/         # ScriptureOverview, SoloReadingFlow
    __tests__/          # Component tests
  shared/               # NetworkStatusIndicator, NetworkStatusDot, SyncToast
```

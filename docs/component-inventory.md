# Component Inventory

> UI component catalog for My-Love project.
> Last updated: 2026-01-30 | Scan level: Deep (Rescan)

## Overview

71 TSX/TS files across 26 component directories. React 19 with TypeScript, Framer Motion animations, Tailwind CSS styling, lucide-react icons. Zustand for state. Lazy-loaded route views.

## Application Shell (App.tsx)

- Auth flow: LoginScreen → DisplayNameSetup → Main App
- Lazy-loaded views with Suspense: photos, mood, partner, notes, scripture
- ViewErrorBoundary wraps each route view
- BottomNavigation for non-home views

## Feature Components

### Scripture Reading (NEW)

| Component | File | Purpose | Props |
|-----------|------|---------|-------|
| ScriptureOverview | containers/ScriptureOverview.tsx | Main entry, mode selection | None (store) |

Features: Partner status detection, solo/together mode, lavender theme. Dependencies: useAppStore, Framer Motion.

### Love Notes Chat

| Component | File | Purpose | Key Props |
|-----------|------|---------|-----------|
| LoveNotes | LoveNotes.tsx | Chat container | None |
| MessageList | MessageList.tsx | Virtualized messages | notes, currentUserId, onLoadMore |
| LoveNoteMessage | LoveNoteMessage.tsx | Chat bubble | message, isOwnMessage |
| MessageInput | MessageInput.tsx | Text + image input | None |
| ImagePreview | ImagePreview.tsx | Pre-send preview | file, onRemove |
| FullScreenImageViewer | FullScreenImageViewer.tsx | Image modal | imageUrl, isOpen, onClose |

Features: react-window virtualization, infinite scroll, XSS sanitization (DOMPurify), image compression, optimistic UI, retry logic, keyboard shortcuts, rate limiting (10/min).

### Mood Tracker

| Component | File | Purpose | Key Props |
|-----------|------|---------|-----------|
| MoodTracker | MoodTracker.tsx | Main tracker | None |
| MoodButton | MoodButton.tsx | Mood selector | mood, isSelected, onClick |
| MoodHistoryTimeline | MoodHistoryTimeline.tsx | Virtualized timeline | userId, isPartnerView? |
| MoodHistoryItem | MoodHistoryItem.tsx | Single entry | mood, isPartnerView? |
| PartnerMoodDisplay | PartnerMoodDisplay.tsx | Real-time partner mood | partnerId |
| NoMoodLoggedState | NoMoodLoggedState.tsx | Empty state | None |
| MoodHistoryCalendar | MoodHistory/ | Calendar view | (in subdirectory) |

Features: Multi-mood selection (12 moods), 200-char notes, tabs (Log/Timeline/Calendar), real-time partner mood, offline support, sync status, haptic feedback.

### Photo Gallery

| Component | File | Purpose | Key Props |
|-----------|------|---------|-----------|
| PhotoGallery | PhotoGallery.tsx | Grid with pagination | onUploadClick? |
| PhotoGridItem | PhotoGridItem.tsx | Thumbnail | photo, onPhotoClick |
| PhotoViewer | PhotoViewer.tsx | Full-screen carousel | photos, selectedPhotoId, onClose |
| PhotoUpload | PhotoUpload.tsx | Multi-step upload | isOpen, onClose |

Features: Responsive grid (3-4 cols), Intersection Observer lazy loading, swipe gestures, double-tap zoom, pan when zoomed, photo preloading, delete confirmation, storage quota checks (80%/95% warnings).

### Relationship Timers

| Component | File | Purpose | Key Props |
|-----------|------|---------|-----------|
| RelationshipTimers | RelationshipTimers.tsx | Timer panel | className? |
| TimeTogether | TimeTogether.tsx | Duration count-up | None |
| BirthdayCountdown | BirthdayCountdown.tsx | Birthday countdown | birthday |
| EventCountdown | EventCountdown.tsx | Generic countdown | label, icon, date |

Features: Real-time second-by-second updates, birthday detection, color-coded events.

### Navigation

| Component | File | Purpose |
|-----------|------|---------|
| BottomNavigation | BottomNavigation.tsx | 7-tab bottom nav |

Tabs: Home, Mood, Notes, Partner, Photos, Scripture, Logout. Safe area handling.

### Daily Message

| Component | File | Purpose |
|-----------|------|---------|
| DailyMessage | DailyMessage.tsx | Message card with swipe |

Features: Swipe/keyboard navigation, floating hearts (45), favorite toggle, share (native + clipboard), category badges, anniversary countdown.

### Authentication

| Component | File | Purpose |
|-----------|------|---------|
| LoginScreen | LoginScreen.tsx | Email/password + Google OAuth |
| DisplayNameSetup | DisplayNameSetup/ | OAuth display name setup |

### Partner Management

| Component | File | Purpose |
|-----------|------|---------|
| PartnerMoodView | PartnerMoodView.tsx | Partner search + mood view |
| PokeKissInterface | PokeKissInterface/ | Poke/kiss interaction buttons |

Features: Partner search, send/accept/decline requests, real-time mood subscriptions, connection status indicator.

### Admin

| Component | File | Purpose |
|-----------|------|---------|
| AdminPanel | AdminPanel.tsx | Custom message CRUD |

Features: Create/Edit/Delete messages, JSON export/import.

### Shared Components

| Component | File | Purpose |
|-----------|------|---------|
| NetworkStatusIndicator | shared/NetworkStatusIndicator.tsx | Online/offline banner |
| SyncToast | shared/SyncToast.tsx | Sync completion toast |

### Utility Components

| Component | Purpose |
|-----------|---------|
| ErrorBoundary | Global error catch |
| ViewErrorBoundary | Route-level error boundary |
| WelcomeSplash | First-visit welcome with raining hearts |
| WelcomeButton | Trigger welcome splash |
| CountdownTimer | Anniversary countdown |
| Settings | User account settings |

## Architecture Patterns

- **Container/Presentational**: Containers connect to store, presentationals receive props
- **Lazy Loading**: Route views loaded with React.lazy + Suspense
- **Error Isolation**: ViewErrorBoundary keeps nav visible on view errors
- **Virtualization**: react-window for MessageList and MoodHistoryTimeline
- **Optimistic UI**: Love notes show immediately, retry on failure
- **Accessibility**: ARIA labels, live regions, focus traps, keyboard support

## New Since Jan 27

- **scripture-reading/ScriptureOverview**: New feature entry point with mode selection
- **NavigationSlice**: 'scripture' tab added to BottomNavigation

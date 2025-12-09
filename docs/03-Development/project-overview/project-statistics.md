# Project Statistics

> **Last Updated:** 2025-12-08 | **Scan Type:** Exhaustive

## Codebase Metrics

| Metric | Count | Notes |
|--------|-------|-------|
| **Total Source Files** | 148 | TypeScript/TSX files |
| **Total Directories** | 42 | src/ subdirectories |
| **UI Components** | 54 | React components across TSX files |
| **Store Slices** | 8 | Zustand slices with persist |
| **API Services** | 8 | Supabase API modules |
| **Business Services** | 12 | Service classes |
| **Custom Hooks** | 11 | React hooks |
| **Utility Modules** | 9 | Helper functions |
| **Validation Schemas** | 15+ | Zod schemas |
| **Database Migrations** | 7 | SQL migration files |
| **Test Files** | 25+ | Vitest + Playwright |

## Store Slices Breakdown

| Slice | Actions | State Properties | Purpose |
|-------|---------|------------------|---------|
| `settingsSlice` | 8 | 6 | App settings, theme, partner config |
| `messagesSlice` | 5 | 4 | Daily messages, admin messages |
| `photosSlice` | 7 | 5 | Photo gallery, upload state |
| `moodSlice` | 7 | 4 | Mood tracking, partner moods |
| `partnerSlice` | 4 | 3 | Partner profile, connection |
| `interactionsSlice` | 5 | 3 | Poke/Kiss interactions |
| `navigationSlice` | 3 | 2 | View state, navigation |
| `notesSlice` | 11 | 5 | Love Notes chat |
| **Total** | **50** | **32** | |

## Feature Breakdown

| Domain | Components | Key Files |
|--------|------------|-----------|
| **Love Notes Chat** | 6 | LoveNotes, MessageList, MessageInput, LoveNoteMessage, ImageAttachment |
| **Photo Management** | 8 | PhotoUpload, PhotoGallery, PhotoCarousel, PhotoEditModal, PhotoDeleteConfirmation |
| **Mood Tracking** | 5 | MoodTracker, MoodHistory, MoodCalendar, PartnerMoodView, MoodSelector |
| **Message System** | 7 | DailyMessage, AdminPanel (6 sub-components) |
| **Authentication** | 4 | LoginScreen, DisplayNameSetup, WelcomeSplash, PartnerConnect |
| **Partner Interaction** | 3 | PokeKissInterface, InteractionHistory, PartnerStatus |
| **Navigation** | 2 | BottomNavigation, SwipeNavigation |
| **Settings** | 3 | Settings, AnniversarySettings, ThemeSettings |
| **Core/Shared** | 16 | CountdownTimer, ErrorBoundary, LoadingSpinner, NetworkStatus, etc. |

## API Services Architecture

| Service | Methods | Purpose |
|---------|---------|---------|
| `authService` | 12 | Authentication (email, Google OAuth) |
| `moodApi` | 5 | Mood CRUD operations |
| `moodSyncService` | 4 | Mood sync with Supabase |
| `interactionsApi` | 4 | Poke/Kiss interactions |
| `partnerApi` | 3 | Partner connection |
| `messagesApi` | 2 | Custom messages |
| `loveNotesApi` | 3 | Love Notes chat |
| `supabaseClient` | - | Base Supabase client |

## Business Services

| Service | Methods | Purpose |
|---------|---------|---------|
| `moodService` | 8 | IndexedDB mood operations |
| `photoService` | 8 | Supabase storage operations |
| `realtimeService` | 5 | Realtime subscriptions |
| `imageCompressionService` | 4 | Image compression (canvas) |
| `loveNoteImageService` | 3 | Love Note image uploads |
| `messageService` | 3 | Message selection logic |
| `notificationService` | 4 | Push notifications |
| `syncService` | 3 | Background sync coordination |
| `settingsService` | 3 | Settings persistence |
| `dateService` | 5 | Date utilities |
| `hapticService` | 2 | Haptic feedback |
| `timerService` | 3 | Anniversary timers |

## Database Schema

| Table | Columns | RLS Policies | Purpose |
|-------|---------|--------------|---------|
| `users` | 8 | 4 | User profiles, partner linking |
| `moods` | 7 | 5 | Mood entries with types array |
| `love_notes` | 6 | 3 | Chat messages with images |
| `interactions` | 6 | 4 | Poke/Kiss interactions |
| `partner_requests` | 6 | 3 | Partner connection requests |
| `photos` | 10 | 4 | Photo metadata |

## Test Coverage

| Category | Files | Coverage |
|----------|-------|----------|
| Unit Tests (Vitest) | 18 | 80%+ |
| E2E Tests (Playwright) | 7 | Core flows |
| Integration Tests | 5 | API services |

## Build Output

| Asset | Size (gzipped) |
|-------|----------------|
| Main bundle | ~120KB |
| Vendor bundle | ~85KB |
| CSS bundle | ~25KB |
| Service Worker | ~15KB |
| **Total Initial Load** | **~245KB** |

## Performance Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| First Contentful Paint | <1.5s | ~1.2s |
| Largest Contentful Paint | <2.5s | ~2.0s |
| Time to Interactive | <3.0s | ~2.5s |
| Lighthouse Score | >90 | ~95 |

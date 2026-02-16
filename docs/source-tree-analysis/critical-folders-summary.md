# Critical Folders Summary

## `src/api/` -- Server Communication Layer

Direct Supabase client calls. All network communication with the backend goes through this folder.

| File | Purpose |
|---|---|
| `supabaseClient.ts` | Singleton Supabase client instance, `getPartnerId()` helper |
| `auth/actionService.ts` | Sign in, sign up, sign out, Google OAuth, password reset |
| `auth/sessionService.ts` | Session management, `getCurrentUserId`, `onAuthStateChange` |
| `auth/types.ts` | `AuthCredentials`, `AuthResult`, `AuthStatus` |
| `moodSyncService.ts` | Mood upload/fetch to `moods` table, partner mood Broadcast |
| `moodApi.ts` | Paginated mood history queries |
| `interactionService.ts` | Poke/kiss CRUD + Broadcast subscriptions |
| `partnerService.ts` | Partner search, request, accept/decline |
| `errorHandlers.ts` | API error handling utilities |
| `validation/supabaseSchemas.ts` | Zod schemas for Supabase response validation |

---

## `src/components/` -- React UI Components

Feature-organized directories. Each feature gets its own folder with component, styles, and co-located tests.

**Home View Components (always loaded):**
- `RelationshipTimers/` -- TimeTogether, BirthdayCountdown, EventCountdown
- `DailyMessage/` -- Daily love message with prev/next navigation
- `WelcomeButton/` -- Manual trigger for welcome splash

**Lazy-Loaded View Components:**
- `PhotoGallery/` -- Photo grid with skeleton loading
- `MoodTracker/` -- Daily mood entry with multi-mood selection
- `PartnerMoodView/` -- Partner mood + poke/kiss
- `love-notes/` -- Chat UI (LoveNotes, MessageList, MessageInput, LoveNoteMessage)
- `scripture-reading/` -- Scripture reading flow (containers, reading, reflection)

**Modal Components:**
- `WelcomeSplash/` -- Animated welcome with floating hearts
- `PhotoUpload/` -- Upload form with compression
- `PhotoCarousel/` -- Full-screen viewer with swipe
- `PhotoEditModal/` -- Caption/tag editing
- `PhotoDeleteConfirmation/` -- Delete dialog
- `DisplayNameSetup/` -- Post-OAuth name entry

**Infrastructure Components:**
- `ErrorBoundary/` -- Top-level error boundary
- `ViewErrorBoundary/` -- Per-view boundary (keeps nav visible)
- `Navigation/` -- Bottom tab bar (BottomNavigation)
- `LoginScreen/` -- Authentication form
- `AdminPanel/` -- Custom message CRUD
- `shared/` -- NetworkStatusIndicator, SyncToast

---

## `src/stores/` -- Zustand State Management

Single store composed from 10 slices.

| File | Purpose |
|---|---|
| `useAppStore.ts` | Store creation, persist config, pre-hydration validation, Map serialization |
| `types.ts` | `AppState`, `AppSlice`, `AppStateCreator<T>`, `AppMiddleware` |
| `slices/appSlice.ts` | Core: `isLoading`, `error`, `__isHydrated` |
| `slices/settingsSlice.ts` | Settings, theme, onboarding, `initializeApp()` |
| `slices/navigationSlice.ts` | `currentView`, `setView()` with browser history |
| `slices/messagesSlice.ts` | Messages, rotation history, custom messages, import/export |
| `slices/moodSlice.ts` | Mood entries, 3-layer sync, partner moods |
| `slices/interactionsSlice.ts` | Poke/kiss with Broadcast subscription |
| `slices/partnerSlice.ts` | Partner connection management |
| `slices/notesSlice.ts` | Love notes chat, optimistic UI, rate limiting |
| `slices/photosSlice.ts` | Photo upload with progress, storage quota |
| `slices/scriptureReadingSlice.ts` | Scripture sessions, reflections, retry |

---

## `src/hooks/` -- Custom React Hooks

Bridge between components and the store/services.

| Hook | Key Responsibility |
|---|---|
| `useAuth` | Auth state subscription |
| `useAutoSave` | Visibility change + beforeunload saves |
| `useImageCompression` | Compression status tracking |
| `useLoveNotes` | Love notes facade (fetch, send, retry, realtime, cleanup) |
| `useMoodHistory` | Paginated mood history (PAGE_SIZE=50) |
| `useMotionConfig` | Reduced-motion-aware animation presets |
| `useNetworkStatus` | Online/offline/connecting with debounce |
| `usePartnerMood` | Partner mood + Broadcast subscription |
| `usePhotos` | Photo lifecycle (load, upload, delete) |
| `useRealtimeMessages` | Broadcast with exponential backoff retry |
| `useVibration` | Vibration API wrapper |

---

## `src/services/` -- Business Logic and Local Persistence

Domain-specific logic that is not tied to React or Supabase directly.

| File | Purpose |
|---|---|
| `storage.ts` | IndexedDB message CRUD (init, add, getAll, toggle, bulk) |
| `moodService.ts` | Mood CRUD with Zod validation, sync tracking |
| `customMessageService.ts` | Custom message CRUD in IndexedDB (create, update, delete, export, import) |
| `imageCompressionService.ts` | Canvas API compression (2048px max, 80% quality) |
| `loveNoteImageService.ts` | Supabase Storage upload for love note images |
| `photoService.ts` | Supabase photo CRUD with signed URLs |
| `photoStorageService.ts` | Low-level photo storage operations |
| `scriptureReadingService.ts` | Scripture session CRUD via Supabase RPCs |
| `migrationService.ts` | localStorage to IndexedDB migration |
| `dbSchema.ts` | IndexedDB schema definition (DB_NAME, DB_VERSION, STORE_NAMES) |
| `BaseIndexedDBService.ts` | Abstract IDB service base class |
| `realtimeService.ts` | Supabase Realtime channel management |
| `syncService.ts` | Sync coordination service |
| `performanceMonitor.ts` | Runtime performance tracking |

---

## `src/config/` -- Configuration Constants

| File | Key Exports |
|---|---|
| `constants.ts` | `APP_CONFIG`: `defaultPartnerName='Gracie'`, `defaultStartDate='2025-10-18'` |
| `images.ts` | `IMAGE_COMPRESSION`, `IMAGE_VALIDATION`, `IMAGE_STORAGE`, `NOTES_CONFIG` |
| `performance.ts` | `PAGINATION`, `STORAGE_QUOTAS`, `VALIDATION_LIMITS` |
| `relationshipDates.ts` | Birthdays, wedding, visits, `calculateTimeTogether()` |

---

## `src/utils/` -- Pure Utility Functions

Stateless helper functions used across the application.

| File | Key Exports |
|---|---|
| `themes.ts` | 4 theme definitions, `applyTheme()` CSS variable setter |
| `messageRotation.ts` | `getDailyMessage()` deterministic hash, `getAvailableHistoryDays()` |
| `offlineErrorHandler.ts` | `OfflineError`, `withOfflineCheck()`, `safeOfflineOperation()` |
| `backgroundSync.ts` | `registerBackgroundSync()`, `setupServiceWorkerListener()` |
| `haptics.ts` | `triggerMoodSaveHaptic(50ms)`, `triggerErrorHaptic([100,50,100])` |
| `interactionValidation.ts` | `isValidUUID()`, `isValidInteractionType()` |
| `performanceMonitoring.ts` | Scroll PerformanceObserver, Chrome memory API |
| `storageMonitor.ts` | localStorage quota estimation |
| `calendarHelpers.ts` | Calendar grid generation |
| `dateFormat.ts` / `dateFormatters.ts` / `dateHelpers.ts` | Date utilities |
| `deterministicRandom.ts` | Seed-based random number generation |
| `moodEmojis.ts` | Mood type to emoji mapping |
| `moodGrouping.ts` | Mood entries grouping by date |

---

## `src/validation/` -- Zod Schemas

| File | Key Exports |
|---|---|
| `schemas.ts` | `MessageSchema`, `MoodEntrySchema`, `PhotoSchema`, `SettingsSchema`, `SupabaseSessionSchema`, etc. |
| `errorMessages.ts` | `createValidationError()`, `isZodError()` |
| `index.ts` | Barrel file |

---

## `src/types/` -- TypeScript Definitions

| File | Key Types |
|---|---|
| `index.ts` | `Message`, `MoodEntry`, `Settings`, `Theme`, `ThemeName`, `MessageCategory`, `MoodType`, `CustomMessage`, `Photo` |
| `models.ts` | `LoveNote`, `LoveNotesState`, `SendMessageInput` |
| `database.types.ts` | Auto-generated Supabase database types |

---

## `src/data/` -- Static Data

| File | Purpose |
|---|---|
| `defaultMessages.ts` | Default love message content across 4 categories |
| `defaultMessagesLoader.ts` | Async loader (dynamic import for code splitting) |
| `scriptureSteps.ts` | Scripture reading step definitions with `MAX_STEPS` |

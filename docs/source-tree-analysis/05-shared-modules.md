# Shared Modules

Cross-cutting modules that are used by multiple features and form the backbone of the application.

## Core Shared Infrastructure

### `src/stores/useAppStore.ts` -- Central State Store

Used by every component and hook. Composes 11 slices into a single Zustand store with persist middleware. Custom storage handles `Map` serialization for `messageHistory.shownMessages`.

**Consumers**: All components via `useAppStore()`, E2E tests via `window.__APP_STORE__`

### `src/api/supabaseClient.ts` -- Supabase Client Singleton

Single `SupabaseClient<Database>` instance used by all API services, slices, and hooks. Validates environment variables at import time. Provides helper functions `getPartnerId()` and `getPartnerDisplayName()`.

**Consumers**: `moodApi.ts`, `moodSyncService.ts`, `interactionService.ts`, `partnerService.ts`, `auth/sessionService.ts`, `auth/actionService.ts`, `scriptureReadingService.ts`, `notesSlice.ts`, `scriptureReadingSlice.ts`, `useScriptureBroadcast.ts`, `useScripturePresence.ts`

### `src/services/BaseIndexedDBService.ts` -- IndexedDB Base Class

Abstract class providing CRUD operations for all IndexedDB services. Implements the split error strategy (read=graceful, write=throw).

**Consumers**: `MoodService`, `CustomMessageService`, `ScriptureReadingService`

### `src/services/dbSchema.ts` -- IndexedDB Schema Definition

Defines `MyLoveDBSchema` (8 stores), `DB_NAME`, `DB_VERSION`, and the centralized `upgradeDb()` migration function. The service worker duplicates this logic in `sw-db.ts`.

**Consumers**: All IndexedDB services, `sw-db.ts` (duplicated for SW context)

### `src/utils/logger.ts` -- Centralized Logging

Introduced in the 2026-03-13 refactor, replacing raw `console.log`/`info`/`debug` across 48+ source files. Enforces the ESLint `no-console` rule while preserving operational logging:

- `logger.debug(...)` -- DEV only. Verbose tracing.
- `logger.info(...)` -- Always logs. Operational events.

**Consumers**: Nearly every file in `src/api/`, `src/services/`, `src/stores/slices/`, `src/hooks/`, and `src/components/`. The `sw.ts` service worker does NOT use logger (uses raw `console.log` since `import.meta.env.DEV` is unavailable in SW context).

> **Removed:** `src/api/realtimeChannel.ts` (the shared private-channel auth helper) and `src/services/realtimeService.ts` (the subscription manager) were both deleted. Each realtime hook now calls `channel.setAuth()` inline and owns its own channel lifecycle -- see [Real-Time Subscriptions](../api-reference/12-real-time-subscriptions.md).

## Validation Modules

### `src/validation/schemas.ts` -- Zod Schema Definitions

All Zod schemas for local data validation: `MessageSchema`, `CreateMessageInputSchema`, `PhotoSchema`, `MoodEntrySchema`, `SettingsSchema`, `SupabaseSessionSchema`, `SupabaseReflectionSchema`, `SupabaseBookmarkSchema`, `SupabaseMessageSchema`.

**Consumers**: `moodService.ts`, `customMessageService.ts`, `migrationService.ts`, `settingsSlice.ts`, `scriptureReadingService.ts`

### `src/api/validation/supabaseSchemas.ts` -- API Response Schemas

Zod schemas for validating Supabase query responses: `SupabaseMoodSchema`, `SupabaseUserSchema`, `SupabaseInteractionSchema`, `CoupleStatsSchema`, `MoodArraySchema`, `InteractionArraySchema`, `UserArraySchema`.

**Consumers**: `moodApi.ts`, `interactionService.ts`, `partnerService.ts`, `scriptureReadingService.ts`

### `src/validation/errorMessages.ts` -- Error Transformation

`ValidationError` class, `formatZodError()`, `getFieldErrors()`, and `FIELD_NAME_MAP` for converting Zod errors to user-friendly messages.

**Consumers**: `settingsSlice.ts`, `customMessageService.ts`, any component displaying validation errors

## Authentication Modules

### `src/api/auth/sessionService.ts` -- Session Management

`getSession()`, `getUser()`, `getCurrentUserId()`, `getCurrentUserIdOfflineSafe()`, `onAuthStateChange()`. Stores/clears auth tokens in IndexedDB for SW background sync.

**Consumers**: `App.tsx`, `useAuth.ts`, `moodSlice.ts` (offline-safe), `interactionsSlice.ts`

### `src/api/auth/actionService.ts` -- Auth Actions

`signIn()`, `signUp()`, `signOut()`, `resetPassword()`, `signInWithGoogle()`. Stores auth tokens on sign-in.

**Consumers**: `LoginScreen.tsx`, `DisplayNameSetup.tsx`

## Error Handling Modules

### `src/api/errorHandlers.ts` -- API Error Utilities

`SupabaseServiceError` class, `handleSupabaseError()`, `handleNetworkError()`, `isOnline()`, `retryWithBackoff()`, `createOfflineMessage()`. PostgreSQL/PostgREST error code mapping.

**Consumers**: `moodApi.ts`, `interactionService.ts`, `partnerService.ts`, `moodSyncService.ts`

### `src/utils/offlineErrorHandler.ts` -- Offline Error Utilities

`OfflineError` class, `withOfflineCheck()`, `safeOfflineOperation()`. Type guards `isOfflineError()`.

**Consumers**: Any feature that may be used offline (mood tracking, settings, messages)

## Configuration Modules

### `src/config/performance.ts` -- Performance Constants

Trimmed to two exports in the dead-code sweep:

- `VALIDATION_LIMITS` -- `MESSAGE_TEXT_MAX_LENGTH: 1000`, `CAPTION_MAX_LENGTH: 500`, `NOTE_MAX_LENGTH: 1000`, `PARTNER_NAME_MAX_LENGTH: 50`
- `LOG_TRUNCATE_LENGTH: 50`

**Consumers**: `schemas.ts` (validation limits), `migrationService.ts` (log truncation)

> `PAGINATION` and `STORAGE_QUOTAS` were removed along with `photoStorageService.ts`. Storage thresholds now live as private constants in `photoService.ts` (`WARNING_THRESHOLD = 0.8`, `CRITICAL_THRESHOLD = 0.95`, `STORAGE_QUOTA = 1 GiB`); page sizes are per-call defaults (`NOTES_CONFIG.PAGE_SIZE = 50`, `moodApi` defaults to 50).

### `src/config/images.ts` -- Image Configuration

`IMAGE_COMPRESSION` (2048px, 0.8 quality), `IMAGE_VALIDATION` (25MB max, MIME types), `IMAGE_STORAGE` (1hr signed URL), `NOTES_CONFIG` (50 page size, 10/min rate limit).

**Consumers**: `imageCompressionService.ts`, `loveNoteImageService.ts`, `notesSlice.ts`, `PhotoUpload.tsx`

### `src/config/sentry.ts` -- Error Tracking

`initSentry()`, `setSentryUser()`, `clearSentryUser()`. PII stripping, error filtering, 20% trace sample rate.

**Consumers**: `main.tsx`, `App.tsx`

## Utility Modules

### `src/utils/themes.ts` -- Theme System

Theme definitions (sunset, ocean, lavender, rose) and `applyTheme()` which sets CSS custom properties on `document.documentElement`.

**Consumers**: `App.tsx`, `settingsSlice.ts`, `Settings.tsx`

### `src/utils/messageRotation.ts` -- Message Selection

Deterministic daily message rotation algorithm using seeded random from `deterministicRandom.ts`.

**Consumers**: `messagesSlice.ts`

### `src/utils/messageValidation.ts` -- Content Sanitization

`sanitizeMessageContent()` using DOMPurify (no HTML tags/attributes, preserve text content).

**Consumers**: `notesSlice.ts`, `LoveNoteMessage.tsx`

### `src/utils/backgroundSync.ts` -- Background Sync Registration

`registerBackgroundSync(tag)` with feature detection for service worker and SyncManager support.

**Consumers**: `moodSlice.ts`, `App.tsx`

## Type Definition Modules

### `src/types/index.ts` -- Core Types

`ThemeName`, `MessageCategory`, `MoodType` (12 types), `Message`, `Photo`, `MoodEntry`, `Settings`, `MessageHistory`, `CustomMessage`, `Theme`, `ViewType`.

**Consumers**: All slices, services, components, and hooks

### `src/types/database.types.ts` -- Supabase Types (Auto-Generated)

TypeScript types generated from the Supabase database schema. Contains table row types, insert types, and update types for all tables.

**Consumers**: `supabaseClient.ts`, `moodApi.ts`, `interactionService.ts`, all services querying Supabase

### `src/stores/types.ts` -- Store Types

`AppState` (intersection of all 11 slices), `AppSlice`, `AppStateCreator<T>`, `AppMiddleware`.

**Consumers**: All 10 slice files, `useAppStore.ts`

## Related Documentation

- [Critical Code Paths](./04-critical-code-paths.md)
- [Architecture - Architecture Patterns](../architecture/03-architecture-patterns.md)
- [Architecture - Validation Layer](../architecture/14-validation-layer.md)

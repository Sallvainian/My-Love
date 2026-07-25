# 14. Additional Services

## Logger (`src/utils/logger.ts`)

Centralized logging utility that suppresses verbose output in production.

```typescript
const isDev = import.meta.env.DEV;

export const logger = {
  debug: (...args) => {
    if (isDev) console.debug(...args);
  }, // DEV only
  info: (...args) => {
    console.info(...args);
  }, // Always
  log: (...args) => {
    console.log(...args);
  }, // Always
};
```

ESLint enforces `no-console: 'error'` across `src/` -- only `console.warn` and `console.error` are permitted directly. Use `logger.debug()` / `logger.info()` for everything else. Exceptions: `src/sw.ts` and `src/sw-db.ts` (service worker context cannot import the logger).

> Import the logger via a **relative path** (`../../utils/logger`), not `@/utils/logger`. The `@/` alias is configured in `vitest.config.ts` and `tsconfig.app.json` but **not** in `vite.config.ts`, so alias imports break the production build.

## StorageService (`src/services/storage.ts`)

Legacy IndexedDB service (predates `BaseIndexedDBService`). Provides direct CRUD for the `photos` and `messages` object stores. Opens `my-love-db` at `DB_VERSION` with its own inline upgrade callback (a fallback path -- the canonical upgrade logic lives in `dbSchema.ts`).

### Key Methods

- Photo: `addPhoto`, `getPhoto`, `getAllPhotos`, `deletePhoto`, `updatePhoto`
- Message: `addMessage`, `getMessage`, `getAllMessages`, `getMessagesByCategory`, `updateMessage`, `deleteMessage`, `toggleFavorite`, `addMessages` (bulk transaction)
- Utility: `clearAllData` (clears photos + messages), `exportData` (returns `{ photos, messages }`)

Read operations degrade gracefully (`undefined` / `[]`); write operations re-throw.

> The `localStorageHelper` object documented in the 2026-03 scan no longer exists in this module.

## MigrationService (`src/services/migrationService.ts`)

One-time migration from LocalStorage to IndexedDB for custom messages.

### `migrateCustomMessagesFromLocalStorage(): Promise<MigrationResult>`

Reads `my-love-custom-messages` from LocalStorage, validates each entry with `CreateMessageInputSchema`, deduplicates by normalized text (against both existing IndexedDB rows and earlier entries in the same run), creates via `customMessageService.create()`, then removes the LocalStorage key on success.

```typescript
interface MigrationResult {
  success: boolean;
  migratedCount: number;
  skippedCount: number;
  errors: string[];
}
```

Invoked from `App.tsx` inside `requestIdleCallback` (2s timeout, `setTimeout(100)` fallback) so it never blocks first paint.

## Utility Modules

### `dateUtils.ts`

Single source of truth for all date formatting, comparison, and arithmetic. Do not inline date logic or create new date utility files.

- `getRelativeTime(timestamp)` -- "2h ago", "Yesterday"
- `isJustNow(timestamp)` -- within a 5-minute threshold
- `formatMessageTimestamp(dateInput)` -- Today: time, Yesterday: "Yesterday", This week: day name, Older: short date
- `formatFullTimestamp(dateInput)` -- full date + time
- `formatDateISO(date)` -- **local timezone** YYYY-MM-DD (not UTC)
- `formatDateLong(date)` -- "January 1, 2024"
- `formatRelativeDate(isoString)` -- via `Intl.RelativeTimeFormat`

> **Trimmed since the 2026-03 scan.** `formatCountdown`, `isToday`, `isSameDay`, `isPast`, `isFuture`, `addDays`, `getDaysUntil`, and `getNextAnniversary` were removed as dead code; `getDaysSince` is now module-private. Anniversary math lives in `countdownService.ts` (`getNextAnniversaryDate`).

### `messageRotation.ts`

- `hashDateString(dateString)` -- character-code sum hash
- `getDailyMessage(allMessages, date?)` -- deterministic hash-based rotation
- `getMessageForDate(...)`, `getDailyMessageId(...)`, `getTodayMessage(...)`
- `getNextMessage(...)`, `getPreviousMessage(...)`
- `getAvailableHistoryDays(history, settings)` -- min of config, relationship duration, 30
- `isNewDay(...)`, `getDaysSinceStart(...)`
- `formatRelationshipDuration(startDate)` -- "3 months", "1 year and 2 months"

### `countdownService.ts`

- `calculateTimeRemaining(targetDate): TimeRemaining`
- `getUpcomingAnniversaries(...)`
- `getNextAnniversaryDate(dateString)`
- `shouldTriggerCelebration(targetDate)`
- `formatCountdownDisplay(timeRemaining, label)`

### `messageValidation.ts`

- `MAX_MESSAGE_LENGTH` constant
- `validateMessageContent(content)` -- non-empty, length-bounded
- `sanitizeMessageContent(content)` -- DOMPurify, strips all HTML

### `interactionValidation.ts`

- `isValidUUID(uuid)`, `isValidInteractionType(type)` (`'poke'` or `'kiss'`)
- `validatePartnerId(partnerId)`, `validateInteraction(partnerId, type)`
- `sanitizeInput(input)` -- trim + length limit
- `INTERACTION_ERRORS` constant map

### `storageMonitor.ts`

- `logStorageQuota()` -- dev console output of LocalStorage usage and quota warning level

> `getLocalStorageUsage()` and `getStorageQuotaInfo()` are now module-private; only `logStorageQuota()` is exported.

### `performanceMonitoring.ts`

- `measureScrollPerformance(): PerformanceObserver` -- observes long frames during scrolling

> `measureMemoryUsage()` was removed. The separate `src/services/performanceMonitor.ts` module (with `measureAsync`, `recordMetric`, `getReport`) was **deleted** in the dead-code sweep -- this file is the only performance utility that remains.

### `backgroundSync.ts`

- `registerBackgroundSync()` -- registers the SW sync tag
- `setupServiceWorkerListener()` -- wires SW `message` events
- `isServiceWorkerSupported()`, `isBackgroundSyncSupported()` -- capability guards

### Other Utils

- `haptics.ts` -- `isVibrationSupported`, `triggerMoodSaveHaptic`, `triggerErrorHaptic`, `triggerSelectionHaptic`
- `moodEmojis.ts` -- `getMoodEmoji(moodType)`
- `moodGrouping.ts` -- `groupMoodsByDate(moods)`
- `calendarHelpers.ts` -- `generateCalendarDays`, `formatDateKey`, `getMonthBoundaries`, `formatModalDate`, `formatModalTime`, `getMonthName`, `navigateToPreviousMonth`, `navigateToNextMonth`
- `themes.ts` -- `applyTheme(themeName)`
- `deterministicRandom.ts` -- `generateDeterministicNumbers(seed, count, min?, max?)` (FNV-1a hash + mulberry32 PRNG)

## Removed Services

These modules were documented in the 2026-03 scan and have since been deleted:

| Module                                | Replacement                                                                      |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| `src/services/syncService.ts`         | `moodSyncService.syncPendingMoods()` in `src/api/moodSyncService.ts`             |
| `src/services/performanceMonitor.ts`  | `src/utils/performanceMonitoring.ts` (scroll observer only)                       |
| `src/services/photoStorageService.ts` | `src/services/photoService.ts` (Supabase Storage) + `storageService` photo CRUD  |
| `src/services/realtimeService.ts`     | Per-feature channels: `moodSyncService`, `interactionService`, `useScriptureBroadcast` |
| `src/api/realtimeChannel.ts`          | Same as above                                                                     |
| `src/hooks/useImageCompression.ts`    | `imageCompressionService.compressImage()` called directly from `notesSlice`      |
| `src/validation/index.ts`             | Import from `src/validation/schemas.ts` / `errorMessages.ts` directly            |

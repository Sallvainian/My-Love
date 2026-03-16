# 14. Additional Services

## Logger (`src/utils/logger.ts`)

Centralized logging utility that suppresses verbose output in production.

```typescript
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

## PerformanceMonitor (`src/services/performanceMonitor.ts`)

Tracks operation execution times using `performance.now()`.

### `measureAsync<T>(name, operation): Promise<T>`

Wraps async operation, records duration metric.

### `recordMetric(name, duration): void`

Tracks count, avg/min/max/total duration per metric name.

### `getReport(): string`

Human-readable report sorted by total duration descending.

### `getMetrics(name)`, `getAllMetrics()`, `clear()`

Accessors and reset.

## StorageService (`src/services/storage.ts`)

Legacy IndexedDB service (predates BaseIndexedDBService). Provides direct CRUD for photos and messages, plus LocalStorage helpers. Still used by some store slices.

### Key Methods

- Photo: `addPhoto`, `getPhoto`, `getAllPhotos`, `deletePhoto`, `updatePhoto`
- Message: `addMessage`, `getMessage`, `getAllMessages`, `getMessagesByCategory`, `updateMessage`, `deleteMessage`, `toggleFavorite`, `addMessages` (bulk)
- Utility: `clearAllData`, `exportData`

### `localStorageHelper`

Object with `get<T>(key, default)`, `set<T>(key, value)`, `remove(key)`, `clear()`.

## SyncService (`src/services/syncService.ts`)

Offline-first mood sync from IndexedDB to Supabase. Uses `moodApi.create()` for validated uploads.

### `syncPendingMoods(): Promise<SyncSummary>`

Gets unsynced moods, uploads each with `Promise.all()` (parallel). Partial failure handling.

### `hasPendingSync(): Promise<boolean>`

Checks if unsynced moods exist.

### `getPendingCount(): Promise<number>`

Returns count of unsynced moods.

## MigrationService (`src/services/migrationService.ts`)

One-time migration from LocalStorage to IndexedDB for custom messages.

### `migrateCustomMessagesFromLocalStorage(): Promise<MigrationResult>`

Reads `my-love-custom-messages` from LocalStorage, validates each with `CreateMessageInputSchema`, deduplicates by text, creates via `customMessageService.create()`, removes LocalStorage key on success.

## Utility Modules

### `dateUtils.ts`

- `getRelativeTime(timestamp)` -- "2h ago", "Yesterday"
- `formatMessageTimestamp(date)` -- Today: time, Yesterday: "Yesterday", This week: day name, Older: "Nov 20"
- `formatDateISO(date)` -- Local timezone YYYY-MM-DD
- `formatDateLong(date)` -- "January 1, 2024"
- `formatCountdown(days)` -- "Today!", "3 days", "2 weeks", etc.
- `formatRelativeDate(isoString)` -- "today", "3 days ago", "2 months ago"
- `isToday(date)`, `isSameDay(d1, d2)`, `isPast(date)`, `isFuture(date)`
- `addDays(date, n)`, `getDaysUntil(target)`, `getDaysSince(past)`
- `getNextAnniversary(dateString)`

### `messageRotation.ts`

- `getDailyMessage(allMessages, date?)` -- Deterministic hash-based rotation
- `hashDateString(dateString)` -- Character code sum hash
- `getAvailableHistoryDays(history, settings)` -- Min of config, relationship duration, 30
- `formatRelationshipDuration(startDate)` -- "3 months", "1 year and 2 months"

### `messageValidation.ts`

- `validateMessageContent(content)` -- Max 1000 chars, non-empty
- `sanitizeMessageContent(content)` -- DOMPurify strip all HTML

### `interactionValidation.ts`

- `isValidUUID(uuid)` -- UUID regex check
- `isValidInteractionType(type)` -- 'poke' or 'kiss'
- `validatePartnerId(partnerId)` -- Non-null + UUID
- `validateInteraction(partnerId, type)` -- Combined validation
- `sanitizeInput(input)` -- Trim + 500 char limit

### `deterministicRandom.ts`

- `generateDeterministicNumbers(seed, count, min?, max?)` -- FNV-1a hash + mulberry32 PRNG

### `storageMonitor.ts`

- `getLocalStorageUsage()` -- Byte count estimate
- `getStorageQuotaInfo()` -- Usage %, warning levels (safe/warning/critical)
- `logStorageQuota()` -- Dev console output
- `hasStorageSpace(bytes, margin?)` -- Space check

### `performanceMonitoring.ts`

- `measureScrollPerformance()` -- PerformanceObserver for frame drops
- `measureMemoryUsage()` -- Chrome `performance.memory` API

### Other Utils

- `haptics.ts` -- Vibration API wrapper
- `moodEmojis.ts` -- Mood type to emoji mapping
- `moodGrouping.ts` -- Group moods by date ranges
- `calendarHelpers.ts` -- Calendar view date math
- `countdownService.ts` -- Anniversary countdown logic
- `themes.ts` -- Theme color configurations

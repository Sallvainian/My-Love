# Performance

## Lazy Loading

### View-Level Code Splitting

Non-home views are loaded on demand via `React.lazy()`:

```typescript
const PhotoGallery = lazy(() => import('./components/PhotoGallery/PhotoGallery'));
const MoodTracker = lazy(() => import('./components/MoodTracker/MoodTracker'));
const LoveNotes = lazy(() => import('./components/love-notes/LoveNotes'));
const ScriptureOverview = lazy(
  () => import('./components/scripture-reading/containers/ScriptureOverview')
);
```

The home view is not lazy-loaded since it is the default landing page.

### Animation Tree-Shaking

Framer Motion uses `LazyMotion` with `domAnimation` features for tree-shakeable animations:

```typescript
// src/main.tsx
<LazyMotion features={domAnimation}>
  <App />
</LazyMotion>
```

Individual components can opt into additional motion features via `motionFeatures.ts` in the scripture reading module.

## Virtualization

### Infinite Scroll Lists

Love notes and mood history use `react-window` (v2.3.0) with `react-window-infinite-loader` for virtualized rendering:

- Only visible items are rendered in the DOM
- Scroll position is maintained during data loading
- Page size: 50 items for mood history (`useMoodHistory.ts`)

## Image Optimization

### Compression Pipeline (`src/services/imageCompressionService.ts`)

All uploaded images go through Canvas API compression. Configuration is centralized in `src/config/images.ts`:

| Setting         | Value                               | Config Constant                             |
| --------------- | ----------------------------------- | ------------------------------------------- |
| Max width       | 2048px                              | `IMAGE_COMPRESSION.MAX_WIDTH`               |
| Max height      | 2048px                              | `IMAGE_COMPRESSION.MAX_HEIGHT`              |
| JPEG quality    | 80% (0.8)                           | `IMAGE_COMPRESSION.QUALITY`                 |
| Allowed formats | JPEG, PNG, WebP                     | `IMAGE_VALIDATION.ALLOWED_MIME_TYPES`       |
| Max upload size | 25MB                                | `IMAGE_VALIDATION.MAX_FILE_SIZE_BYTES`      |
| Large file warn | 10MB (may approach 3s limit)        | `IMAGE_VALIDATION.LARGE_FILE_WARNING_BYTES` |
| Fallback        | Original image if compression fails | (hardcoded)                                 |

The compression flow:

1. Validate file type and size
2. Load image into `Image` element
3. Calculate scaled dimensions (maintain aspect ratio, max 2048px)
4. Draw to `Canvas` at target dimensions
5. Export as JPEG blob at 80% quality
6. Compare sizes; use compressed only if smaller

### Signed URL Caching (`src/services/loveNoteImageService.ts`)

Love note image URLs are cached with LRU eviction:

| Setting               | Value                                              |
| --------------------- | -------------------------------------------------- |
| Cache size            | Max 100 entries                                    |
| URL expiry            | 1 hour (Supabase signed URL default)               |
| Request deduplication | Concurrent requests for same image share one fetch |
| Refresh buffer        | URL treated as stale 5 minutes before expiry       |

> The `batchGetSignedUrls()` helper was removed in the dead-code sweep; callers request URLs individually and rely on the deduplication map.

## IndexedDB Performance

### Cursor-Based Pagination

`BaseIndexedDBService.getPage()` uses cursor-based pagination instead of loading all records:

```typescript
async getPage(page: number, pageSize: number): Promise<T[]> {
  const tx = db.transaction(this.storeName, 'readonly');
  const store = tx.objectStore(this.storeName);
  let cursor = await store.openCursor();
  const skip = (page - 1) * pageSize;
  // Advance cursor past skipped records
  if (skip > 0 && cursor) {
    cursor = await cursor.advance(skip);
  }
  // Collect pageSize records
  // ...
}
```

### Indexed Queries

The `moods` store has a `by-user-date` index (unique on `[userId, date]`) for efficient queries. It
replaced a `by-date` index unique on the date alone, which collided across accounts: on a shared
device the second partner to log a mood that day was rejected outright.

- `getMoodForDate(userId, date)` -- Uses `by-user-date` for O(1) lookup by owner + ISO date string
- `getMoodsInRange(userId, start, end)` -- Uses `IDBKeyRange.bound()` on `by-user-date` for range scans
- `getUnsyncedMoods(userId?)` -- Iterates all entries and filters `synced === false` (and owner, when given) in JavaScript; there is no index for sync status

## Performance Monitoring

> **Removed (2026-07).** `src/services/performanceMonitor.ts` -- the singleton with `measureAsync()`, `recordMetric()`, `getReport()`, and per-operation count/avg/min/max tracking -- was deleted in the dead-code sweep, as was `measureMemoryUsage()`. `src/utils/performanceMonitoring.ts` is the only performance utility that remains, and it exports exactly one function.
>
> Production performance signal now comes from the Lighthouse PWA audit workflow and the `bundle-size` CI check. Nothing reports runtime metrics from real sessions.

### Scroll Performance (`src/utils/performanceMonitoring.ts`)

Development-only scroll frame monitoring:

```typescript
export function measureScrollPerformance(): PerformanceObserver {
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.duration > 16.67) {
        console.warn('[Performance] Frame drop detected:', entry.duration, 'ms');
      }
    }
  });
  observer.observe({ entryTypes: ['measure'] });
  return observer;
}
```

## LocalStorage Quota Monitoring

`src/utils/storageMonitor.ts` proactively monitors localStorage usage. Only `logStorageQuota()` is exported (called once from `App.tsx` during the deferred migration pass); `getLocalStorageUsage()` and `getStorageQuotaInfo()` are module-private:

| Threshold | Level      | Action                                        |
| --------- | ---------- | --------------------------------------------- |
| < 70%     | `safe`     | Normal operation                              |
| 70-85%    | `warning`  | Console warning with optimization suggestions |
| > 85%     | `critical` | Console error with action items               |

Conservative estimate of 5MB total (typical browser minimum).

## Deterministic Rendering

`src/utils/deterministicRandom.ts` provides seeded pseudo-random number generation for render-safe animations:

```typescript
export function generateDeterministicNumbers(
  seed: string,
  count: number,
  min: number,
  max: number
): number[] {
  // FNV-1a hash for seed -> Mulberry32 PRNG
}
```

This avoids `Math.random()` in render paths, preventing hydration mismatches and ensuring stable animation values across re-renders.

## Bundle Splitting

Manual chunk splitting in `vite.config.ts` creates predictable, stable cache keys for vendor libraries:

```typescript
codeSplitting: {
  groups: [
    { name: 'vendor-react', test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/ },
    { name: 'vendor-supabase', test: /[\\/]node_modules[\\/]@supabase[\\/]supabase-js[\\/]/ },
    { name: 'vendor-state', test: /[\\/]node_modules[\\/](zustand|idb|zod)[\\/]/ },
    { name: 'vendor-animation', test: /[\\/]node_modules[\\/]framer-motion[\\/]/ },
    { name: 'vendor-icons', test: /[\\/]node_modules[\\/]lucide-react[\\/]/ },
  ],
},
```

This ensures that when application code changes, vendor chunk hashes remain the same. Returning users only re-download the app code chunk, not the entire vendor bundle.

## Bundle Analysis

```bash
npm run perf:bundle-report
```

Uses `rollup-plugin-visualizer` to generate a visual bundle size report at `dist/stats.html` with gzip and brotli size estimates.

## Configuration Constants

From `src/config/performance.ts` (all `as const` for literal types). This file was trimmed in the dead-code sweep -- `PAGINATION` and `STORAGE_QUOTAS` were removed along with `photoStorageService.ts`, their only consumer:

```typescript
export const VALIDATION_LIMITS = {
  MESSAGE_TEXT_MAX_LENGTH: 1000,
  CAPTION_MAX_LENGTH: 500,
  NOTE_MAX_LENGTH: 1000,
  PARTNER_NAME_MAX_LENGTH: 50,
};

export const LOG_TRUNCATE_LENGTH = 50;
```

Remote storage thresholds now live as private constants in `src/services/photoService.ts`:

```typescript
const STORAGE_QUOTA = 1024 * 1024 * 1024; // 1 GiB free tier
const WARNING_THRESHOLD = 0.8; // 80% -- warn
const CRITICAL_THRESHOLD = 0.95; // 95% -- block uploads
```

From `src/config/images.ts`:

```typescript
export const IMAGE_STORAGE = {
  SIGNED_URL_EXPIRY_SECONDS: 3600, // 1 hour
  URL_REFRESH_BUFFER_MS: 5 * 60 * 1000, // Refresh 5 min before expiry
  MAX_CACHE_SIZE: 100, // LRU cache limit
};

export const NOTES_CONFIG = {
  PAGE_SIZE: 50, // Notes per page
  RATE_LIMIT_MAX_MESSAGES: 10, // Max messages per window
  RATE_LIMIT_WINDOW_MS: 60000, // 1 minute window
};
```

## Related Documentation

- [Service Worker Architecture](./10-service-worker.md)
- [Data Architecture](./04-data-architecture.md)
- [Component Hierarchy](./06-component-hierarchy.md)

# Performance

## Lazy Loading

### View-Level Code Splitting

Non-home views are loaded on demand via `React.lazy()`:

```typescript
const PhotoGallery = lazy(() => import('./components/PhotoGallery/PhotoGallery'));
const MoodTracker = lazy(() => import('./components/MoodTracker/MoodTracker'));
const LoveNotes = lazy(() => import('./components/love-notes/LoveNotes'));
const ScriptureOverview = lazy(() => import('./components/scripture-reading/containers/ScriptureOverview'));
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

Love notes and mood history use `react-window` (v2.2.6) with `react-window-infinite-loader` for virtualized rendering:

- Only visible items are rendered in the DOM
- Scroll position is maintained during data loading
- Page size: 50 items for mood history (`useMoodHistory.ts`)

## Image Optimization

### Compression Pipeline (`src/services/imageCompressionService.ts`)

All uploaded images go through Canvas API compression:

| Setting | Value |
|---------|-------|
| Max dimension | 2048px (width or height) |
| JPEG quality | 80% |
| Allowed formats | JPEG, PNG, WebP |
| Max upload size | 25MB |
| Fallback | Original image if compression fails |

The compression flow:
1. Validate file type and size
2. Load image into `Image` element
3. Calculate scaled dimensions (maintain aspect ratio, max 2048px)
4. Draw to `Canvas` at target dimensions
5. Export as JPEG blob at 80% quality
6. Compare sizes; use compressed only if smaller

### Signed URL Caching (`src/services/loveNoteImageService.ts`)

Love note image URLs are cached with LRU eviction:

| Setting | Value |
|---------|-------|
| Cache size | Max 100 entries |
| URL expiry | 1 hour (Supabase signed URL default) |
| Request deduplication | Concurrent requests for same image share one fetch |
| Batch fetching | Multiple URLs fetched in a single request |

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

The `moods` store has two indexes for efficient queries:
- `by-date` (date field) -- Used by `getMoodForDate()` and `getMoodsInRange()`
- `by-synced` (synced field) -- Used by `getUnsyncedMoods()` for sync operations

## Performance Monitoring

### PerformanceMonitor Service (`src/services/performanceMonitor.ts`)

Singleton service for tracking async operation timing:

```typescript
const result = await performanceMonitor.measureAsync('loadMoods', async () => {
  return await moodService.getAll();
});
```

Tracks per-operation metrics:
- Call count
- Average duration
- Min/Max duration

The `getReport()` method generates a human-readable summary for development debugging.

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

### Memory Usage (`src/utils/performanceMonitoring.ts`)

Chrome-specific memory monitoring via `performance.memory`:

```typescript
export function measureMemoryUsage(): number {
  const perf = performance as PerformanceWithMemory;
  if (perf.memory) {
    return perf.memory.usedJSHeapSize / 1048576; // MB
  }
  return 0;
}
```

## LocalStorage Quota Monitoring

`src/utils/storageMonitor.ts` proactively monitors localStorage usage:

| Threshold | Level | Action |
|-----------|-------|--------|
| < 70% | `safe` | Normal operation |
| 70-85% | `warning` | Console warning with optimization suggestions |
| > 85% | `critical` | Console error with action items |

Conservative estimate of 5MB total (typical browser minimum).

## Deterministic Rendering

`src/utils/deterministicRandom.ts` provides seeded pseudo-random number generation for render-safe animations:

```typescript
export function generateDeterministicNumbers(
  seed: string, count: number, min: number, max: number
): number[] {
  // FNV-1a hash for seed -> Mulberry32 PRNG
}
```

This avoids `Math.random()` in render paths, preventing hydration mismatches and ensuring stable animation values across re-renders.

## Bundle Analysis

```bash
npm run perf:bundle-report
```

Uses `rollup-plugin-visualizer` to generate a visual bundle size report.

## Configuration Constants

From `src/config/performance.ts`:

```typescript
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MOOD_HISTORY_PAGE_SIZE: 50,
};

export const STORAGE_QUOTAS = {
  PHOTO_STORAGE_WARNING_PERCENT: 80,
  PHOTO_STORAGE_CRITICAL_PERCENT: 95,
};
```

## Related Documentation

- [Service Worker Architecture](./10-service-worker.md)
- [Data Architecture](./04-data-architecture.md)
- [Component Hierarchy](./06-component-hierarchy.md)

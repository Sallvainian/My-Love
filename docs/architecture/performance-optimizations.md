# Performance Optimizations

## Code Splitting

### Lazy-Loaded Components

All non-home views use `React.lazy` with named exports:

```typescript
const PhotoGallery = lazy(() =>
  import('./components/PhotoGallery/PhotoGallery').then(m => ({ default: m.PhotoGallery }))
);
const MoodTracker = lazy(() =>
  import('./components/MoodTracker/MoodTracker').then(m => ({ default: m.MoodTracker }))
);
const PartnerMoodView = lazy(() =>
  import('./components/PartnerMoodView/PartnerMoodView').then(m => ({ default: m.PartnerMoodView }))
);
const LoveNotes = lazy(() =>
  import('./components/love-notes').then(m => ({ default: m.LoveNotes }))
);
const ScriptureOverview = lazy(() =>
  import('./components/scripture-reading').then(m => ({ default: m.ScriptureOverview }))
);
```

Modal components (`WelcomeSplash`, `PhotoUpload`, `PhotoCarousel`) are also lazy-loaded with `Suspense fallback={null}` to avoid visible loading spinners for overlays.

### Manual Chunk Splitting

```typescript
manualChunks: {
  'vendor-react': ['react', 'react-dom'],
  'vendor-supabase': ['@supabase/supabase-js'],
  'vendor-state': ['zustand', 'idb', 'zod'],
  'vendor-animation': ['framer-motion'],
  'vendor-icons': ['lucide-react'],
},
```

Benefits:
- Vendor chunks are cached independently of application code
- Supabase (heavy) is isolated since it is only actively used in specific views
- Animation library is its own chunk, loadable on demand

## Animation Performance

### LazyMotion

Framer Motion uses `LazyMotion` with `domAnimation` to tree-shake unused animation features:

```typescript
<LazyMotion features={domAnimation}>
  <App />
</LazyMotion>
```

This reduces the Framer Motion bundle by excluding 3D transforms, layout animations, and SVG path morphing.

### Reduced Motion Support

The `useMotionConfig` hook provides motion presets that respect `prefers-reduced-motion`:

```typescript
export function useMotionConfig() {
  const prefersReducedMotion = useReducedMotion();

  const crossfade = prefersReducedMotion
    ? { initial: {}, animate: {}, exit: {} }
    : { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };
  // ... similar for slide, spring, fadeIn
}
```

## Image Compression

### Client-Side Compression (`src/services/imageCompressionService.ts`)

Photos are compressed before upload using the Canvas API:

| Parameter | Value |
|---|---|
| Max dimension | 2048px |
| JPEG quality | 0.8 (80%) |
| Supported formats | JPEG, PNG, WebP |
| Max file size | 25MB (pre-compression) |

Configuration from `src/config/images.ts`:

```typescript
export const IMAGE_COMPRESSION = {
  maxDimension: 2048,
  quality: 0.8,
  outputFormat: 'image/jpeg',
};

export const IMAGE_VALIDATION = {
  maxFileSize: 25 * 1024 * 1024, // 25MB
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
};
```

## Pagination

| Feature | Page Size | Strategy |
|---|---|---|
| Love Notes | 50 | Cursor-based (oldest `created_at`) |
| Mood History | 50 | Offset-based |
| Photos | 20 | Offset-based |

Default page size from `src/config/performance.ts`:

```typescript
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
};
```

## Storage Optimization

### Selective Persistence

Only small, critical state is persisted to localStorage:

```typescript
partialize: (state) => ({
  settings: state.settings,
  isOnboarded: state.isOnboarded,
  messageHistory: { /* serialized Map */ },
  moods: state.moods,
}),
```

Large data (messages, photos, custom messages) stays in IndexedDB, loaded on demand.

### Storage Quota Monitoring

```typescript
// src/utils/storageMonitor.ts
export function logStorageQuota(): void;
```

Monitors localStorage usage against an estimated 5MB quota with warning levels.

### Photo Storage Quotas (`src/config/performance.ts`)

```typescript
export const STORAGE_QUOTAS = {
  WARNING_THRESHOLD: 0.8,   // 80% -- show warning
  CRITICAL_THRESHOLD: 0.95, // 95% -- block uploads
};
```

The `photosSlice` checks Supabase Storage quota before uploads and shows warnings.

## Initialization Performance

### Deferred Migration

Custom message migration from localStorage to IndexedDB is deferred to not block first paint:

```typescript
if ('requestIdleCallback' in window) {
  requestIdleCallback(() => runMigration(), { timeout: 2000 });
} else {
  setTimeout(runMigration, 100);
}
```

### Home View Inline Rendering

The home view is not lazy-loaded, ensuring:
- No chunk fetch for the initial render
- Offline-first rendering (no network needed for code)
- Faster Time to Interactive

## Runtime Performance Monitoring

### Scroll Performance (`src/utils/performanceMonitoring.ts`)

Uses `PerformanceObserver` to monitor scroll jank:

```typescript
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    // Monitor long animation frames during scroll
  }
});
```

### Memory Measurement

Uses Chrome's `performance.memory` API (when available) to track heap usage:

```typescript
if ('memory' in performance) {
  const memory = (performance as unknown as { memory: { usedJSHeapSize: number } }).memory;
  // Log heap usage
}
```

## Service Worker Caching

| Strategy | Resources | Benefit |
|---|---|---|
| `NetworkOnly` | JS/CSS bundles | Always fresh code after deploy |
| `NetworkFirst` | Navigation (HTML) | Fresh content, offline fallback |
| `CacheFirst` | Images/Fonts | Fast load, 30-day expiry |
| Precache | Static assets | Available offline from first visit |

## Blob URL Cleanup

Love Notes preview images use `URL.createObjectURL()` for optimistic display. These are explicitly revoked to prevent memory leaks:

```typescript
function revokePreviewUrlsFromNotes(notes: LoveNote[]): void {
  notes.forEach((note) => {
    if (note.imagePreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(note.imagePreviewUrl);
    }
  });
}
```

Called on:
- `fetchNotes` (before replacing note list)
- `setNotes` (before replacing note list)
- `cleanupPreviewUrls` (on component unmount)
- Individual note success/retry (after server URL replaces preview)

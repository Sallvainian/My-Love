# Performance Optimizations

| Optimization | Implementation | Impact |
|---|---|---|
| **Code splitting** | `React.lazy()` for all non-home views | Reduces initial bundle size |
| **Manual chunks** | Vite `manualChunks` config | Vendor libraries cached independently |
| **Cursor pagination** | `BaseIndexedDBService.getPage()` | O(offset+limit) vs. O(n) for large datasets |
| **List virtualization** | react-window | Only visible list items are rendered |
| **Image compression** | Canvas-based resize + quality reduction | Max 2048x2048, 80% quality, WebP output |
| **Deferred initialization** | `requestIdleCallback` / `setTimeout` | Migration runs after first paint |
| **Lazy modals** | PhotoUpload, PhotoCarousel lazy-loaded | Not included in main bundle |
| **Service Worker caching** | CacheFirst for static assets | Instant load for images/fonts |
| **Zustand partial persist** | Only small state to localStorage | Fast hydration, large data in IndexedDB |
| **Bundle visualization** | rollup-plugin-visualizer | `dist/stats.html` for analysis |
| **Reduced motion** | `useMotionConfig` hook | Respects OS accessibility settings |

---

# Bundle Size Report

Generated from `vite build` output on 2026-03-01. Vite 7.3.1, 2663 modules transformed in 4.02s.

## JavaScript Chunks

| #   | Chunk                                      | Raw       | Gzip      | Map         | Category                 |
| --- | ------------------------------------------ | --------- | --------- | ----------- | ------------------------ |
| 1   | `index-BAr5qT5n.js`                        | 360.14 KB | 105.71 KB | 1,670.72 KB | Application (main entry) |
| 2   | `vendor-supabase-Ev_XeaHi.js`              | 167.89 KB | 44.61 KB  | 761.12 KB   | Vendor                   |
| 3   | `vendor-animation-lsXz_mBp.js`             | 128.45 KB | 42.74 KB  | 706.18 KB   | Vendor                   |
| 4   | `index-CdSpdhvu.js`                        | 78.39 KB  | 18.06 KB  | 241.93 KB   | Application              |
| 5   | `vendor-state-C9_2aNYE.js`                 | 73.33 KB  | 20.19 KB  | 401.68 KB   | Vendor                   |
| 6   | `index-DKXlBgHF.js`                        | 42.10 KB  | 15.42 KB  | 181.78 KB   | Application              |
| 7   | `defaultMessages-unl9wo2X.js`              | 39.04 KB  | 9.02 KB   | 66.80 KB    | Static Data              |
| 8   | `MoodTracker-C_1t51EE.js`                  | 32.38 KB  | 9.61 KB   | 128.48 KB   | Route (lazy)             |
| 9   | `PartnerMoodView-EDlRiIoP.js`              | 25.90 KB  | 7.56 KB   | 80.37 KB    | Route (lazy)             |
| 10  | `AdminPanel-C7tXKVsc.js`                   | 22.86 KB  | 5.15 KB   | 58.66 KB    | Route (lazy)             |
| 11  | `PhotoGallery-BDUYsPJ5.js`                 | 14.97 KB  | 5.14 KB   | 52.67 KB    | Route (lazy)             |
| 12  | `vendor-icons-RRwbiWli.js`                 | 13.53 KB  | 5.12 KB   | 57.37 KB    | Vendor                   |
| 13  | `PhotoCarousel-nnsPrty8.js`                | 11.99 KB  | 3.77 KB   | 38.30 KB    | Route (lazy)             |
| 14  | `PhotoUpload-D1VM8rnZ.js`                  | 9.84 KB   | 3.38 KB   | 26.62 KB    | Route (lazy)             |
| 15  | `react-window-infinite-loader-D8TlbPEu.js` | 9.13 KB   | 3.61 KB   | 35.40 KB    | Library (lazy)           |
| 16  | `workbox-window.prod.es5-CMbbtPCE.js`      | 6.18 KB   | 2.57 KB   | 13.96 KB    | SW Runtime               |
| 17  | `vendor-react-DDdjrX6f.js`                 | 4.08 KB   | 1.60 KB   | 12.92 KB    | Vendor                   |
| 18  | `WelcomeSplash-BwO-R7oj.js`                | 3.04 KB   | 1.43 KB   | 6.86 KB     | Route (lazy)             |
| 19  | `virtual_pwa-register-Cnr9Zjjb.js`         | 1.35 KB   | 0.75 KB   | 3.97 KB     | PWA                      |
| 20  | `authService-x0_0sh4_.js`                  | 0.72 KB   | 0.46 KB   | 1.60 KB     | Service (lazy)           |
| 21  | `motionFeatures-93jff5qB.js`               | 0.49 KB   | 0.33 KB   | 0.11 KB     | Animation                |

## CSS

| File                 | Raw      | Gzip     |
| -------------------- | -------- | -------- |
| `index-JkDDXOin.css` | 93.35 KB | 15.14 KB |

## Service Worker

| File     | Raw      | Gzip     | Map       |
| -------- | -------- | -------- | --------- |
| `sw.mjs` | 33.32 KB | 10.35 KB | 264.76 KB |

## Summary by Category

| Category        | Chunks | Raw Total       | Gzip Total    |
| --------------- | ------ | --------------- | ------------- |
| Application     | 3      | 480.63 KB       | 139.19 KB     |
| Vendor          | 5      | 387.28 KB       | 114.26 KB     |
| Route (lazy)    | 6      | 120.98 KB       | 34.61 KB      |
| Static Data     | 1      | 39.04 KB        | 9.02 KB       |
| Library (lazy)  | 1      | 9.13 KB         | 3.61 KB       |
| SW / PWA        | 3      | 8.02 KB         | 3.65 KB       |
| Animation       | 1      | 0.49 KB         | 0.33 KB       |
| **JS Total**    | **20** | **1,045.57 KB** | **304.67 KB** |
| CSS             | 1      | 93.35 KB        | 15.14 KB      |
| Service Worker  | 1      | 33.32 KB        | 10.35 KB      |
| **Grand Total** | **22** | **1,172.24 KB** | **330.16 KB** |

## Critical Path Analysis

The initial page load requires these chunks before the app is interactive:

| Chunk                   | Gzip          | Notes                        |
| ----------------------- | ------------- | ---------------------------- |
| `index.html`            | 0.83 KB       | SPA entry point              |
| `index.css`             | 15.14 KB      | All styles (Tailwind CSS v4) |
| `vendor-react`          | 1.60 KB       | React runtime                |
| `vendor-state`          | 20.19 KB      | Zustand store + IDB + Zod    |
| `index` (main)          | 105.71 KB     | Application bootstrap        |
| **Critical path total** | **143.47 KB** | Before first paint           |

The remaining chunks (`vendor-supabase`, `vendor-animation`, `vendor-icons`, route-level components) load on demand as the user navigates.

## Lazy Loading Patterns

The app uses `React.lazy()` with dynamic imports in `src/App.tsx` for route-level code splitting. Each lazy component is wrapped in a `<Suspense>` boundary with a loading spinner fallback.

### Lazy-Loaded Components

| Component           | Import Path                                    | Named Export        |
| ------------------- | ---------------------------------------------- | ------------------- |
| `PhotoGallery`      | `./components/PhotoGallery/PhotoGallery`       | `PhotoGallery`      |
| `MoodTracker`       | `./components/MoodTracker/MoodTracker`         | `MoodTracker`       |
| `PartnerMoodView`   | `./components/PartnerMoodView/PartnerMoodView` | `PartnerMoodView`   |
| `AdminPanel`        | `./components/AdminPanel/AdminPanel`           | default export      |
| `LoveNotes`         | `./components/love-notes`                      | `LoveNotes`         |
| `ScriptureOverview` | `./components/scripture-reading`               | `ScriptureOverview` |
| `WelcomeSplash`     | `./components/WelcomeSplash/WelcomeSplash`     | `WelcomeSplash`     |
| `PhotoUpload`       | `./components/PhotoUpload/PhotoUpload`         | `PhotoUpload`       |
| `PhotoCarousel`     | `./components/PhotoCarousel/PhotoCarousel`     | `PhotoCarousel`     |

Named exports use the `.then((m) => ({ default: m.ComponentName }))` pattern to satisfy React.lazy's requirement for a default export.

### Dynamic Import Pattern

```typescript
const PhotoGallery = lazy(() =>
  import('./components/PhotoGallery/PhotoGallery').then((m) => ({ default: m.PhotoGallery }))
);
```

### Vendor Chunk Strategy

Configured in `vite.config.ts` under `build.rollupOptions.output.manualChunks`:

```typescript
manualChunks: {
  'vendor-react': ['react', 'react-dom'],
  'vendor-supabase': ['@supabase/supabase-js'],
  'vendor-state': ['zustand', 'idb', 'zod'],
  'vendor-animation': ['framer-motion'],
  'vendor-icons': ['lucide-react'],
},
```

This splits heavy vendor dependencies into separate chunks that can be cached independently by the browser. Since vendor code changes infrequently compared to application code, this improves cache hit rates on subsequent visits.

## Largest Chunks (Top 5 by Gzip)

1. **index (main entry)** -- 105.71 KB gzip -- Contains all application code including the Zustand store slices, React components for the main views, routing logic, and the scripture reading flow. This is the largest chunk and the primary optimization target.

2. **vendor-supabase** -- 44.61 KB gzip -- The Supabase client SDK. Heavy but unavoidable for real-time features, auth, and database access. Loaded on demand, not on critical path.

3. **vendor-animation** -- 42.74 KB gzip -- Framer Motion animation library. Used for page transitions, gesture handling, and micro-interactions. Could potentially be lazy-loaded more aggressively.

4. **vendor-state** -- 20.19 KB gzip -- Zustand (state management), idb (IndexedDB wrapper), and Zod (schema validation). On the critical path because the store initializes at app boot.

5. **index (secondary)** -- 18.06 KB gzip -- Secondary application module, likely containing feature-specific code that was split by Rollup's chunking algorithm.

## Tree Shaking

- **Lucide React** icons are tree-shakeable. Only imported icons are included in the `vendor-icons` chunk. The 13.53 KB raw size reflects only the icons actually used in the application.
- **Framer Motion** uses `LazyMotion` with `domAnimation` features loaded on demand via a separate `motionFeatures` chunk (0.49 KB raw). This avoids loading the full Framer Motion feature set.
- **Tailwind CSS v4** automatically tree-shakes unused utility classes via the `@tailwindcss/postcss` plugin. The 93.35 KB raw CSS includes only classes referenced in the source code.

## Bundle Analysis Tooling

### Interactive Visualizer

After building, open the Rollup visualizer:

```bash
npm run build
open dist/stats.html
```

The visualizer shows a treemap of all chunks with their raw, gzip, and brotli sizes.

### Markdown Report

```bash
npm run perf:bundle-report
```

The `perf-bundle-report.mjs` script generates this report by measuring raw and gzip sizes for target chunks (`index-`, `vendor-supabase-`, `vendor-animation-`, `vendor-state-`) and all CSS files. Build warnings are extracted from the build log and included.

### CI Bundle Size Tracking

The `bundle-size.yml` workflow uses `preactjs/compressed-size-action@v3` to track brotli-compressed sizes on PRs. It strips content hashes from filenames (`-[A-Za-z0-9_-]{8}\.`) for stable comparison. Changes smaller than 100 bytes are suppressed.

## Recommendations

1. **Main entry chunk (105.71 KB gzip)**: Consider further code splitting of feature-specific components. The scripture reading flow and mood tracker could be separate lazy-loaded routes to reduce the main chunk.

2. **Framer Motion (42.74 KB gzip)**: The `LazyMotion` component with `domAnimation` is already used. Ensure only needed features are imported. The `motionFeatures` chunk (0.33 KB) suggests this is working correctly.

3. **CSS (15.14 KB gzip)**: Tailwind CSS v4 with the `@tailwindcss/postcss` plugin handles tree-shaking of unused utility classes. The current size is reasonable for the feature set.

4. **Service Worker (10.35 KB gzip)**: Includes Workbox runtime for precaching and runtime caching strategies. Size is appropriate for the caching complexity.

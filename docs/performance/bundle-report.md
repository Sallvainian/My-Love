# Bundle Size Report

Generated from `vite build` output on 2026-03-03. Vite 7.3.1, 2,687 modules transformed in 7.96s.

## JavaScript Chunks

| #   | Chunk                                      | Raw       | Gzip      | Map         | Category                 |
| --- | ------------------------------------------ | --------- | --------- | ----------- | ------------------------ |
| 1   | `index-CajMPF7Y.js`                        | 429.48 KB | 129.70 KB | 2,120.49 KB | Application (main entry) |
| 2   | `vendor-supabase-BGaGvsOb.js`              | 171.16 KB | 45.64 KB  | 774.64 KB   | Vendor                   |
| 3   | `vendor-animation-BIEsYeOU.js`             | 131.89 KB | 43.85 KB  | 726.55 KB   | Vendor                   |
| 4   | `index-DrN2IMkC.js`                        | 80.06 KB  | 18.48 KB  | 248.31 KB   | Application              |
| 5   | `vendor-state-B3zABjKr.js`                 | 73.33 KB  | 20.19 KB  | 401.68 KB   | Vendor                   |
| 6   | `index-CFn4-Dtn.js`                        | 42.10 KB  | 15.42 KB  | 181.78 KB   | Application              |
| 7   | `defaultMessages-DJ19pJWk.js`              | 39.04 KB  | 9.02 KB   | 66.80 KB    | Static Data              |
| 8   | `MoodTracker-DtaIsWA4.js`                  | 32.38 KB  | 9.62 KB   | 128.48 KB   | Route (lazy)             |
| 9   | `PartnerMoodView-Br4d7tft.js`              | 25.90 KB  | 7.56 KB   | 80.37 KB    | Route (lazy)             |
| 10  | `AdminPanel-BPaNsQ5y.js`                   | 22.86 KB  | 5.15 KB   | 58.66 KB    | Route (lazy)             |
| 11  | `PhotoGallery-C_vQXUXk.js`                 | 14.97 KB  | 5.14 KB   | 52.67 KB    | Route (lazy)             |
| 12  | `vendor-icons-DBRKUt55.js`                 | 13.53 KB  | 5.12 KB   | 57.37 KB    | Vendor                   |
| 13  | `PhotoCarousel-Dx_wD1Oz.js`                | 11.99 KB  | 3.77 KB   | 38.30 KB    | Route (lazy)             |
| 14  | `PhotoUpload-CJ2JTguf.js`                  | 9.84 KB   | 3.38 KB   | 26.62 KB    | Route (lazy)             |
| 15  | `react-window-infinite-loader-BPR7BjQF.js` | 9.13 KB   | 3.60 KB   | 35.40 KB    | Library (lazy)           |
| 16  | `workbox-window.prod.es5-C30RbaxU.js`      | 6.18 KB   | 2.57 KB   | 13.96 KB    | SW Runtime               |
| 17  | `vendor-react-D9EoMyb9.js`                 | 4.08 KB   | 1.60 KB   | 12.93 KB    | Vendor                   |
| 18  | `WelcomeSplash-Ebns8NVZ.js`                | 3.04 KB   | 1.43 KB   | 6.86 KB     | Route (lazy)             |
| 19  | `virtual_pwa-register-BhIOp4sZ.js`         | 1.35 KB   | 0.76 KB   | 3.97 KB     | PWA                      |
| 20  | `authService-DwpY-Gl3.js`                  | 0.72 KB   | 0.46 KB   | 1.60 KB     | Service (lazy)           |
| 21  | `motionFeatures-CVpYvBHg.js`               | 0.49 KB   | 0.33 KB   | 0.11 KB     | Animation                |

## CSS

| File                 | Raw      | Gzip     |
| -------------------- | -------- | -------- |
| `index-3l5QVQRg.css` | 94.40 KB | 15.22 KB |

## Service Worker

| File     | Raw      | Gzip     | Map       |
| -------- | -------- | -------- | --------- |
| `sw.mjs` | 33.39 KB | 10.38 KB | 264.88 KB |

## Summary by Category

| Category        | Chunks | Raw Total       | Gzip Total    |
| --------------- | ------ | --------------- | ------------- |
| Application     | 3      | 551.64 KB       | 163.60 KB     |
| Vendor          | 5      | 393.99 KB       | 116.40 KB     |
| Route (lazy)    | 7      | 120.98 KB       | 36.05 KB      |
| Static Data     | 1      | 39.04 KB        | 9.02 KB       |
| Library (lazy)  | 1      | 9.13 KB         | 3.60 KB       |
| SW Runtime      | 1      | 6.18 KB         | 2.57 KB       |
| PWA             | 1      | 1.35 KB         | 0.76 KB       |
| Service (lazy)  | 1      | 0.72 KB         | 0.46 KB       |
| Animation       | 1      | 0.49 KB         | 0.33 KB       |
| **JS Total**    | **21** | **1,123.52 KB** | **332.79 KB** |
| CSS             | 1      | 94.40 KB        | 15.22 KB      |
| Service Worker  | 1      | 33.39 KB        | 10.38 KB      |
| **Grand Total** | **23** | **1,251.31 KB** | **358.39 KB** |

## Critical Path Analysis

The initial page load requires these chunks before the app is interactive:

| Chunk                   | Gzip          | Notes                          |
| ----------------------- | ------------- | ------------------------------ |
| `index.html`            | 0.83 KB       | SPA entry point                |
| `index.css`             | 15.22 KB      | All styles (Tailwind CSS v4)   |
| `vendor-react`          | 1.60 KB       | React runtime                  |
| `vendor-state`          | 20.19 KB      | Zustand store + IDB + Zod      |
| `index` (main)          | 129.70 KB     | Application bootstrap + Sentry |
| **Critical path total** | **167.54 KB** | Before first paint             |

The remaining chunks (`vendor-supabase`, `vendor-animation`, `vendor-icons`, route-level components) load on demand as the user navigates.

## Largest Chunks (Top 5 by Gzip)

1. **index (main entry)** -- 129.70 KB gzip -- Contains all application code including the Zustand store slices, React components for the main views, routing logic, the scripture reading flow, and the Sentry error tracking SDK (`@sentry/react`). This is the largest chunk and the primary optimization target. Grew from 105.71 KB due to Sentry integration in Epic 4.

2. **vendor-supabase** -- 45.64 KB gzip -- The Supabase client SDK. Heavy but unavoidable for real-time features, auth, and database access. Loaded on demand, not on critical path.

3. **vendor-animation** -- 43.85 KB gzip -- Framer Motion animation library. Used for page transitions, gesture handling, and micro-interactions. Could potentially be lazy-loaded more aggressively.

4. **vendor-state** -- 20.19 KB gzip -- Zustand (state management), idb (IndexedDB wrapper), and Zod (schema validation). On the critical path because the store initializes at app boot.

5. **index (secondary)** -- 18.48 KB gzip -- Secondary application module, likely containing feature-specific code that was split by Rollup's chunking algorithm.

## Recommendations

1. **Main entry chunk (129.70 KB gzip)**: The Sentry SDK added ~24 KB gzip. Consider further code splitting of feature-specific components. The scripture reading flow and mood tracker could be separate lazy-loaded routes to reduce the main chunk.

2. **Framer Motion (43.85 KB gzip)**: The `LazyMotion` component with `domAnimation` is already used. Ensure only needed features are imported. The `motionFeatures` chunk (0.33 KB) suggests this is working correctly.

3. **CSS (15.22 KB gzip)**: Tailwind CSS v4 with the `@tailwindcss/postcss` plugin handles tree-shaking of unused utility classes. The current size is reasonable for the feature set.

4. **Service Worker (10.38 KB gzip)**: Includes Workbox runtime for precaching and runtime caching strategies. Size is appropriate for the caching complexity.

5. **Build time (7.96s)**: The Sentry Vite plugin uploads source maps during the build, adding approximately 4 seconds. Source maps are deleted from `dist/` after upload, so they do not affect deployed bundle size.

## How to Regenerate

```bash
npm run perf:bundle-report
```

This runs a clean build and generates this report using `scripts/perf-bundle-report.mjs`. The raw build output is also captured in `docs/performance/perf-build.log`.

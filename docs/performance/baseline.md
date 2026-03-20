# Performance Baseline

Captured from `vite build` output on 2026-03-20 using Vite 7.3.1. All sizes are post-minification.

Last reviewed: 2026-03-20

## Build Summary

| Metric              | Value                 |
| ------------------- | --------------------- |
| Vite version        | 7.3.1                 |
| Modules transformed | 2,687                 |
| Build time          | 7.96s                 |
| SW modules          | 85                    |
| SW build time       | 130ms                 |
| Precache entries    | 8 (8.90 KiB)          |
| PWA plugin          | vite-plugin-pwa 1.2.0 |
| InjectManifest      | ES format             |

## Chunk Size Baseline

### Vendor Chunks

| Chunk              | Raw (KB) | Gzip (KB) | Source Map (KB) | Purpose                                    |
| ------------------ | -------- | --------- | --------------- | ------------------------------------------ |
| `vendor-react`     | 4.08     | 1.60      | 12.93           | React core (`react`, `react-dom`)          |
| `vendor-icons`     | 13.53    | 5.12      | 57.37           | Icon library (`lucide-react`)              |
| `vendor-state`     | 73.33    | 20.19     | 401.68          | State management (`zustand`, `idb`, `zod`) |
| `vendor-animation` | 131.89   | 43.85     | 726.55          | Animation library (`framer-motion`)        |
| `vendor-supabase`  | 171.16   | 45.64     | 774.64          | Supabase client (`@supabase/supabase-js`)  |

### Application Chunks

| Chunk                          | Raw (KB) | Gzip (KB) | Source Map (KB) | Purpose                             |
| ------------------------------ | -------- | --------- | --------------- | ----------------------------------- |
| `index` (main entry)           | 429.48   | 129.70    | 2,120.49        | Application code (all features)     |
| `index` (secondary)            | 80.06    | 18.48     | 248.31          | Additional application module       |
| `index` (tertiary)             | 42.10    | 15.42     | 181.78          | Additional application module       |
| `defaultMessages`              | 39.04    | 9.02      | 66.80           | Pre-loaded daily love messages      |
| `MoodTracker`                  | 32.38    | 9.62      | 128.48          | Mood tracking UI component          |
| `PartnerMoodView`              | 25.90    | 7.56      | 80.37           | Partner mood display component      |
| `AdminPanel`                   | 22.86    | 5.15      | 58.66           | Admin panel (lazy-loaded)           |
| `PhotoGallery`                 | 14.97    | 5.14      | 52.67           | Photo gallery component             |
| `PhotoCarousel`                | 11.99    | 3.77      | 38.30           | Photo carousel viewer               |
| `PhotoUpload`                  | 9.84     | 3.38      | 26.62           | Photo upload component              |
| `react-window-infinite-loader` | 9.13     | 3.60      | 35.40           | Virtualized infinite scroll         |
| `workbox-window`               | 6.18     | 2.57      | 13.96           | Service worker registration runtime |
| `WelcomeSplash`                | 3.04     | 1.43      | 6.86            | Welcome splash screen               |
| `virtual_pwa-register`         | 1.35     | 0.76      | 3.97            | PWA registration handler            |
| `authService`                  | 0.72     | 0.46      | 1.60            | Auth service (lazy chunk)           |
| `motionFeatures`               | 0.49     | 0.33      | 0.11            | Framer Motion feature bundle        |

### CSS

| File        | Raw (KB) | Gzip (KB) |
| ----------- | -------- | --------- |
| `index.css` | 94.40    | 15.22     |

### Service Worker

| File     | Raw (KB) | Gzip (KB) | Source Map (KB) |
| -------- | -------- | --------- | --------------- |
| `sw.mjs` | 33.39    | 10.38     | 264.88          |

### Other

| File                   | Raw (KB) |
| ---------------------- | -------- |
| `manifest.webmanifest` | 0.42     |
| `index.html`           | 1.93     |

## Total Transfer Size (Gzip)

| Category        | Gzip (KB)  |
| --------------- | ---------- |
| Vendor JS       | 116.40     |
| Application JS  | 189.35     |
| CSS             | 15.22      |
| Service Worker  | 10.38      |
| HTML + Manifest | 0.83       |
| **Total**       | **332.18** |

## Thresholds and Targets

These baselines serve as the reference point for the bundle-size CI workflow (`.github/workflows/bundle-size.yml`). Significant regressions against these numbers should be investigated.

| Metric                      | Baseline  | Target   |
| --------------------------- | --------- | -------- |
| Main entry chunk (gzip)     | 129.70 KB | < 150 KB |
| Total vendor JS (gzip)      | 116.40 KB | < 130 KB |
| Total application JS (gzip) | 189.35 KB | < 210 KB |
| CSS (gzip)                  | 15.22 KB  | < 20 KB  |
| Total transfer (gzip)       | 332.18 KB | < 400 KB |
| Build time                  | 7.96s     | < 15s    |

## Code Splitting Strategy

The project uses manual chunks in `vite.config.ts` to split vendor dependencies into separate cached files. This improves cache efficiency because vendor code changes infrequently compared to application code.

**Vendor chunks** (5 chunks, 116.40 KB gzip):

- `vendor-react`: React core, rarely changes
- `vendor-supabase`: Supabase client, heavy but stable
- `vendor-state`: Zustand + IndexedDB + Zod, moderately stable
- `vendor-animation`: Framer Motion, stable between major versions
- `vendor-icons`: Lucide React, tree-shaken icon set

**Route-level splitting** (automatic via React.lazy):

- `PhotoGallery`, `MoodTracker`, `PartnerMoodView`, `AdminPanel`, `LoveNotes`, `ScriptureOverview`, `WelcomeSplash`, `PhotoUpload`, `PhotoCarousel` are all separate chunks loaded on demand.

**Static data chunks**:

- `defaultMessages` contains pre-loaded daily love messages. Separated to avoid bloating the main entry chunk with static string data.

## Browser Targets

The `browserslist` configuration in `package.json`:

```json
"browserslist": [
  "defaults and supports es6-module",
  "maintained node versions"
]
```

This targets browsers with ES module support, which aligns with the ES2022 TypeScript target.

## Performance Monitoring Infrastructure

The project includes built-in performance monitoring utilities:

### PerformanceMonitor Service (`src/services/performanceMonitor.ts`)

A singleton service that tracks operation execution times using the Web Performance API:

- `measureAsync(name, operation)` -- Measure execution time of async operations
- `recordMetric(name, duration)` -- Record custom performance metrics
- `getMetrics(name)` -- Get metrics for a specific operation (count, avg, min, max, total)
- `getReport()` -- Generate a human-readable performance report sorted by total duration
- In development mode, each measurement is logged to the console with `[PerfMonitor]` prefix

### Scroll and Memory Monitoring (`src/utils/performanceMonitoring.ts`)

Development-mode utilities for detecting performance issues:

- `measureScrollPerformance()` -- Creates a PerformanceObserver that warns when frame drops occur (> 16.67ms per frame)
- `measureMemoryUsage()` -- Returns current JavaScript heap size in MB (Chrome/Edge only via `performance.memory`)

### Performance Constants (`src/config/performance.ts`)

Centralized configuration for performance-related magic numbers:

- **Pagination**: Default page size (20), max page size (100)
- **Storage Quotas**: Warning threshold (80%), error threshold (95%), default quota (50MB), monitoring interval (5 minutes)
- **Validation Limits**: Message text max (1000), caption max (500), mood note max (1000), partner name max (50)

### Logger Utility (`src/utils/logger.ts`)

The logger utility gates verbose debug output behind `import.meta.env.DEV`, ensuring that `logger.debug()` calls produce no output in production builds. This avoids performance overhead from console output in production while preserving detailed tracing in development. See the [Code Style guide](../development-guide/code-style.md#logger-utility) for details.

## CI Bundle Size Monitoring

The `bundle-size.yml` workflow runs on PRs and uses `preactjs/compressed-size-action@v3` to track brotli-compressed bundle sizes. Changes smaller than 100 bytes are not reported. The workflow comments on PRs with a size comparison table showing deltas for each JS and CSS file.

## How to Regenerate Bundle Report

```bash
npm run perf:bundle-report
```

This runs a clean build and generates the bundle report at `docs/performance/bundle-report.md` using `scripts/perf-bundle-report.mjs`. The raw build output is also captured in `docs/performance/perf-build.log`.

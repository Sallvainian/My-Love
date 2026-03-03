# Performance Baseline

Captured from `vite build` output on 2026-03-03 using Vite 7.3.1. All sizes are post-minification.

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

Build time increased from 4.02s to 7.96s due to the Sentry Vite plugin (`@sentry/vite-plugin`) uploading source maps during the build step.

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
| `index` (main entry)           | 429.48   | 129.70    | 2,120.49        | Application code + Sentry SDK       |
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
| Application JS  | 216.39     |
| CSS             | 15.22      |
| Service Worker  | 10.38      |
| HTML + Manifest | 0.83       |
| **Total**       | **359.22** |

Application JS includes all non-vendor JavaScript chunks: index chunks, route-level lazy chunks, static data, library chunks, SW runtime, PWA registration, auth service, and motion features.

## Thresholds and Targets

These baselines serve as the reference point for the bundle-size CI workflow (`.github/workflows/bundle-size.yml`). Significant regressions against these numbers should be investigated.

| Metric                      | Baseline  | Target   | Notes                                 |
| --------------------------- | --------- | -------- | ------------------------------------- |
| Main entry chunk (gzip)     | 129.70 KB | < 150 KB | Grew from 105.71 KB due to Sentry SDK |
| Total vendor JS (gzip)      | 116.40 KB | < 130 KB |                                       |
| Total application JS (gzip) | 216.39 KB | < 240 KB |                                       |
| CSS (gzip)                  | 15.22 KB  | < 20 KB  |                                       |
| Total transfer (gzip)       | 359.22 KB | < 400 KB |                                       |
| Build time                  | 7.96s     | < 15s    | Sentry source map upload adds ~4s     |

## Code Splitting Strategy

The project uses manual chunks in `vite.config.ts` to split vendor dependencies into separate cached files. This improves cache efficiency because vendor code changes infrequently compared to application code.

**Vendor chunks** (5 chunks, 116.40 KB gzip):

- `vendor-react`: React core, rarely changes
- `vendor-supabase`: Supabase client, heavy but stable
- `vendor-state`: Zustand + IndexedDB + Zod, moderately stable
- `vendor-animation`: Framer Motion, stable between major versions
- `vendor-icons`: Lucide React, tree-shaken icon set

**Route-level splitting** (automatic via React.lazy):

- `AdminPanel`, `MoodTracker`, `PartnerMoodView`, `PhotoGallery`, `PhotoCarousel`, `PhotoUpload`, `WelcomeSplash` are all separate chunks loaded on demand.

**Static data chunks**:

- `defaultMessages` contains pre-loaded daily love messages. Separated to avoid bloating the main entry chunk with static string data.

## Change Log

| Date       | Main Entry (gzip) | Total Transfer (gzip) | Modules | Build Time | Notes                                      |
| ---------- | ----------------- | --------------------- | ------- | ---------- | ------------------------------------------ |
| 2026-03-01 | 105.71 KB         | 325.98 KB             | 2,663   | 4.02s      | Initial baseline                           |
| 2026-03-03 | 129.70 KB         | 359.22 KB             | 2,687   | 7.96s      | Epic 4 hardening: Sentry SDK + source maps |

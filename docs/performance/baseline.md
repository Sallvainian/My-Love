# Performance Baseline

Captured from `vite build` output on 2026-03-01 using Vite 7.3.1. All sizes are post-minification.

## Build Summary

| Metric              | Value                 |
| ------------------- | --------------------- |
| Vite version        | 7.3.1                 |
| Modules transformed | 2,663                 |
| Build time          | 4.02s                 |
| SW modules          | 85                    |
| SW build time       | 72ms                  |
| Precache entries    | 8 (8.90 KiB)         |
| PWA plugin          | vite-plugin-pwa 1.2.0 |
| InjectManifest      | ES format             |

## Chunk Size Baseline

### Vendor Chunks

| Chunk              | Raw (KB) | Gzip (KB) | Source Map (KB) | Purpose                                         |
| ------------------ | -------- | --------- | --------------- | ----------------------------------------------- |
| `vendor-react`     | 4.08     | 1.60      | 12.92           | React core (`react`, `react-dom`)               |
| `vendor-icons`     | 13.53    | 5.12      | 57.37           | Icon library (`lucide-react`)                   |
| `vendor-state`     | 73.33    | 20.19     | 401.68          | State management (`zustand`, `idb`, `zod`)      |
| `vendor-animation` | 128.45   | 42.74     | 706.18          | Animation library (`framer-motion`)             |
| `vendor-supabase`  | 167.89   | 44.61     | 761.12          | Supabase client (`@supabase/supabase-js`)       |

### Application Chunks

| Chunk                        | Raw (KB) | Gzip (KB) | Source Map (KB) | Purpose                               |
| ---------------------------- | -------- | --------- | --------------- | ------------------------------------- |
| `index` (main entry)        | 360.14   | 105.71    | 1,670.72        | Application code (all features)       |
| `index` (secondary)         | 78.39    | 18.06     | 241.93          | Additional application module         |
| `index` (tertiary)          | 42.10    | 15.42     | 181.78          | Additional application module         |
| `defaultMessages`           | 39.04    | 9.02      | 66.80           | Pre-loaded daily love messages        |
| `MoodTracker`               | 32.38    | 9.61      | 128.48          | Mood tracking UI component            |
| `PartnerMoodView`           | 25.90    | 7.56      | 80.37           | Partner mood display component        |
| `AdminPanel`                | 22.86    | 5.15      | 58.66           | Admin panel (lazy-loaded)             |
| `PhotoGallery`              | 14.97    | 5.14      | 52.67           | Photo gallery component               |
| `PhotoCarousel`             | 11.99    | 3.77      | 38.30           | Photo carousel viewer                 |
| `PhotoUpload`               | 9.84     | 3.38      | 26.62           | Photo upload component                |
| `react-window-infinite-loader` | 9.13  | 3.61      | 35.40           | Virtualized infinite scroll           |
| `workbox-window`            | 6.18     | 2.57      | 13.96           | Service worker registration runtime   |
| `WelcomeSplash`             | 3.04     | 1.43      | 6.86            | Welcome splash screen                 |
| `virtual_pwa-register`      | 1.35     | 0.75      | 3.97            | PWA registration handler              |
| `authService`               | 0.72     | 0.46      | 1.60            | Auth service (lazy chunk)             |
| `motionFeatures`            | 0.49     | 0.33      | 0.11            | Framer Motion feature bundle          |

### CSS

| File       | Raw (KB) | Gzip (KB) |
| ---------- | -------- | --------- |
| `index.css` | 93.35   | 15.14     |

### Service Worker

| File    | Raw (KB) | Gzip (KB) | Source Map (KB) |
| ------- | -------- | --------- | --------------- |
| `sw.mjs` | 33.32   | 10.35     | 264.76          |

### Other

| File                   | Raw (KB) |
| ---------------------- | -------- |
| `manifest.webmanifest` | 0.42     |
| `index.html`           | 1.93     |

## Total Transfer Size (Gzip)

| Category        | Gzip (KB) |
| --------------- | --------- |
| Vendor JS       | 114.26    |
| Application JS  | 185.40    |
| CSS             | 15.14     |
| Service Worker  | 10.35     |
| HTML + Manifest | 0.83      |
| **Total**       | **325.98** |

## Thresholds and Targets

These baselines serve as the reference point for the bundle-size CI workflow (`.github/workflows/bundle-size.yml`). Significant regressions against these numbers should be investigated.

| Metric                       | Baseline  | Target    |
| ---------------------------- | --------- | --------- |
| Main entry chunk (gzip)     | 105.71 KB | < 120 KB  |
| Total vendor JS (gzip)      | 114.26 KB | < 130 KB  |
| Total application JS (gzip) | 185.40 KB | < 200 KB  |
| CSS (gzip)                  | 15.14 KB  | < 20 KB   |
| Total transfer (gzip)       | 325.98 KB | < 400 KB  |
| Build time                  | 4.02s     | < 10s     |

## Code Splitting Strategy

The project uses manual chunks in `vite.config.ts` to split vendor dependencies into separate cached files. This improves cache efficiency because vendor code changes infrequently compared to application code.

**Vendor chunks** (5 chunks, 114.26 KB gzip):
- `vendor-react`: React core, rarely changes
- `vendor-supabase`: Supabase client, heavy but stable
- `vendor-state`: Zustand + IndexedDB + Zod, moderately stable
- `vendor-animation`: Framer Motion, stable between major versions
- `vendor-icons`: Lucide React, tree-shaken icon set

**Route-level splitting** (automatic via React.lazy):
- `AdminPanel`, `MoodTracker`, `PartnerMoodView`, `PhotoGallery`, `PhotoCarousel`, `PhotoUpload`, `WelcomeSplash` are all separate chunks loaded on demand.

**Static data chunks**:
- `defaultMessages` contains pre-loaded daily love messages. Separated to avoid bloating the main entry chunk with static string data.

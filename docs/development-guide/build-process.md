# Build Process

## Build Command

```bash
fnox exec -- npm run build
```

This executes:

```bash
tsc -p tsconfig.app.json && vite build
```

Environment variables are decrypted by fnox (using the age provider) before the build runs. Locally, `fnox exec` decrypts secrets from `fnox.toml`. In CI, secrets are provided directly as GitHub Secrets environment variables without fnox.

## Build Stages

### Stage 1: TypeScript Type Check

`tsc -p tsconfig.app.json` runs the TypeScript compiler against the application config, checking types for all source files in `src/` (excluding test files).

Key TypeScript settings for the build:

- **Target**: ES2022
- **Module**: ESNext with bundler resolution
- **Strict mode**: enabled with `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
- **noEmit**: true (Vite handles bundling, TypeScript only type-checks)
- **Incremental**: true with `.tsbuildinfo` cached in `node_modules/.tmp/`
- **Path aliases**: `@/*` maps to `src/*` (in `tsconfig.app.json`)

### Stage 2: Vite Build

`vite build` produces the production bundle in `dist/` with:

1. **Code splitting** via manual chunks (see below)
2. **PWA manifest** generation (`dist/manifest.webmanifest`)
3. **Service worker** compilation via InjectManifest strategy (`dist/sw.js`)
4. **Bundle analysis** output at `dist/stats.html`
5. **CSS extraction** and minification via PostCSS (Tailwind CSS v4 + autoprefixer)
6. **Tree shaking** via Rollup
7. **Source maps** (hidden) when `SENTRY_AUTH_TOKEN` is present, uploaded to Sentry and then deleted from `dist/`
8. **Sentry release** creation when Sentry credentials are configured

The production base path is set to `/My-Love/` for GitHub Pages deployment.

## Manual Chunks (Code Splitting)

Configured in `vite.config.ts` under `build.rollupOptions.output.manualChunks`:

| Chunk Name         | Libraries               | Purpose                                                      |
| ------------------ | ----------------------- | ------------------------------------------------------------ |
| `vendor-react`     | `react`, `react-dom`    | React core -- changes rarely, cached aggressively            |
| `vendor-supabase`  | `@supabase/supabase-js` | Supabase client -- heavy, loaded on demand                   |
| `vendor-state`     | `zustand`, `idb`, `zod` | State management, IndexedDB, validation                      |
| `vendor-animation` | `framer-motion`         | Animation library -- can be lazy loaded                      |
| `vendor-icons`     | `lucide-react`          | Icon library -- tree-shakeable, benefits from separate cache |

This strategy produces separate cached chunks for major dependencies, improving cache hit rates on repeat visits since vendor code changes infrequently compared to application code.

## PWA Manifest Generation

The VitePWA plugin generates `dist/manifest.webmanifest` with:

```json
{
  "name": "My Love - Daily Reminders",
  "short_name": "My Love",
  "description": "Daily love notes and memories",
  "theme_color": "#FF6B9D",
  "background_color": "#FFE5EC",
  "display": "standalone",
  "orientation": "portrait",
  "start_url": "./",
  "scope": "./",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    {
      "src": "icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

## Service Worker

The service worker is compiled from `src/sw.ts` using the InjectManifest strategy. This means:

- **Precache manifest** is injected into `sw.js` by the VitePWA plugin
- **Runtime caching strategies** are defined in `src/sw.ts` (NetworkFirst, CacheFirst, etc.)
- **Precached assets**: only static assets (`*.png`, `*.jpg`, `*.jpeg`, `*.svg`, `*.woff2`, `*.ico`)
- **Not precached**: JavaScript, CSS, and HTML files (these use runtime caching strategies defined in `sw.ts`)
- **`index.html`** is included in precache with a timestamp-based revision, forcing service worker updates on every build

The `workbox` section in VitePWA config is intentionally omitted because InjectManifest ignores it. All runtime caching behavior is controlled in `src/sw.ts`.

## Sentry Integration

When `SENTRY_AUTH_TOKEN` is present in the environment:

- Source maps are generated as `hidden` (not referenced in the output JS files)
- The `@sentry/vite-plugin` uploads source maps to Sentry for error tracking
- Source map files are deleted from `dist/` after upload (via `filesToDeleteAfterUpload`)
- A Sentry release is created with the name from `SENTRY_RELEASE` (typically `my-love@<commit-sha>`)
- Plugin telemetry is disabled

When `SENTRY_AUTH_TOKEN` is absent (e.g., local development), source maps are not generated and Sentry integration is completely disabled.

## Bundle Analysis

After building, inspect bundle sizes:

```bash
# Open the Rollup visualizer output
open dist/stats.html

# Or generate a Markdown report with raw and gzip sizes
npm run perf:bundle-report
```

The visualizer shows a treemap of all chunks with their raw, gzip, and brotli sizes. The bundle report script (`scripts/perf-bundle-report.mjs`) generates `docs/performance/bundle-report.md` with exact sizes for target chunks and CSS files.

## Build Output Structure

```
dist/
  index.html                    # SPA entry point with redirect handler
  manifest.webmanifest          # PWA manifest
  sw.js                         # Compiled service worker
  registerSW.js                 # Service worker registration script
  stats.html                    # Bundle analysis treemap
  assets/
    index-[hash].js             # Application entry chunk
    index-[hash].css            # Extracted CSS
    vendor-react-[hash].js      # React core chunk
    vendor-supabase-[hash].js   # Supabase client chunk
    vendor-state-[hash].js      # State management chunk
    vendor-animation-[hash].js  # Framer Motion chunk
    vendor-icons-[hash].js      # Lucide React chunk
  icons/
    icon-192.png                # PWA icon 192x192
    icon-512.png                # PWA icon 512x512
  workbox-[hash].js             # Workbox runtime (generated by InjectManifest)
```

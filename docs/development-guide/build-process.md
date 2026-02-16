# Build Process

## Build Command

```bash
npm run build
```

This executes:

```bash
dotenvx run --overload -- bash -c 'tsc -b && vite build'
```

## Build Stages

### Stage 1: Environment Decryption

`dotenvx run --overload` decrypts the `.env` file using the key from `.env.keys`, then injects the decrypted variables into the environment. The `--overload` flag forces decrypted values to override any pre-existing environment variables.

### Stage 2: TypeScript Compilation

`tsc -b` runs the TypeScript compiler in build mode, checking types across the project references defined in `tsconfig.json` (which references `tsconfig.app.json` and `tsconfig.node.json`).

Key TypeScript settings for the build:

- **Target**: ES2022
- **Module**: ESNext with bundler resolution
- **Strict mode**: enabled with `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
- **noEmit**: true (Vite handles bundling, TypeScript only type-checks)
- **Incremental**: true with `.tsbuildinfo` cached in `node_modules/.tmp/`

### Stage 3: Vite Build

`vite build` produces the production bundle in `dist/` with:

1. **Code splitting** via manual chunks (see below)
2. **PWA manifest** generation (`dist/manifest.webmanifest`)
3. **Service worker** compilation via InjectManifest strategy (`dist/sw.js`)
4. **Bundle analysis** output at `dist/stats.html`
5. **CSS extraction** and minification via PostCSS (Tailwind CSS v4 + autoprefixer)
6. **Tree shaking** via Rollup

The production base path is set to `/My-Love/` for GitHub Pages deployment.

## Manual Chunks (Code Splitting)

Configured in `vite.config.ts` under `build.rollupOptions.output.manualChunks`:

| Chunk Name | Libraries | Purpose |
|---|---|---|
| `vendor-react` | `react`, `react-dom` | React core -- changes rarely, cached aggressively |
| `vendor-supabase` | `@supabase/supabase-js` | Supabase client -- heavy, loaded on demand |
| `vendor-state` | `zustand`, `idb`, `zod` | State management, IndexedDB, validation |
| `vendor-animation` | `framer-motion` | Animation library -- can be lazy loaded |
| `vendor-icons` | `lucide-react` | Icon library -- tree-shakeable, benefits from separate cache |

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
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
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

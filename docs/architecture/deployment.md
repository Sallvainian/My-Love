# Deployment

## Hosting

| Aspect | Technology | Details |
|---|---|---|
| **Hosting** | GitHub Pages | Static site at `/{repo-name}/` |
| **Build Tool** | Vite 7.3.1 | With `@vitejs/plugin-react` |
| **Deploy Tool** | `gh-pages` | Publishes `dist/` to `gh-pages` branch |
| **CI/CD** | GitHub Actions | Build, test, deploy pipeline |
| **Env Management** | `@dotenvx/dotenvx` | Encrypted `.env` files |

## Build Configuration (`vite.config.ts`)

### Base Path

```typescript
base: mode === 'production' ? '/My-Love/' : '/',
```

Production builds serve from the `/My-Love/` subpath. Development uses root `/`.

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

This splits vendor code into cacheable chunks that change independently of application code.

### PWA Configuration

```typescript
VitePWA({
  registerType: 'autoUpdate',
  strategies: 'injectManifest',
  srcDir: 'src',
  filename: 'sw.ts',
  injectManifest: {
    globPatterns: ['**/*.{png,jpg,jpeg,svg,woff2,ico}'],
    globIgnores: ['**/*.js', '**/*.css', '**/*.html'],
    additionalManifestEntries: [
      { url: 'index.html', revision: Date.now().toString() },
    ],
  },
})
```

Key decisions:
- `injectManifest` strategy gives full control over Service Worker caching behavior
- JS/CSS/HTML are **excluded** from precache to ensure `NetworkOnly` strategy in `sw.ts` runs
- `index.html` has a timestamp-based revision to force SW updates on every deploy
- Static assets (images, fonts, icons) are precached for offline use

### Bundle Analysis

```typescript
visualizer({
  filename: 'dist/stats.html',
  gzipSize: true,
  brotliSize: true,
})
```

Generates `dist/stats.html` with visual bundle size analysis after every build.

### Type Checking

```typescript
checker({ typescript: true })
```

Runs TypeScript type checking in a separate worker during development for faster feedback.

## Web App Manifest

```typescript
manifest: {
  name: 'My Love - Daily Reminders',
  short_name: 'My Love',
  description: 'Daily love notes and memories',
  theme_color: '#FF6B9D',
  background_color: '#FFE5EC',
  display: 'standalone',
  orientation: 'portrait',
  start_url: './',
  scope: './',
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
  ],
}
```

## npm Scripts

### Build Pipeline

```bash
npm run build          # dotenvx run -- bash -c 'tsc -b && vite build'
npm run predeploy      # npm run build && npm run test:smoke
npm run deploy         # gh-pages -d dist
npm run postdeploy     # Prints post-deploy check reminder
```

### Performance Analysis

```bash
npm run perf:build          # Build with perf logging
npm run perf:bundle-report  # Build + generate bundle report
```

### Pre-deploy Checks

The `predeploy` script runs:
1. `tsc -b` -- Full TypeScript build check
2. `vite build` -- Production bundle generation
3. `test:smoke` -- Smoke tests validating the build output

## Service Worker Update Strategy

### Auto-Update in Production

```typescript
if (import.meta.env.PROD) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        updateSW(true); // Auto-reload
      },
    });
  });
}
```

When a new SW is available, the page auto-reloads. No user prompt.

### Dev Mode Cleanup

```typescript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  });
}
```

In development, all SWs are unregistered to prevent stale code.

## SPA Routing on GitHub Pages

GitHub Pages returns 404 for deep links (e.g., `/My-Love/photos`). The solution:

1. A `404.html` file captures the URL and redirects to `index.html` via `sessionStorage`
2. `index.html` reads the stored URL and replaces the history entry
3. The app's initial route detection sets the correct view

## Environment Variables

Build-time variables are injected via Vite's `import.meta.env`:

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Supabase anon key |
| `BASE_URL` | Vite base path (`/` or `/My-Love/`) |
| `DEV` | `true` in development |
| `PROD` | `true` in production |

The `@dotenvx/dotenvx` package provides encrypted `.env` files and the `--overload` flag ensures environment variables take precedence.

## Browser Support

```json
"browserslist": [
  "defaults and supports es6-module",
  "maintained node versions"
]
```

Targets modern browsers with ES module support.

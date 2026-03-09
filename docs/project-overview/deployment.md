# Deployment

## Production URL

**Live site**: https://sallvainian.github.io/My-Love/

## Automatic Deployment Pipeline

Every push to `main` triggers `.github/workflows/deploy.yml`:

### Build Job (`ubuntu-latest`)

1. Checkout code
2. Setup Node.js (version from `.mise.toml`) with npm cache
3. `npm ci`
4. Generate TypeScript types from remote Supabase schema: `supabase gen types typescript --project-id xojempkrugifnaveqtqc > src/types/database.types.ts`
5. `npm run build` with environment variables injected via GitHub Secrets (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY, Sentry config)
6. `npm run test:smoke` (validates dist/ directory structure, index.html, manifest, icons, JS bundles, service worker)
7. Upload `dist/` as GitHub Pages artifact

### Deploy Job

Deploys the build artifact to GitHub Pages using `actions/deploy-pages@v4`.

### Health Check Job

Runs after deployment:

1. Waits 10 seconds for GitHub Pages CDN propagation
2. HTTP status check (expects 200) with 3 retry attempts and 10-second delay between retries
3. Response time check (baseline under 3 seconds)
4. Verifies JavaScript bundle reference exists in HTML
5. Verifies PWA manifest is accessible (HTTP 200 for `manifest.webmanifest`)
6. Supabase connection verification (creates a client, checks auth endpoint returns a valid response)

## Required GitHub Secrets

| Secret                    | Description                                                                |
| ------------------------- | -------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`       | Supabase project URL (injected at build time)                              |
| `VITE_SUPABASE_ANON_KEY`  | Supabase anon/public key (mapped to VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY) |
| `SUPABASE_ACCESS_TOKEN`   | Supabase CLI auth token for TypeScript type generation                     |
| `VITE_SENTRY_DSN`         | Sentry DSN for error tracking                                              |
| `SENTRY_AUTH_TOKEN`       | Sentry auth token for source map upload                                    |
| `SENTRY_ORG`              | Sentry organization slug                                                   |
| `SENTRY_PROJECT`          | Sentry project slug                                                        |
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude Code OAuth token for AI-powered workflows                           |

## GitHub Pages Configuration

1. Repository **Settings > Pages**
2. Under **Source**, select "GitHub Actions"
3. Save

## Manual Deployment

```bash
npm run deploy
```

This runs `npm run build` and `npm run test:smoke` (via the `predeploy` script), then publishes `dist/` to GitHub Pages via `gh-pages`.

## Post-Deploy Verification

```bash
node scripts/post-deploy-check.cjs https://sallvainian.github.io/My-Love/
```

Informational (does not block deployment). Checks:

1. HTTP 200 response from the live site
2. Viewport meta tag and manifest link in HTML
3. PWA manifest structure validation (name, short_name, icons, display, theme_color)
4. Service worker registration guidance (manual verification in DevTools)
5. Pre-configured data visibility guidance (manual verification)

## Build Configuration

### Base Path

```typescript
// vite.config.ts
base: mode === 'production' ? '/My-Love/' : '/',
```

### Source Maps

Source maps are generated as `hidden` when `SENTRY_AUTH_TOKEN` is present (uploaded to Sentry, then deleted from dist/). Otherwise source maps are disabled.

### Manual Chunks (Code Splitting)

| Chunk Name         | Libraries               |
| ------------------ | ----------------------- |
| `vendor-react`     | `react`, `react-dom`    |
| `vendor-supabase`  | `@supabase/supabase-js` |
| `vendor-state`     | `zustand`, `idb`, `zod` |
| `vendor-animation` | `framer-motion`         |
| `vendor-icons`     | `lucide-react`          |

### PWA Manifest

- Name: "My Love - Daily Reminders"
- Short name: "My Love"
- Theme color: `#FF6B9D`
- Background color: `#FFE5EC`
- Display: standalone
- Orientation: portrait
- Icons: 192x192 and 512x512 PNG (any maskable)

### Service Worker

- Strategy: InjectManifest (`src/sw.ts`)
- Precached: `**/*.{png,jpg,jpeg,svg,woff2,ico}` only
- Excluded from precache: `**/*.js`, `**/*.css`, `**/*.html`
- `index.html` included with timestamp-based revision for forced SW updates

### Vite Plugins

| Plugin                     | Purpose                                   |
| -------------------------- | ----------------------------------------- |
| `@vitejs/plugin-react`     | React JSX transform and HMR               |
| `vite-plugin-checker`      | In-browser TypeScript error overlay       |
| `vite-plugin-pwa`          | PWA service worker (InjectManifest)       |
| `rollup-plugin-visualizer` | Bundle analysis (`dist/stats.html`)       |
| `@sentry/vite-plugin`      | Source map upload to Sentry (conditional) |

### Bundle Analysis

```bash
npm run perf:bundle-report
```

Generates `docs/performance/bundle-report.md` with raw and gzip sizes for target chunks and CSS files.

## Concurrency

The deploy workflow uses a `pages` concurrency group with `cancel-in-progress: false` to prevent overlapping deployments.

## Deployment Timeline

Typical: approximately 2-3 minutes from push to live.

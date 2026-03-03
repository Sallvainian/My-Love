# Deployment

> Last updated: 2026-03-03

## Build Pipeline

### Production Build

```bash
fnox exec -- npm run build
# Expands to: tsc -b && vite build
```

The build process:

1. **fnox** decrypts secrets from `fnox.toml` using age keys at `~/.age/key.txt`
2. **tsc -b** runs TypeScript compilation (project references mode)
3. **vite build** bundles the application for production

### Pre-deploy

```bash
npm run predeploy
# Expands to: npm run build && npm run test:smoke
```

Smoke tests (`scripts/smoke-tests.cjs`) validate the build output before deployment.

### Deploy

```bash
npm run deploy
# Expands to: gh-pages -d dist
```

Deploys the `dist/` directory to the `gh-pages` branch via the `gh-pages` npm package.

### Post-deploy

```bash
npm run postdeploy
# Prints: "Run: node scripts/post-deploy-check.cjs [YOUR_URL]"
```

## GitHub Pages Configuration

- **Live URL**: `https://sallvainian.github.io/My-Love/`
- **Base path**: `/My-Love/` (configured in `vite.config.ts` when `mode === 'production'`)
- **Branch**: `gh-pages` (managed by `gh-pages` package)

### Base Path Handling

```typescript
// vite.config.ts
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/My-Love/' : '/',
  // ...
}));
```

This affects:

- Asset URLs (images, fonts, JS/CSS bundles)
- Service worker registration path (`/My-Love/sw.js`)
- Navigation URL generation in `NavigationSlice`

## Environment Variables

### Secrets Management: fnox with age provider

Secrets are managed by [fnox](https://fnox.jdx.dev) using the **age** encryption provider. Encrypted ciphertext is stored inline in `fnox.toml` (committed to git). Decryption uses age keys stored at `~/.age/key.txt` on each machine.

| Variable                                | Purpose                                       |
| --------------------------------------- | --------------------------------------------- |
| `VITE_SUPABASE_URL`                     | Supabase project URL                          |
| `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Supabase anon/public key                      |
| `SUPABASE_SERVICE_KEY`                  | Supabase service role key                     |
| `SENTRY_AUTH_TOKEN`                     | Sentry auth token (enables source map upload) |
| `SENTRY_ORG`                            | Sentry organization slug                      |
| `SENTRY_PROJECT`                        | Sentry project slug                           |
| `VITE_SENTRY_DSN`                       | Sentry DSN for error tracking                 |
| `SUPABASE_PAT`                          | Supabase Personal Access Token                |

Key commands:

- `fnox exec -- <command>` -- inject secrets and run
- `fnox set KEY "value"` -- encrypt and store a secret
- `fnox get KEY` -- decrypt and retrieve a secret
- `fnox check` -- verify all secrets resolve

### Test Variables

`.env.test` provides plain-text local Supabase values for E2E tests. Playwright config auto-detects local Supabase via `supabase status -o env` and re-signs JWT tokens with ES256 when GoTrue uses ES256 signing keys.

## CI/CD Workflows

Located in `.github/workflows/`:

| Workflow          | Trigger           | Purpose                           |
| ----------------- | ----------------- | --------------------------------- |
| `deploy.yml`      | Push to main      | Build and deploy to GitHub Pages  |
| `test.yml`        | PR / Push         | Run unit tests, lint, type check  |
| `migrations.yml`  | Migration changes | Validate Supabase migration files |
| `code-review.yml` | PR                | Automated code review             |

### Source Maps and Sentry

When `SENTRY_AUTH_TOKEN` is set in the environment, the build enables two additional features:

1. **Hidden source maps**: `sourcemap: 'hidden'` in `build` config generates source maps that are not referenced in the output bundles (invisible to browsers).
2. **Sentry upload**: `@sentry/vite-plugin` uploads the source maps to Sentry, then deletes the `.map` files from `dist/` to prevent public exposure.

```typescript
// vite.config.ts (conditional Sentry plugin)
...(process.env.SENTRY_AUTH_TOKEN
  ? [sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      release: { name: process.env.SENTRY_RELEASE },
      sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
      telemetry: false,
    })]
  : []),
```

When `SENTRY_AUTH_TOKEN` is absent (e.g., local development), source maps are disabled entirely (`sourcemap: false`).

## Bundle Splitting

Manual chunk splitting in `vite.config.ts` creates predictable cache keys:

```typescript
manualChunks: {
  'vendor-react': ['react', 'react-dom'],
  'vendor-supabase': ['@supabase/supabase-js'],
  'vendor-state': ['zustand', 'idb', 'zod'],
  'vendor-animation': ['framer-motion'],
  'vendor-icons': ['lucide-react'],
},
```

This keeps vendor library chunks stable across app code changes, improving cache hit rates on repeat visits.

## PWA Configuration

The `vite-plugin-pwa` configuration in `vite.config.ts`:

- **Strategy**: `injectManifest` (custom service worker in `src/sw.ts`)
- **Service Worker**: Compiled from `src/sw.ts`
- **Update**: Auto-reload on new version detection
- **Precache**: Only static assets (images, fonts, icons). JS/CSS are excluded from precache since they use `NetworkOnly` strategy in the service worker.
- **Navigation fallback**: `index.html` is added to the manifest with a timestamp revision to force SW update on every build.

The web app manifest includes:

```json
{
  "name": "My Love - Daily Reminders",
  "short_name": "My Love",
  "theme_color": "#FF6B9D",
  "background_color": "#FFE5EC",
  "display": "standalone",
  "orientation": "portrait",
  "start_url": "./",
  "scope": "./"
}
```

## Related Documentation

- [Service Worker Architecture](./10-service-worker.md)
- [Technology Stack](./02-technology-stack.md)
- [Performance](./18-performance.md)

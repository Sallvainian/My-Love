# Deployment

## Build Pipeline

### Production Build

```bash
npm run build
# Expands to: dotenvx run --overload -- bash -c 'tsc -b && vite build'
```

The build process:
1. **dotenvx** decrypts `.env` file using `.env.keys`
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

### Encrypted Variables

Uses [dotenvx](https://dotenvx.com) for encrypted `.env` files committed to git:

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Supabase anon/public key |

The `.env.keys` file contains the decryption key and is gitignored.

### Test Variables

`.env.test` provides plain-text local Supabase values for E2E tests. Playwright config auto-detects local Supabase via `supabase status -o env`.

## CI/CD Workflows

Located in `.github/workflows/`:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `deploy.yml` | Push to main | Build and deploy to GitHub Pages |
| `test.yml` | PR / Push | Run unit tests, lint, type check |
| `migrations.yml` | Migration changes | Validate Supabase migration files |
| `code-review.yml` | PR | Automated code review |

## PWA Configuration

The `vite-plugin-pwa` configuration in `vite.config.ts`:

- **Strategy**: `injectManifest` (custom service worker in `src/sw.ts`)
- **Service Worker**: Compiled from `src/sw.ts`
- **Update**: Auto-reload on new version detection

The web app manifest includes:
- App name, icons, theme color
- `display: standalone` for native-like experience
- `start_url: /My-Love/`

## Related Documentation

- [Service Worker Architecture](./10-service-worker.md)
- [Technology Stack](./02-technology-stack.md)

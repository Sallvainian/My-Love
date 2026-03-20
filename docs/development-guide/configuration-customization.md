# Configuration Customization

## APP_CONFIG

Edit `src/config/constants.ts` to personalize the app for your relationship:

```typescript
export const APP_CONFIG = {
  defaultPartnerName: 'Gracie', // Your partner's name, displayed throughout the app
  defaultStartDate: '2025-10-18', // Relationship start date (YYYY-MM-DD), used for duration counter
  isPreConfigured: true, // Always true since values are hardcoded
} as const;
```

Additional exports from this file:

```typescript
export const USER_ID = 'default-user' as const; // Single-user IndexedDB key
export const PARTNER_NAME = APP_CONFIG.defaultPartnerName; // Backward-compatible alias
```

After changing these values, rebuild and redeploy:

```bash
fnox exec -- npm run build
npm run deploy
```

## Vite Configuration

`vite.config.ts` controls the build pipeline, plugins, and code splitting.

### Base Path

```typescript
base: mode === 'production' ? '/My-Love/' : '/',
```

- **Development** (`npm run dev`): base path is `/`, so the app is at `http://localhost:5173/`.
- **Production** (`npm run build`): base path is `/My-Love/`, matching the GitHub Pages deployment at `https://sallvainian.github.io/My-Love/`.

If you deploy to a different URL, change the production base path accordingly.

### Manual Chunks (Code Splitting)

```typescript
manualChunks: {
  'vendor-react': ['react', 'react-dom'],
  'vendor-supabase': ['@supabase/supabase-js'],
  'vendor-state': ['zustand', 'idb', 'zod'],
  'vendor-animation': ['framer-motion'],
  'vendor-icons': ['lucide-react'],
},
```

This produces separate cached chunks for major dependencies, improving cache hit rates on repeat visits.

### Source Maps and Sentry

```typescript
sourcemap: process.env.SENTRY_AUTH_TOKEN ? 'hidden' : false,
```

Source maps are only generated when `SENTRY_AUTH_TOKEN` is present. When generated, they are uploaded to Sentry and deleted from the build output.

### Plugins

| Plugin                      | Purpose                                                                |
| --------------------------- | ---------------------------------------------------------------------- |
| `@vitejs/plugin-react`      | React Fast Refresh, JSX transform                                      |
| `vite-plugin-checker`       | TypeScript type checking overlay in the browser during development     |
| `vite-plugin-pwa` (VitePWA) | PWA manifest generation, service worker compilation via InjectManifest |
| `rollup-plugin-visualizer`  | Bundle size analysis output at `dist/stats.html`                       |
| `@sentry/vite-plugin`       | Source map upload to Sentry (conditional on `SENTRY_AUTH_TOKEN`)       |

### PWA Configuration

The VitePWA plugin is configured with `strategies: 'injectManifest'`, meaning the custom service worker at `src/sw.ts` controls all runtime caching. The plugin only handles precache manifest injection and manifest generation.

Key settings:

```typescript
VitePWA({
  registerType: 'autoUpdate',
  strategies: 'injectManifest',
  srcDir: 'src',
  filename: 'sw.ts',
  injectManifest: {
    globPatterns: ['**/*.{js,css,png,jpg,jpeg,svg,woff2,ico}'], // Precache JS, CSS, and static assets
    globIgnores: ['**/*.map', '**/*.html'], // Do NOT precache HTML or source maps
  },
  devOptions: { enabled: false }, // PWA disabled in development
});
```

HTML is intentionally excluded from precaching so that `PrecacheRoute` does not intercept navigation requests. Instead, the custom service worker (`src/sw.ts`) uses a `NavigationRoute` with `NetworkFirst` strategy (3-second timeout) to always attempt fetching fresh HTML from the network, preventing stale content after deployments.

## Tailwind Theme

`tailwind.config.js` extends the default Tailwind configuration with custom design tokens.

### Custom Color Palettes

Four themed palettes, each with shades from 50 to 900:

| Palette    | Primary Color | Hex (500) |
| ---------- | ------------- | --------- |
| `sunset`   | Rose red      | `#f43f5e` |
| `coral`    | Light salmon  | `#ffa07a` |
| `ocean`    | Teal          | `#14b8a6` |
| `lavender` | Purple        | `#a855f7` |
| `rose`     | Rose red      | `#f43f5e` |

Usage in components:

```html
<div class="bg-sunset-100 text-sunset-700">Sunset theme</div>
<div class="bg-ocean-500 text-white">Ocean theme</div>
```

### Custom Fonts

```typescript
fontFamily: {
  sans: ['Inter', 'system-ui', 'sans-serif'],
  serif: ['Playfair Display', 'serif'],
  cursive: ['Dancing Script', 'cursive'],
},
```

### Custom Animations

| Animation Class      | Description                 | Duration    |
| -------------------- | --------------------------- | ----------- |
| `animate-float`      | Vertical float (up-down)    | 3s infinite |
| `animate-fade-in`    | Opacity 0 to 1              | 0.5s        |
| `animate-scale-in`   | Scale 0.9 to 1 with fade    | 0.3s        |
| `animate-slide-up`   | Translate up 20px with fade | 0.4s        |
| `animate-pulse-slow` | Slow pulse                  | 3s infinite |
| `animate-heart-beat` | Heart beat scale            | 1s infinite |
| `animate-shimmer`    | Horizontal shimmer sweep    | 2s infinite |

## TypeScript Configuration

### Application Code (`tsconfig.app.json`)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noEmit": true,
    "verbatimModuleSyntax": true,
    "types": ["vite/client", "node"],
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts", "src/**/*.test.tsx", "src/**/__tests__/**"]
}
```

### Node Configuration (`tsconfig.node.json`)

Covers `vite.config.ts` and `vitest.config.ts` with ES2022 target.

### Test Configuration (`tsconfig.test.json`)

Extends `tsconfig.app.json` with relaxed unused variable checks and test-specific types (`vitest/globals`, `@testing-library/jest-dom/vitest`).

### Project References and `tsc -b`

The `tsconfig.json` root file defines three project references:

```json
{
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.test.json" }
  ]
}
```

The `npm run typecheck` script uses `tsc -b --force`, which checks all three project references in one invocation. The `-b` (build) flag enables project references mode, while `--force` ensures a complete rebuild (no incremental caching). This replaced the earlier `tsc --noEmit` approach.

The `npm run build` script uses `tsc -p tsconfig.app.json` to type-check only the application code before running `vite build`.

### Path Aliases

- **In application code**: `@/` maps to `src/` (configured in `tsconfig.app.json` via `paths`)
- **In tests**: `@/` maps to `src/` (configured in `vitest.config.ts` via the `resolve.alias` option)
- **Note**: The `@/` path alias is not configured in `vite.config.ts` itself -- only in `vitest.config.ts` for test resolution and `tsconfig.app.json` for TypeScript resolution. Vite resolves `@/` imports via TypeScript's `paths` configuration.

## PostCSS Configuration

`postcss.config.js` uses two plugins:

```javascript
export default {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
};
```

`@tailwindcss/postcss` is the Tailwind CSS v4 PostCSS plugin. `autoprefixer` adds vendor prefixes for broader browser compatibility.

## Performance Constants

`src/config/performance.ts` centralizes magic numbers for pagination, storage quotas, and validation limits:

| Category          | Constant                    | Value | Purpose                                     |
| ----------------- | --------------------------- | ----- | ------------------------------------------- |
| Pagination        | `DEFAULT_PAGE_SIZE`         | 20    | Default items per page (photos, messages)   |
| Pagination        | `MAX_PAGE_SIZE`             | 100   | Maximum page size                           |
| Storage Quotas    | `WARNING_THRESHOLD_PERCENT` | 80    | Display warning banner at this quota %      |
| Storage Quotas    | `ERROR_THRESHOLD_PERCENT`   | 95    | Block uploads at this quota %               |
| Storage Quotas    | `DEFAULT_QUOTA_MB`          | 50    | Fallback quota when Storage API unavailable |
| Validation Limits | `MESSAGE_TEXT_MAX_LENGTH`   | 1000  | Maximum message text length                 |
| Validation Limits | `CAPTION_MAX_LENGTH`        | 500   | Maximum photo caption length                |
| Validation Limits | `NOTE_MAX_LENGTH`           | 1000  | Maximum mood note length                    |
| Validation Limits | `PARTNER_NAME_MAX_LENGTH`   | 50    | Maximum partner name length                 |

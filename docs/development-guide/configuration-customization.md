# Configuration Customization

## APP_CONFIG

Edit `src/config/constants.ts` to personalize the app for your relationship:

```typescript
export const APP_CONFIG = {
  defaultPartnerName: 'Gracie',       // Your partner's name, displayed throughout the app
  defaultStartDate: '2025-10-18',     // Relationship start date (YYYY-MM-DD), used for duration counter
  isPreConfigured: true,              // Always true since values are hardcoded
} as const;
```

Additional exports from this file:

```typescript
export const USER_ID = 'default-user' as const;     // Single-user IndexedDB key
export const PARTNER_NAME = APP_CONFIG.defaultPartnerName; // Backward-compatible alias
```

After changing these values, rebuild and redeploy:

```bash
npm run build
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

### Plugins

| Plugin | Purpose |
|---|---|
| `@vitejs/plugin-react` | React Fast Refresh, JSX transform |
| `vite-plugin-checker` | TypeScript type checking overlay in the browser during development |
| `vite-plugin-pwa` (VitePWA) | PWA manifest generation, service worker compilation via InjectManifest |
| `rollup-plugin-visualizer` | Bundle size analysis output at `dist/stats.html` |

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
    globPatterns: ['**/*.{png,jpg,jpeg,svg,woff2,ico}'],  // Only precache static assets
    globIgnores: ['**/*.js', '**/*.css', '**/*.html'],     // Do NOT precache code
    additionalManifestEntries: [
      { url: 'index.html', revision: Date.now().toString() },  // Force SW update per build
    ],
  },
  devOptions: { enabled: false },  // PWA disabled in development
})
```

## Tailwind Theme

`tailwind.config.js` extends the default Tailwind configuration with custom design tokens.

### Custom Color Palettes

Four themed palettes, each with shades from 50 to 900:

| Palette | Primary Color | Hex (500) |
|---|---|---|
| `sunset` | Rose red | `#f43f5e` |
| `coral` | Light salmon | `#ffa07a` |
| `ocean` | Teal | `#14b8a6` |
| `lavender` | Purple | `#a855f7` |
| `rose` | Rose red | `#f43f5e` |

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

| Animation Class | Description | Duration |
|---|---|---|
| `animate-float` | Vertical float (up-down) | 3s infinite |
| `animate-fade-in` | Opacity 0 to 1 | 0.5s |
| `animate-scale-in` | Scale 0.9 to 1 with fade | 0.3s |
| `animate-slide-up` | Translate up 20px with fade | 0.4s |
| `animate-pulse-slow` | Slow pulse | 3s infinite |
| `animate-heart-beat` | Heart beat scale | 1s infinite |
| `animate-shimmer` | Horizontal shimmer sweep | 2s infinite |

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
    "types": ["vite/client", "node"]
  },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts", "src/**/*.test.tsx", "src/**/__tests__/**"]
}
```

### Node Configuration (`tsconfig.node.json`)

Covers `vite.config.ts` and `vitest.config.ts` with ES2022 target.

### Path Aliases

- **In tests**: `@/` maps to `src/` (configured in `vitest.config.ts` via the `resolve.alias` option)
- **In application code**: No path alias configured in `vite.config.ts`; use relative imports

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

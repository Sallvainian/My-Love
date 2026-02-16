# Technology Stack

## Runtime Dependencies

| Package | Version | Purpose |
|---|---|---|
| `react` | 19.2.4 | UI library with concurrent features, StrictMode |
| `react-dom` | 19.2.4 | DOM rendering for React |
| `zustand` | 5.0.11 | State management with slice pattern and persist middleware |
| `@supabase/supabase-js` | ^2.93.3 | Supabase client: auth, database, storage, realtime |
| `zod` | 4.3.6 | Runtime schema validation (uses `zod/v4` import path) |
| `idb` | 8.0.3 | Promise-based IndexedDB wrapper for offline storage |
| `framer-motion` | ^12.29.3 | Animation library; LazyMotion + domAnimation for tree-shaking |
| `lucide-react` | ^0.563.0 | Icon library, tree-shakeable SVG icons |
| `dompurify` | ^3.3.1 | HTML sanitization to prevent XSS |
| `react-window` | 2.2.6 | Virtualized list rendering for mood history timeline |
| `react-window-infinite-loader` | 2.0.1 | Infinite scroll integration with react-window |
| `workbox-window` | 7.4.0 | Service Worker registration and lifecycle management |

## Build and Development

| Package | Version | Purpose |
|---|---|---|
| `vite` | 7.3.1 | Build tool and development server |
| `typescript` | ~5.9.3 | Static type checking with strict mode |
| `tailwindcss` | ^4.1.17 | Utility-first CSS framework (v4 with `@import` syntax) |
| `@vitejs/plugin-react` | ^5.1.3 | React Fast Refresh for Vite HMR |
| `vite-plugin-pwa` | ^1.2.0 | PWA support with Workbox injectManifest strategy |
| `vite-plugin-checker` | ^0.12.0 | TypeScript overlay errors during development |
| `rollup-plugin-visualizer` | ^6.0.5 | Bundle size analysis (output: `dist/stats.html`) |
| `@dotenvx/dotenvx` | ^1.52.0 | Environment variable management with `--overload` support |
| `eslint` | ^9.39.2 | Linting with flat config |
| `prettier` | ^3.8.1 | Code formatting |
| `prettier-plugin-tailwindcss` | ^0.7.2 | Automatic Tailwind class sorting |
| `gh-pages` | ^6.3.0 | GitHub Pages deployment |
| `autoprefixer` | ^10.4.24 | CSS vendor prefixing |
| `postcss` | ^8.5.6 | CSS processing pipeline |

## Testing Stack

| Package | Version | Purpose |
|---|---|---|
| `vitest` | ^4.0.17 | Unit/integration test framework |
| `@vitest/coverage-v8` | ^4.0.18 | V8-based code coverage |
| `@vitest/ui` | ^4.0.17 | Visual test runner UI |
| `@testing-library/react` | ^16.3.2 | React component testing utilities |
| `@testing-library/user-event` | ^14.6.1 | User interaction simulation |
| `@testing-library/jest-dom` | ^6.9.1 | DOM assertion matchers |
| `@playwright/test` | ^1.58.2 | End-to-end testing with Chromium/Firefox/WebKit |
| `@axe-core/playwright` | ^4.11.1 | Automated accessibility testing |
| `happy-dom` | ^20.5.0 | Lightweight DOM for Vitest |
| `fake-indexeddb` | ^6.2.5 | IndexedDB mock for unit tests |
| `@faker-js/faker` | ^10.3.0 | Test data generation |
| `supabase` | ^2.76.3 | Supabase CLI for local dev, migrations, and pgTAP tests |
| `tdd-guard-vitest` | ^0.1.6 | TDD enforcement plugin |

## Service Worker Libraries (bundled into `sw.ts`)

| Package | Role |
|---|---|
| `workbox-precaching` | Precache static assets (images, fonts, icons) |
| `workbox-routing` | Route-based caching strategy dispatch |
| `workbox-strategies` | CacheFirst, NetworkFirst, NetworkOnly strategies |
| `workbox-expiration` | Cache entry TTL and max-entries limits |
| `workbox-cacheable-response` | Filter cacheable responses by status code |

## Vite Manual Chunks

Configured in `vite.config.ts` for optimized caching:

```typescript
manualChunks: {
  'vendor-react': ['react', 'react-dom'],
  'vendor-supabase': ['@supabase/supabase-js'],
  'vendor-state': ['zustand', 'idb', 'zod'],
  'vendor-animation': ['framer-motion'],
  'vendor-icons': ['lucide-react'],
}
```

## Key Version Notes

- **React 19**: StrictMode double-rendering handled with `useRef` initialization guards in `App.tsx`
- **Zod 4**: Uses `import { z } from 'zod/v4'` for the v4 API surface
- **Tailwind 4**: Uses `@import 'tailwindcss'` with `@config "../tailwind.config.js"` directive
- **TypeScript 5.9**: Strict mode enabled; `~5.9.3` pinning for stability
- **Node 24.13.0**: Required for development and CI

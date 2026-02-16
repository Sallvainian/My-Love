# Technology Stack at a Glance

## Runtime Dependencies

| Package | Version | Role |
|---|---|---|
| `react` | ^19.2.4 | UI framework |
| `react-dom` | ^19.2.4 | DOM renderer |
| `@supabase/supabase-js` | ^2.93.3 | Backend client (Auth, DB, Storage, Realtime) |
| `zustand` | ^5.0.11 | State management with persist middleware |
| `zod` | ^4.3.6 | Runtime validation (imported via `zod/v4`) |
| `idb` | ^8.0.3 | IndexedDB promise wrapper |
| `framer-motion` | ^12.29.3 | Animations with LazyMotion tree-shaking |
| `lucide-react` | ^0.563.0 | Icon library (tree-shakeable) |
| `dompurify` | ^3.3.1 | HTML sanitization |
| `react-window` | ^2.2.6 | Virtualized list rendering |
| `react-window-infinite-loader` | ^2.0.1 | Infinite scroll integration |
| `workbox-window` | ^7.4.0 | Service Worker registration |
| `eventsource` | ^4.1.0 | EventSource polyfill |

## Development Dependencies

### Build & Tooling

| Package | Version | Role |
|---|---|---|
| `vite` | ^7.3.1 | Build tool and dev server |
| `@vitejs/plugin-react` | ^5.1.3 | React Fast Refresh for Vite |
| `vite-plugin-pwa` | ^1.2.0 | PWA manifest + Service Worker injection |
| `vite-plugin-checker` | ^0.12.0 | TypeScript checking in dev overlay |
| `rollup-plugin-visualizer` | ^6.0.5 | Bundle size visualization |
| `typescript` | ~5.9.3 | Type system |
| `@dotenvx/dotenvx` | ^1.52.0 | Encrypted environment variables |

### CSS

| Package | Version | Role |
|---|---|---|
| `tailwindcss` | ^4.1.17 | Utility-first CSS framework |
| `@tailwindcss/postcss` | ^4.1.18 | PostCSS integration for Tailwind |
| `postcss` | ^8.5.6 | CSS processing pipeline |
| `autoprefixer` | ^10.4.24 | Vendor prefix automation |
| `prettier-plugin-tailwindcss` | ^0.7.2 | Tailwind class sorting in Prettier |

### Testing

| Package | Version | Role |
|---|---|---|
| `vitest` | ^4.0.17 | Unit test framework |
| `@vitest/coverage-v8` | ^4.0.18 | Code coverage |
| `@vitest/ui` | ^4.0.17 | Browser test UI |
| `@testing-library/react` | ^16.3.2 | React component testing utilities |
| `@testing-library/jest-dom` | ^6.9.1 | DOM assertion matchers |
| `@testing-library/user-event` | ^14.6.1 | User interaction simulation |
| `@playwright/test` | ^1.58.2 | E2E browser testing |
| `@axe-core/playwright` | ^4.11.1 | Accessibility testing |
| `@currents/playwright` | ^1.21.1 | Playwright CI parallelization |
| `@seontechnologies/playwright-utils` | ^3.13.1 | Playwright helper utilities |
| `@faker-js/faker` | ^10.3.0 | Test data generation |
| `fake-indexeddb` | ^6.2.5 | IndexedDB test mock |
| `happy-dom` | ^20.5.0 | Lightweight DOM implementation for tests |
| `tdd-guard-vitest` | ^0.1.6 | TDD workflow enforcement |

### Linting & Formatting

| Package | Version | Role |
|---|---|---|
| `eslint` | ^9.39.2 | Linting |
| `@eslint/js` | ^9.39.2 | ESLint flat config base |
| `typescript-eslint` | ^8.54.0 | TypeScript ESLint rules |
| `eslint-plugin-react-hooks` | ^7.0.1 | React hooks linting rules |
| `eslint-plugin-react-refresh` | ^0.5.0 | React refresh linting |
| `prettier` | ^3.8.1 | Code formatting |

### Type Definitions

| Package | Version | Role |
|---|---|---|
| `@types/react` | ^19.2.10 | React type definitions |
| `@types/react-dom` | ^19.2.3 | React DOM type definitions |
| `@types/react-window` | ^2.0.0 | react-window type definitions |
| `@types/dompurify` | ^3.2.0 | DOMPurify type definitions |
| `@types/node` | ^24.10.1 | Node.js type definitions |

### Deployment & Utilities

| Package | Version | Role |
|---|---|---|
| `gh-pages` | ^6.3.0 | GitHub Pages deployment |
| `supabase` | ^2.76.3 | Supabase CLI (migrations, local dev) |
| `tsx` | ^4.21.0 | TypeScript execution for scripts |
| `dotenv` | ^17.2.4 | Environment variable loading |
| `globals` | ^16.5.0 | Global variables for ESLint flat config |

## Overrides

```json
{
  "glob": "^12.0.0",
  "js-yaml": "^4.1.1",
  "tar": "^7.5.6"
}
```

These override transitive dependency versions for security patches.

## Browser Support

```json
"browserslist": [
  "defaults and supports es6-module",
  "maintained node versions"
]
```

Targets modern browsers with ES module support (no IE11, no legacy Safari).

## Node.js Version

The project targets Node.js 24.13.0 (as specified in the development environment).

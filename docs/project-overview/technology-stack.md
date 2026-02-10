# Technology Stack

## Runtime and Frameworks

| Technology | Version | Purpose |
|---|---|---|
| Node.js | 24.13.0 | Runtime (pinned via `.nvmrc`) |
| React | 19.2.4 | UI framework |
| React DOM | 19.2.4 | DOM rendering |
| TypeScript | ~5.9.3 | Static type checking (strict mode) |
| Vite | 7.3.1 | Build tool and dev server |
| Tailwind CSS | 4.1.17 | Utility-first CSS framework (v4) |
| PostCSS | 8.5.6 | CSS post-processing |
| Autoprefixer | 10.4.24 | Vendor prefix automation |

## State Management and Data

| Technology | Version | Purpose |
|---|---|---|
| Zustand | 5.0.11 | Client-side state management (10 slices) |
| Zod | 4.3.6 | Schema validation for forms and API responses |
| idb | 8.0.3 | IndexedDB wrapper (offline-first local storage) |
| @supabase/supabase-js | 2.93.3 | Supabase client SDK (auth, database, storage, realtime) |

## UI and Animation

| Technology | Version | Purpose |
|---|---|---|
| Framer Motion | 12.29.3 | Animation library |
| Lucide React | 0.563.0 | Icon library (tree-shakeable) |
| DOMPurify | 3.3.1 | HTML sanitization |
| react-window | 2.2.6 | Virtualized list rendering |
| react-window-infinite-loader | 2.0.1 | Infinite scroll for virtualized lists |

## PWA

| Technology | Version | Purpose |
|---|---|---|
| vite-plugin-pwa | 1.2.0 | PWA integration (InjectManifest strategy) |
| workbox-window | 7.4.0 | Service worker registration and lifecycle |

## Testing

| Technology | Version | Purpose |
|---|---|---|
| Vitest | 4.0.17 | Unit test runner |
| @vitest/coverage-v8 | 4.0.18 | Code coverage (V8 provider, 80% threshold) |
| @vitest/ui | 4.0.17 | Vitest interactive UI |
| happy-dom | 20.5.0 | DOM environment for unit tests |
| @testing-library/react | 16.3.2 | React component testing utilities |
| @testing-library/jest-dom | 6.9.1 | Custom DOM matchers |
| @testing-library/user-event | 14.6.1 | User interaction simulation |
| fake-indexeddb | 6.2.5 | IndexedDB mock for unit tests |
| Playwright | 1.58.2 | E2E browser testing |
| @seontechnologies/playwright-utils | 3.13.1 | Playwright fixture utilities (apiRequest, recurse, log, networkErrorMonitor) |
| @axe-core/playwright | 4.11.1 | Accessibility testing |
| @currents/playwright | 1.21.1 | Playwright cloud reporting (Currents.dev) |
| @faker-js/faker | 10.3.0 | Test data generation |
| tdd-guard-vitest | 0.1.6 | TDD guard reporter for Vitest |
| pgTAP (via Supabase CLI) | -- | Database unit testing |

## Developer Tooling

| Technology | Version | Purpose |
|---|---|---|
| ESLint | 9.39.2 | Linting (flat config format) |
| typescript-eslint | 8.54.0 | TypeScript ESLint rules |
| eslint-plugin-react-hooks | 7.0.1 | React hooks linting (including React 19 rules) |
| eslint-plugin-react-refresh | 0.5.0 | React Refresh HMR validation |
| Prettier | 3.8.1 | Code formatting |
| prettier-plugin-tailwindcss | 0.7.2 | Tailwind class sorting |
| @dotenvx/dotenvx | 1.52.0 | Encrypted environment variables |
| dotenv | 17.2.4 | Environment variable loading |
| vite-plugin-checker | 0.12.0 | Vite-integrated type checking |
| rollup-plugin-visualizer | 6.0.5 | Bundle analysis (generates dist/stats.html) |
| gh-pages | 6.3.0 | GitHub Pages deployment |
| tsx | 4.21.0 | TypeScript execution |
| Supabase CLI | 2.76.3 | Local Supabase development |

## Build Targets

| Setting | Value |
|---|---|
| ECMAScript Target | ES2022 |
| Module System | ESNext |
| Module Resolution | Bundler |
| JSX Transform | react-jsx |
| Strict Mode | Enabled |
| Browser Support | `defaults and supports es6-module` |
| Production Base Path | `/My-Love/` |
| Development Base Path | `/` |

## Package Manager

**npm** is the package manager for this project.

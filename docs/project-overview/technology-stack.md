# Technology Stack

My-Love is a Progressive Web App built with a modern TypeScript-first frontend stack, Supabase for the backend, Sentry for error tracking, and a comprehensive testing infrastructure.

## Runtime and Frameworks

| Technology   | Version | Purpose                                                                   |
| ------------ | ------- | ------------------------------------------------------------------------- |
| Node.js      | 24.13.0 | Runtime (pinned via `.mise.toml` managed by [mise](https://mise.jdx.dev)) |
| React        | 19.2.4  | UI framework                                                              |
| React DOM    | 19.2.4  | DOM rendering                                                             |
| TypeScript   | ~5.9.3  | Static type checking (strict mode enabled)                                |
| Vite         | 7.3.1   | Build tool and dev server                                                 |
| Tailwind CSS | 4.1.17  | Utility-first CSS framework (v4 with PostCSS integration)                 |
| PostCSS      | 8.5.6   | CSS post-processing                                                       |
| Autoprefixer | 10.4.27 | Vendor prefix automation                                                  |

**Why Vite?** Vite provides near-instant hot module replacement during development and fast production builds via Rollup. The project uses Vite's InjectManifest strategy for PWA service worker compilation, the `vite-plugin-checker` for in-browser TypeScript error overlays, and `rollup-plugin-visualizer` for bundle analysis.

**Why TypeScript strict mode?** The project enforces `"strict": true` in `tsconfig.app.json`, along with `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, and `verbatimModuleSyntax`. ESLint also enforces `@typescript-eslint/no-explicit-any` as an error globally.

**Why Tailwind CSS v4?** Tailwind v4 uses the CSS-based configuration approach via `@tailwindcss/postcss`. The project defines custom color themes (sunset, coral, ocean, lavender, rose), custom font families (Inter, Playfair Display, Dancing Script), and relationship-themed animations (heartBeat, float, shimmer) in `tailwind.config.js`.

## State Management and Data

| Technology            | Version | Purpose                                                 |
| --------------------- | ------- | ------------------------------------------------------- |
| Zustand               | 5.0.11  | Client-side state management (10-slice store pattern)   |
| Zod                   | 4.3.6   | Schema validation for forms and API responses           |
| idb                   | 8.0.3   | IndexedDB wrapper (offline-first local storage)         |
| @supabase/supabase-js | 2.97.0  | Supabase client SDK (auth, database, storage, realtime) |

**Why Zustand?** Zustand provides a lightweight, boilerplate-free store. The project uses the slice pattern with 10 slices composed into a single store (`useAppStore.ts`). State is persisted to `localStorage` via `zustand/persist` with custom serialization for `Map` objects.

**Why IndexedDB via idb?** The app follows an offline-first architecture. IndexedDB serves as the primary data store for moods, photos, and interactions. Entries are created with `synced: false` and synced to Supabase in the background.

## UI and Animation

| Technology                   | Version | Purpose                                                              |
| ---------------------------- | ------- | -------------------------------------------------------------------- |
| Framer Motion                | 12.34.3 | Animation library (lazy-loaded via `LazyMotion` with `domAnimation`) |
| Lucide React                 | 0.575.0 | Icon library (tree-shakeable)                                        |
| DOMPurify                    | 3.3.1   | HTML sanitization for user-generated content                         |
| react-window                 | 2.2.7   | Virtualized list rendering for photo gallery                         |
| react-window-infinite-loader | 2.0.1   | Infinite scroll for virtualized lists                                |

## Error Tracking

| Technology          | Version | Purpose                                                |
| ------------------- | ------- | ------------------------------------------------------ |
| @sentry/react       | 10.39.0 | Error tracking, performance monitoring, session replay |
| @sentry/vite-plugin | 5.0.0   | Source map upload to Sentry during production builds   |

**Why Sentry?** Added in Epic 4 hardening. Sentry captures unhandled exceptions, tracks error rates, and provides source-mapped stack traces in production. The Vite plugin uploads source maps during build and deletes them from `dist/` afterward so they are never deployed publicly. Sentry is initialized in `src/config/sentry.ts` and is a no-op when `VITE_SENTRY_DSN` is absent (safe for local development).

## PWA

| Technology      | Version | Purpose                                                       |
| --------------- | ------- | ------------------------------------------------------------- |
| vite-plugin-pwa | 1.2.0   | PWA integration (InjectManifest strategy with custom `sw.ts`) |
| workbox-window  | 7.4.0   | Service worker registration and lifecycle management          |

## Testing

| Technology                         | Version | Purpose                                                                           |
| ---------------------------------- | ------- | --------------------------------------------------------------------------------- |
| Vitest                             | 4.0.17  | Unit test runner                                                                  |
| @vitest/coverage-v8                | 4.0.18  | Code coverage (V8 provider, 80% threshold on lines/functions/branches/statements) |
| @vitest/ui                         | 4.0.17  | Vitest interactive browser UI                                                     |
| happy-dom                          | 20.7.0  | DOM environment for unit tests                                                    |
| @testing-library/react             | 16.3.2  | React component testing utilities                                                 |
| @testing-library/jest-dom          | 6.9.1   | Custom DOM matchers (`toBeInTheDocument`, `toHaveTextContent`, etc.)              |
| @testing-library/user-event        | 14.6.1  | User interaction simulation                                                       |
| fake-indexeddb                     | 6.2.5   | IndexedDB mock for unit tests                                                     |
| Playwright                         | 1.58.2  | E2E browser testing                                                               |
| @seontechnologies/playwright-utils | 3.14.0  | Playwright fixture utilities (apiRequest, recurse, log, networkErrorMonitor)      |
| @axe-core/playwright               | 4.11.1  | Accessibility testing integration                                                 |
| @faker-js/faker                    | 10.3.0  | Test data generation                                                              |
| tdd-guard-vitest                   | 0.1.6   | TDD enforcement reporter for Vitest                                               |
| pgTAP (via Supabase CLI)           | --      | Database unit testing                                                             |

## Developer Tooling

| Technology                  | Version | Purpose                                                                               |
| --------------------------- | ------- | ------------------------------------------------------------------------------------- |
| ESLint                      | 9.39.2  | Linting (flat config format, `eslint.config.js`)                                      |
| typescript-eslint           | 8.56.1  | TypeScript ESLint rules                                                               |
| eslint-plugin-react-hooks   | 7.0.1   | React hooks linting (including React 19 rules for `set-state-in-effect` and `purity`) |
| eslint-plugin-react-refresh | 0.5.2   | React Refresh HMR validation                                                          |
| Prettier                    | 3.8.1   | Code formatting                                                                       |
| prettier-plugin-tailwindcss | 0.7.2   | Tailwind class sorting                                                                |
| fnox (age provider)         | --      | Encrypted secrets management via [fnox](https://fnox.jdx.dev) with age encryption     |
| mise                        | --      | Tool version management (Node.js pinned in `.mise.toml`)                              |
| vite-plugin-checker         | 0.12.0  | Vite-integrated TypeScript type checking overlay                                      |
| rollup-plugin-visualizer    | 6.0.5   | Bundle analysis (generates `dist/stats.html` with gzip and brotli sizes)              |
| gh-pages                    | 6.3.0   | GitHub Pages deployment                                                               |
| tsx                         | 4.21.0  | TypeScript script execution                                                           |
| Supabase CLI                | 2.76.15 | Local Supabase development, migrations, type generation                               |

## Build Targets

| Setting                 | Value                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| ECMAScript Target       | ES2022                                                                                   |
| Module System           | ESNext                                                                                   |
| Module Resolution       | Bundler                                                                                  |
| JSX Transform           | react-jsx (React 19 automatic)                                                           |
| Strict Mode             | Enabled (`strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`) |
| Incremental Compilation | Enabled (`.tsbuildinfo` cached in `node_modules/.tmp/`)                                  |
| Browser Support         | `defaults and supports es6-module`                                                       |
| Production Base Path    | `/My-Love/`                                                                              |
| Development Base Path   | `/`                                                                                      |

## Vendor Chunk Strategy

Production builds split dependencies into independently cacheable chunks via `manualChunks` in `vite.config.ts`:

| Chunk Name         | Libraries               |
| ------------------ | ----------------------- |
| `vendor-react`     | `react`, `react-dom`    |
| `vendor-supabase`  | `@supabase/supabase-js` |
| `vendor-state`     | `zustand`, `idb`, `zod` |
| `vendor-animation` | `framer-motion`         |
| `vendor-icons`     | `lucide-react`          |

This ensures that updating application code does not invalidate cached vendor bundles.

## Package Manager

**npm** is the package manager for this project. The lock file is `package-lock.json`. Do not use yarn, pnpm, or bun.
